/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { GraduationCap, HardHat, HeartPulse, Sparkles, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { STRINGS } from '../strings.ts';
import { AdviceResponse, CityOutlook } from '../types.ts';
import { getAdviceForOutlook } from '../geminiService.ts';

interface AdvicePanelProps {
  outlook: CityOutlook;
}

export const AdvicePanel: React.FC<AdvicePanelProps> = ({ outlook }) => {
  const [activeTab, setActiveTab] = useState<'schools' | 'workers' | 'families'>('schools');
  const [adviceData, setAdviceData] = useState<AdviceResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    getAdviceForOutlook(outlook).then((res) => {
      if (isMounted) {
        setAdviceData(res);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [outlook]);

  const peakLevel = outlook.peakLevel;
  const worstWindowText = outlook.worstWindow.displayRange;

  const tabs: Array<{ id: 'schools' | 'workers' | 'families'; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'schools', label: STRINGS.advice.tabSchools, icon: GraduationCap },
    { id: 'workers', label: STRINGS.advice.tabWorkers, icon: HardHat },
    { id: 'families', label: STRINGS.advice.tabFamilies, icon: HeartPulse },
  ];

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextTab = tabs[(index + 1) % tabs.length];
      setActiveTab(nextTab.id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevTab = tabs[(index - 1 + tabs.length) % tabs.length];
      setActiveTab(prevTab.id);
    }
  };

  return (
    <div className="bg-[#FFFDFB] dark:bg-[#1E2D38] border border-[#DFCBB3] dark:border-[#354651] rounded-xl p-4 sm:p-5 shadow-xs transition-colors">
      {/* Highest estimated risk header - Essential Summary Always Visible */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[#DFCBB3]/60 dark:border-[#354651]">
        <span className="text-sm font-bold text-[#713F2B] dark:text-[#F4F6F8]">
          {STRINGS.advice.highestPrefix(peakLevel, worstWindowText)}
        </span>
        <span className="text-xs text-[#713F2B] dark:text-[#E8874A] bg-[#E8D2B4] dark:bg-[#263743] border border-[#D8C3AA] dark:border-[#354651] px-2.5 py-0.5 rounded-md font-bold">
          3-Hour Peak Window
        </span>
      </div>

      {/* Expandable Header / Control for Detailed Audience Guidance */}
      <div className="pt-2.5">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-controls="operational-advice-details"
          className="w-full flex items-center justify-between text-left text-xs font-bold text-[#713F2B] dark:text-[#E8874A] hover:text-[#E8874A] py-1 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8874A] rounded"
        >
          <span className="flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-[#E8874A]" />
            <span>Operational Audience Guidance (Schools, Workers, Families)</span>
          </span>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-[#8C6D58] dark:text-[#AAB8C2]">
            <span>{isExpanded ? 'Collapse Guidance' : 'View Recommendations'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        {isExpanded && (
          <div id="operational-advice-details" className="mt-3 pt-2 border-t border-[#DFCBB3]/60 dark:border-[#354651]">
            {/* Tabs with Animated Indicator */}
            <div
              role="tablist"
              aria-label="Advice recipient categories"
              className="flex items-center gap-1 border-b border-[#DFCBB3] dark:border-[#354651] mb-3 relative"
            >
              {tabs.map((tab, idx) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`advice-tab-${tab.id}`}
                    aria-selected={isActive}
                    aria-controls={`advice-panel-${tab.id}`}
                    tabIndex={isActive ? 0 : -1}
                    onKeyDown={(e) => handleTabKeyDown(e, idx)}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative px-3.5 py-2 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors min-h-[44px] cursor-pointer z-10 active:scale-98 ${
                      isActive
                        ? 'text-[#713F2B] dark:text-[#F4F6F8] font-bold'
                        : 'text-[#6B564B] dark:text-[#AAB8C2] hover:text-[#2D1A12] dark:hover:text-[#F4F6F8]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 relative z-10" />
                    <span className="relative z-10">{tab.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId={shouldReduceMotion ? undefined : 'adviceTabIndicator'}
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E8874A]"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab Panel Content with Smooth Crossfade */}
            <div
              id={`advice-panel-${activeTab}`}
              role="tabpanel"
              aria-labelledby={`advice-tab-${activeTab}`}
              className="min-h-[70px] flex flex-col justify-center"
            >
              {isLoading ? (
                <div role="status" className="flex items-center gap-2 text-xs text-[#6B564B] dark:text-[#AAB8C2] italic py-2">
                  <span
                    aria-hidden="true"
                    className="w-4 h-4 shrink-0 rounded-full border-2 border-[#DFCBB3] dark:border-[#354651] border-t-[#713F2B] dark:border-t-[#E8874A] animate-spin"
                  />
                  <span>{STRINGS.advice.preparing}</span>
                </div>
              ) : adviceData ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                    animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="text-sm text-[#2D1A12] dark:text-[#F4F6F8] leading-relaxed"
                  >
                    {activeTab === 'schools' && <p>{adviceData.schools}</p>}
                    {activeTab === 'workers' && <p>{adviceData.workers}</p>}
                    {activeTab === 'families' && <p>{adviceData.families}</p>}
                  </motion.div>
                </AnimatePresence>
              ) : null}
            </div>

            {/* Attribution Label */}
            <div className="mt-3 pt-2.5 border-t border-[#DFCBB3]/60 dark:border-[#354651] flex items-start gap-1.5 text-xs text-[#6B564B] dark:text-[#AAB8C2]">
              {adviceData?.isAI ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#E8874A] shrink-0 mt-0.5" />
                  <p className="leading-tight">{STRINGS.advice.aiAttribution}</p>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-[#6B564B] dark:text-[#AAB8C2] shrink-0 mt-0.5" />
                  <p className="leading-tight">{STRINGS.advice.standardAttribution}</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

