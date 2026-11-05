/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Bell, AlertTriangle, CheckCircle2, Wind, Info, MapPin } from 'lucide-react';
import { CityOutlook } from '../types.ts';
import { CITIES, APP_CONFIG } from '../config.ts';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  outlooks: Record<string, CityOutlook>;
  onSelectCity: (cityId: string) => void;
  isDemoMode: boolean;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  outlooks,
  onSelectCity,
  isDemoMode,
}) => {
  if (!isOpen) return null;

  // Gather active atmospheric warnings across the 10 monitored UAE stations
  const activeAlerts: Array<{
    cityId: string;
    cityName: string;
    level: string;
    score: number;
    peakHour: string;
  }> = [];

  for (const city of CITIES) {
    const outlook = outlooks[city.id];
    if (outlook && (outlook.levelNow === 'High' || outlook.levelNow === 'Very High' || outlook.peakLevel === 'High' || outlook.peakLevel === 'Very High')) {
      activeAlerts.push({
        cityId: city.id,
        cityName: city.name,
        level: outlook.peakLevel,
        score: outlook.peakScore,
        peakHour: outlook.peakHourTime,
      });
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notifications-modal-title"
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
    >
      <div className="bg-[#FFFDF8] dark:bg-[#1E2D38] rounded-3xl border border-[#E7DDD0] dark:border-[#354651] shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 transition-colors">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E7DDD0] dark:border-[#354651] flex items-center justify-between bg-[#F7F1E8] dark:bg-[#18242E]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E8874A] text-white flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 id="notifications-modal-title" className="text-sm font-black text-[#244C3B] dark:text-[#F4F6F8]">
                Atmospheric Dust Advisories
              </h2>
              <p className="text-[11px] text-[#8C6D58] dark:text-[#AAB8C2]">
                Real-time regional telemetry & outlook alerts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-white dark:hover:bg-[#263743] text-[#713F2B] dark:text-[#AAB8C2] flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Close notifications"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3 max-h-[420px] overflow-y-auto text-xs">
          {isDemoMode && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Demonstration Feed Active</div>
                <div className="text-[11px] text-amber-800 dark:text-amber-300/80">
                  You are viewing simulated high-dust conditions designed for testing warning behavior.
                </div>
              </div>
            </div>
          )}

          {activeAlerts.length > 0 ? (
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-[#713F2B] dark:text-[#E8874A] uppercase tracking-wider">
                Elevated Risk Stations ({activeAlerts.length})
              </div>
              {activeAlerts.map((alert) => (
                <div
                  key={alert.cityId}
                  className="p-3 bg-[#FBEBDD] dark:bg-[#2E201B] border border-[#F2D8C3] dark:border-[#4A3225] rounded-xl flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-[#2D1A12] dark:text-[#F4F6F8] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#E8874A]" />
                      <span>{alert.cityName}</span>
                    </div>
                    <div className="text-[11px] text-[#713F2B] dark:text-[#E0BA9B]">
                      {alert.level} Risk expected around {alert.peakHour} (Score: {Math.round(alert.score)})
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCity(alert.cityId);
                      onClose();
                    }}
                    className="px-2.5 py-1.5 bg-[#713F2B] dark:bg-[#E8874A] text-white rounded-lg text-[10px] font-bold hover:bg-[#5A331A] dark:hover:bg-[#D47539] cursor-pointer transition-colors"
                  >
                    Inspect
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-[#E8F0E7] dark:bg-[#152B20] border border-[#D5E4D4] dark:border-[#204433] rounded-xl text-[#244C3B] dark:text-[#A7D7B5] flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#244C3B] dark:text-[#52B788] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Nominal Atmospheric Conditions</div>
                <div className="text-[11px] text-[#244C3B]/80 dark:text-[#A7D7B5]/80">
                  All 10 monitored UAE stations currently exhibit Low to Moderate dust levels.
                </div>
              </div>
            </div>
          )}

          {/* Official Meteorological Notice */}
          <div className="p-3 bg-[#F7F1E8] dark:bg-[#18242E] border border-[#E7DDD0] dark:border-[#354651] rounded-xl text-[11px] text-[#5A453A] dark:text-[#AAB8C2] space-y-1">
            <div className="font-bold text-[#3A1E13] dark:text-[#F4F6F8] flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-[#E8874A]" />
              <span>Advisory Notice</span>
            </div>
            <p className="leading-relaxed">
              DustWatch provides experimental research-grade estimates. Always refer to the UAE National Center of Meteorology (NCM) for official national warnings.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#F7F1E8] dark:bg-[#18242E] border-t border-[#E7DDD0] dark:border-[#354651] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-[#244C3B] dark:bg-[#3D7A60] text-white rounded-xl text-xs font-bold hover:bg-[#1B3A2D] dark:hover:bg-[#4E9A78] cursor-pointer transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
