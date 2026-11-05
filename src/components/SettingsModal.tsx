/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Settings, ShieldCheck, Sliders, BellRing, RefreshCw, Sun, Moon } from 'lucide-react';
import { useTheme } from '../themeContext.tsx';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isDemoMode,
  onToggleDemoMode,
  onRefresh,
  isRefreshing,
}) => {
  const [autoRefreshInterval, setAutoRefreshInterval] = useState('30');
  const [temperatureUnit, setTemperatureUnit] = useState<'C' | 'F'>('C');
  const [windUnit, setWindUnit] = useState<'kmh' | 'knots' | 'ms'>('kmh');
  const { theme, setTheme, isDark } = useTheme();

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
    >
      <div className="bg-[#FFFDF8] dark:bg-[#1E2D38] rounded-3xl border border-[#E7DDD0] dark:border-[#354651] shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 transition-colors">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E7DDD0] dark:border-[#354651] flex items-center justify-between bg-[#F7F1E8] dark:bg-[#18242E]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#244C3B] dark:bg-[#1E382E] text-white flex items-center justify-center">
              <Settings className="w-5 h-5 text-[#E8874A]" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-base font-black text-[#244C3B] dark:text-[#F4F6F8]">
                DustWatch Preferences
              </h2>
              <p className="text-xs text-[#8C6D58] dark:text-[#AAB8C2]">
                Display, telemetry pipeline & monitoring configuration
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white dark:hover:bg-[#263743] text-[#713F2B] dark:text-[#AAB8C2] flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs text-[#2D221C] dark:text-[#F4F6F8] max-h-[calc(85vh-120px)] overflow-y-auto">
          {/* Interface Theme Selection */}
          <div className="space-y-2 p-3.5 bg-[#F7F1E8] dark:bg-[#18242E] rounded-2xl border border-[#E7DDD0] dark:border-[#354651]">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-[#713F2B] dark:text-[#F4F6F8]">Interface Theme</div>
                <div className="text-[11px] text-[#8C6D58] dark:text-[#AAB8C2]">
                  Select light cream or environmental dark intelligence theme
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E8874A]/10 text-[#E8874A] border border-[#E8874A]/30">
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setTheme('light')}
                data-testid="theme-toggle-light"
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                  !isDark
                    ? 'bg-white text-[#713F2B] border-[#E8874A] shadow-xs ring-2 ring-[#E8874A]/20'
                    : 'bg-[#101820] text-[#AAB8C2] border-[#354651] hover:text-[#F4F6F8]'
                }`}
                aria-pressed={!isDark}
              >
                <Sun className={`w-4 h-4 ${!isDark ? 'text-amber-500' : 'text-zinc-400'}`} />
                <span>Light Mode</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                data-testid="theme-toggle-dark"
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                  isDark
                    ? 'bg-[#263743] text-white border-[#E8874A] shadow-xs ring-2 ring-[#E8874A]/40'
                    : 'bg-[#FFFDF8] text-[#5A453A] border-[#DFCBB3] hover:text-[#2D221C]'
                }`}
                aria-pressed={isDark}
              >
                <Moon className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-zinc-500'}`} />
                <span>Dark Mode</span>
              </button>
            </div>
          </div>

          {/* Demonstration Mode Switch */}
          <div className="flex items-center justify-between p-3.5 bg-[#F7F1E8] dark:bg-[#18242E] rounded-2xl border border-[#E7DDD0] dark:border-[#354651]">
            <div>
              <div className="font-bold text-[#713F2B] dark:text-[#F4F6F8]">Demonstration Feed (Demo Mode)</div>
              <div className="text-[11px] text-[#8C6D58] dark:text-[#AAB8C2]">
                Inject simulated severe regional dust events across UAE stations
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isDemoMode}
              onClick={onToggleDemoMode}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isDemoMode ? 'bg-[#E8874A] text-white' : 'bg-white dark:bg-[#1E2D38] text-[#713F2B] dark:text-[#F4F6F8] border border-[#DFCBB3] dark:border-[#354651]'
              }`}
            >
              {isDemoMode ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Refresh Cadence */}
          <div className="space-y-1.5">
            <label htmlFor="refresh-cadence-select" className="font-bold text-[#244C3B] dark:text-[#F4F6F8] block">
              Telemetry Auto-Refresh Interval
            </label>
            <select
              id="refresh-cadence-select"
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(e.target.value)}
              className="w-full bg-[#F7F1E8] dark:bg-[#101820] border border-[#DFCBB3] dark:border-[#354651] rounded-xl px-3 py-2 text-xs font-semibold text-[#2D221C] dark:text-[#F4F6F8] focus:outline-none focus:border-[#E8874A]"
            >
              <option value="15">Every 15 minutes (High frequency)</option>
              <option value="30">Every 30 minutes (Standard optimal)</option>
              <option value="60">Every 60 minutes (Conservative bandwidth)</option>
            </select>
          </div>

          {/* Unit Preferences */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="temp-unit-select" className="font-bold text-[#244C3B] dark:text-[#F4F6F8] block">
                Temperature Unit
              </label>
              <select
                id="temp-unit-select"
                value={temperatureUnit}
                onChange={(e) => setTemperatureUnit(e.target.value as 'C' | 'F')}
                className="w-full bg-[#F7F1E8] dark:bg-[#101820] border border-[#DFCBB3] dark:border-[#354651] rounded-xl px-3 py-2 text-xs font-semibold text-[#2D221C] dark:text-[#F4F6F8] focus:outline-none focus:border-[#E8874A]"
              >
                <option value="C">Celsius (°C)</option>
                <option value="F">Fahrenheit (°F)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="wind-unit-select" className="font-bold text-[#244C3B] dark:text-[#F4F6F8] block">
                Wind Velocity Unit
              </label>
              <select
                id="wind-unit-select"
                value={windUnit}
                onChange={(e) => setWindUnit(e.target.value as 'kmh' | 'knots' | 'ms')}
                className="w-full bg-[#F7F1E8] dark:bg-[#101820] border border-[#DFCBB3] dark:border-[#354651] rounded-xl px-3 py-2 text-xs font-semibold text-[#2D221C] dark:text-[#F4F6F8] focus:outline-none focus:border-[#E8874A]"
              >
                <option value="kmh">Kilometres per hour (km/h)</option>
                <option value="knots">Knots (kn)</option>
                <option value="ms">Metres per second (m/s)</option>
              </select>
            </div>
          </div>

          {/* Manual Cache Purge */}
          <div className="pt-2 border-t border-[#E7DDD0] dark:border-[#354651] flex items-center justify-between">
            <div>
              <div className="font-bold text-[#244C3B] dark:text-[#F4F6F8]">Force Cache Sync</div>
              <div className="text-[11px] text-[#8C6D58] dark:text-[#AAB8C2]">Bypass client cache and fetch fresh NWP grids</div>
            </div>
            <button
              type="button"
              onClick={() => {
                onRefresh();
                onClose();
              }}
              disabled={isRefreshing}
              className="px-3.5 py-2 bg-[#244C3B] dark:bg-[#3D7A60] text-white rounded-xl text-xs font-bold hover:bg-[#1B3A2D] dark:hover:bg-[#4E9A78] cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F7F1E8] dark:bg-[#18242E] border-t border-[#E7DDD0] dark:border-[#354651] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#713F2B] dark:bg-[#E8874A] text-white rounded-xl text-xs font-bold hover:bg-[#5A331A] dark:hover:bg-[#D47539] cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
