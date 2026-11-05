/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertCircle, Cpu, Info, ShieldAlert } from 'lucide-react';
import { STRINGS } from '../strings.ts';
import { HourlyRiskResult, ModelFileConfig } from '../types.ts';

interface WhyThisRatingProps {
  selectedHour: HourlyRiskResult;
  activeModelInfo?: {
    name: string;
    version: string;
    trainedDate: string;
  };
}

export const WhyThisRating: React.FC<WhyThisRatingProps> = ({
  selectedHour,
  activeModelInfo,
}) => {
  const subScores = selectedHour.subScores;
  const scoredFactorKeys = Object.keys(subScores);

  const getStatusBadge = (status: 'low' | 'moderate' | 'high' | 'missing') => {
    switch (status) {
      case 'high':
        return <span className="text-[10px] bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 font-semibold px-1.5 py-0.2 rounded border border-red-200 dark:border-red-800">High</span>;
      case 'moderate':
        return <span className="text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800">Moderate</span>;
      case 'low':
        return <span className="text-[10px] bg-[#E8D2B4]/40 dark:bg-[#263743] text-[#713F2B] dark:text-[#E8874A] font-semibold px-1.5 py-0.2 rounded border border-[#DFCBB3] dark:border-[#354651]">Low</span>;
      case 'missing':
        return <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold px-1.5 py-0.2 rounded border border-gray-300 dark:border-gray-700">Missing</span>;
    }
  };

  return (
    <div className="bg-[#FFFDFB] dark:bg-[#1E2D38] border border-[#DFCBB3] dark:border-[#354651] rounded-xl p-5 shadow-xs transition-colors">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm text-[#713F2B] dark:text-[#F4F6F8]">
          {STRINGS.whyThisRating.title}
        </h3>
        <span className="text-xs font-bold text-[#713F2B] dark:text-[#E8874A] bg-[#E8D2B4]/50 dark:bg-[#263743] border border-[#DFCBB3] dark:border-[#354651] px-2.5 py-0.5 rounded-md">
          Hour: {selectedHour.displayHour}
        </span>
      </div>

      <p className="text-xs text-[#6B564B] dark:text-[#AAB8C2] mb-4">
        {STRINGS.whyThisRating.hourSubtitle(selectedHour.displayHour)}
      </p>

      {/* Active Mode Banner */}
      <div className="mb-4 p-3 rounded-lg bg-[#F7F1E8] dark:bg-[#18242E] border border-[#DFCBB3] dark:border-[#354651] text-xs text-[#2D1A12] dark:text-[#F4F6F8] flex items-start gap-2.5">
        <Cpu className="w-4 h-4 text-[#E8874A] shrink-0 mt-0.5" />
        <div>
          {activeModelInfo ? (
            <span className="font-medium">
              {STRINGS.whyThisRating.activeModeModel(
                activeModelInfo.name,
                activeModelInfo.version,
                activeModelInfo.trainedDate
              )}
            </span>
          ) : (
            <span className="font-medium text-[#6B564B] dark:text-[#AAB8C2]">
              {STRINGS.whyThisRating.activeModeBaseline}
            </span>
          )}
        </div>
      </div>

      {/* When trained model is active, show comparison next to baseline */}
      {selectedHour.modelScore !== undefined && (
        <div className="mb-4 p-3 rounded-lg bg-[#E8D2B4]/30 dark:bg-[#263743] border border-[#DFCBB3] dark:border-[#354651] text-xs text-[#2D1A12] dark:text-[#F4F6F8]">
          <div className="font-semibold mb-1 text-[#713F2B] dark:text-[#E8874A]">{STRINGS.whyThisRating.comparisonTitle}</div>
          <p>
            {STRINGS.whyThisRating.baselineComparison(
              selectedHour.baselineCategory,
              Math.round(selectedHour.baselineScore),
              selectedHour.category,
              Math.round(selectedHour.finalScore)
            )}
          </p>
        </div>
      )}

      {/* Particle cap notice if active */}
      {selectedHour.isParticleCapped && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-[#2A201A] border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <p>{STRINGS.whyThisRating.particleCapNotice}</p>
        </div>
      )}

      {/* Missing variables warning */}
      {selectedHour.missingVariables.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-900 dark:text-red-200 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">{STRINGS.whyThisRating.missingDataWarning}: </span>
            <span>{selectedHour.missingVariables.join(', ')} (confidence lowered)</span>
          </div>
        </div>
      )}

      {/* Scored factors list */}
      <div className="mb-4">
        <div className="text-xs font-bold text-[#713F2B] dark:text-[#E8874A] uppercase tracking-wider mb-2.5">
          {STRINGS.whyThisRating.scoredFactors}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {scoredFactorKeys.map((key) => {
            const factor = subScores[key];
            if (!factor) return null;

            return (
              <div
                key={key}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[#F7F1E8] dark:bg-[#18242E] border border-[#DFCBB3]/80 dark:border-[#354651]"
              >
                <div>
                  <div className="font-semibold text-[#2D1A12] dark:text-[#F4F6F8]">{factor.displayName}</div>
                  <div className="text-[11px] text-[#6B564B] dark:text-[#AAB8C2]">
                    {factor.rawValue !== null
                      ? `${factor.rawValue} ${factor.unit}`
                      : 'Missing (null)'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(factor.status)}
                  {factor.subScore !== null && (
                    <span className="font-mono text-xs font-semibold text-[#6B564B] dark:text-[#AAB8C2] w-6 text-right">
                      {Math.round(factor.subScore)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Contextual factors (PM2.5, Temperature) */}
      <div className="mb-4 pt-3 border-t border-[#DFCBB3] dark:border-[#354651]">
        <div className="text-xs font-bold text-[#713F2B] dark:text-[#E8874A] uppercase tracking-wider mb-2">
          {STRINGS.whyThisRating.contextFactors}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-[#F7F1E8] dark:bg-[#18242E] border border-[#DFCBB3]/80 dark:border-[#354651] flex justify-between items-center">
            <span className="text-[#6B564B] dark:text-[#AAB8C2]">PM2.5 particles:</span>
            <span className="font-bold text-[#2D1A12] dark:text-[#F4F6F8]">
              {selectedHour.contextVariables.pm2_5.value !== null
                ? `${selectedHour.contextVariables.pm2_5.value} ${selectedHour.contextVariables.pm2_5.unit}`
                : 'n/a'}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#F7F1E8] dark:bg-[#18242E] border border-[#DFCBB3]/80 dark:border-[#354651] flex justify-between items-center">
            <span className="text-[#6B564B] dark:text-[#AAB8C2]">Air Temperature:</span>
            <span className="font-bold text-[#2D1A12] dark:text-[#F4F6F8]">
              {selectedHour.contextVariables.temperature_2m.value !== null
                ? `${selectedHour.contextVariables.temperature_2m.value} ${selectedHour.contextVariables.temperature_2m.unit}`
                : 'n/a'}
            </span>
          </div>
        </div>
      </div>

      {/* Top contributors */}
      {selectedHour.topContributors.length > 0 && (
        <div className="mb-4 text-xs text-[#6B564B] dark:text-[#AAB8C2]">
          <span className="font-semibold text-[#2D1A12] dark:text-[#F4F6F8]">
            {STRINGS.whyThisRating.topContributors}:{' '}
          </span>
          <span>{selectedHour.topContributors.join('; ')}</span>
        </div>
      )}

      {/* Scientific Caution */}
      <div className="p-3 rounded-lg bg-[#E8D2B4]/40 dark:bg-[#263743] border border-[#DFCBB3] dark:border-[#354651] text-xs text-[#2D1A12] dark:text-[#F4F6F8] flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#713F2B] dark:text-[#E8874A] shrink-0 mt-0.5" />
        <p className="leading-relaxed italic">{STRINGS.whyThisRating.scientificCaution}</p>
      </div>
    </div>
  );
};
