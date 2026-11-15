import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import {
  ActiveStrategySnapshot,
  BookingFormData,
  ClientData,
  PrimaryCategory,
  StrategyPathConfig,
  StrategyPathId,
} from './types';
import { ALL_PATHS } from './utils/constants';
import { formatBoundaryAwareFpl, getHouseholdSize, get100PercentFPL, isOutsideAcaEnrollmentWindow } from './utils/calculations';
import { SoundFX } from './utils/audio';

import { Header } from './components/Header';
import { DisclaimerModal } from './components/DisclaimerModal';
import { StepOneQuestion } from './components/StepOneQuestion';
import { StepTwoQuestionnaire } from './components/StepTwoQuestionnaire';
import { StrategyHub } from './components/StrategyHub';
import { BookingModal } from './components/BookingModal';
import { ToastNotification } from './components/ToastNotification';
import { AdvisoryDocModal } from './components/AdvisoryDocModal';
import { MedicaidModal } from './components/MedicaidModal';

export default function App() {
  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<PrimaryCategory | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [isWizardCompleted, setIsWizardCompleted] = useState<boolean>(false);

  const [clientData, setClientData] = useState<ClientData>({
    taxYear: '2027',
    tobacco: 'no',
    filingStatus: 'single',
    clientAge: 54,
    dependents: 0,
    preExisting: 'no',
    acaWindow: 'auto',
    selectedHealthCarrier: 'oscar',
    zipCode: '34994',
    householdSize: 1,
    grossAGI: 65000,
    liquidSavings: 15000,
    healthStatus: 'healthy',
    ownsBusiness: false,
    w2Employees: 0,
    employerGroup: 'no',
    active401k: false,
    hasTraditionalIraAnnuity: false,
    annuityType: 'none',
    annuityAnnualContribution: 0,
    dormantRetirement: 0,
    spouseDormantRetirement: 0,
    existingAnnuityCash: 0,
    spouseExistingAnnuityCash: 0,
    lifePolicyStatus: 'no',
    fpl100: 15960,
    fplPct: 407,
    isSelfEmployed: false,
    netSelfEmploymentProfit: 55000,
    spouseCoveredByPlan: false,
    policyGrossValue: 0,
    policyCostBasis: 30000,
    policyLoans: 5000,
    policySurrenderCharges: 2000,
    policyMonthlyPremium: 450,
  });

  const [eligiblePathIds, setEligiblePathIds] = useState<StrategyPathId[]>([]);
  const [activePathId, setActivePathId] = useState<StrategyPathId>('atlasbridge');
  const [activeStrategySnapshot, setActiveStrategySnapshot] = useState<ActiveStrategySnapshot | null>(null);

  // Booking & Document state
  const [isBookingOpen, setIsBookingOpen] = useState<boolean>(false);
  const [bookingResult, setBookingResult] = useState<BookingFormData | null>(null);
  const [showDocModal, setShowDocModal] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [showMedicaidModal, setShowMedicaidModal] = useState<boolean>(false);
  const [isMapsQuotaExceeded, setIsMapsQuotaExceeded] = useState<boolean>(false);

  const scrollToTopInstant = () => {
    const applyScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    applyScroll();
    window.requestAnimationFrame(applyScroll);
  };

  useEffect(() => {
    const handleQuotaExceeded = () => setIsMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  useEffect(() => {
    if (!isWizardCompleted || !isWizardOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsWizardOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWizardCompleted, isWizardOpen]);

  // Recalculate household and FPL on data change
  const handleClientDataUpdate = (updates: Partial<ClientData>) => {
    setClientData((prev) => {
      const merged = { ...prev, ...updates };
      const householdSize = getHouseholdSize(merged.filingStatus, merged.dependents);
      const fpl100 = get100PercentFPL(householdSize, merged.taxYear);
      const exactFplPct = fpl100 > 0 ? (merged.grossAGI / fpl100) * 100 : 0;
      const fplPct = formatBoundaryAwareFpl(exactFplPct);
      return {
        ...merged,
        householdSize,
        fpl100,
        fplPct,
      };
    });
  };

  const handleSelectPrimaryCategory = (category: PrimaryCategory) => {
    setSelectedCategory(category);
    setIsWizardOpen(true);
    scrollToTopInstant();
  };

  const handleEvaluateEligibility = () => {
    const currentHouseholdSize = getHouseholdSize(clientData.filingStatus, clientData.dependents);
    const currentFpl100 = get100PercentFPL(currentHouseholdSize, clientData.taxYear);
    const currentExactFplPct = currentFpl100 > 0 ? (clientData.grossAGI / currentFpl100) * 100 : 0;
    const currentFplPct = formatBoundaryAwareFpl(currentExactFplPct);

    const isHighIncome =
      (clientData.filingStatus === 'married' ? clientData.grossAGI > 200000 : clientData.grossAGI > 150000) ||
      currentExactFplPct > 500;
    const isOutsideWindow = isOutsideAcaEnrollmentWindow(clientData.acaWindow);
    const hasEmployerAffordable = clientData.employerGroup === 'yes_affordable';
    const isBusinessWithEmployees = Boolean(clientData.ownsBusiness && clientData.w2Employees >= 1);
    const hasDormantRolloverAssets =
      clientData.dormantRetirement > 0 || (clientData.spouseDormantRetirement || 0) > 0;
    const hasExistingAnnuityOrIraAssets = Boolean(
      clientData.hasTraditionalIraAnnuity ||
        (clientData.annuityType && !['none', 'no', 'neither'].includes(clientData.annuityType)) ||
        clientData.existingAnnuityCash > 0 ||
        (clientData.spouseExistingAnnuityCash || 0) > 0
    );
    const selfEmployedCanReachAca = Boolean(
      clientData.isSelfEmployed &&
        !hasEmployerAffordable &&
        !isOutsideWindow &&
        clientData.grossAGI <= 260000
    );

    let unlocked: StrategyPathId[] = [];

    if (selectedCategory === 'health') {
      if (isOutsideWindow) {
        unlocked.push('private_health');
        if (isBusinessWithEmployees) {
          unlocked.push('group');
        }
      } else if (hasEmployerAffordable) {
        if (clientData.healthStatus !== 'high') {
          unlocked.push('private_health');
        }
        if (isBusinessWithEmployees) {
          unlocked.push('group');
        }
        if (unlocked.length === 0) {
          unlocked.push('traditional_aca');
        }
      } else {
        if (!isHighIncome && currentExactFplPct <= 500) {
          unlocked.push('atlasbridge');
        }
        if (selfEmployedCanReachAca) {
          unlocked.push('self_employed_aca');
        }
        unlocked.push('traditional_aca');
        if (clientData.healthStatus === 'healthy' || clientData.healthStatus === 'moderate' || isHighIncome) {
          unlocked.push('private_health');
        }
        if (isBusinessWithEmployees) {
          unlocked.push('group');
        }
      }
    } else if (selectedCategory === 'life') {
      unlocked.push('life');
      if (clientData.lifePolicyStatus === 'perm_unwanted') {
        unlocked.push('unwanted_life', 'settlements');
      }
    } else if (selectedCategory === 'annuities') {
      unlocked.push('annuities');
      if (hasDormantRolloverAssets || hasExistingAnnuityOrIraAssets) {
        unlocked.push('rollovers');
      }
      if (clientData.lifePolicyStatus === 'perm_unwanted') {
        unlocked.push('unwanted_life');
      }
    } else if (selectedCategory === 'rollovers') {
      unlocked.push('rollovers', 'annuities');
      if (clientData.lifePolicyStatus === 'perm_unwanted') {
        unlocked.push('unwanted_life');
      }
    } else if (selectedCategory === 'unwanted_life') {
      unlocked.push('unwanted_life', 'annuities', 'settlements');
      if (hasDormantRolloverAssets) {
        unlocked.push('rollovers');
      }
    } else if (selectedCategory === 'settlements') {
      unlocked.push('settlements');
      if (clientData.lifePolicyStatus !== 'no') {
        unlocked.push('unwanted_life');
      }
    }

    if (unlocked.length === 0) {
      if (selectedCategory === 'health' || !selectedCategory) {
        unlocked.push(isOutsideWindow || isHighIncome ? 'private_health' : 'atlasbridge');
      } else {
        unlocked.push(selectedCategory);
      }
    }

    let primaryPathId: StrategyPathId =
      selectedCategory && selectedCategory !== 'health' ? selectedCategory : unlocked[0];
    if (selectedCategory === 'health') {
      if (isOutsideWindow || hasEmployerAffordable) {
        primaryPathId = unlocked[0];
      } else if (unlocked.includes('atlasbridge')) {
        primaryPathId = 'atlasbridge';
      } else if (unlocked.includes('self_employed_aca')) {
        primaryPathId = 'self_employed_aca';
      } else {
        primaryPathId = unlocked[0];
      }
    }

    // Ensure primary path is at index 0, followed strictly by qualified secondary paths
    unlocked = Array.from(new Set([primaryPathId, ...unlocked.filter((id) => id !== primaryPathId)]));

    setEligiblePathIds(unlocked);
    setActivePathId(primaryPathId);

    setIsWizardCompleted(true);
    setIsWizardOpen(false);
    setShowMedicaidModal(currentExactFplPct <= 138);
    SoundFX.playUnlock();

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.7 },
      });
    } catch {
      // ignore
    }

    // Always scroll back to the top on submit and profile resubmit
    scrollToTopInstant();
  };

  const handleRestart = () => {
    setSelectedCategory(null);
    setIsWizardOpen(false);
    setIsWizardCompleted(false);
    setEligiblePathIds([]);
    setActiveStrategySnapshot(null);
    scrollToTopInstant();
  };

  const handleBookingSuccess = (formData: BookingFormData) => {
    setBookingResult(formData);
    setIsBookingOpen(false);
    setShowToast(true);
    setShowDocModal(true);
    SoundFX.playUnlock();

    try {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }

    // Auto dismiss toast after 7 seconds
    setTimeout(() => {
      setShowToast(false);
    }, 7000);
  };

  const activePathConfig: StrategyPathConfig =
    ALL_PATHS.find((p) => p.id === activePathId) || ALL_PATHS[0];

  return (
    <div className="min-h-screen pb-20 antialiased selection:bg-blue-500 selection:text-white">
      {/* Toast Notification */}
      <ToastNotification isVisible={showToast} onDismiss={() => setShowToast(false)} />

      {/* Mandatory Initial Legal & Advisory Compliance Disclaimer Modal */}
      <DisclaimerModal isOpen={showDisclaimer} onAccept={() => setShowDisclaimer(false)} />

      {/* Google Maps Platform Quota Exceeded Notice */}
      {isMapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Header */}
      <Header
        taxYear={clientData.taxYear}
        isWizardCompleted={isWizardCompleted}
        isWizardOpen={isWizardOpen}
        onToggleQuestionnaire={() => setIsWizardOpen((prev) => !prev)}
        onRestartFlow={handleRestart}
      />

      {/* Slide-down Change Personal Info Drawer anchored below sticky header */}
      <AnimatePresence>
        {selectedCategory && isWizardCompleted && isWizardOpen && (
          <div className="fixed inset-x-0 top-20 bottom-0 z-40 flex flex-col">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsWizardOpen(false)}
              className="fixed inset-x-0 top-20 bottom-0 bg-navy-950/75 backdrop-blur-sm"
              aria-hidden="true"
            />
            <motion.div
              initial={{ y: '-100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-100%', opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 max-h-[calc(100vh-5.25rem)] overflow-y-auto border-b border-purple-500/40 bg-navy-950/95 shadow-2xl shadow-black/60"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
                <StepTwoQuestionnaire
                  selectedCategory={selectedCategory}
                  clientData={clientData}
                  onChangeClientData={handleClientDataUpdate}
                  onSubmit={handleEvaluateEligibility}
                  isDrawerMode
                  onCancelDrawer={() => setIsWizardOpen(false)}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8 space-y-8 sm:space-y-10">
        {/* STEP 1: The One Question Screen */}
        {!selectedCategory && !isWizardCompleted && (
          <StepOneQuestion onSelectCategory={handleSelectPrimaryCategory} />
        )}

        {/* STEP 2: Initial Onboarding View (Before Dashboard Unlock) */}
        {selectedCategory && !isWizardCompleted && isWizardOpen && (
          <StepTwoQuestionnaire
            selectedCategory={selectedCategory}
            clientData={clientData}
            onChangeClientData={handleClientDataUpdate}
            onSubmit={handleEvaluateEligibility}
          />
        )}

        {/* STEP 3: Unlocked Customized Strategy Suite */}
        {isWizardCompleted && (
          <StrategyHub
            clientData={clientData}
            eligiblePathIds={eligiblePathIds}
            activePathId={activePathId}
            onSelectPath={(pathId) => {
              setEligiblePathIds((prev) => (prev.includes(pathId) ? prev : [...prev, pathId]));
              setActivePathId(pathId);
              scrollToTopInstant();
            }}
            onChangeClientData={handleClientDataUpdate}
            onOpenBooking={() => setIsBookingOpen(true)}
            onUpdateStrategySnapshot={setActiveStrategySnapshot}
          />
        )}
      </main>

      {/* Booking Appointment Modal */}
      <BookingModal
        isOpen={isBookingOpen}
        activePath={activePathConfig}
        clientData={clientData}
        strategySnapshot={activeStrategySnapshot}
        onClose={() => setIsBookingOpen(false)}
        onBookingSuccess={handleBookingSuccess}
      />

      {/* 2-Page Strategy & IRS Compliance Document Modal */}
      <AdvisoryDocModal
        isOpen={showDocModal}
        bookingData={bookingResult}
        activePath={activePathConfig}
        clientData={clientData}
        onClose={() => setShowDocModal(false)}
      />

      {/* Potential Medicaid Eligibility Notice Modal */}
      <MedicaidModal
        isOpen={showMedicaidModal}
        clientData={clientData}
        onClose={() => setShowMedicaidModal(false)}
      />
    </div>
  );
}
