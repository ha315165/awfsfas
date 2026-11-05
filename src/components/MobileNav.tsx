/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Bell,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  MapPin,
  SlidersHorizontal,
  Sun,
  Moon,
} from 'lucide-react';
import { ScreenId } from './Sidebar.tsx';
import { CITIES } from '../config.ts';
import { useTheme } from '../themeContext.tsx';

export interface MobileNavProps {
  activeScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  viewMode: 'now' | 'highest12h';
  onChangeViewMode: (mode: 'now' | 'highest12h') => void;
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastUpdatedFormatted?: string;
  selectedCityId?: string;
  onSelectCity?: (cityId: string) => void;
}

export interface MobileNavItem {
  id: string;
  screenId: ScreenId;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  viewModeTarget?: 'now' | 'highest12h';
}

export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  {
    id: 'overview',
    screenId: 'home',
    label: 'Overview',
    sublabel: 'National summary & risk cards',
    icon: LayoutDashboard,
  },
  {
    id: 'live-map',
    screenId: 'map',
    label: 'Live Map',
    sublabel: 'Interactive UAE dust map (Current)',
    icon: MapIcon,
    viewModeTarget: 'now',
  },
  {
    id: 'forecast',
    screenId: 'map',
    label: '12h Forecast',
    sublabel: 'Hourly dust & rain trajectory (Peak)',
    icon: CalendarClock,
    viewModeTarget: 'highest12h',
  },
  {
    id: 'school-mode',
    screenId: 'school-mode',
    label: 'School Mode',
    sublabel: 'Outdoor activity safety policy',
    icon: GraduationCap,
  },
  {
    id: 'accuracy',
    screenId: 'accuracy',
    label: 'Accuracy',
    sublabel: 'Model evaluation & verification',
    icon: Target,
  },
  {
    id: 'evaluation',
    screenId: 'test-view',
    label: 'Evaluation',
    sublabel: 'Diagnostics & test workbench',
    icon: FlaskConical,
  },
  {
    id: 'how-it-works',
    screenId: 'how-it-works',
    label: 'How It Works',
    sublabel: 'Scientific methodology & data',
    icon: BookOpen,
  },
];

export const isTabActive = (
  item: MobileNavItem,
  activeScreen: ScreenId,
  viewMode: 'now' | 'highest12h'
): boolean => {
  if (item.id === 'forecast') {
    return activeScreen === 'map' && viewMode === 'highest12h';
  }
  if (item.id === 'live-map') {
    return activeScreen === 'map' && viewMode === 'now';
  }
  return activeScreen === item.screenId;
};

export const MobileNav: React.FC<MobileNavProps> = ({
  activeScreen,
  onSelectScreen,
  viewMode,
  onChangeViewMode,
  isDemoMode,
  onToggleDemoMode,
  onOpenSettings,
  onOpenNotifications,
  unreadNotificationsCount,
  onRefresh,
  isRefreshing = false,
  lastUpdatedFormatted,
  selectedCityId,
  onSelectCity,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const tabStripRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const { isDark, toggleTheme } = useTheme();

  // Check scroll position to display left/right affordance gradients
  const updateScrollIndicators = useCallback(() => {
    const el = tabStripRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = tabStripRef.current;
    if (!el) return;
    updateScrollIndicators();
    el.addEventListener('scroll', updateScrollIndicators, { passive: true });
    window.addEventListener('resize', updateScrollIndicators, { passive: true });
    return () => {
      el.removeEventListener('scroll', updateScrollIndicators);
      window.removeEventListener('resize', updateScrollIndicators);
    };
  }, [updateScrollIndicators]);

  // Automatically scroll active tab into view whenever screen or viewMode changes
  useEffect(() => {
    if (activeTabRef.current && tabStripRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
      // Allow DOM to settle and update indicators
      setTimeout(updateScrollIndicators, 250);
    }
  }, [activeScreen, viewMode, updateScrollIndicators]);

  // Handle tab click: route to target screen and synchronize view mode if needed
  const handleTabClick = (item: MobileNavItem) => {
    if (item.viewModeTarget) {
      onChangeViewMode(item.viewModeTarget);
      onSelectScreen('map');
    } else {
      onSelectScreen(item.screenId);
    }
    setIsMenuOpen(false);
  };

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  // Scroll horizontal strip manually via indicator tap
  const scrollTabStrip = (direction: 'left' | 'right') => {
    const el = tabStripRef.current;
    if (!el) return;
    const offset = direction === 'left' ? -180 : 180;
    el.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <nav
      aria-label="Mobile Navigation"
      data-testid="mobile-navigation"
      className="md:hidden sticky top-0 z-[1100] w-full bg-[#244C3B] dark:bg-[#13231B] text-white select-none border-b border-[#1B3A2D] dark:border-[#1E382E] shadow-md print:hidden transition-colors duration-200"
    >
      {/* -------------------------------------------------------------
          Row 1: Brand & Top Mobile Utility Toolbar (Compact 44px)
         ------------------------------------------------------------- */}
      <div className="flex items-center justify-between px-3 py-2 gap-2 h-12">
        {/* Brand Lockup */}
        <button
          type="button"
          onClick={() => {
            onSelectScreen('home');
            setIsMenuOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-2 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8874A] rounded-xl shrink-0 min-h-[40px] px-1"
          aria-label="DustWatch Home"
        >
          <div className="w-7 h-7 rounded-lg bg-[#FFFDF8] dark:bg-[#1E2D38] p-1 flex items-center justify-center shadow-xs shrink-0">
            <img
              src="/assets/dustwatch-logo-transparent.png"
              alt="DustWatch"
              className="w-full h-full object-contain"
              width={20}
              height={20}
            />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-black tracking-tight text-white leading-none">
              DustWatch
            </span>
            <span className="text-[10px] text-[#A8B99A] font-semibold hidden xs:inline">
              UAE
            </span>
          </div>
        </button>

        {/* Quick Utility Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Demo Mode Toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={isDemoMode}
            aria-label={`Demo Mode is ${isDemoMode ? 'active' : 'inactive'}`}
            onClick={onToggleDemoMode}
            className={`px-2 py-1 rounded-lg flex items-center gap-1 text-[11px] font-bold transition-all cursor-pointer min-h-[36px] ${
              isDemoMode
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-[#E8F0E7]/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">DEMO</span>
          </button>

          {/* Quick Refresh Button */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#E8F0E7]/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer min-h-[36px] disabled:opacity-50"
              aria-label="Refresh telemetry data"
              title={lastUpdatedFormatted ? `Last synced: ${lastUpdatedFormatted}` : 'Refresh'}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#E8874A] ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Quick Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#E8F0E7]/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer min-h-[36px]"
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Atmospheric Notifications Bell */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#E8F0E7]/80 hover:text-white hover:bg-white/10 relative transition-all cursor-pointer min-h-[36px]"
            aria-label="Atmospheric Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#E8874A] rounded-full ring-2 ring-[#244C3B]" />
            )}
          </button>

          {/* Settings Modal Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#E8F0E7]/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer min-h-[36px]"
            aria-label="Open settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* All-Tabs Drawer Toggle (Hamburger / X) */}
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer min-h-[36px] ${
              isMenuOpen ? 'bg-[#E8874A] text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            aria-label={isMenuOpen ? 'Close navigation drawer' : 'Open all navigation tabs'}
            aria-expanded={isMenuOpen}
            data-testid="mobile-menu-toggle"
          >
            {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          Row 2: Horizontal Scrollable Navigation Tab Bar
         ------------------------------------------------------------- */}
      <div className="relative bg-[#1B3A2D] dark:bg-[#0F1C15] border-t border-[#152e23] dark:border-[#1A2D23] flex items-center transition-colors duration-200">
        {/* Left Scroll Indicator Hint */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollTabStrip('left')}
            className="absolute left-0 top-0 bottom-0 z-20 w-7 flex items-center justify-center bg-gradient-to-r from-[#1B3A2D] dark:from-[#0F1C15] via-[#1B3A2D]/90 dark:via-[#0F1C15]/90 to-transparent text-[#E8874A] focus:outline-none"
            aria-label="Scroll navigation tabs left"
          >
            <ChevronLeft className="w-4 h-4 drop-shadow-xs" />
          </button>
        )}

        {/* Scrollable Tabs Track */}
        <div
          ref={tabStripRef}
          data-testid="mobile-tab-strip"
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-3 py-1.5 w-full touch-pan-x scroll-smooth"
        >
          {MOBILE_NAV_ITEMS.map((item) => {
            const active = isTabActive(item, activeScreen, viewMode);
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                ref={active ? activeTabRef : undefined}
                type="button"
                data-testid={`mobile-tab-${item.id}`}
                data-active={active ? 'true' : 'false'}
                onClick={() => handleTabClick(item)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all duration-150 cursor-pointer min-h-[38px] shrink-0 active:scale-95 ${
                  active
                    ? 'bg-[#E8874A] text-white shadow-xs font-bold ring-1 ring-white/20'
                    : 'text-[#E8F0E7]/80 hover:text-white hover:bg-white/10 dark:text-[#AAB8C2] dark:hover:text-[#F4F6F8] dark:hover:bg-white/5 font-semibold'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Scroll Indicator Hint */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollTabStrip('right')}
            className="absolute right-0 top-0 bottom-0 z-20 w-7 flex items-center justify-center bg-gradient-to-l from-[#1B3A2D] dark:from-[#0F1C15] via-[#1B3A2D]/90 dark:via-[#0F1C15]/90 to-transparent text-[#E8874A] focus:outline-none"
            aria-label="Scroll navigation tabs right"
          >
            <ChevronRight className="w-4 h-4 drop-shadow-xs" />
          </button>
        )}
      </div>

      {/* -------------------------------------------------------------
          Expandable Full Drawer (When hamburger menu is opened)
         ------------------------------------------------------------- */}
      {isMenuOpen && (
        <>
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 top-[88px] bg-black/50 backdrop-blur-xs z-[1090]"
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Menu Panel */}
          <div
            data-testid="mobile-navigation-drawer"
            className="relative z-[1100] bg-[#1B3A2D] dark:bg-[#18242E] border-b border-[#2D5A47] dark:border-[#2B3D4A] px-4 py-3 shadow-2xl max-h-[calc(100vh-100px)] overflow-y-auto space-y-3 animate-in fade-in slide-from-top-2 duration-150 transition-colors duration-200"
          >
            {/* Quick Station Switcher (Convenient for mobile users) */}
            {selectedCityId && onSelectCity && (
              <div className="bg-[#152e23] dark:bg-[#101820] rounded-xl p-2.5 border border-[#244C3B] dark:border-[#2B3D4A] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-[#E8874A] shrink-0" />
                  <span className="text-xs text-[#C5D9C5] dark:text-[#AAB8C2] font-semibold truncate">
                    Station:
                  </span>
                </div>
                <select
                  value={selectedCityId}
                  onChange={(e) => {
                    onSelectCity(e.target.value);
                    setIsMenuOpen(false);
                  }}
                  className="bg-[#244C3B] dark:bg-[#1E2D38] text-white border border-[#3E6B58] dark:border-[#354651] text-xs font-bold rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-[#E8874A]"
                  aria-label="Switch UAE Station"
                >
                  {CITIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Section Heading */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-[#A8B99A] dark:text-[#AAB8C2] uppercase tracking-wider">
                All Navigation Destinations
              </span>
              <span className="text-[10px] text-[#C5D9C5]/70 dark:text-[#AAB8C2]/70">
                {MOBILE_NAV_ITEMS.length} screens
              </span>
            </div>

            {/* List of Navigation Destinations */}
            <div className="grid grid-cols-1 gap-1.5">
              {MOBILE_NAV_ITEMS.map((item) => {
                const active = isTabActive(item, activeScreen, viewMode);
                const Icon = item.icon;

                return (
                  <button
                    key={`drawer-${item.id}`}
                    type="button"
                    data-testid={`drawer-item-${item.id}`}
                    onClick={() => handleTabClick(item)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer min-h-[44px] ${
                      active
                        ? 'bg-[#E8874A] text-white font-bold shadow-xs'
                        : 'bg-[#152e23]/70 dark:bg-[#101820]/70 hover:bg-[#152e23] dark:hover:bg-[#101820] text-[#E8F0E7] dark:text-[#F4F6F8]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          active
                            ? 'bg-white/20 text-white'
                            : 'bg-[#244C3B] dark:bg-[#1E2D38] text-[#C5D9C5] dark:text-[#AAB8C2]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{item.label}</div>
                        <div
                          className={`text-[10px] truncate ${
                            active ? 'text-white/80' : 'text-[#A8B99A] dark:text-[#AAB8C2]'
                          }`}
                        >
                          {item.sublabel}
                        </div>
                      </div>
                    </div>
                    {active ? (
                      <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ml-2">
                        Active
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 opacity-50 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Theme Switcher inside drawer */}
            <div className="pt-2 border-t border-white/10 dark:border-white/5">
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-left bg-[#152e23]/70 dark:bg-[#101820]/70 hover:bg-[#152e23] dark:hover:bg-[#101820] text-[#E8F0E7] dark:text-[#F4F6F8] transition-all cursor-pointer min-h-[44px] border border-[#244C3B] dark:border-[#2B3D4A]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#244C3B] dark:bg-[#1E2D38] flex items-center justify-center text-amber-400">
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-[#C5D9C5]" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold">Theme: {isDark ? 'Dark Mode' : 'Light Mode'}</div>
                    <div className="text-[10px] text-[#A8B99A] dark:text-[#AAB8C2]">Tap to switch to {isDark ? 'Light' : 'Dark'} mode</div>
                  </div>
                </div>
                <span className="text-[10px] bg-white/10 dark:bg-white/5 text-white dark:text-[#F4F6F8] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  {isDark ? 'Dark' : 'Light'}
                </span>
              </button>
            </div>
          </div>
        </>
      )}
    </nav>
  );
};
