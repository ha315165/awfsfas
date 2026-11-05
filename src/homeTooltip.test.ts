/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Homepage Information Tooltip Regression Tests', () => {
  const homeScreenPath = path.resolve(process.cwd(), 'src/components/HomeScreen.tsx');
  const homeScreenContent = fs.readFileSync(homeScreenPath, 'utf-8');

  test('HomeScreen includes the accessible information tooltip trigger and popover elements', () => {
    assert.ok(
      homeScreenContent.includes('id="dustwatch-info-trigger"'),
      'Must contain information tooltip trigger with ID dustwatch-info-trigger'
    );
    assert.ok(
      homeScreenContent.includes('data-testid="dustwatch-info-trigger"'),
      'Must contain data-testid for the tooltip trigger'
    );
    assert.ok(
      homeScreenContent.includes('id="dustwatch-info-popover"'),
      'Must contain popover dialog with ID dustwatch-info-popover'
    );
    assert.ok(
      homeScreenContent.includes('aria-haspopup="dialog"'),
      'Trigger must declare aria-haspopup="dialog"'
    );
    assert.ok(
      homeScreenContent.includes('aria-expanded={isInfoOpen}'),
      'Trigger must bind aria-expanded to isInfoOpen'
    );
    assert.ok(
      homeScreenContent.includes('role="dialog"'),
      'Popover must have role="dialog"'
    );
  });

  test('Explanation text covers all required technical and organizational points', () => {
    // 1. Forecast data ingestion
    assert.ok(
      homeScreenContent.includes('Collects atmospheric and environmental forecast data') ||
      homeScreenContent.includes('forecast data from integrated meteorological models'),
      'Must explain forecast data collection from integrated sources'
    );

    // 2. Deterministic processing
    assert.ok(
      homeScreenContent.toLowerCase().includes('processes relevant variables') &&
      (homeScreenContent.toLowerCase().includes('deterministic') || homeScreenContent.toLowerCase().includes('risk-assessment engine')),
      'Must explain deterministic processing of relevant variables'
    );

    // 3. UAE municipal locations
    assert.ok(
      homeScreenContent.includes('monitored UAE locations') ||
      homeScreenContent.includes('monitored municipal stations across all 7 Emirates'),
      'Must explain coverage across monitored UAE locations'
    );

    // 4. Current & 12h forecast
    assert.ok(
      homeScreenContent.includes('12-hour') &&
      homeScreenContent.includes('current conditions'),
      'Must explain current conditions and 12-hour forecast'
    );

    // 5. Gemini AI role
    assert.ok(
      homeScreenContent.includes('Gemini AI') &&
      homeScreenContent.includes('does not calculate or modify the underlying risk score'),
      'Must explain that Gemini AI translates guidance without calculating risk score'
    );

    // 6. Experimental student project & unofficial warning notice
    assert.ok(
      homeScreenContent.includes('Experimental Student Project') &&
      homeScreenContent.includes('does not provide official meteorological warnings'),
      'Must clarify experimental student status and lack of official warnings'
    );
  });

  test('Interaction handlers include hover, click/tap, keyboard escape, and outside dismiss', () => {
    assert.ok(
      homeScreenContent.includes('onMouseEnter={handleMouseEnter}'),
      'Trigger must support mouse hover enter'
    );
    assert.ok(
      homeScreenContent.includes('onMouseLeave={handleMouseLeave}'),
      'Trigger must support mouse hover leave'
    );
    assert.ok(
      homeScreenContent.includes('onClick={handleToggleClick}'),
      'Trigger must support click / tap toggle'
    );
    assert.ok(
      homeScreenContent.includes('onKeyDown={handleKeyDown}'),
      'Trigger must support keyboard interaction'
    );
    assert.ok(
      homeScreenContent.includes("e.key === 'Escape'"),
      'Must handle Escape key dismissal'
    );
    assert.ok(
      homeScreenContent.includes('handleClickOutside') &&
      homeScreenContent.includes('mousedown') &&
      homeScreenContent.includes('touchstart'),
      'Must handle outside click and touch tap dismissal'
    );
  });

  test('Existing buttons and layout structure in HomeScreen are preserved', () => {
    assert.ok(
      homeScreenContent.includes('STRINGS.home.exploreCta'),
      'Explore CTA button must remain preserved'
    );
    assert.ok(
      homeScreenContent.includes('STRINGS.home.howItWorksCta'),
      'How it works CTA button must remain preserved'
    );
    assert.ok(
      homeScreenContent.includes('STRINGS.home.heroHeadline'),
      'Hero headline must remain preserved'
    );
    assert.ok(
      homeScreenContent.includes('STRINGS.home.heroDescription'),
      'Hero description must remain preserved'
    );
  });
});
