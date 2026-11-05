/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Wind,
  Droplets,
  Thermometer,
  Eye,
  MapPin,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldAlert,
  Compass,
} from 'lucide-react';
import { CITIES, APP_CONFIG } from '../config.ts';
import { CityOutlook, HourlyRiskResult, RiskCategory } from '../types.ts';

interface StationInsightsPanelProps {
  currentOutlook: CityOutlook;
  selectedHourResult: HourlyRiskResult;
  selectedCityId: string;
  onSelectCity: (cityId: string) => void;
  outlooks: Record<string, CityOutlook>;
  viewMode: 'now' | 'highest12h';
}

export const StationInsightsPanel: React.FC<StationInsightsPanelProps> = ({
  currentOutlook,
  selectedHourResult,
  selectedCityId,
  onSelectCity,
  outlooks,
  viewMode,
}) => {
  const [showScientificDetails, setShowScientificDetails] = useState(false);
  const [showAllStations, setShowAllStations] = useState(false);

  // Read current environmental telemetry safely from subScores and contextVariables
  const pm10 = selectedHourResult.subScores.pm10?.rawValue ?? null;
  const pm25 = selectedHourResult.contextVariables?.pm2_5?.value ?? null;
  const windSpeed = selectedHourResult.subScores.wind_speed_10m?.rawValue ?? null;
  const temp = selectedHourResult.contextVariables?.temperature_2m?.value ?? null;
  const humidity = selectedHourResult.subScores.relative_humidity_2m?.rawValue ?? null;
  const rawVis = selectedHourResult.subScores.visibility?.rawValue ?? null;
  const visibility = rawVis != null ? rawVis / 1000 : null; // in km

  // Calculations for horizontal progress bars (scaled sensibly to domain ranges)
  const pm10Pct = pm10 != null ? Math.min(100, Math.round((pm10 / 150) * 100)) : 0;
  const pm25Pct = pm25 != null ? Math.min(100, Math.round((pm25 / 75) * 100)) : 0;
  const windPct = windSpeed != null ? Math.min(100, Math.round((windSpeed / 50) * 100)) : 0;
  const humidityPct = humidity != null ? Math.min(100, Math.round(humidity)) : 0;

  const currentRisk = viewMode === 'now' ? currentOutlook.levelNow : currentOutlook.peakLevel;
  const riskCfg = APP_CONFIG.colors[currentRisk];

  return (
    <div className="space-y-4">
      {/* =========================================================================
          MODULE 1: Station Insights & Telemetry (Reference: "Platform Insight")
         ========================================================================= */}
      <div className="bg-[#FFFDF8] dark:bg-[#1E2D38] border border-[#E7DDD0] dark:border-[#354651] rounded-2xl p-5 shadow-2xs transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-[#E7DDD0] dark:border-[#354651]">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#713F2B] dark:text-[#E8874A]">
              Station Telemetry
            </span>
            <h3 className="text-lg font-black text-[#244C3B] dark:text-[#F4F6F8] tracking-tight flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#E8874A]" />
              <span>{currentOutlook.city.name}</span>
            </h3>
          </div>
          <span
            style={{
              backgroundColor: riskCfg.badgeBg,
              color: riskCfg.badgeText,
              borderColor: riskCfg.border,
            }}
            className="text-xs font-bold px-2.5 py-1 rounded-lg border font-mono"
          >
            {riskCfg.label} · {Math.round(viewMode === 'now' ? currentOutlook.scoreNow : currentOutlook.peakScore)}
          </span>
        </div>

        {/* Environmental Telemetry Bars (styled like the reference screenshot's progress bars) */}
        <div className="space-y-3.5 text-xs">
          {/* Reading 1: PM10 Particulate */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[#2D221C] dark:text-[#F4F6F8]">
              <span className="font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#E8874A]" />
                PM10 Coarse Dust
              </span>
              <span className="font-mono font-bold tabular-nums text-[#713F2B] dark:text-[#E8874A]">
                {pm10 != null ? `${Math.round(pm10)} µg/m³` : 'N/A'}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#F7F1E8] dark:bg-[#101820] overflow-hidden border border-[#E7DDD0] dark:border-[#354651]">
              <div
                style={{ width: `${pm10Pct}%` }}
                className="h-full bg-[#E8874A] rounded-full transition-all duration-300"
              />
            </div>
          </div>

          {/* Reading 2: PM2.5 Fine Dust */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[#2D221C] dark:text-[#F4F6F8]">
              <span className="font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#D57639]" />
                PM2.5 Fine Particles
              </span>
              <span className="font-mono font-bold tabular-nums text-[#713F2B] dark:text-[#E8874A]">
                {pm25 != null ? `${Math.round(pm25)} µg/m³` : 'N/A'}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#F7F1E8] dark:bg-[#101820] overflow-hidden border border-[#E7DDD0] dark:border-[#354651]">
              <div
                style={{ width: `${pm25Pct}%` }}
                className="h-full bg-[#D57639] rounded-full transition-all duration-300"
              />
            </div>
          </div>

          {/* Reading 3: Surface Wind */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[#2D221C] dark:text-[#F4F6F8]">
              <span className="font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#244C3B] dark:bg-[#4E9A78]" />
                Wind Velocity & Direction
              </span>
              <span className="font-mono font-bold tabular-nums text-[#244C3B] dark:text-[#4E9A78]">
                {windSpeed != null ? `${Math.round(windSpeed)} km/h` : 'N/A'}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#F7F1E8] dark:bg-[#101820] overflow-hidden border border-[#E7DDD0] dark:border-[#354651]">
              <div
                style={{ width: `${windPct}%` }}
                className="h-full bg-[#244C3B] dark:bg-[#4E9A78] rounded-full transition-all duration-300"
              />
            </div>
          </div>

          {/* Reading 4: Relative Humidity */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[#2D221C] dark:text-[#F4F6F8]">
              <span className="font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#3D7058] dark:bg-[#52B788]" />
                Relative Humidity
              </span>
              <span className="font-mono font-bold tabular-nums text-[#3D7058] dark:text-[#52B788]">
                {humidity != null ? `${Math.round(humidity)}%` : 'N/A'}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#F7F1E8] dark:bg-[#101820] overflow-hidden border border-[#E7DDD0] dark:border-[#354651]">
              <div
                style={{ width: `${humidityPct}%` }}
                className="h-full bg-[#3D7058] dark:bg-[#52B788] rounded-full transition-all duration-300"
              />
            </div>
          </div>

          {/* Reading 5: Temperature & Visibility Pills */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2.5 bg-[#F7F1E8] dark:bg-[#101820] rounded-xl border border-[#E7DDD0] dark:border-[#354651]">
              <div className="text-[10px] uppercase font-bold text-[#8C6D58] dark:text-[#AAB8C2]">Temperature</div>
              <div className="text-sm font-black font-mono text-[#244C3B] dark:text-[#F4F6F8] tabular-nums">
                {temp != null ? `${Math.round(temp)}°C` : 'N/A'}
              </div>
            </div>
            <div className="p-2.5 bg-[#F7F1E8] dark:bg-[#101820] rounded-xl border border-[#E7DDD0] dark:border-[#354651]">
              <div className="text-[10px] uppercase font-bold text-[#8C6D58] dark:text-[#AAB8C2]">Visibility</div>
              <div className="text-sm font-black font-mono text-[#244C3B] dark:text-[#F4F6F8] tabular-nums">
                {visibility != null ? `${visibility.toFixed(1)} km` : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Scientific Breakdown Accordion Toggle */}
        <div className="mt-4 pt-3 border-t border-[#E7DDD0] dark:border-[#354651]">
          <button
            type="button"
            onClick={() => setShowScientificDetails(!showScientificDetails)}
            aria-expanded={showScientificDetails}
            aria-controls="scientific-factor-details"
            className="w-full flex items-center justify-between text-xs font-bold text-[#713F2B] dark:text-[#E8874A] hover:text-[#E8874A] py-1 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8874A] rounded"
          >
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#E8874A]" />
              <span>Scientific Factor Attribution</span>
            </span>
            {showScientificDetails ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showScientificDetails && (
            <div id="scientific-factor-details" className="mt-2.5 p-3 bg-[#F7F1E8] dark:bg-[#101820] rounded-xl text-[11px] text-[#5A453A] dark:text-[#AAB8C2] space-y-2 border border-[#E7DDD0] dark:border-[#354651]">
              <div className="flex justify-between">
                <span>PM10 Subscore Contribution:</span>
                <span className="font-mono font-bold text-[#2D221C] dark:text-[#F4F6F8]">
                  {selectedHourResult.subScores.pm10?.subScore != null ? Math.round(selectedHourResult.subScores.pm10.subScore) : 'N/A'}/100
                </span>
              </div>
              <div className="flex justify-between">
                <span>Wind Speed Subscore:</span>
                <span className="font-mono font-bold text-[#2D221C] dark:text-[#F4F6F8]">
                  {selectedHourResult.subScores.wind_speed_10m?.subScore != null ? Math.round(selectedHourResult.subScores.wind_speed_10m.subScore) : 'N/A'}/100
                </span>
              </div>
              <div className="flex justify-between">
                <span>Humidity Dampening Factor:</span>
                <span className="font-mono font-bold text-[#2D221C] dark:text-[#F4F6F8]">
                  {selectedHourResult.subScores.relative_humidity_2m?.subScore != null ? Math.round(selectedHourResult.subScores.relative_humidity_2m.subScore) : 'N/A'}/100
                </span>
              </div>
              <div className="flex justify-between">
                <span>Aerosol Optical Depth (AOD):</span>
                <span className="font-mono font-bold text-[#2D221C] dark:text-[#F4F6F8]">
                  {selectedHourResult.subScores.aerosol_optical_depth?.subScore != null ? Math.round(selectedHourResult.subScores.aerosol_optical_depth.subScore) : 'N/A'}/100
                </span>
              </div>
              <p className="text-[10px] text-[#8C6D58] dark:text-[#AAB8C2] pt-1 border-t border-[#DFCBB3] dark:border-[#354651]">
                Evaluated deterministically from hourly numerical weather prediction (NWP) model outputs.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          MODULE 2: Monitored UAE Stations List (Reference: "Applicants")
         ========================================================================= */}
      <div className="bg-[#FFFDF8] dark:bg-[#1E2D38] border border-[#E7DDD0] dark:border-[#354651] rounded-2xl p-5 shadow-2xs transition-colors">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E7DDD0] dark:border-[#354651]">
          <button
            type="button"
            onClick={() => setShowAllStations(!showAllStations)}
            aria-expanded={showAllStations}
            aria-controls="monitored-stations-list"
            className="text-left group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#E8874A] rounded p-0.5"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#713F2B] dark:text-[#E8874A] block">
              National Network
            </span>
            <h3 className="text-base font-black text-[#244C3B] dark:text-[#F4F6F8] group-hover:text-[#E8874A] tracking-tight transition-colors">
              UAE Monitored Stations
            </h3>
          </button>
          <button
            type="button"
            onClick={() => setShowAllStations(!showAllStations)}
            aria-expanded={showAllStations}
            aria-controls="monitored-stations-list"
            className="text-xs font-bold text-[#713F2B] dark:text-[#E8874A] hover:text-[#E8874A] flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F7F1E8] dark:bg-[#101820] border border-[#DFCBB3] dark:border-[#354651] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8874A]"
          >
            <span>{showAllStations ? 'Collapse List' : 'Expand All (10)'}</span>
            {showAllStations ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* When collapsed: show active station card summary */}
        {!showAllStations && (
          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-[#E8D2B4]/40 dark:bg-[#263743] border-2 border-[#E8874A] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  style={{ backgroundColor: riskCfg.bg, color: riskCfg.text }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 shadow-2xs"
                >
                  {riskCfg.abbr}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs text-[#244C3B] dark:text-[#F4F6F8] truncate flex items-center gap-1">
                    <span>{currentOutlook.city.name}</span>
                    <span className="text-[10px] text-[#713F2B] dark:text-[#E8874A] font-normal">(Active Selection)</span>
                  </div>
                  <div className="text-[10px] text-[#8C6D58] dark:text-[#AAB8C2]">
                    {currentOutlook.city.latitude.toFixed(1)}°N, {currentOutlook.city.longitude.toFixed(1)}°E
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  style={{
                    backgroundColor: riskCfg.badgeBg,
                    color: riskCfg.badgeText,
                    borderColor: riskCfg.border,
                  }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded border"
                >
                  {riskCfg.label}
                </span>
                <span className="font-mono text-xs font-bold text-[#713F2B] dark:text-[#F4F6F8] w-6 text-right tabular-nums">
                  {Math.round(viewMode === 'now' ? currentOutlook.scoreNow : currentOutlook.peakScore)}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-[#8C6D58] dark:text-[#AAB8C2] text-center pt-1">
              Click &ldquo;Expand All (10)&rdquo; above to switch monitoring stations.
            </p>
          </div>
        )}

        {/* Expanded Stations List */}
        {showAllStations && (
          <div id="monitored-stations-list" className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
            {CITIES.map((city) => {
              const outlook = outlooks[city.id];
              const cat = outlook
                ? viewMode === 'now'
                  ? outlook.levelNow
                  : outlook.peakLevel
                : 'Low';
              const score = outlook
                ? viewMode === 'now'
                  ? outlook.scoreNow
                  : outlook.peakScore
                : 0;
              const catCfg = APP_CONFIG.colors[cat];
              const isSelected = city.id === selectedCityId;

              return (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => onSelectCity(city.id)}
                  className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#E8D2B4]/50 dark:bg-[#263743] border-2 border-[#E8874A] shadow-2xs'
                      : 'bg-[#F7F1E8]/70 dark:bg-[#101820]/70 hover:bg-[#F7F1E8] dark:hover:bg-[#101820] border border-[#E7DDD0] dark:border-[#354651]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      style={{ backgroundColor: catCfg.bg, color: catCfg.text }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 shadow-2xs"
                    >
                      {catCfg.abbr}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-[#244C3B] dark:text-[#F4F6F8] truncate flex items-center gap-1">
                        <span>{city.name}</span>
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E8874A]" />
                        )}
                      </div>
                      <div className="text-[10px] text-[#8C6D58] dark:text-[#AAB8C2] truncate">
                        {city.latitude.toFixed(1)}°N, {city.longitude.toFixed(1)}°E
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      style={{
                        backgroundColor: catCfg.badgeBg,
                        color: catCfg.badgeText,
                        borderColor: catCfg.border,
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded border"
                    >
                      {catCfg.label}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#713F2B] dark:text-[#F4F6F8] w-6 text-right tabular-nums">
                      {Math.round(score)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
