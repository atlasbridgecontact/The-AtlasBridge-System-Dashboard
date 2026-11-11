import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  BookingFormData,
  ClientData,
  PrimaryCategory,
  StrategyPathConfig,
  StrategyPathId,
} from './types';
import { ALL_PATHS } from './utils/constants';
import { getHouseholdSize, get100PercentFPL, isOutsideAcaEnrollmentWindow } from './utils/calculations';
import { SoundFX } from './utils/audio';

import { Header } from './components/Header';
import { DisclaimerModal } from './components/DisclaimerModal';
import { StepOneQuestion } from './components/StepOneQuestion';
import { StepTwoQuestionnaire } from './components/StepTwoQuestionnaire';
import { StrategyHub } from './components/StrategyHub';
import { BookingModal } from './components/BookingModal';
import { ToastNotification } from './components/ToastNotification';
import { AdvisoryDocModal } from './components/AdvisoryDocModal';

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
    policyGrossValue: 0,
    policyCostBasis: 30000,
    policyLoans: 5000,
    policySurrenderCharges: 2000,
    policyMonthlyPremium: 450,
  });

  const [eligiblePathIds, setEligiblePathIds] = useState<StrategyPathId[]>([]);
  const [activePathId, setActivePathId] = useState<StrategyPathId>('atlasbridge');

  // Booking & Document state
  const [isBookingOpen, setIsBookingOpen] = useState<boolean>(false);
  const [bookingResult, setBookingResult] = useState<BookingFormData | null>(null);
  const [showDocModal, setShowDocModal] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);

  // Recalculate household and FPL on data change
  const handleClientDataUpdate = (updates: Partial<ClientData>) => {
    setClientData((prev) => {
      const merged = { ...prev, ...updates };
      const householdSize = getHouseholdSize(merged.filingStatus, merged.dependents);
      const fpl100 = get100PercentFPL(householdSize);
      const fplPct = Math.round((merged.grossAGI / fpl100) * 100);
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
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const handleEvaluateEligibility = () => {
    const isHighIncome =
      (clientData.filingStatus === 'married' ? clientData.grossAGI > 200000 : clientData.grossAGI > 150000) ||
      clientData.fplPct > 500;
    const isOutsideWindow = isOutsideAcaEnrollmentWindow(clientData.acaWindow);
    const hasRetirementOrIra =
      clientData.active401k ||
      clientData.hasTraditionalIraAnnuity ||
      clientData.annuityType === 'yes' ||
      clientData.dormantRetirement > 0 ||
      clientData.annuityAnnualContribution > 0;

    let unlocked: StrategyPathId[] = [];

    if (selectedCategory === 'unwanted_life') {
      unlocked.push('unwanted_life', 'annuities', 'rollovers');
    } else if (selectedCategory === 'health') {
      if (isOutsideWindow) {
        unlocked.push('private_health', 'traditional_aca');
      } else {
        if (!isHighIncome && clientData.employerGroup !== 'yes_affordable' && clientData.fplPct <= 500) {
          unlocked.push('atlasbridge');
        }
        if (clientData.employerGroup !== 'yes_affordable') {
          unlocked.push('traditional_aca');
        }
        if (clientData.healthStatus === 'healthy' || clientData.healthStatus === 'moderate' || isHighIncome) {
          unlocked.push('private_health');
        }
      }
      if (clientData.ownsBusiness || clientData.w2Employees >= 1) {
        unlocked.push('group');
      }
    } else if (selectedCategory === 'life') {
      unlocked.push('life');
      if (clientData.lifePolicyStatus !== 'no') {
        unlocked.push('unwanted_life');
      }
    } else if (selectedCategory === 'annuities') {
      unlocked.push('annuities');
      if (clientData.lifePolicyStatus !== 'no') {
        unlocked.push('unwanted_life');
      }
    } else if (selectedCategory === 'rollovers') {
      unlocked.push('rollovers');
      if (clientData.lifePolicyStatus !== 'no') {
        unlocked.push('unwanted_life');
      }
    } else if (selectedCategory === 'settlements') {
      if (clientData.lifePolicyStatus !== 'no') {
        unlocked.push('settlements', 'unwanted_life');
      } else {
        unlocked.push('settlements');
      }
    }

    // Existing retirement/IRAs: Ensure client is NEVER disqualified from The AtlasBridge System;
    // recommend AtlasBridge System in these cases alongside rollovers/annuities
    if (hasRetirementOrIra) {
      if (!unlocked.includes('atlasbridge')) {
        unlocked.unshift('atlasbridge');
      }
      if (!unlocked.includes('rollovers') && selectedCategory !== 'unwanted_life') {
        unlocked.push('rollovers');
      }
      if (!unlocked.includes('annuities') && selectedCategory !== 'unwanted_life') {
        unlocked.push('annuities');
      }
    }

    if (clientData.lifePolicyStatus === 'no' && selectedCategory !== 'unwanted_life') {
      unlocked = unlocked.filter((id) => id !== 'unwanted_life' && id !== 'settlements');
    }

    if (unlocked.length === 0) {
      if (selectedCategory === 'unwanted_life') unlocked.push('unwanted_life');
      else if (selectedCategory === 'life') unlocked.push('life');
      else if (isOutsideWindow) unlocked.push('private_health');
      else if (isHighIncome) unlocked.push('private_health', 'traditional_aca');
      else unlocked.push('atlasbridge');
    }

    const primaryPathId: StrategyPathId = selectedCategory === 'health' ? 'atlasbridge' : (selectedCategory || 'atlasbridge');
    // Ensure primary path is at index 0, followed by other eligible options
    unlocked = [primaryPathId, ...unlocked.filter((id) => id !== primaryPathId)];
    unlocked = Array.from(new Set(unlocked));

    setEligiblePathIds(unlocked);
    setActivePathId(primaryPathId);

    setIsWizardCompleted(true);
    setIsWizardOpen(false);
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

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const handleRestart = () => {
    setSelectedCategory(null);
    setIsWizardOpen(false);
    setIsWizardCompleted(false);
    setEligiblePathIds([]);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
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

      {/* Header */}
      <Header
        taxYear={clientData.taxYear}
        isWizardCompleted={isWizardCompleted}
        onToggleQuestionnaire={() => setIsWizardOpen(!isWizardOpen)}
        onRestartFlow={handleRestart}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8 space-y-8 sm:space-y-10">
        {/* STEP 1: The One Question Screen */}
        {!selectedCategory && !isWizardCompleted && (
          <StepOneQuestion onSelectCategory={handleSelectPrimaryCategory} />
        )}

        {/* STEP 2: Diagnostic Onboarding / Eligibility Questions */}
        {selectedCategory && isWizardOpen && (
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
              setActivePathId(pathId);
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
              document.documentElement.scrollTop = 0;
              document.body.scrollTop = 0;
            }}
            onChangeClientData={handleClientDataUpdate}
            onOpenBooking={() => setIsBookingOpen(true)}
          />
        )}
      </main>

      {/* Booking Appointment Modal */}
      <BookingModal
        isOpen={isBookingOpen}
        activePath={activePathConfig}
        clientData={clientData}
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
    </div>
  );
}
