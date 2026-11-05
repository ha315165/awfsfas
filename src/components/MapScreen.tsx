/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Clock,
  Compass,
  ExternalLink,
  Info,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  MapPin,
  SlidersHorizontal,
} from 'lucide-react';
import { APP_CONFIG, CITIES } from '../config.ts';
import { STRINGS } from '../strings.ts';
import { CityOutlook, HourlyRiskResult } from '../types.ts';
import { UaeMap } from './UaeMap.tsx';
import { TimelineChart } from './TimelineChart.tsx';
import { AdvicePanel } from './AdvicePanel.tsx';
import { TopMetricCards } from './TopMetricCards.tsx';
import { StationInsightsPanel } from './StationInsightsPanel.tsx';

interface MapScreenProps {
  outlooks: Record<string, CityOutlook>;
  selectedCityId: string;
  onSelectCity: (cityId: string) => void;
  lastUpdatedFormatted: string;
  isDemoMode?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onToggleDemoMode?: () => void;
  onSelectScreen?: (screen: 'home' | 'map' | 'school-mode' | 'how-it-works' | 'accuracy' | 'test-view') => void;
  viewMode?: 'now' | 'highest12h';
  onChangeViewMode?: (mode: 'now' | 'highest12h') => void;
}

export const MapScreen: React.FC<MapScreenProps> = ({
  outlooks,
  selectedCityId,
  onSelectCity,
  lastUpdatedFormatted,
  isDemoMode = false,
  onRefresh,
  isRefreshing = false,
  onToggleDemoMode,
  viewMode: controlledViewMode,
  onChangeViewMode,
}) => {
  const [internalViewMode, setInternalViewMode] = useState<'highest12h' | 'now'>('now');
  const viewMode = controlledViewMode ?? internalViewMode;

  const handleSelectViewMode = (mode: 'now' | 'highest12h') => {
    if (onChangeViewMode) {
      onChangeViewMode(mode);
    } else {
      setInternalViewMode(mode);
    }
  };

  const shouldReduceMotion = useReducedMotion();

  // Currently selected city outlook
  const currentOutlook = outlooks[selectedCityId] || outlooks[APP_CONFIG.defaultSelectedCityId];

  // Selected hour index within the 12-hour outlook
  const [selectedHourIndex, setSelectedHourIndex] = useState<number>(0);

  useEffect(() => {
    if (currentOutlook) {
      if (viewMode === 'now') {
        setSelectedHourIndex(0);
      } else {
        setSelectedHourIndex(currentOutlook.peakHourIndex);
      }
    }
  }, [currentOutlook?.city.id, viewMode, currentOutlook?.peakHourIndex]);

  if (!currentOutlook) {
    return (
      <div className="p-16 text-center text-[#5F6762] space-y-3">
        <div className="w-9 h-9 mx-auto border-3 border-[#244C3B] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-[#244C3B]">Loading UAE atmospheric telemetry...</p>
        <p className="text-xs text-[#8C6D58]">Synthesizing Open-Meteo & ECMWF forecast grids</p>
      </div>
    );
  }

  const selectedHourResult: HourlyRiskResult =
    currentOutlook.hourlyResults[selectedHourIndex] || currentOutlook.hourlyResults[0];

  const activePeriodLevel = viewMode === 'now' ? currentOutlook.levelNow : currentOutlook.peakLevel;
  const activePeriodScore = viewMode === 'now' ? currentOutlook.scoreNow : currentOutlook.peakScore;
  const activePeriodCfg = APP_CONFIG.colors[activePeriodLevel];

  return (
    <div className="space-y-6">
      {/* =========================================================================
          SECTION 1: Top 4 Metric Cards (Directly inspired by reference screenshot)
         ========================================================================= */}
      <section aria-label="Key Atmospheric Metrics">
        <TopMetricCards
          currentOutlook={currentOutlook}
          lastUpdatedFormatted={lastUpdatedFormatted}
          isDemoMode={isDemoMode}
        />
      </section>

      {/* =========================================================================
          SECTION 2: Main Dashboard Grid (Central Workspace + Right Information Panel)
         ========================================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ---------------------------------------------------------------------
            LEFT / CENTRAL WORKSPACE (7 to 8 Columns on XL)
           --------------------------------------------------------------------- */}
        <div className="xl:col-span-8 space-y-6">
          {/* Workspace Location Sub-header & Quick Actions */}
          <div
            data-testid="risk-summary-banner"
            className="bg-[#FFFDF8] dark:bg-[#1E2D38] border border-[#E7DDD0] dark:border-[#354651] rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#244C3B] dark:bg-[#1E382E] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Compass className="w-5 h-5 text-[#E8874A]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#713F2B] dark:text-[#E8874A]">
                    Active Station
                  </span>
                  <span className="text-[10px] bg-[#E8F0E7] dark:bg-[#152B20] text-[#244C3B] dark:text-[#A7D7B5] font-bold px-2 py-0.2 rounded-full border border-[#D5E4D4] dark:border-[#204433]">
                    {currentOutlook.city.latitude.toFixed(2)}°N, {currentOutlook.city.longitude.toFixed(2)}°E
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <h2 className="text-xl sm:text-2xl font-black text-[#244C3B] dark:text-[#F4F6F8] tracking-tight">
                    {currentOutlook.city.name}
                  </h2>
                  <select
                    value={selectedCityId}
                    onChange={(e) => onSelectCity(e.target.value)}
                    className="bg-[#F7F1E8] dark:bg-[#101820] border border-[#DFCBB3] dark:border-[#354651] text-xs font-bold text-[#713F2B] dark:text-[#F4F6F8] rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-[#E8874A]"
                    aria-label="Switch monitoring station"
                  >
                    {CITIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Risk Assessment Period Toggle */}
            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              <span className="text-xs font-bold text-[#713F2B] dark:text-[#AAB8C2] uppercase tracking-wider hidden sm:inline">
                Period:
              </span>
              <div
                role="radiogroup"
                aria-label="Risk assessment period"
                className="relative inline-flex rounded-xl bg-[#F7F1E8] dark:bg-[#101820] p-1 border border-[#DFCBB3] dark:border-[#354651]"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={viewMode === 'now'}
                  onClick={() => handleSelectViewMode('now')}
                  className={`relative px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer min-h-[38px] z-10 ${
                    viewMode === 'now' ? 'text-[#713F2B] dark:text-[#F4F6F8]' : 'text-[#5A453A] dark:text-[#AAB8C2] hover:text-[#713F2B] dark:hover:text-[#F4F6F8]'
                  }`}
                >
                  <span className="relative z-10">{STRINGS.toggles.now}</span>
                  {viewMode === 'now' && (
                    <motion.span
                      layoutId={shouldReduceMotion ? undefined : 'riskPeriodPill'}
                      className="absolute inset-0 bg-white dark:bg-[#263743] rounded-lg shadow-2xs -z-0"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    />
                  )}
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={viewMode === 'highest12h'}
                  onClick={() => handleSelectViewMode('highest12h')}
                  className={`relative px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer min-h-[38px] z-10 ${
                    viewMode === 'highest12h' ? 'text-[#713F2B] dark:text-[#F4F6F8]' : 'text-[#5A453A] dark:text-[#AAB8C2] hover:text-[#713F2B] dark:hover:text-[#F4F6F8]'
                  }`}
                >
                  <span className="relative z-10">{STRINGS.toggles.highest12h}</span>
                  {viewMode === 'highest12h' && (
                    <motion.span
                      layoutId={shouldReduceMotion ? undefined : 'riskPeriodPill'}
                      className="absolute inset-0 bg-white dark:bg-[#263743] rounded-lg shadow-2xs -z-0"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Leaflet UAE Map Card (Spacious Workspace) */}
          <div className="bg-[#FFFDF8] dark:bg-[#1E2D38] border border-[#E7DDD0] dark:border-[#354651] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#713F2B] dark:text-[#E8874A]">
                  Spatial Model Heatmap
                </span>
                <h3 className="text-base font-black text-[#244C3B] dark:text-[#F4F6F8] tracking-tight">
                  Continuous Atmospheric Dust Distribution
                </h3>
              </div>
              <span className="text-xs text-[#5F6762] dark:text-[#AAB8C2] hidden sm:inline font-mono">
                Model: Open-Meteo NWP · Raster Layer
              </span>
            </div>

            {/* Map Container */}
            <div className="rounded-xl overflow-hidden border border-[#E7DDD0] dark:border-[#354651] relative">
              <UaeMap
                outlooks={outlooks}
                selectedCityId={selectedCityId}
                onSelectCity={onSelectCity}
                viewMode={viewMode}
                isDemoMode={isDemoMode}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#8C6D58] dark:text-[#AAB8C2] pt-1">
              <span>Use the map controls above to toggle Satellite AOD, Rainfall, and PM concentration overlays</span>
              <span className="font-mono">UAE Bounds: 22.5°N - 26.5°N</span>
            </div>
          </div>

          {/* 12-Hour Forecast Timeline Chart Card */}
          <div className="bg-[#FFFDF8] dark:bg-[#1E2D38] border border-[#E7DDD0] dark:border-[#354651] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#713F2B] dark:text-[#E8874A]">
                  Temporal Progression
                </span>
                <h3 className="text-base font-black text-[#244C3B] dark:text-[#F4F6F8] tracking-tight">
                  12-Hour Hourly Trajectory for {currentOutlook.city.name}
                </h3>
              </div>
              <span className="text-xs font-mono text-[#713F2B] dark:text-[#E8874A] font-bold">
                Hour {selectedHourResult.displayHour} Selected
              </span>
            </div>

            <TimelineChart
              hourlyResults={currentOutlook.hourlyResults}
              selectedHourIndex={selectedHourIndex}
              onSelectHour={setSelectedHourIndex}
            />
          </div>

          {/* Operational Audience Guidance Card */}
          <div className="bg-[#FFFDF8] dark:bg-[#1E2D38] border border-[#E7DDD0] dark:border-[#354651] rounded-2xl p-4 sm:p-5 shadow-2xs transition-colors">
            <AdvicePanel outlook={currentOutlook} />
          </div>
        </div>

        {/* ---------------------------------------------------------------------
            RIGHT-HAND INFORMATION PANEL (4 Columns on XL)
            (Matching reference screenshot: "Platform Insight" & "Applicants")
           --------------------------------------------------------------------- */}
        <div className="xl:col-span-4">
          <StationInsightsPanel
            currentOutlook={currentOutlook}
            selectedHourResult={selectedHourResult}
            selectedCityId={selectedCityId}
            onSelectCity={onSelectCity}
            outlooks={outlooks}
            viewMode={viewMode}
          />
        </div>
      </div>
    </div>
  );
};
