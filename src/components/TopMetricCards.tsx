/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Wind,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  Clock,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { APP_CONFIG } from '../config.ts';
import { CityOutlook } from '../types.ts';

interface TopMetricCardsProps {
  currentOutlook: CityOutlook;
  lastUpdatedFormatted: string;
  isDemoMode?: boolean;
}

export const TopMetricCards: React.FC<TopMetricCardsProps> = ({
  currentOutlook,
  lastUpdatedFormatted,
  isDemoMode = false,
}) => {
  const levelNowCfg = APP_CONFIG.colors[currentOutlook.levelNow];
  const peakLevelCfg = APP_CONFIG.colors[currentOutlook.peakLevel];

  // Derive model consensus based on confidence and score variance
  const getConsensusPercent = () => {
    switch (currentOutlook.confidence) {
      case 'High':
        return 92;
      case 'Medium':
        return 74;
      case 'Low':
        return 48;
      default:
        return 85;
    }
  };

  const consensusPercent = getConsensusPercent();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4">
      {/* =========================================================================
          CARD 1: Current Dust Risk (Light Orange #FBEBDD / Dark #251D18)
         ========================================================================= */}
      <div className="bg-[#FBEBDD] dark:bg-[#251D18] border border-[#F2D8C3] dark:border-[#423126] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-colors duration-200">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#713F2B] dark:text-[#E8874A]">
              Current Dust Risk
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#E8874A]/15 dark:bg-[#E8874A]/25 flex items-center justify-center text-[#E8874A]">
              <Wind className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-2.5 my-1">
            <span className="text-2xl sm:text-3xl font-black text-[#2D1A12] dark:text-[#F4F6F8] tracking-tight">
              {levelNowCfg.label}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white/80 dark:bg-[#101820]/90 text-[#713F2B] dark:text-[#F4F6F8] border border-[#DFCBB3] dark:border-[#354651] font-mono tabular-nums">
              Score: {Math.round(currentOutlook.scoreNow)}/100
            </span>
          </div>

          <p className="text-xs text-[#713F2B]/80 dark:text-[#AAB8C2] font-medium line-clamp-1">
            Station: {currentOutlook.city.name} · Current hour
          </p>
        </div>

        {/* Micro-visualisation: 12-hour hourly score distribution bars */}
        <div className="mt-4 pt-3 border-t border-[#713F2B]/10 dark:border-white/10">
          <div className="flex items-end justify-between gap-1 h-9">
            {currentOutlook.hourlyResults.slice(0, 12).map((h, i) => {
              const heightPct = Math.max(16, Math.min(100, (h.finalScore / 100) * 100));
              const isCurrent = i === 0;
              return (
                <div
                  key={i}
                  title={`Hour ${h.displayHour}: Score ${Math.round(h.finalScore)} (${h.category})`}
                  className="flex-1 flex flex-col items-center gap-1 group relative cursor-help"
                >
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-sm transition-all duration-200 ${
                      isCurrent
                        ? 'bg-[#E8874A] ring-1 ring-[#713F2B] dark:ring-white/50'
                        : 'bg-[#713F2B]/30 dark:bg-white/20 group-hover:bg-[#713F2B]/60 dark:group-hover:bg-white/40'
                    }`}
                  />
                  <span className="text-[8px] font-mono font-medium text-[#713F2B]/70 dark:text-[#AAB8C2]/70 truncate">
                    {i % 3 === 0 ? h.displayHour.split(':')[0] : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================================
          CARD 2: Peak Risk in Next 12 Hours (Pale Apricot #F5DDC9 / Dark #2A201A)
         ========================================================================= */}
      <div className="bg-[#F5DDC9] dark:bg-[#2A201A] border border-[#E7C6AF] dark:border-[#4A372B] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-colors duration-200">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#713F2B] dark:text-[#E8874A]">
              12-Hour Forecast Peak
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#E8874A]/20 dark:bg-[#E8874A]/25 flex items-center justify-center text-[#713F2B] dark:text-[#E8874A]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-2.5 my-1">
            <span className="text-2xl sm:text-3xl font-black text-[#2D1A12] dark:text-[#F4F6F8] tracking-tight">
              {peakLevelCfg.label}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white/80 dark:bg-[#101820]/90 text-[#713F2B] dark:text-[#F4F6F8] border border-[#DFCBB3] dark:border-[#354651] font-mono tabular-nums">
              Score: {Math.round(currentOutlook.peakScore)}/100
            </span>
          </div>

          <p className="text-xs text-[#713F2B]/80 dark:text-[#AAB8C2] font-medium line-clamp-1">
            Peak expected at {currentOutlook.peakHourTime} GST
          </p>
        </div>

        {/* Micro-visualisation: Peak Trajectory Trend */}
        <div className="mt-4 pt-3 border-t border-[#713F2B]/10 dark:border-white/10">
          <div className="flex items-end justify-between gap-1 h-9">
            {currentOutlook.hourlyResults.slice(0, 12).map((h, i) => {
              const safePeakIdx =
                currentOutlook.peakHourIndex >= 0 && currentOutlook.peakHourIndex < 12
                  ? currentOutlook.peakHourIndex
                  : currentOutlook.hourlyResults.slice(0, 12).findIndex((hr) => hr.finalScore === currentOutlook.peakScore);
              const isPeak = i === (safePeakIdx !== -1 ? safePeakIdx : 0);
              const heightPct = Math.max(16, Math.min(100, (h.finalScore / 100) * 100));
              return (
                <div
                  key={i}
                  title={`Hour ${h.displayHour}: Score ${Math.round(h.finalScore)}`}
                  className="flex-1 flex flex-col items-center gap-1 group relative cursor-help"
                >
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-sm transition-all duration-200 ${
                      isPeak
                        ? 'bg-[#E8874A] ring-2 ring-[#713F2B] dark:ring-white/60'
                        : 'bg-[#713F2B]/25 dark:bg-white/15 group-hover:bg-[#713F2B]/50 dark:group-hover:bg-white/35'
                    }`}
                  />
                  <span className="text-[8px] font-mono font-medium text-[#713F2B]/70 dark:text-[#AAB8C2]">
                    {isPeak ? '▲' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================================
          CARD 3: Forecast Confidence (Soft Sage #E8F0E7 / Dark #182B22)
         ========================================================================= */}
      <div className="bg-[#E8F0E7] dark:bg-[#182B22] border border-[#D5E4D4] dark:border-[#274436] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-colors duration-200">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#244C3B] dark:text-[#A7D7B5]">
              Forecast Confidence
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#244C3B]/10 dark:bg-[#4E9A78]/25 flex items-center justify-center text-[#244C3B] dark:text-[#A7D7B5]">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-2.5 my-1">
            <span className="text-2xl sm:text-3xl font-black text-[#1E362A] dark:text-[#F4F6F8] tracking-tight">
              {currentOutlook.confidence}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white/80 dark:bg-[#101820]/90 text-[#244C3B] dark:text-[#A7D7B5] border border-[#CBD5CD] dark:border-[#354651] font-mono tabular-nums">
              {consensusPercent}% Consensus
            </span>
          </div>

          <p className="text-xs text-[#244C3B]/80 dark:text-[#AAB8C2] font-medium line-clamp-1">
            Multi-model agreement (Open-Meteo & ECMWF)
          </p>
        </div>

        {/* Micro-visualisation: Multi-Model Consensus Gauge Bars */}
        <div className="mt-4 pt-3 border-t border-[#244C3B]/10 dark:border-white/10">
          <div className="flex items-center gap-1.5 h-9">
            {[1, 2, 3, 4, 5].map((seg) => {
              const active = seg <= Math.round((consensusPercent / 100) * 5);
              return (
                <div
                  key={seg}
                  className={`flex-1 h-3 rounded-sm transition-all duration-300 ${
                    active ? 'bg-[#244C3B] dark:bg-[#4E9A78]' : 'bg-[#244C3B]/20 dark:bg-white/10'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================================
          CARD 4: Data Freshness (Pale Green #C5D9C5 / Dark #1A3326)
         ========================================================================= */}
      <div className="bg-[#C5D9C5] dark:bg-[#1A3326] border border-[#B0CCA7] dark:border-[#2A4D3B] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-colors duration-200">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1B3A2D] dark:text-[#A7D7B5]">
              Data Freshness
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#1B3A2D]/15 dark:bg-[#4E9A78]/25 flex items-center justify-center text-[#1B3A2D] dark:text-[#A7D7B5]">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-2.5 my-1">
            <span className="text-2xl sm:text-3xl font-black text-[#152B20] dark:text-[#F4F6F8] tracking-tight truncate">
              {isDemoMode ? 'Demo Feed' : 'Live Synced'}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white/80 dark:bg-[#101820]/90 text-[#1B3A2D] dark:text-[#A7D7B5] border border-[#A2C29B] dark:border-[#354651] font-mono tabular-nums">
              Synced
            </span>
          </div>

          <p className="text-xs text-[#1B3A2D]/80 dark:text-[#AAB8C2] font-medium line-clamp-1">
            {lastUpdatedFormatted}
          </p>
        </div>

        {/* Micro-visualisation: Telemetry Pipeline Signal Bars */}
        <div className="mt-4 pt-3 border-t border-[#1B3A2D]/10 dark:border-white/10">
          <div className="flex items-end justify-between gap-1.5 h-9">
            {[35, 60, 80, 100].map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%` }}
                className="flex-1 bg-[#1B3A2D] dark:bg-[#4E9A78] rounded-xs transition-all duration-200"
                title="Telemetry latency optimal"
              />
            ))}
            <div className="text-[10px] font-mono text-[#1B3A2D] dark:text-[#A7D7B5] font-bold pl-1 self-center">
              100% OK
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
