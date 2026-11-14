import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  useMapsLibrary,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import { HealthCarrierId, HealthCarrierInfo } from '../../types';
import { REGIONAL_HEALTH_CARRIERS } from '../../utils/constants';
import { SoundFX } from '../../utils/audio';

interface ProviderNetworkMapProps {
  zipCode: string;
  onChangeZipCode: (zip: string) => void;
  carrier: HealthCarrierInfo;
  onChangeCarrier: (carrierId: HealthCarrierId) => void;
  selectedTier: string;
  displayPlanName: string;
}

type FacilityCategory = 'all' | 'primary_care' | 'hospital' | 'urgent_care';
type SearchScope = 'carrier_aligned' | 'all_local';

interface ProviderPlaceItem {
  id: string;
  name: string;
  address: string;
  typeLabel: string;
  rating?: number | null;
  ratingCount?: number | null;
  phone?: string | null;
  mapsUri?: string | null;
  location: google.maps.LatLngLiteral;
  driveMinutes?: number | null;
  distanceMiles?: number | null;
  durationMs?: number | null;
  carrierAffiliated?: boolean;
}

const DEFAULT_STUART_CENTER: google.maps.LatLngLiteral = { lat: 27.1975, lng: -80.2528 };
const ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];
const MAX_DRIVE_MINUTES = 25;
const MAX_DRIVE_MS = MAX_DRIVE_MINUTES * 60 * 1000;
const CANDIDATE_BIAS_RADIUS_METERS = 32000; // ~20 mi radius to capture full 25-min driving catchment

function getTierDisplayLabel(selectedTier: string, displayPlanName: string): string {
  if (selectedTier === 'bronze') return 'Bronze Tier';
  if (selectedTier === 'silver') return 'Standard Silver (70% AV)';
  if (selectedTier === 'gold') return 'Gold Tier';
  return displayPlanName;
}

function resolveMapsApiKey(): string {
  const globalKey = (globalThis as unknown as { GOOGLE_MAPS_API_KEY?: string }).GOOGLE_MAPS_API_KEY;
  if (typeof globalKey === 'string' && globalKey.trim().length > 0) {
    return globalKey.trim();
  }
  const viteKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  return typeof viteKey === 'string' ? viteKey.trim() : '';
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const upper = msg.toUpperCase();
  return (
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('OVER_QUERY_LIMIT') ||
    upper.includes('429') ||
    upper.includes('QUOTA')
  );
}

function matchesCarrierBranding(placeName: string, carrierId: HealthCarrierId): boolean {
  const lower = placeName.toLowerCase();
  if (carrierId === 'aetna') {
    return lower.includes('cvs') || lower.includes('minuteclinic') || lower.includes('healthhub') || lower.includes('aetna');
  }
  if (carrierId === 'fl_blue') {
    return lower.includes('florida blue') || lower.includes('sanitas') || lower.includes('guidewell');
  }
  if (carrierId === 'fhcp') {
    return lower.includes('florida health care') || lower.includes('fhcp');
  }
  if (carrierId === 'uhc') {
    return lower.includes('unitedhealthcare') || lower.includes('optum');
  }
  if (carrierId === 'oscar') {
    return lower.includes('oscar') || lower.includes('cleveland clinic');
  }
  if (carrierId === 'ambetter') {
    return lower.includes('ambetter') || lower.includes('sunshine') || lower.includes('community health');
  }
  return false;
}

interface ProviderMarkerProps {
  provider: ProviderPlaceItem;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
  carrierName: string;
}

const ProviderMarker: React.FC<ProviderMarkerProps> = ({
  provider,
  index,
  isSelected,
  onSelect,
  onClose,
  carrierName,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={provider.location}
        title={provider.name}
        zIndex={isSelected ? 50 : provider.carrierAffiliated ? 20 : 10}
        onClick={() => {
          SoundFX.playClick();
          onSelect(provider.id);
        }}
      >
        <Pin
          background={isSelected ? '#f59e0b' : provider.carrierAffiliated ? '#059669' : '#2563eb'}
          borderColor={isSelected ? '#fef3c7' : provider.carrierAffiliated ? '#a7f3d0' : '#93c5fd'}
          glyphColor="#ffffff"
          scale={isSelected ? 1.2 : 1.0}
          glyphText={String(index + 1)}
        />
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} onCloseClick={onClose} maxWidth={285}>
          <div className="p-1 text-slate-900 space-y-1.5">
            <div className="font-bold text-xs leading-snug">{provider.name}</div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-medium text-blue-700">{provider.typeLabel}</span>
              {provider.driveMinutes != null && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 tabular-nums">
                  {provider.driveMinutes} min drive
                  {provider.distanceMiles != null ? ` · ${provider.distanceMiles} mi` : ''}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-600 leading-snug">{provider.address}</div>
            {provider.rating != null && (
              <div className="text-[11px] text-amber-700 font-semibold">
                ★ {provider.rating.toFixed(1)}
                {provider.ratingCount ? ` (${provider.ratingCount.toLocaleString()} reviews)` : ''}
              </div>
            )}
            {provider.phone && (
              <div className="text-[11px] text-slate-700">{provider.phone}</div>
            )}
            <div className="pt-1 border-t border-slate-200 flex items-center justify-between gap-2 text-[10.5px]">
              <span className="text-slate-500">Verify {carrierName} status</span>
              {provider.mapsUri && (
                <a
                  href={provider.mapsUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 font-semibold hover:underline shrink-0"
                >
                  Open in Maps →
                </a>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

interface InnerProviderMapProps {
  activeZip: string;
  carrier: HealthCarrierInfo;
  selectedTier: string;
  displayPlanName: string;
  facilityCategory: FacilityCategory;
  searchScope: SearchScope;
  providers: ProviderPlaceItem[];
  setProviders: React.Dispatch<React.SetStateAction<ProviderPlaceItem[]>>;
  selectedPlaceId: string | null;
  setSelectedPlaceId: React.Dispatch<React.SetStateAction<string | null>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  searchError: string | null;
  setSearchError: React.Dispatch<React.SetStateAction<string | null>>;
  fallbackNotice: string | null;
  setFallbackNotice: React.Dispatch<React.SetStateAction<string | null>>;
}

const InnerProviderMap: React.FC<InnerProviderMapProps> = ({
  activeZip,
  carrier,
  facilityCategory,
  searchScope,
  providers,
  setProviders,
  selectedPlaceId,
  setSelectedPlaceId,
  setIsLoading,
  setSearchError,
  setFallbackNotice,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const coreLib = useMapsLibrary('core');
  const routesLib = useMapsLibrary('routes');
  const apiStatus = useApiLoadingStatus();

  const runPlaceSearch = useCallback(async () => {
    if (!placesLib || !coreLib || !routesLib || !map) return;
    if (!/^\d{5}$/.test(activeZip)) {
      setSearchError('Enter a valid 5-digit US ZIP code to locate nearby care providers.');
      setProviders([]);
      return;
    }

    setIsLoading(true);
    setSearchError(null);
    setFallbackNotice(null);

    try {
      const { Place } = placesLib;
      const { LatLngBounds } = coreLib;
      const { RouteMatrix } = routesLib;

      // 1. Resolve target 5-digit ZIP center
      let zipCenter: google.maps.LatLngLiteral = DEFAULT_STUART_CENTER;
      let zipViewport: google.maps.LatLngBounds | null = null;

      try {
        const zipRes = await Place.searchByText({
          textQuery: `postal code ${activeZip}, United States`,
          fields: ['displayName', 'location', 'viewport'],
          region: 'us',
          language: 'en-US',
          maxResultCount: 1,
          internalUsageAttributionIds: ATTRIBUTION_IDS,
        });

        const zipPlace = zipRes.places?.[0];
        if (zipPlace?.location) {
          zipCenter = {
            lat: zipPlace.location.lat(),
            lng: zipPlace.location.lng(),
          };
        }
        if (zipPlace?.viewport) {
          zipViewport = zipPlace.viewport;
        }
      } catch (zipErr) {
        if (isQuotaError(zipErr)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          throw zipErr;
        }
      }

      // 2. Build facility-category + carrier-correlated Places API (New) queries within ~32km (~20mi)
      const categoryPhrase =
        facilityCategory === 'primary_care'
          ? 'primary care physician medical clinic'
          : facilityCategory === 'hospital'
          ? 'hospital medical center'
          : facilityCategory === 'urgent_care'
          ? 'urgent care walk-in clinic'
          : 'primary care clinic hospital urgent care';

      const fields = [
        'id',
        'displayName',
        'formattedAddress',
        'location',
        'rating',
        'userRatingCount',
        'primaryTypeDisplayName',
        'googleMapsURI',
        'nationalPhoneNumber',
      ];

      const circleBias: google.maps.CircleLiteral = {
        center: zipCenter,
        radius: CANDIDATE_BIAS_RADIUS_METERS,
      };

      const rawCandidates: Array<{ place: google.maps.places.Place; fromCarrierQuery: boolean }> = [];

      if (searchScope === 'carrier_aligned') {
        const carrierKeyword = carrier.carrierQueries?.[0] || carrier.name;
        const primaryQuery =
          facilityCategory === 'all'
            ? `${carrierKeyword} ${carrier.networkSearchHint} near ${activeZip}`
            : `${carrier.id === 'aetna' && facilityCategory === 'hospital' ? carrier.name : carrierKeyword} ${categoryPhrase} near ${activeZip}`;

        const regionalQuery =
          facilityCategory === 'all'
            ? `${carrier.carrierQueries?.[1] || categoryPhrase} near ${activeZip}`
            : `${categoryPhrase} near ${activeZip}`;

        const [carrierRes, regionalRes] = await Promise.allSettled([
          Place.searchByText({
            textQuery: primaryQuery,
            fields,
            locationBias: circleBias,
            region: 'us',
            language: 'en-US',
            maxResultCount: 20,
            internalUsageAttributionIds: ATTRIBUTION_IDS,
          }),
          Place.searchByText({
            textQuery: regionalQuery,
            fields,
            locationBias: circleBias,
            region: 'us',
            language: 'en-US',
            maxResultCount: 20,
            internalUsageAttributionIds: ATTRIBUTION_IDS,
          }),
        ]);

        if (carrierRes.status === 'rejected' && isQuotaError(carrierRes.reason)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          throw carrierRes.reason;
        }
        if (regionalRes.status === 'rejected' && isQuotaError(regionalRes.reason)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          throw regionalRes.reason;
        }

        if (carrierRes.status === 'fulfilled') {
          (carrierRes.value.places || []).forEach((place) =>
            rawCandidates.push({ place, fromCarrierQuery: true })
          );
        }
        if (regionalRes.status === 'fulfilled') {
          (regionalRes.value.places || []).forEach((place) =>
            rawCandidates.push({ place, fromCarrierQuery: false })
          );
        }
      } else {
        const broadRes = await Place.searchByText({
          textQuery: `${categoryPhrase} near ${activeZip}`,
          fields,
          locationBias: circleBias,
          region: 'us',
          language: 'en-US',
          maxResultCount: 20,
          internalUsageAttributionIds: ATTRIBUTION_IDS,
        });
        (broadRes.places || []).forEach((place) =>
          rawCandidates.push({ place, fromCarrierQuery: false })
        );
      }

      // Deduplicate Places by ID without using Map constructor (protected for GoogleMap collision)
      const seenPlaceIds: Record<string, boolean> = {};
      const candidateItems: ProviderPlaceItem[] = [];

      for (const entry of rawCandidates) {
        const p = entry.place;
        if (!p.id || !p.location || seenPlaceIds[p.id]) continue;
        seenPlaceIds[p.id] = true;

        const name = p.displayName || 'Healthcare Provider';
        const affiliated =
          matchesCarrierBranding(name, carrier.id) ||
          (entry.fromCarrierQuery && name.toLowerCase().includes(carrier.name.split(' ')[0].toLowerCase()));

        candidateItems.push({
          id: p.id,
          name,
          address: p.formattedAddress || `Near ZIP ${activeZip}`,
          typeLabel: p.primaryTypeDisplayName || 'Medical Facility',
          rating: p.rating ?? null,
          ratingCount: p.userRatingCount ?? null,
          phone: p.nationalPhoneNumber ?? null,
          mapsUri: p.googleMapsURI ?? null,
          location: {
            lat: p.location.lat(),
            lng: p.location.lng(),
          },
          carrierAffiliated: affiliated,
        });

        if (candidateItems.length >= 25) break;
      }

      // 3. Filter strictly to <= 25-minute drive from ZIP centroid via Routes API
      let finalProviders: ProviderPlaceItem[] = candidateItems;
      let routeMatrixNotice: string | null = null;

      if (candidateItems.length > 0 && RouteMatrix) {
        try {
          const matrixResponse = await RouteMatrix.computeRouteMatrix({
            origins: [zipCenter],
            destinations: candidateItems.map((item) => item.location),
            travelMode: 'DRIVING',
            routingPreference: 'TRAFFIC_AWARE',
            fields: ['durationMillis', 'distanceMeters', 'condition'],
            internalUsageAttributionIds: ATTRIBUTION_IDS,
          });

          const rowItems = matrixResponse.matrix?.rows?.[0]?.items || [];
          const withinDriveRadius: ProviderPlaceItem[] = [];

          candidateItems.forEach((item, idx) => {
            const routeItem = rowItems[idx];
            const durationMs = routeItem?.durationMillis;
            const routeValid =
              routeItem &&
              (routeItem.condition === 'ROUTE_EXISTS' || !routeItem.condition) &&
              typeof durationMs === 'number' &&
              Number.isFinite(durationMs);

            if (routeValid && durationMs <= MAX_DRIVE_MS) {
              const driveMinutes = Math.max(1, Math.round(durationMs / 60000));
              const distanceMeters = routeItem.distanceMeters;
              const distanceMiles =
                typeof distanceMeters === 'number' && Number.isFinite(distanceMeters)
                  ? Number((distanceMeters / 1609.344).toFixed(1))
                  : null;

              withinDriveRadius.push({
                ...item,
                driveMinutes,
                distanceMiles,
                durationMs,
              });
            }
          });

          if (withinDriveRadius.length > 0) {
            // Prioritize carrier-affiliated matches within 25 min, then fastest driving duration
            withinDriveRadius.sort((a, b) => {
              if (searchScope === 'carrier_aligned') {
                const affDiff = (b.carrierAffiliated ? 1 : 0) - (a.carrierAffiliated ? 1 : 0);
                if (affDiff !== 0) return affDiff;
              }
              return (a.durationMs ?? Number.MAX_SAFE_INTEGER) - (b.durationMs ?? Number.MAX_SAFE_INTEGER);
            });
            finalProviders = withinDriveRadius;
          } else if (rowItems.length > 0) {
            finalProviders = [];
            routeMatrixNotice = `No matching medical facilities found within a ${MAX_DRIVE_MINUTES}-minute drive of ZIP ${activeZip}. Try widening your category or ZIP code.`;
          }
        } catch (routeErr) {
          if (isQuotaError(routeErr)) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
            throw routeErr;
          }
          routeMatrixNotice = `Live driving-time filter is temporarily unavailable; displaying local facilities near ZIP ${activeZip}.`;
        }
      }

      if (searchScope === 'carrier_aligned' && finalProviders.length > 0) {
        const affiliatedCount = finalProviders.filter((p) => p.carrierAffiliated).length;
        if (affiliatedCount === 0 && !routeMatrixNotice) {
          routeMatrixNotice = `Showing ${finalProviders.length} care facilities within a ${MAX_DRIVE_MINUTES}-min drive of ${activeZip}. Confirm exact ${carrier.name} HIOS plan acceptance in their directory.`;
        }
      }

      setFallbackNotice(routeMatrixNotice);
      setProviders(finalProviders);
      setSelectedPlaceId(finalProviders[0]?.id ?? null);

      if (finalProviders.length > 0) {
        const bounds = new LatLngBounds();
        bounds.extend(zipCenter);
        finalProviders.forEach((item) => bounds.extend(item.location));
        map.fitBounds(bounds, 48);
      } else if (zipViewport) {
        map.fitBounds(zipViewport);
      } else {
        map.panTo(zipCenter);
        map.setZoom(11);
      }
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        setSearchError('Google Maps Platform quota limit reached while searching providers.');
      } else {
        setSearchError('Unable to load local providers for this ZIP code right now. Please try again.');
      }
      setProviders([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    activeZip,
    carrier.carrierQueries,
    carrier.id,
    carrier.name,
    carrier.networkSearchHint,
    coreLib,
    facilityCategory,
    map,
    placesLib,
    routesLib,
    searchScope,
    setFallbackNotice,
    setIsLoading,
    setProviders,
    setSearchError,
    setSelectedPlaceId,
  ]);

  useEffect(() => {
    void runPlaceSearch();
  }, [runPlaceSearch]);

  useEffect(() => {
    if (apiStatus === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  }, [apiStatus]);

  useEffect(() => {
    if (!map || !selectedPlaceId) return;
    const target = providers.find((p) => p.id === selectedPlaceId);
    if (target) {
      map.panTo(target.location);
    }
  }, [map, providers, selectedPlaceId]);

  if (apiStatus === APILoadingStatus.FAILED || apiStatus === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="w-full h-[360px] sm:h-[420px] rounded-xl border border-rose-500/40 bg-navy-900/90 flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-2">
          <i className="fa-solid fa-triangle-exclamation text-rose-400 text-2xl"></i>
          <div className="text-sm font-bold text-white">Google Maps Could Not Initialize</div>
          <p className="text-xs text-slate-300">
            Please verify that the Maps JavaScript API, Places API (New), and Routes API are active on your provisioned API key.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[360px] sm:h-[420px] rounded-xl overflow-hidden border border-navy-700/80 relative bg-navy-900">
      <GoogleMap
        defaultCenter={DEFAULT_STUART_CENTER}
        defaultZoom={11}
        mapId="DEMO_MAP_ID"
        gestureHandling="greedy"
        clickableIcons={false}
        internalUsageAttributionIds={ATTRIBUTION_IDS}
        onClick={() => setSelectedPlaceId(null)}
        style={{ width: '100%', height: '100%' }}
      >
        {providers.map((provider, idx) => (
          <ProviderMarker
            key={provider.id}
            provider={provider}
            index={idx}
            isSelected={selectedPlaceId === provider.id}
            onSelect={(id) => setSelectedPlaceId(id)}
            onClose={() => setSelectedPlaceId(null)}
            carrierName={carrier.name}
          />
        ))}
      </GoogleMap>
    </div>
  );
};

export const ProviderNetworkMap: React.FC<ProviderNetworkMapProps> = ({
  zipCode,
  onChangeZipCode,
  carrier,
  onChangeCarrier,
  selectedTier,
  displayPlanName,
}) => {
  const apiKey = useMemo(() => resolveMapsApiKey(), []);
  const [zipDraft, setZipDraft] = useState<string>(zipCode || '34994');
  const [activeZip, setActiveZip] = useState<string>(/^\d{5}$/.test(zipCode) ? zipCode : '34994');
  const [facilityCategory, setFacilityCategory] = useState<FacilityCategory>('all');
  const [searchScope, setSearchScope] = useState<SearchScope>('carrier_aligned');
  const [providers, setProviders] = useState<ProviderPlaceItem[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  useEffect(() => {
    setZipDraft(zipCode);
    if (/^\d{5}$/.test(zipCode)) {
      setActiveZip(zipCode);
    }
  }, [zipCode]);

  const tierLabel = getTierDisplayLabel(selectedTier, displayPlanName);

  const handleZipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = zipDraft.replace(/\D/g, '').slice(0, 5);
    setZipDraft(cleaned);
    if (/^\d{5}$/.test(cleaned)) {
      SoundFX.playClick();
      setActiveZip(cleaned);
      onChangeZipCode(cleaned);
      setSearchError(null);
    } else {
      setSearchError('Please enter a complete 5-digit US ZIP code (e.g., 34994).');
    }
  };

  return (
    <div className="pt-4 mt-2 border-t border-navy-800 space-y-4">
      {/* Toolbar: ZIP input, Carrier Switcher, Carrier Scope, Facility Filter, Official Directory Link */}
      <div className="flex flex-col gap-3 bg-navy-900/90 p-3.5 rounded-xl border border-blue-500/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <form onSubmit={handleZipSubmit} className="flex items-center gap-1.5">
              <label htmlFor="provider-map-zip" className="text-xs font-bold text-slate-300 whitespace-nowrap">
                ZIP:
              </label>
              <input
                id="provider-map-zip"
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={zipDraft}
                onChange={(e) => setZipDraft(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="34994"
                className="w-20 bg-navy-950 text-xs font-extrabold text-white px-2.5 py-1.5 rounded-lg border border-blue-500/40 focus:outline-none focus:border-blue-400 tabular-nums"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Update
              </button>
            </form>

            {/* In-Map Carrier Switcher (Two-way synced with Plan Category selector) */}
            <div className="flex items-center gap-1.5 bg-navy-950 px-2.5 py-1 rounded-lg border border-emerald-500/40">
              <label htmlFor="provider-map-carrier" className="text-[11px] font-bold text-emerald-300 whitespace-nowrap cursor-pointer">
                Carrier:
              </label>
              <select
                id="provider-map-carrier"
                value={carrier.id}
                onChange={(e) => {
                  SoundFX.playClick();
                  onChangeCarrier(e.target.value as HealthCarrierId);
                }}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer max-w-[175px] sm:max-w-[215px]"
              >
                {REGIONAL_HEALTH_CARRIERS.map((c) => (
                  <option key={c.id} value={c.id} className="bg-navy-900 text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Scope Toggle */}
            <div className="flex items-center gap-1 p-1 bg-navy-950 rounded-lg border border-navy-700">
              <button
                type="button"
                onClick={() => {
                  SoundFX.playClick();
                  setSearchScope('carrier_aligned');
                }}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  searchScope === 'carrier_aligned'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Carrier Match ({carrier.name.split(' ')[0]})
              </button>
              <button
                type="button"
                onClick={() => {
                  SoundFX.playClick();
                  setSearchScope('all_local');
                }}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  searchScope === 'all_local'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Nearby Care
              </button>
            </div>

            <a
              href={carrier.directoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
              Verify {carrier.name.split(' ')[0]} Network
            </a>
          </div>
        </div>

        {/* Facility Type Segmented Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-navy-800/80">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-navy-950 rounded-lg border border-navy-700">
            {(
              [
                { id: 'all', label: 'All Care' },
                { id: 'primary_care', label: 'Primary Care' },
                { id: 'hospital', label: 'Hospitals' },
                { id: 'urgent_care', label: 'Urgent Care' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  SoundFX.playClick();
                  setFacilityCategory(cat.id);
                }}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  facilityCategory === cat.id
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1.5">
            <i className="fa-solid fa-car-side text-emerald-400"></i>
            25-Minute Drive Catchment Active
          </span>
        </div>
      </div>

      {/* Accuracy & Tier Verification Context Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-300 bg-navy-900/60 px-3.5 py-2.5 rounded-lg border border-navy-800">
        <span>
          <strong className="text-white">ZIP {activeZip}</strong> · Live facilities within a{' '}
          <strong className="text-emerald-400">~{MAX_DRIVE_MINUTES}-min drive</strong> for{' '}
          <strong className="text-blue-400">{carrier.name}</strong> ({tierLabel}).
        </span>
        <span className="text-slate-400 shrink-0">
          Confirm exact HIOS plan-ID acceptance via carrier directory before enrolling.
        </span>
      </div>

      {fallbackNotice && (
        <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3.5 py-2 rounded-lg flex items-center gap-2">
          <i className="fa-solid fa-circle-info text-amber-400 shrink-0"></i>
          <span>{fallbackNotice}</span>
        </div>
      )}

      {searchError && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 rounded-lg flex items-center gap-2">
          <i className="fa-solid fa-triangle-exclamation text-rose-400 shrink-0"></i>
          <span>{searchError}</span>
        </div>
      )}

      {!apiKey ? (
        <div className="w-full p-6 rounded-xl border border-amber-500/40 bg-navy-900/90 text-center space-y-2">
          <i className="fa-solid fa-key text-amber-400 text-xl"></i>
          <div className="text-sm font-bold text-white">Google Maps API Key Required</div>
          <p className="text-xs text-slate-300 max-w-lg mx-auto">
            No Google Maps API key is currently detected in the environment. Configure{' '}
            <code className="text-amber-300">VITE_GOOGLE_MAPS_API_KEY</code> or complete the Google Maps setup prompt, then restart the dev server.
          </p>
        </div>
      ) : (
        <APIProvider apiKey={apiKey} version="weekly" language="en" region="US" libraries={['places', 'marker', 'core', 'routes']}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Scrollable Verified Provider List */}
            <div className="lg:col-span-5 bg-navy-900/80 rounded-xl border border-navy-700/80 p-3 flex flex-col h-[360px] sm:h-[420px]">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-navy-800 text-xs">
                <span className="font-bold text-white">
                  Providers ≤ 25 Min Drive ({providers.length})
                </span>
                <span className="text-[10.5px] text-slate-400 tabular-nums">
                  ZIP {activeZip}
                </span>
              </div>

              {isLoading ? (
                <div className="flex-1 space-y-2.5 overflow-hidden">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="p-3 rounded-lg bg-navy-950/80 border border-navy-800 animate-pulse space-y-2">
                      <div className="h-3.5 bg-navy-800 rounded w-3/4"></div>
                      <div className="h-2.5 bg-navy-800 rounded w-1/2"></div>
                      <div className="h-2.5 bg-navy-800 rounded w-5/6"></div>
                    </div>
                  ))}
                </div>
              ) : providers.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-2">
                  <i className="fa-solid fa-hospital-user text-slate-500 text-2xl"></i>
                  <div className="text-xs font-bold text-slate-300">No Facilities Within 25 Min</div>
                  <p className="text-[11px] text-slate-400">
                    Try switching to &ldquo;All Nearby Care&rdquo;, selecting &ldquo;All Care&rdquo;, or updating your 5-digit ZIP code above.
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {providers.map((provider, idx) => {
                    const active = selectedPlaceId === provider.id;
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => {
                          SoundFX.playClick();
                          setSelectedPlaceId(provider.id);
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer space-y-1 ${
                          active
                            ? 'bg-blue-950/60 border-gold-500/70'
                            : 'bg-navy-950/80 border-navy-800 hover:border-blue-500/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-white leading-snug">
                            <span className="text-blue-400 mr-1.5 tabular-nums">{idx + 1}.</span>
                            {provider.name}
                          </span>
                          {provider.rating != null && (
                            <span className="text-[10.5px] font-bold text-amber-400 shrink-0 tabular-nums">
                              ★ {provider.rating.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10.5px]">
                          <span className="text-emerald-400 font-semibold">{provider.typeLabel}</span>
                          {provider.driveMinutes != null && (
                            <span className="text-blue-300 font-semibold tabular-nums">
                              ~{provider.driveMinutes} min drive
                              {provider.distanceMiles != null ? ` · ${provider.distanceMiles} mi` : ''}
                            </span>
                          )}
                        </div>
                        {provider.carrierAffiliated && (
                          <div className="text-[10px] font-bold text-emerald-300">
                            ● {carrier.name.split(' ')[0]} Affiliated Facility
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400 leading-snug">
                          {provider.address}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Interactive Google Map Canvas */}
            <div className="lg:col-span-7">
              <InnerProviderMap
                activeZip={activeZip}
                carrier={carrier}
                selectedTier={selectedTier}
                displayPlanName={displayPlanName}
                facilityCategory={facilityCategory}
                searchScope={searchScope}
                providers={providers}
                setProviders={setProviders}
                selectedPlaceId={selectedPlaceId}
                setSelectedPlaceId={setSelectedPlaceId}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                searchError={searchError}
                setSearchError={setSearchError}
                fallbackNotice={fallbackNotice}
                setFallbackNotice={setFallbackNotice}
              />
            </div>
          </div>
        </APIProvider>
      )}
    </div>
  );
};
