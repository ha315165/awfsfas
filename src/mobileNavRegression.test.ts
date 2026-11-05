/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MOBILE_NAV_ITEMS, isTabActive, MobileNavItem } from './components/MobileNav.tsx';
import { ScreenId } from './components/Sidebar.tsx';

describe('Responsive Mobile Navigation Regression Tests', () => {
  const allExpectedScreens: ScreenId[] = [
    'home',
    'map',
    'school-mode',
    'accuracy',
    'test-view',
    'how-it-works',
  ];

  test('All 7 primary navigation destinations are defined in MOBILE_NAV_ITEMS', () => {
    assert.equal(MOBILE_NAV_ITEMS.length, 7, 'Must have exactly 7 primary navigation items');

    const itemIds = MOBILE_NAV_ITEMS.map((item) => item.id);
    assert.deepEqual(itemIds, [
      'overview',
      'live-map',
      'forecast',
      'school-mode',
      'accuracy',
      'evaluation',
      'how-it-works',
    ]);
  });

  test('Every existing application screen is reachable directly from mobile navigation', () => {
    const reachableScreens = new Set(MOBILE_NAV_ITEMS.map((item) => item.screenId));
    for (const screen of allExpectedScreens) {
      assert.ok(
        reachableScreens.has(screen),
        `Screen "${screen}" must be reachable directly from mobile navigation`
      );
    }
  });

  test('Every navigation item contains valid non-empty labels, sublabels, and icons', () => {
    for (const item of MOBILE_NAV_ITEMS) {
      assert.ok(item.label.trim().length > 0, `Item ${item.id} must have non-empty label`);
      assert.ok(item.sublabel.trim().length > 0, `Item ${item.id} must have non-empty sublabel`);
      assert.ok(typeof item.icon === 'function' || typeof item.icon === 'object', `Item ${item.id} must have valid icon component`);
    }
  });

  test('isTabActive correctly distinguishes Live Map (now) from 12h Forecast (highest12h)', () => {
    const liveMapItem = MOBILE_NAV_ITEMS.find((i) => i.id === 'live-map')!;
    const forecastItem = MOBILE_NAV_ITEMS.find((i) => i.id === 'forecast')!;

    // Scenario 1: Active on Map screen with viewMode 'now'
    assert.equal(
      isTabActive(liveMapItem, 'map', 'now'),
      true,
      'Live Map must be active when screen is map and viewMode is now'
    );
    assert.equal(
      isTabActive(forecastItem, 'map', 'now'),
      false,
      '12h Forecast must NOT be active when viewMode is now'
    );

    // Scenario 2: Active on Map screen with viewMode 'highest12h'
    assert.equal(
      isTabActive(forecastItem, 'map', 'highest12h'),
      true,
      '12h Forecast must be active when screen is map and viewMode is highest12h'
    );
    assert.equal(
      isTabActive(liveMapItem, 'map', 'highest12h'),
      false,
      'Live Map must NOT be active when viewMode is highest12h'
    );
  });

  test('isTabActive correctly identifies non-map screens without false positives', () => {
    const overviewItem = MOBILE_NAV_ITEMS.find((i) => i.id === 'overview')!;
    const schoolModeItem = MOBILE_NAV_ITEMS.find((i) => i.id === 'school-mode')!;
    const accuracyItem = MOBILE_NAV_ITEMS.find((i) => i.id === 'accuracy')!;
    const evaluationItem = MOBILE_NAV_ITEMS.find((i) => i.id === 'evaluation')!;
    const howItWorksItem = MOBILE_NAV_ITEMS.find((i) => i.id === 'how-it-works')!;

    // Overview test
    assert.equal(isTabActive(overviewItem, 'home', 'now'), true);
    assert.equal(isTabActive(overviewItem, 'school-mode', 'now'), false);

    // School mode test
    assert.equal(isTabActive(schoolModeItem, 'school-mode', 'now'), true);
    assert.equal(isTabActive(schoolModeItem, 'home', 'now'), false);

    // Accuracy test
    assert.equal(isTabActive(accuracyItem, 'accuracy', 'now'), true);
    assert.equal(isTabActive(accuracyItem, 'map', 'now'), false);

    // Evaluation test
    assert.equal(isTabActive(evaluationItem, 'test-view', 'now'), true);
    assert.equal(isTabActive(evaluationItem, 'accuracy', 'now'), false);

    // How it works test
    assert.equal(isTabActive(howItWorksItem, 'how-it-works', 'now'), true);
    assert.equal(isTabActive(howItWorksItem, 'test-view', 'now'), false);
  });

  test('Exactly one tab is active for any combination of activeScreen and viewMode', () => {
    const testCases: Array<{ screen: ScreenId; viewMode: 'now' | 'highest12h'; expectedActiveId: string }> = [
      { screen: 'home', viewMode: 'now', expectedActiveId: 'overview' },
      { screen: 'home', viewMode: 'highest12h', expectedActiveId: 'overview' },
      { screen: 'map', viewMode: 'now', expectedActiveId: 'live-map' },
      { screen: 'map', viewMode: 'highest12h', expectedActiveId: 'forecast' },
      { screen: 'school-mode', viewMode: 'now', expectedActiveId: 'school-mode' },
      { screen: 'accuracy', viewMode: 'now', expectedActiveId: 'accuracy' },
      { screen: 'test-view', viewMode: 'now', expectedActiveId: 'evaluation' },
      { screen: 'how-it-works', viewMode: 'now', expectedActiveId: 'how-it-works' },
    ];

    for (const { screen, viewMode, expectedActiveId } of testCases) {
      const activeItems = MOBILE_NAV_ITEMS.filter((item) => isTabActive(item, screen, viewMode));
      assert.equal(
        activeItems.length,
        1,
        `Expected exactly 1 active tab for screen=${screen}, viewMode=${viewMode}, got ${activeItems.length}`
      );
      assert.equal(
        activeItems[0].id,
        expectedActiveId,
        `Expected active tab id to be ${expectedActiveId} for screen=${screen}, viewMode=${viewMode}`
      );
    }
  });

  test('Target view mode is properly specified on dual-mode map items', () => {
    const liveMap = MOBILE_NAV_ITEMS.find((i) => i.id === 'live-map')!;
    const forecast = MOBILE_NAV_ITEMS.find((i) => i.id === 'forecast')!;

    assert.equal(liveMap.viewModeTarget, 'now');
    assert.equal(forecast.viewModeTarget, 'highest12h');
  });
});
