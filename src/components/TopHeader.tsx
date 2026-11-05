/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Compass,
  AlertTriangle,
  Menu,
  X,
  MapPin,
  Clock,
  Radio,
  Sun,
  Moon,
} from 'lucide-react';
import { CITIES, APP_CONFIG } from '../config.ts';
import { CityOutlook, RiskCategory } from '../types.ts';
import { ScreenId } from './Sidebar.tsx';
import { useTheme } from '../themeContext.tsx';

interface TopHeaderProps {
  activeScreen: ScreenId;
  selectedCityId: string;
  onSelectCity: (cityId: string) => void;
  outlooks: Record<string, CityOutlook>;
  viewMode: 'now' | 'highest12h';
  onChangeViewMode: (mode: 'now' | 'highest12h') => void;
  lastUpdatedFormatted: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
  onSelectScreen: (screen: ScreenId) => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeScreen,
  selectedCityId,
  onSelectCity,
  outlooks,
  viewMode,
  onChangeViewMode,
  lastUpdatedFormatted,
  isRefreshing,
  onRefresh,
  isDemoMode,
  onOpenNotifications,
  unreadNotificationsCount,
  onSelectScreen,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { isDark, toggleTheme } = useTheme();

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter cities by search query
  const filteredCities = CITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Dynamic contextual greeting based on UAE time (UTC+4)
  const getContextualGreeting = () => {
    try {
      const now = new Date();
      // UTC + 4 for GST
      const uaeHour = (now.getUTCHours() + 4) % 24;
      if (uaeHour >= 5 && uaeHour < 12) return 'Good morning';
      if (uaeHour >= 12 && uaeHour < 17) return 'Good afternoon';
      return 'Good evening';
    } catch {
      return 'Good day';
    }
  };

  const currentCity = CITIES.find((c) => c.id === selectedCityId) || CITIES[0];
  const currentOutlook = outlooks[selectedCityId];
  const currentRisk = currentOutlook ? (viewMode === 'now' ? currentOutlook.levelNow : currentOutlook.peakLevel) : 'Low';
  const riskConfig = APP_CONFIG.colors[currentRisk];

  const getScreenTitle = () => {
    switch (activeScreen) {
      case 'home':
        return 'Overview & Environmental Summary';
      case 'map':
        return 'Atmospheric Dust Monitor';
      case 'school-mode':
        return 'School Mode Policy Assessment';
      case 'accuracy':
        return 'Accuracy & Model Verification';
      case 'how-it-works':
        return 'Scientific Methodology';
      case 'test-view':
        return 'Evaluation & Test Workbench';
      default:
        return 'Atmospheric Dust Monitor';
    }
  };

  return (
    <header className="px-5 sm:px-8 py-5 border-b border-[#E7DDD0] dark:border-[#2B3D4A] bg-[#FFFDF8] dark:bg-[#18242E] flex flex-col gap-4 transition-colors duration-200 print:hidden">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Contextual Greeting & Active Page Title */}
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#8C6D58] dark:text-[#AAB8C2] uppercase tracking-wider">
              {getContextualGreeting()} · UAE
            </span>
            {isDemoMode && (
              <span className="text-[10px] bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                Demo Active
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#244C3B] dark:text-[#F4F6F8] tracking-tight truncate">
            {getScreenTitle()}
          </h1>
          <p className="text-xs text-[#5F6762] dark:text-[#AAB8C2] hidden sm:block">
            10 monitored stations across 7 Emirates · Asia/Dubai Timezone (GST)
          </p>
        </div>

        {/* Center / Right Controls */}
        <div className="flex items-center gap-3">
          {/* Quick Station Search Bar (Desktop) */}
          <div ref={searchRef} className="relative hidden md:block w-56 lg:w-72">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#8C6D58] dark:text-[#AAB8C2] absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search UAE stations..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                className="w-full pl-9 pr-3 py-2 bg-[#F7F1E8] hover:bg-[#F2EAE0] dark:bg-[#1E2D38] dark:hover:bg-[#263743] dark:focus:bg-[#1E2D38] text-xs text-[#2D221C] dark:text-[#F4F6F8] placeholder-[#8C6D58] dark:placeholder-[#AAB8C2] rounded-xl border border-[#DFCBB3] dark:border-[#354651] focus:border-[#E8874A] focus:outline-none transition-all shadow-2xs"
                aria-label="Search monitoring stations"
              />
            </div>

            {/* Autocomplete Dropdown */}
            {isSearchOpen && (
              <div className="absolute top-full mt-1.5 left-0 right-0 bg-[#FFFDF8] dark:bg-[#1E2D38] rounded-xl border border-[#DFCBB3] dark:border-[#354651] shadow-lg py-2 z-50 max-h-64 overflow-y-auto">
                <div className="px-3 py-1 text-[11px] font-bold text-[#8C6D58] dark:text-[#AAB8C2] uppercase tracking-wider">
                  Monitored Stations ({filteredCities.length})
                </div>
                {filteredCities.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-[#5F6762] dark:text-[#AAB8C2]">No stations found</div>
                ) : (
                  filteredCities.map((city) => {
                    const cityOutlook = outlooks[city.id];
                    const cat = cityOutlook ? (viewMode === 'now' ? cityOutlook.levelNow : cityOutlook.peakLevel) : 'Low';
                    const catCfg = APP_CONFIG.colors[cat];
                    const isSelected = city.id === selectedCityId;

                    return (
                      <button
                        key={city.id}
                        type="button"
                        onClick={() => {
                          onSelectCity(city.id);
                          onSelectScreen('map');
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#E8D2B4]/40 dark:bg-[#263743] text-[#244C3B] dark:text-[#F4F6F8] font-bold'
                            : 'hover:bg-[#F7F1E8] dark:hover:bg-[#263743] text-[#2D221C] dark:text-[#F4F6F8]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-[#E8874A]" />
                          <span>{city.name}</span>
                        </div>
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
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* View Mode Toggle Button ("Now" vs "12h Peak") */}
          <div className="hidden sm:inline-flex rounded-xl bg-[#F7F1E8] dark:bg-[#101820] p-1 border border-[#DFCBB3] dark:border-[#354651]">
            <button
              type="button"
              onClick={() => onChangeViewMode('now')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[36px] ${
                viewMode === 'now'
                  ? 'bg-white dark:bg-[#263743] text-[#713F2B] dark:text-[#F4F6F8] shadow-2xs'
                  : 'text-[#5A453A] dark:text-[#AAB8C2] hover:text-[#713F2B] dark:hover:text-[#F4F6F8]'
              }`}
            >
              Current (Now)
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode('highest12h')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[36px] ${
                viewMode === 'highest12h'
                  ? 'bg-white dark:bg-[#263743] text-[#713F2B] dark:text-[#F4F6F8] shadow-2xs'
                  : 'text-[#5A453A] dark:text-[#AAB8C2] hover:text-[#713F2B] dark:hover:text-[#F4F6F8]'
              }`}
            >
              12h Peak
            </button>
          </div>

          {/* Quick-Access Theme Toggle (Desktop & Tablet) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-10 h-10 rounded-xl bg-[#F7F1E8] hover:bg-[#F2EAE0] dark:bg-[#1E2D38] dark:hover:bg-[#263743] border border-[#DFCBB3] dark:border-[#354651] text-[#244C3B] dark:text-[#E8874A] hidden md:flex items-center justify-center relative cursor-pointer transition-colors active:scale-95"
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#244C3B]" />}
          </button>

          {/* Notifications Bell Button (Desktop & Tablet) */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="w-10 h-10 rounded-xl bg-[#F7F1E8] hover:bg-[#F2EAE0] dark:bg-[#1E2D38] dark:hover:bg-[#263743] border border-[#DFCBB3] dark:border-[#354651] text-[#244C3B] dark:text-[#F4F6F8] hidden md:flex items-center justify-center relative cursor-pointer transition-colors active:scale-95"
            aria-label="View Atmospheric Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E8874A] text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-xs">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Data Freshness & Refresh Control (Desktop & Tablet) */}
          <div className="hidden md:flex items-center gap-2 pl-1 border-l border-[#DFCBB3] dark:border-[#354651]">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              title={`Last updated: ${lastUpdatedFormatted}. Click to refresh.`}
              className="px-3 py-2 bg-[#F7F1E8] hover:bg-[#F2EAE0] dark:bg-[#1E2D38] dark:hover:bg-[#263743] border border-[#DFCBB3] dark:border-[#354651] rounded-xl text-xs font-medium text-[#713F2B] dark:text-[#F4F6F8] flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#E8874A] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden xl:inline">{isRefreshing ? 'Syncing...' : lastUpdatedFormatted}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
