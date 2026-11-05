/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Map as MapIcon,
  CalendarClock,
  GraduationCap,
  Target,
  FlaskConical,
  BookOpen,
  Settings,
  Flame,
  Sun,
  Moon,
} from 'lucide-react';
import { STRINGS } from '../strings.ts';
import { useTheme } from '../themeContext.tsx';

export type ScreenId = 'home' | 'map' | 'school-mode' | 'how-it-works' | 'accuracy' | 'test-view';

interface SidebarProps {
  activeScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
  onOpenSettings: () => void;
  viewMode?: 'now' | 'highest12h';
  onChangeViewMode?: (mode: 'now' | 'highest12h') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeScreen,
  onSelectScreen,
  isDemoMode,
  onToggleDemoMode,
  onOpenSettings,
  viewMode,
  onChangeViewMode,
}) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const { isDark, toggleTheme } = useTheme();

  const allNavItems = [
    {
      id: 'home' as ScreenId,
      label: 'Overview',
      icon: LayoutDashboard,
      tooltip: 'Overview & National Summary',
    },
    {
      id: 'map' as ScreenId,
      label: 'Live Map',
      icon: MapIcon,
      tooltip: 'Interactive UAE Dust Map (Current)',
      action: () => {
        onSelectScreen('map');
        onChangeViewMode?.('now');
      },
    },
    {
      id: 'map' as ScreenId,
      pseudoId: 'forecast',
      label: 'Forecast',
      icon: CalendarClock,
      tooltip: '12-Hour Forecast Trajectory (Peak)',
      action: () => {
        onSelectScreen('map');
        onChangeViewMode?.('highest12h');
      },
    },
    {
      id: 'school-mode' as ScreenId,
      label: 'School Mode',
      icon: GraduationCap,
      tooltip: 'School Outdoor Policy Assessment',
    },
    {
      id: 'accuracy' as ScreenId,
      label: 'Accuracy',
      icon: Target,
      tooltip: 'Model Evaluation & Ground Truth',
    },
    {
      id: 'test-view' as ScreenId,
      label: 'Evaluation',
      icon: FlaskConical,
      tooltip: 'Verification Checks & Public Testing',
    },
    {
      id: 'how-it-works' as ScreenId,
      label: 'How It Works',
      icon: BookOpen,
      tooltip: 'Scientific Methodology & Architecture',
    },
  ];

  return (
    <aside
      aria-label="Sidebar Navigation"
      className="hidden md:flex w-18 lg:w-20 bg-[#244C3B] dark:bg-[#13231B] text-white flex-col items-center py-5 justify-between shrink-0 select-none z-30 transition-all duration-200 border-r border-[#1B3A2D] dark:border-[#1E382E] print:hidden"
    >
      {/* Top Brand Logo Mark */}
      <div className="flex flex-col items-center gap-6 w-full px-2">
        <button
          type="button"
          onClick={() => onSelectScreen('home')}
          className="w-12 h-12 rounded-2xl bg-[#FFFDF8] dark:bg-[#1E2D38] p-2 flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#E8874A]"
          aria-label="DustWatch Home"
        >
          <img
            src="/assets/dustwatch-logo-transparent.png"
            alt="DustWatch"
            className="w-full h-full object-contain"
            width={32}
            height={32}
          />
        </button>

        {/* Primary Navigation Icons */}
        <nav className="flex flex-col items-center gap-2 w-full" aria-label="Main screens">
          {allNavItems.map((item) => {
            const isActive =
              item.pseudoId === 'forecast'
                ? activeScreen === 'map' && viewMode === 'highest12h'
                : item.id === 'map'
                ? activeScreen === 'map' && (viewMode === 'now' || !viewMode)
                : activeScreen === item.id;
            const Icon = item.icon;
            const itemId = item.pseudoId || item.id;

            return (
              <div key={itemId} className="relative group flex items-center justify-center w-full">
                <button
                  type="button"
                  onClick={() => (item.action ? item.action() : onSelectScreen(item.id))}
                  onMouseEnter={() => setHoveredItem(itemId)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer relative min-h-[44px] min-w-[44px] ${
                    isActive
                      ? 'bg-[#E8874A] text-white shadow-md font-bold'
                      : 'text-[#E8F0E7]/80 hover:text-white hover:bg-white/10'
                  }`}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5 transition-transform duration-150 group-hover:scale-110" />
                </button>

                {/* Accessible Tooltip */}
                <div
                  role="tooltip"
                  className={`absolute left-full ml-3 px-3 py-1.5 bg-[#1B3A2D] dark:bg-[#1E2D38] text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none transition-all duration-150 z-50 border border-[#2D5A47] dark:border-[#354651] ${
                    hoveredItem === itemId
                      ? 'opacity-100 translate-x-0'
                      : 'opacity-0 -translate-x-1.5'
                  }`}
                >
                  {item.label}
                  <span className="block text-[10px] font-normal text-[#C5D9C5]">{item.tooltip}</span>
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom Controls: Demo Mode & Settings */}
      <div className="flex flex-col items-center gap-3 w-full px-2 pt-4 border-t border-white/10">
        {/* Demo Mode Toggle Button */}
        <div className="relative group flex items-center justify-center w-full">
          <button
            type="button"
            role="switch"
            aria-checked={isDemoMode}
            aria-label={`Demo Mode is ${isDemoMode ? 'active' : 'inactive'}`}
            onClick={onToggleDemoMode}
            onMouseEnter={() => setHoveredItem('demo')}
            onMouseLeave={() => setHoveredItem(null)}
            className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer relative min-h-[44px] min-w-[44px] ${
              isDemoMode
                ? 'bg-amber-500 text-white shadow-md'
                : 'text-[#E8F0E7]/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span className="text-[9px] font-bold tracking-tight">DEMO</span>
            {isDemoMode && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#E8874A] rounded-full ring-2 ring-[#244C3B]" />
            )}
          </button>

          <div
            role="tooltip"
            className={`absolute left-full ml-3 px-3 py-1.5 bg-[#1B3A2D] dark:bg-[#1E2D38] text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none transition-all duration-150 z-50 border border-[#2D5A47] dark:border-[#354651] ${
              hoveredItem === 'demo' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1.5'
            }`}
          >
            Demo Mode: {isDemoMode ? 'Active (Synthetic Dust Events)' : 'Inactive (Live Synced)'}
          </div>
        </div>

        {/* Theme Toggle Button */}
        <div className="relative group flex items-center justify-center w-full">
          <button
            type="button"
            onClick={toggleTheme}
            onMouseEnter={() => setHoveredItem('theme')}
            onMouseLeave={() => setHoveredItem(null)}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-[#E8F0E7]/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer min-h-[44px] min-w-[44px]"
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-amber-400 transition-transform duration-150 group-hover:rotate-45" />
            ) : (
              <Moon className="w-5 h-5 transition-transform duration-150 group-hover:-rotate-12" />
            )}
          </button>

          <div
            role="tooltip"
            className={`absolute left-full ml-3 px-3 py-1.5 bg-[#1B3A2D] dark:bg-[#1E2D38] text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none transition-all duration-150 z-50 border border-[#2D5A47] dark:border-[#354651] ${
              hoveredItem === 'theme' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1.5'
            }`}
          >
            Theme: {isDark ? 'Dark (Active)' : 'Light (Active)'}
          </div>
        </div>

        {/* Settings Button */}
        <div className="relative group flex items-center justify-center w-full">
          <button
            type="button"
            onClick={onOpenSettings}
            onMouseEnter={() => setHoveredItem('settings')}
            onMouseLeave={() => setHoveredItem(null)}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-[#E8F0E7]/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer min-h-[44px] min-w-[44px]"
            aria-label="Open Settings"
          >
            <Settings className="w-5 h-5 transition-transform duration-150 group-hover:rotate-45" />
          </button>

          <div
            role="tooltip"
            className={`absolute left-full ml-3 px-3 py-1.5 bg-[#1B3A2D] dark:bg-[#1E2D38] text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none transition-all duration-150 z-50 border border-[#2D5A47] dark:border-[#354651] ${
              hoveredItem === 'settings' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1.5'
            }`}
          >
            Application Settings
          </div>
        </div>
      </div>
    </aside>
  );
};
