/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { APP_CONFIG } from './config.ts';
import { CityOutlook, ModelFileConfig, RawCityData, SchoolPolicyConfig, WorkbenchEvaluationOutput } from './types.ts';
import { DEFAULT_UNCONFIGURED_POLICY, validateSchoolPolicy } from './schoolPolicy.ts';
import { DataFetchStatus, getCityOutlooks } from './dataService.ts';
import { Sidebar, ScreenId } from './components/Sidebar.tsx';
import { MobileNav } from './components/MobileNav.tsx';
import { TopHeader } from './components/TopHeader.tsx';
import { Banners } from './components/Banners.tsx';
import { DisclaimerBar } from './components/DisclaimerBar.tsx';
import { Footer } from './components/Footer.tsx';
import { HomeScreen } from './components/HomeScreen.tsx';
import { MapScreen } from './components/MapScreen.tsx';
import { SchoolModeScreen } from './components/SchoolModeScreen.tsx';
import { HowItWorksScreen } from './components/HowItWorksScreen.tsx';
import { AccuracyScreen } from './components/AccuracyScreen.tsx';
import { TestView } from './components/TestView.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { NotificationsModal } from './components/NotificationsModal.tsx';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('map');
  const [viewMode, setViewMode] = useState<'now' | 'highest12h'>('now');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const [selectedCityId, setSelectedCityId] = useState<string>(() => {
    try {
      return localStorage.getItem('dustwatch_city') || APP_CONFIG.defaultSelectedCityId;
    } catch {
      return APP_CONFIG.defaultSelectedCityId;
    }
  });

  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dustwatch_demo') === 'true';
    } catch {
      return false;
    }
  });

  const [outlooks, setOutlooks] = useState<Record<string, CityOutlook>>({});
  const [rawCityData, setRawCityData] = useState<Record<string, RawCityData>>({});
  const [status, setStatus] = useState<DataFetchStatus>({
    isLoading: true,
    isError: false,
    isDemoMode: false,
    isSnapshotLoaded: false,
    hasLiveCache: false,
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeModel, setActiveModel] = useState<ModelFileConfig | null>(null);
  const [workbenchAccuracyData, setWorkbenchAccuracyData] = useState<WorkbenchEvaluationOutput | null>(null);
  const [schoolPolicy, setSchoolPolicy] = useState<SchoolPolicyConfig>(() => {
    try {
      const saved = localStorage.getItem('dustwatch_school_policy');
      if (saved) return validateSchoolPolicy(JSON.parse(saved));
    } catch {
      // ignore
    }
    return DEFAULT_UNCONFIGURED_POLICY;
  });

  const handleSendToAccuracyChecker = useCallback((output: WorkbenchEvaluationOutput) => {
    setWorkbenchAccuracyData(output);
    setActiveScreen('accuracy');
  }, []);

  // Save selected city safely
  const handleSelectCity = useCallback((cityId: string) => {
    setSelectedCityId(cityId);
    try {
      localStorage.setItem('dustwatch_city', cityId);
    } catch {
      // Storage unavailable, ignore safely
    }
  }, []);

  // Toggle demo mode safely
  const handleToggleDemoMode = useCallback(() => {
    setIsDemoMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('dustwatch_demo', String(next));
      } catch {
        // Storage unavailable, ignore safely
      }
      return next;
    });
  }, []);

  // Fetch or refresh data
  const loadData = useCallback(
    async (forceRefresh: boolean = false) => {
      setIsRefreshing(true);
      try {
        const result = await getCityOutlooks(isDemoMode, forceRefresh, activeModel);
        setOutlooks(result.outlooks);
        setRawCityData(result.rawCityData);
        setStatus(result.status);
      } catch (err) {
        console.error('Fatal loadData error:', err);
      } finally {
        setIsRefreshing(false);
      }
    },
    [isDemoMode, activeModel]
  );

  // Initial load and when demo mode or model changes
  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Automatic refresh every 30 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      loadData(true);
    }, APP_CONFIG.autoRefreshIntervalMs);

    return () => clearInterval(timer);
  }, [loadData]);

  const lastUpdatedFormatted =
    status.lastFetchTimeFormatted ||
    status.lastLiveFetchTime ||
    'Updating...';

  // Count active atmospheric alerts across stations
  // Open navigation across all views
  const handleSelectScreen = useCallback((targetScreen: ScreenId) => {
    setActiveScreen(targetScreen);
  }, []);

  // Direct URL hash navigation support
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash.replace('#', '');
      const validScreens: ScreenId[] = [
        'home',
        'map',
        'school-mode',
        'how-it-works',
        'accuracy',
        'test-view',
      ];
      if (validScreens.includes(hash as ScreenId)) {
        setActiveScreen(hash as ScreenId);
      }
    };

    window.addEventListener('hashchange', checkHash);
    checkHash();
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const unreadNotificationsCount = Object.values(outlooks).filter(
    (o) =>
      o.levelNow === 'High' ||
      o.levelNow === 'Very High' ||
      o.peakLevel === 'High' ||
      o.peakLevel === 'Very High'
  ).length;

  return (
    <div className="min-h-screen bg-[#F7F1E8] dark:bg-[#101820] text-[#2D221C] dark:text-[#F4F6F8] p-0 sm:p-5 lg:p-6 flex flex-col justify-between print:p-0 print:m-0 print:bg-white print:min-h-0 transition-colors duration-200">
      {/* Prominent Data Status Banners (Offline/Fallback) */}
      <div className="max-w-[1680px] w-full mx-auto px-3 sm:px-0 mb-2 sm:mb-3 print:hidden">
        <Banners status={status} />
      </div>

      {/* Large Rounded Warm-White Dashboard Frame */}
      <div className="max-w-[1680px] w-full mx-auto bg-[#FFFDF8] dark:bg-[#18242E] rounded-none sm:rounded-[32px] lg:rounded-[36px] border-0 sm:border border-[#E7DDD0] dark:border-[#2B3D4A] shadow-none sm:shadow-[0_16px_50px_-20px_rgba(36,76,59,0.09)] dark:shadow-[0_16px_50px_-20px_rgba(0,0,0,0.5)] flex flex-col md:flex-row overflow-visible md:overflow-hidden flex-1 mb-16 sm:mb-20 print:m-0 print:p-0 print:border-none print:shadow-none print:overflow-visible print:bg-transparent transition-colors duration-200">
        {/* Mobile-Only Top Navigation (< md) */}
        <MobileNav
          activeScreen={activeScreen}
          onSelectScreen={handleSelectScreen}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          isDemoMode={isDemoMode}
          onToggleDemoMode={handleToggleDemoMode}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          unreadNotificationsCount={unreadNotificationsCount}
          onRefresh={() => loadData(true)}
          isRefreshing={isRefreshing}
          lastUpdatedFormatted={lastUpdatedFormatted}
          selectedCityId={selectedCityId}
          onSelectCity={handleSelectCity}
        />

        {/* Slim Deep Forest Icon Sidebar (Desktop & Tablet: >= md) */}
        <Sidebar
          activeScreen={activeScreen}
          onSelectScreen={handleSelectScreen}
          isDemoMode={isDemoMode}
          onToggleDemoMode={handleToggleDemoMode}
          onOpenSettings={() => setIsSettingsOpen(true)}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
        />

        {/* Main Dashboard Canvas */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#FFFDF8] dark:bg-[#18242E] print:bg-transparent print:overflow-visible transition-colors duration-200">
          {/* Top Header */}
          <div className="print:hidden">
            <TopHeader
              activeScreen={activeScreen}
              selectedCityId={selectedCityId}
              onSelectCity={handleSelectCity}
              outlooks={outlooks}
              viewMode={viewMode}
              onChangeViewMode={setViewMode}
              lastUpdatedFormatted={lastUpdatedFormatted}
              isRefreshing={isRefreshing}
              onRefresh={() => loadData(true)}
              isDemoMode={isDemoMode}
              onToggleDemoMode={handleToggleDemoMode}
              onOpenNotifications={() => setIsNotificationsOpen(true)}
              unreadNotificationsCount={unreadNotificationsCount}
              onSelectScreen={handleSelectScreen}
            />
          </div>

          {/* Active Screen Workspace */}
          <main className="flex-1 p-3.5 sm:p-6 lg:p-7 overflow-x-hidden print:p-0 print:m-0 print:overflow-visible">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeScreen}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: shouldReduceMotion ? 0.01 : 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                {activeScreen === 'home' && (
                  <HomeScreen
                    outlooks={outlooks}
                    onSelectScreen={handleSelectScreen}
                    onSelectCity={handleSelectCity}
                    lastUpdatedFormatted={lastUpdatedFormatted}
                  />
                )}

                {activeScreen === 'map' && (
                  <MapScreen
                    outlooks={outlooks}
                    selectedCityId={selectedCityId}
                    onSelectCity={handleSelectCity}
                    lastUpdatedFormatted={lastUpdatedFormatted}
                    isDemoMode={isDemoMode}
                    onRefresh={() => loadData(true)}
                    isRefreshing={isRefreshing}
                    onToggleDemoMode={handleToggleDemoMode}
                    onSelectScreen={handleSelectScreen}
                    viewMode={viewMode}
                    onChangeViewMode={setViewMode}
                  />
                )}

                {activeScreen === 'school-mode' && (
                  <SchoolModeScreen
                    outlooks={outlooks}
                    rawCityData={rawCityData}
                    selectedCityId={selectedCityId}
                    onSelectCity={handleSelectCity}
                    lastUpdatedFormatted={lastUpdatedFormatted}
                    schoolPolicy={schoolPolicy}
                    onUpdateSchoolPolicy={setSchoolPolicy}
                    isDemoMode={isDemoMode}
                  />
                )}

                {activeScreen === 'how-it-works' && <HowItWorksScreen />}

                {activeScreen === 'accuracy' && (
                  <AccuracyScreen workbenchData={workbenchAccuracyData} />
                )}

                {activeScreen === 'test-view' && (
                  <TestView
                    outlooks={outlooks}
                    rawCityData={rawCityData}
                    selectedCityId={selectedCityId}
                    onSelectCity={handleSelectCity}
                    onDataRefresh={(force) => loadData(force)}
                    activeModel={activeModel}
                    onSetActiveModel={setActiveModel}
                    schoolPolicy={schoolPolicy}
                    onSendToAccuracyChecker={handleSendToAccuracyChecker}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Footer inside dashboard container */}
          <div className="print:hidden">
            <Footer
              onSelectScreen={handleSelectScreen}
              activeScreen={activeScreen}
            />
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <div className="print:hidden">
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          isDemoMode={isDemoMode}
          onToggleDemoMode={handleToggleDemoMode}
          onRefresh={() => loadData(true)}
          isRefreshing={isRefreshing}
        />
      </div>

      {/* Atmospheric Notifications Modal */}
      <div className="print:hidden">
        <NotificationsModal
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          outlooks={outlooks}
          onSelectCity={handleSelectCity}
          isDemoMode={isDemoMode}
        />
      </div>

      {/* Fixed bottom disclaimer bar (present on every screen) */}
      <div className="print:hidden">
        <DisclaimerBar />
      </div>
    </div>
  );
}
