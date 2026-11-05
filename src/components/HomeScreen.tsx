/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Compass,
  Clock,
  GraduationCap,
  Scale,
  ShieldAlert,
  ExternalLink,
  Layers,
  Wind,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  X,
} from 'lucide-react';
import { APP_CONFIG, CITIES } from '../config.ts';
import { STRINGS } from '../strings.ts';
import { CityOutlook } from '../types.ts';
import {
  OutlineDrawCard,
  OutlineDrawHeading,
  OutlineDrawBody,
  OutlineDrawVisual,
} from './OutlineDrawCard.tsx';

interface HomeScreenProps {
  outlooks: Record<string, CityOutlook>;
  onSelectScreen: (screen: 'home' | 'map' | 'school-mode' | 'how-it-works' | 'accuracy' | 'test-view') => void;
  onSelectCity: (cityId: string) => void;
  lastUpdatedFormatted: string;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  outlooks,
  onSelectScreen,
  onSelectCity,
  lastUpdatedFormatted,
}) => {
  const [imageError, setImageError] = useState(false);
  const [showContextDetails, setShowContextDetails] = useState(false);
  const [showDisclaimerDetails, setShowDisclaimerDetails] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const infoContainerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsInfoOpen(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsInfoOpen(false);
    }, 200);
  };

  const handleToggleClick = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsInfoOpen((prev) => !prev);
  };

  const handleFocus = () => {
    setIsInfoOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsInfoOpen(false);
      triggerRef.current?.focus();
    }
  };

  // Close on click outside or global Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        infoContainerRef.current &&
        !infoContainerRef.current.contains(event.target as Node)
      ) {
        setIsInfoOpen(false);
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isInfoOpen) {
        setIsInfoOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleGlobalKeyDown);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, [isInfoOpen]);

  const heroImagePath = '/src/assets/images/uae_dust_monitoring_hero_1793364864881.jpg';

  const handleCityClick = (cityId: string) => {
    onSelectCity(cityId);
    onSelectScreen('map');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
        delayChildren: 0.02,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
    },
  };

  return (
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="relative pt-4 sm:pt-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Main Hero Copy and Actions */}
          <div className="lg:col-span-8">
            {/* Metadata line: Zero-pill discipline */}
            <motion.div
              variants={itemVariants}
              className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[#713F2B] dark:text-[#AAB8C2] uppercase mb-4"
            >
              <span className="text-[#E8874A] font-extrabold">{STRINGS.home.heroKicker}</span>
              <span aria-hidden="true" className="text-[#E8874A]">·</span>
              <span className="text-[#713F2B] dark:text-[#AAB8C2] font-medium">{STRINGS.app.badge}</span>
              <span aria-hidden="true" className="text-[#E8874A]">·</span>
              <span className="text-[#8C6D58] dark:text-[#AAB8C2]">Updated {lastUpdatedFormatted}</span>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              style={{ textWrap: 'balance' }}
              className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#3A1E13] dark:text-[#F4F6F8] leading-[1.12] mb-6"
            >
              {STRINGS.home.heroHeadline}
            </motion.h1>

            {/* Introductory Description with Accessible Info Tooltip */}
            <motion.div
              ref={infoContainerRef}
              variants={itemVariants}
              className="relative max-w-2xl mb-8"
            >
              <p className="text-base sm:text-lg text-[#5A453A] dark:text-[#AAB8C2] leading-relaxed inline">
                {STRINGS.home.heroDescription}
              </p>
              <span className="inline-flex items-center align-middle ml-2">
                <button
                  ref={triggerRef}
                  type="button"
                  id="dustwatch-info-trigger"
                  data-testid="dustwatch-info-trigger"
                  aria-expanded={isInfoOpen}
                  aria-haspopup="dialog"
                  aria-controls="dustwatch-info-popover"
                  aria-label="Learn how DustWatch works"
                  onClick={handleToggleClick}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  onFocus={handleFocus}
                  onKeyDown={handleKeyDown}
                  className={`w-6 h-6 rounded-full inline-flex items-center justify-center border transition-all cursor-pointer shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8874A] active:scale-95 ${
                    isInfoOpen
                      ? 'bg-[#244C3B] text-white border-[#244C3B] ring-2 ring-[#E8874A]'
                      : 'bg-[#FFFDF8] dark:bg-[#1E2D38] border-[#DFCBB3] dark:border-[#354651] text-[#713F2B] dark:text-[#E8874A] hover:bg-[#F2EAE0] dark:hover:bg-[#263743] hover:text-[#244C3B] dark:hover:text-white hover:border-[#E8874A]'
                  }`}
                >
                  <Info className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </span>

              {/* Accessible Explanation Tooltip / Popover */}
              <AnimatePresence>
                {isInfoOpen && (
                  <motion.div
                    id="dustwatch-info-popover"
                    data-testid="dustwatch-info-popover"
                    role="dialog"
                    aria-modal="false"
                    aria-labelledby="dustwatch-info-title"
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                    animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    className="absolute left-0 top-full mt-2.5 z-50 w-full sm:w-[460px] max-w-[calc(100vw-36px)] bg-[#FFFDF8] dark:bg-[#1E2D38] border border-[#DFCBB3] dark:border-[#354651] rounded-2xl shadow-xl p-4 sm:p-5 text-left text-xs text-[#2D221C] dark:text-[#F4F6F8] space-y-3.5"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-[#E7DDD0] dark:border-[#354651] pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#244C3B] dark:bg-[#1E382E] text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <Info className="w-4 h-4 text-[#E8874A]" />
                        </div>
                        <div>
                          <h2 id="dustwatch-info-title" className="text-sm font-bold text-[#244C3B] dark:text-[#F4F6F8] leading-tight">
                            How DustWatch Operates
                          </h2>
                          <p className="text-[11px] text-[#713F2B] dark:text-[#AAB8C2]">
                            Open atmospheric telemetry & risk pipeline
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsInfoOpen(false)}
                        className="text-[#713F2B] dark:text-[#AAB8C2] hover:text-[#244C3B] dark:hover:text-white hover:bg-[#F2EAE0] dark:hover:bg-[#263743] p-1 rounded-lg transition-colors cursor-pointer"
                        aria-label="Close explanation dialog"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Concise System Overview Points */}
                    <div className="space-y-2 text-[#4A3B32] dark:text-[#AAB8C2] leading-relaxed">
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E8874A] mt-1.5 shrink-0" aria-hidden="true" />
                        <p>
                          <strong className="text-[#244C3B] dark:text-[#E8874A]">Forecast Ingestion:</strong> Collects atmospheric and environmental forecast data from integrated meteorological models (ECMWF, ICON) and CAMS atmospheric composition grids.
                        </p>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E8874A] mt-1.5 shrink-0" aria-hidden="true" />
                        <p>
                          <strong className="text-[#244C3B] dark:text-[#E8874A]">Deterministic Processing:</strong> Processes relevant variables (PM2.5, PM10, aerosol optical depth, humidity, wind gusts) through an explicit, transparent risk-assessment engine.
                        </p>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E8874A] mt-1.5 shrink-0" aria-hidden="true" />
                        <p>
                          <strong className="text-[#244C3B] dark:text-[#E8874A]">Regional Outlook:</strong> Estimates calibrated dust-risk levels across 10 monitored municipal stations across all 7 Emirates.
                        </p>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E8874A] mt-1.5 shrink-0" aria-hidden="true" />
                        <p>
                          <strong className="text-[#244C3B] dark:text-[#E8874A]">Current & 12h Forecast:</strong> Synthesizes current conditions with an experimental 12-hour hourly outlook trajectory to support outdoor activity planning.
                        </p>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E8874A] mt-1.5 shrink-0" aria-hidden="true" />
                        <p>
                          <strong className="text-[#244C3B] dark:text-[#E8874A]">Gemini AI Advisory Role:</strong> Gemini AI assists solely in translating raw telemetry into accessible, human-readable safety advice; it does not calculate or modify the underlying risk score.
                        </p>
                      </div>
                    </div>

                    {/* Experimental Disclaimer Notice */}
                    <div className="pt-2 border-t border-[#E7DDD0] dark:border-[#354651] text-[11px] text-[#713F2B] dark:text-[#AAB8C2] bg-[#F7F1E8] dark:bg-[#18242E] rounded-xl p-2.5 leading-snug">
                      <strong className="text-[#3A1E13] dark:text-[#F4F6F8]">Experimental Student Project:</strong> DustWatch provides estimated indicators for academic exploration and outdoor activity planning. It does not provide official meteorological warnings. For official emergency notices, consult the UAE National Center of Meteorology (NCM).
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Primary & Secondary Action Pair with Full Mobile Touch Support */}
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={() => onSelectScreen('map')}
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[#244C3B] dark:bg-[#3D7A60] text-white font-semibold text-sm rounded-lg hover:bg-[#1B3A2D] dark:hover:bg-[#4E9A78] active:scale-[0.98] transition-all shadow-xs hover:shadow-sm cursor-pointer whitespace-nowrap min-h-[48px] interactive-tap"
              >
                <span>{STRINGS.home.exploreCta}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                type="button"
                onClick={() => onSelectScreen('how-it-works')}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-white dark:bg-[#1E2D38] text-[#713F2B] dark:text-[#F4F6F8] border border-[#DFCBB3] dark:border-[#354651] font-semibold text-sm rounded-lg hover:bg-[#E8D2B4]/40 dark:hover:bg-[#263743] hover:border-[#E8874A]/50 active:scale-[0.98] transition-all shadow-xs cursor-pointer whitespace-nowrap min-h-[48px] interactive-tap"
              >
                <span>{STRINGS.home.howItWorksCta}</span>
              </button>
            </motion.div>
          </div>

          {/* Official Primary Logo Showcase in Hero */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-4 flex flex-col items-center justify-center"
          >
            <div className="w-full max-w-[280px] sm:max-w-[320px] lg:max-w-none bg-[#FFFDFB] dark:bg-[#1E2D38] border border-[#DFCBB3] dark:border-[#354651] rounded-2xl p-6 sm:p-7 shadow-xs hover:shadow-sm transition-shadow duration-300 flex flex-col items-center text-center">
              <img
                src="/assets/dustwatch-logo-transparent.png"
                alt="DustWatch - Official Logo"
                className="w-full max-w-[220px] sm:max-w-[240px] h-auto object-contain drop-shadow-2xs"
                width={929}
                height={580}
                loading="eager"
              />
              <div className="mt-4 pt-3.5 border-t border-[#DFCBB3]/80 dark:border-[#354651] w-full">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#E8874A] block">
                  Official Project Identity
                </span>
                <span className="text-xs text-[#5A453A] dark:text-[#AAB8C2] font-medium block mt-0.5">
                  UAE Atmospheric Particulate & Dust Outlook
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Visual Introduction to UAE Dust Monitoring */}
      <OutlineDrawCard
        outlineColor="#E8874A"
        baseBorderColor="rgba(223, 203, 179, 0.5)"
        borderRadius={12}
        duration={0.75}
        className="overflow-hidden rounded-xl border border-[#DFCBB3] dark:border-[#354651] border-t-4 border-t-[#E8874A] bg-[#FFFDFB] dark:bg-[#1E2D38] shadow-xs transition-shadow duration-300 hover:shadow-sm"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Image Container with Fallback */}
          <div className="lg:col-span-7 relative min-h-[220px] sm:min-h-[300px] lg:min-h-[420px] bg-[#E8D2B4]/30 dark:bg-[#15232D] flex items-center justify-center overflow-hidden">
            {!imageError ? (
              <motion.img
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.03 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
                src={heroImagePath}
                alt="Meteorological observation station in the UAE desert dunes measuring atmospheric aerosol optical depth and particulate levels"
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                className="w-full h-full object-cover object-center transition-transform duration-700 hover:scale-[1.01]"
              />
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center h-full text-[#713F2B] dark:text-[#AAB8C2]">
                <Wind className="w-12 h-12 mb-3 text-[#E8874A]" />
                <h3 className="font-bold text-lg text-[#3A1E13] dark:text-[#F4F6F8]">UAE Atmospheric Observation</h3>
                <p className="text-xs text-[#8C6D58] dark:text-[#AAB8C2] max-w-sm mt-1">
                  Continuous atmospheric analysis combining Open-Meteo forecasts and CAMS particulate models.
                </p>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent lg:hidden" />
          </div>

          {/* Context & Scientific Narrative */}
          <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between bg-[#FFFDFB] dark:bg-[#1E2D38]">
            <div className="space-y-4">
              <OutlineDrawHeading>
                <button
                  type="button"
                  onClick={() => setShowContextDetails((prev) => !prev)}
                  aria-expanded={showContextDetails}
                  aria-controls="home-context-details"
                  className="text-left group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#E8874A] rounded p-0.5"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-[#E8874A] uppercase tracking-wider">
                    <Compass className="w-4 h-4 text-[#E8874A]" />
                    <span>Regional Atmospheric Context</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#3A1E13] dark:text-[#F4F6F8] group-hover:text-[#713F2B] dark:group-hover:text-[#E8874A] tracking-tight mt-1 transition-colors">
                    {STRINGS.home.monitoringIntroTitle}
                  </h2>
                </button>
              </OutlineDrawHeading>

              <OutlineDrawBody>
                <p className="text-sm text-[#5A453A] dark:text-[#AAB8C2] leading-relaxed">
                  {STRINGS.home.monitoringIntroBody}
                </p>

                {/* Collapsible Trigger for Dynamics & Operational Pillars */}
                <div className="mt-3 pt-2 border-t border-[#DFCBB3]/70 dark:border-[#354651]">
                  <button
                    type="button"
                    onClick={() => setShowContextDetails((prev) => !prev)}
                    aria-expanded={showContextDetails}
                    aria-controls="home-context-details"
                    className="w-full flex items-center justify-between text-xs font-bold text-[#713F2B] dark:text-[#E8874A] hover:text-[#E8874A] py-1.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8874A] rounded"
                  >
                    <span className="flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-[#E8874A]" />
                      <span>{showContextDetails ? 'Hide Technical Specifications & Pillars' : 'View Technical Specifications & Pillars'}</span>
                    </span>
                    {showContextDetails ? (
                      <ChevronUp className="w-4 h-4 text-[#713F2B] dark:text-[#E8874A]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#713F2B] dark:text-[#E8874A]" />
                    )}
                  </button>

                  {showContextDetails && (
                    <div id="home-context-details" className="space-y-3 mt-2.5 pt-1">
                      {/* Atmospheric Dust & Warm Sand Context Detail */}
                      <div className="p-3 rounded-lg bg-[#E8D2B4]/50 dark:bg-[#263743] border border-[#DFCBB3] dark:border-[#354651] text-[#5A382A] dark:text-[#F4F6F8] text-xs flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E8874A] mt-1.5 shrink-0" />
                        <p className="leading-relaxed">
                          <strong className="text-[#713F2B] dark:text-[#E8874A]">Arabian Desert Dynamics:</strong> Diurnal heating and regional shamal winds lift desert dust particles into the boundary layer, producing late-afternoon and sunset atmospheric haze.
                        </p>
                      </div>

                      <div className="text-xs text-[#8C6D58] dark:text-[#AAB8C2] space-y-1.5">
                        <p className="font-semibold text-[#3A1E13] dark:text-[#F4F6F8]">Operational Pillars:</p>
                        <div className="grid grid-cols-2 gap-2">
                          <span className="flex items-center gap-1.5 text-[#5A453A] dark:text-[#AAB8C2]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#E8874A]" /> 7 Atmospheric Factors
                          </span>
                          <span className="flex items-center gap-1.5 text-[#5A453A] dark:text-[#AAB8C2]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#E8874A]" /> Physical Particle Cap
                          </span>
                          <span className="flex items-center gap-1.5 text-[#5A453A] dark:text-[#AAB8C2]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#E8874A]" /> 10 UAE Municipalities
                          </span>
                          <span className="flex items-center gap-1.5 text-[#5A453A] dark:text-[#AAB8C2]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#E8874A]" /> 30-Min Telemetry Cycle
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </OutlineDrawBody>
            </div>

            <OutlineDrawVisual delayOffset={0.28}>
              <div className="pt-6 mt-6 border-t border-[#DFCBB3] dark:border-[#354651] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onSelectScreen('map')}
                  className="text-xs font-bold text-[#713F2B] dark:text-[#E8874A] hover:text-[#E8874A] flex items-center gap-1.5 cursor-pointer interactive-tap group"
                >
                  <span>Launch Interactive Map View</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1 text-[#E8874A]" />
                </button>
                <span className="text-[11px] text-[#8C6D58] dark:text-[#AAB8C2]">No login required</span>
              </div>
            </OutlineDrawVisual>
          </div>
        </div>
      </OutlineDrawCard>

      {/* Live Conditions Snapshot Across UAE Cities (Ten-city pulse strip) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#3A1E13] dark:text-[#F4F6F8]">
              Live Regional Risk Overview
            </h2>
            <p className="text-sm text-[#5A453A] dark:text-[#AAB8C2] mt-0.5">
              Click any city to open its dedicated 12-hour timeline and factor analysis.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectScreen('map')}
            className="text-xs font-bold text-[#244C3B] dark:text-[#E8874A] hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer group"
          >
            <span>Full UAE Interactive Map</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {CITIES.map((city) => {
            const outlook = outlooks[city.id];
            const level = outlook ? outlook.levelNow : 'Low';
            const score = outlook ? Math.round(outlook.scoreNow) : 0;
            const colorCfg = APP_CONFIG.colors[level];

            return (
              <button
                key={city.id}
                type="button"
                onClick={() => handleCityClick(city.id)}
                className="p-3.5 bg-[#FFFDFB] dark:bg-[#1E2D38] border border-[#DFCBB3] dark:border-[#354651] hover:border-[#E8874A] hover:bg-[#FFF8F0] dark:hover:bg-[#263743] rounded-lg text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs active:scale-[0.98] cursor-pointer group flex flex-col justify-between min-h-[104px]"
              >
                <div>
                  <div className="text-xs text-[#8C6D58] dark:text-[#AAB8C2] group-hover:text-[#713F2B] dark:group-hover:text-[#F4F6F8] transition-colors">
                    Emirate / City
                  </div>
                  <div className="font-bold text-sm text-[#2D1A12] dark:text-[#F4F6F8] truncate mt-0.5">
                    {city.name}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#F2E5D5] dark:border-[#354651]">
                  <span
                    style={{
                      backgroundColor: colorCfg.badgeBg,
                      color: colorCfg.badgeText,
                      borderColor: colorCfg.border,
                    }}
                    className="text-xs px-2 py-0.5 rounded font-semibold border transition-colors"
                  >
                    {colorCfg.label}
                  </span>
                  <span className="font-mono text-xs font-bold text-[#713F2B] dark:text-[#F4F6F8]">
                    {score}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Core Platform Capabilities: Bento-Style Grid */}
      <section className="space-y-6">
        <div>
          <div className="text-xs font-bold text-[#E8874A] uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E8874A]" />
            <span>Platform Architecture</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3A1E13] dark:text-[#F4F6F8]">
            Engineered for Plain Environmental Clarity
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Interactive UAE Map */}
          <OutlineDrawCard
            outlineColor="#E8874A"
            baseBorderColor="rgba(223, 203, 179, 0.45)"
            borderRadius={12}
            duration={0.7}
            delay={0}
            className="p-6 bg-[#FFFDFB] dark:bg-[#1E2D38] border border-[#DFCBB3] dark:border-[#354651] rounded-xl flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs group"
          >
            <div className="space-y-3">
              <OutlineDrawHeading>
                <div className="w-10 h-10 rounded-lg bg-[#E8D2B4]/50 dark:bg-[#263743] text-[#713F2B] dark:text-[#E8874A] flex items-center justify-center transition-colors group-hover:bg-[#E8874A] group-hover:text-white mb-3">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-[#3A1E13] dark:text-[#F4F6F8]">
                  {STRINGS.home.pillars[0].title}
                </h3>
              </OutlineDrawHeading>

              <OutlineDrawBody>
                <p className="text-sm text-[#5A453A] dark:text-[#AAB8C2] leading-relaxed">
                  {STRINGS.home.pillars[0].desc}
                </p>
              </OutlineDrawBody>
            </div>

            <OutlineDrawVisual>
              <div className="pt-6 mt-4 border-t border-[#DFCBB3] dark:border-[#354651]">
                <button
                  type="button"
                  onClick={() => onSelectScreen('map')}
                  className="text-xs font-bold text-[#244C3B] dark:text-[#E8874A] hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <span>View Map Layers & Rasters</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </OutlineDrawVisual>
          </OutlineDrawCard>

          {/* Card 2: 12-Hour Outlook & Window Scoring - Featured Warm Sunset Surface */}
          <OutlineDrawCard
            outlineColor="#E8874A"
            baseBorderColor="rgba(232, 135, 74, 0.5)"
            borderRadius={12}
            duration={0.7}
            delay={0.12}
            className="p-6 bg-gradient-to-br from-[#FFF8F2] dark:from-[#251D18] via-[#F7ECE1] dark:via-[#2A201A] to-[#E8D2B4]/50 dark:to-[#221B17] border border-[#E8874A]/80 dark:border-[#E8874A]/50 rounded-xl flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs group"
          >
            <div className="space-y-3">
              <OutlineDrawHeading>
                <div className="w-10 h-10 rounded-lg bg-[#E8874A] text-white flex items-center justify-center shadow-xs mb-3">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-[#3A1E13] dark:text-[#F4F6F8]">
                  {STRINGS.home.pillars[1].title}
                </h3>
              </OutlineDrawHeading>

              <OutlineDrawBody>
                <p className="text-sm text-[#5A453A] dark:text-[#AAB8C2] leading-relaxed">
                  {STRINGS.home.pillars[1].desc}
                </p>
              </OutlineDrawBody>
            </div>

            <OutlineDrawVisual>
              <div className="pt-6 mt-4 border-t border-[#DFCBB3] dark:border-[#354651]">
                <button
                  type="button"
                  onClick={() => onSelectScreen('map')}
                  className="text-xs font-bold text-[#713F2B] dark:text-[#E8874A] hover:text-[#E8874A] flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Explore Hourly Trajectories</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1 text-[#E8874A]" />
                </button>
              </div>
            </OutlineDrawVisual>
          </OutlineDrawCard>

          {/* Card 3: School Safety Mode */}
          <OutlineDrawCard
            outlineColor="#244C3B"
            baseBorderColor="rgba(223, 203, 179, 0.45)"
            borderRadius={12}
            duration={0.7}
            delay={0.08}
            className="p-6 bg-[#FFFDFB] dark:bg-[#1E2D38] border border-[#DFCBB3] dark:border-[#354651] rounded-xl flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs group"
          >
            <div className="space-y-3">
              <OutlineDrawHeading>
                <div className="w-10 h-10 rounded-lg bg-[#E8D2B4]/50 dark:bg-[#263743] text-[#713F2B] dark:text-[#E8874A] flex items-center justify-center transition-colors group-hover:bg-[#244C3B] group-hover:text-white mb-3">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-[#3A1E13] dark:text-[#F4F6F8]">
                  {STRINGS.home.pillars[2].title}
                </h3>
              </OutlineDrawHeading>

              <OutlineDrawBody>
                <p className="text-sm text-[#5A453A] dark:text-[#AAB8C2] leading-relaxed">
                  {STRINGS.home.pillars[2].desc}
                </p>
              </OutlineDrawBody>
            </div>

            <OutlineDrawVisual>
              <div className="pt-6 mt-4 border-t border-[#DFCBB3] dark:border-[#354651]">
                <button
                  type="button"
                  onClick={() => onSelectScreen('school-mode')}
                  className="text-xs font-bold text-[#244C3B] dark:text-[#E8874A] hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{STRINGS.home.schoolModeCta}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </OutlineDrawVisual>
          </OutlineDrawCard>

          {/* Card 4: Methodology & Open Science */}
          <OutlineDrawCard
            outlineColor="#E8874A"
            baseBorderColor="rgba(223, 203, 179, 0.45)"
            borderRadius={12}
            duration={0.7}
            delay={0.2}
            className="p-6 bg-[#FFFDFB] dark:bg-[#1E2D38] border border-[#DFCBB3] dark:border-[#354651] rounded-xl flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs group"
          >
            <div className="space-y-3">
              <OutlineDrawHeading>
                <div className="w-10 h-10 rounded-lg bg-[#E8D2B4]/50 dark:bg-[#263743] text-[#713F2B] dark:text-[#E8874A] flex items-center justify-center transition-colors group-hover:bg-[#244C3B] group-hover:text-white mb-3">
                  <Scale className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-[#3A1E13] dark:text-[#F4F6F8]">
                  {STRINGS.home.pillars[3].title}
                </h3>
              </OutlineDrawHeading>

              <OutlineDrawBody>
                <p className="text-sm text-[#5A453A] dark:text-[#AAB8C2] leading-relaxed">
                  {STRINGS.home.pillars[3].desc}
                </p>
              </OutlineDrawBody>
            </div>

            <OutlineDrawVisual>
              <div className="pt-6 mt-4 border-t border-[#DFCBB3] dark:border-[#354651] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onSelectScreen('how-it-works')}
                  className="text-xs font-bold text-[#244C3B] dark:text-[#E8874A] hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Read Full Methodology</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectScreen('accuracy')}
                  className="text-xs text-[#8C6D58] dark:text-[#AAB8C2] hover:text-[#3A1E13] dark:hover:text-[#F4F6F8] cursor-pointer"
                >
                  {STRINGS.home.accuracyCta}
                </button>
              </div>
            </OutlineDrawVisual>
          </OutlineDrawCard>
        </div>
      </section>

      {/* Transparent Disclaimer & Scientific Caution Section - Prominent Soft Sand Surface */}
      <OutlineDrawCard
        outlineColor="#713F2B"
        baseBorderColor="rgba(216, 195, 170, 0.6)"
        borderRadius={12}
        delay={0.06}
        duration={0.75}
        className="p-6 sm:p-8 rounded-xl bg-[#E8D2B4] dark:bg-[#221B17] border border-[#D8C3AA] dark:border-[#3D3228] text-[#3D251A] dark:text-[#F4F6F8] space-y-4"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-[#713F2B] dark:text-[#E8874A] shrink-0 mt-0.5" />
          <div className="space-y-2 w-full">
            <OutlineDrawHeading>
              <button
                type="button"
                onClick={() => setShowDisclaimerDetails((prev) => !prev)}
                aria-expanded={showDisclaimerDetails}
                aria-controls="home-disclaimer-details"
                className="text-left font-bold text-base text-[#713F2B] dark:text-[#E8874A] hover:text-[#3D251A] dark:hover:text-white transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#713F2B] dark:focus:ring-[#E8874A] rounded p-0.5"
              >
                Experimental Project Disclaimer & Safety Boundaries
              </button>
            </OutlineDrawHeading>

            <OutlineDrawBody>
              <p className="text-sm text-[#4D3123] dark:text-[#C5B4A6] leading-relaxed">
                {STRINGS.home.experimentalNotice}
              </p>
            </OutlineDrawBody>

            <OutlineDrawVisual>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowDisclaimerDetails((prev) => !prev)}
                  aria-expanded={showDisclaimerDetails}
                  aria-controls="home-disclaimer-details"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#713F2B] dark:text-[#E8874A] hover:text-[#244C3B] dark:hover:text-[#F4F6F8] py-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#713F2B] rounded"
                >
                  <span>{showDisclaimerDetails ? 'Hide Legal & Authority Attribution' : 'View Legal & Authority Attribution'}</span>
                  {showDisclaimerDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showDisclaimerDetails && (
                  <div id="home-disclaimer-details" className="pt-2 flex flex-wrap items-center gap-4 text-xs mt-1 border-t border-[#D8C3AA] dark:border-[#3D3228]">
                    <a
                      href={STRINGS.disclaimer.ncmUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-bold text-[#244C3B] dark:text-[#E8874A] hover:underline"
                    >
                      <span>National Center of Meteorology (ncm.ae)</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <span className="text-[#8C6D58] dark:text-[#AAB8C2] hidden sm:inline">|</span>
                    <span className="text-[#8C6D58] dark:text-[#AAB8C2]">Data source: Open-Meteo & CAMS Atmospheric Models</span>
                  </div>
                )}
              </div>
            </OutlineDrawVisual>
          </div>
        </div>
      </OutlineDrawCard>
    </div>
  );
};
