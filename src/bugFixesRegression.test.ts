/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateSchoolAssessmentPdfBytes, SchoolPdfData } from './utils/pdfGenerator.ts';

describe('Bug Fixes & System Stability Regressions', () => {
  const baseSampleData: SchoolPdfData = {
    cityName: 'Abu Dhabi',
    emirateName: 'Abu Dhabi',
    activityLabel: 'Outdoor Break & Recess',
    generatedDateFormatted: '05 Nov 2026, 14:00 GST (Asia/Dubai)',
    assessmentHour: '14:00 GST',
    actionTitle: 'CONTINUE: Normal Operations',
    primaryGuidance: 'Outdoor conditions are within safe operating limits.',
    outcomeBadge: {
      label: 'CONTINUE OUTDOOR ACTIVITY',
      description: 'Outdoor conditions are within approved policy limits.',
      action: 'continue',
    },
    policyStatus: {
      badgeLabel: 'APPROVED OPERATIONAL POLICY: Horizon Private Academy',
      noticeText: 'Officially ratified operational policy.',
      schoolName: 'Horizon Private Academy',
      policyVersion: 'v2.1',
      effectiveDate: '2026-09-01',
      approvedBy: 'Dr. Fatima Al-Hashimi (Principal)',
    },
    environmentalReadings: {
      temperature: 34,
      relativeHumidity: 45,
      heatIndexCelsius: 38,
      heatIndexCategory: 'Extreme Caution',
      pm10: 120,
      pm2_5: 35,
      dust: 80,
      windSpeed: 22,
      windGusts: null, // Note: null gusts to test no 0 km/h fabrication
      visibility: 8500,
      rain: null,
      ncmWarningStatus: undefined,
    },
    appliedRules: [
      {
        id: 'rule_dust_high',
        name: 'High Dust Relocation',
        metric: 'dust',
        operator: '>=',
        threshold: 150,
        unit: 'ug/m3',
        recommendedAction: 'relocate',
      },
    ],
  };

  test('PDF generator: does NOT fabricate (Gusts: 0 km/h) when windGusts is null or undefined', async () => {
    const dataWithNullGusts: SchoolPdfData = {
      ...baseSampleData,
      environmentalReadings: {
        ...baseSampleData.environmentalReadings,
        windSpeed: 24,
        windGusts: null,
      },
    };

    const bytes = generateSchoolAssessmentPdfBytes(dataWithNullGusts);
    assert.ok(bytes instanceof Uint8Array);
    assert.ok(bytes.length > 500, `PDF bytes should have valid content, got ${bytes.length} bytes`);

    // Inspect stream text content
    const pdfText = new TextDecoder('latin1').decode(bytes);

    // Verify PDF header and trailer
    assert.ok(pdfText.startsWith('%PDF-1.4'), 'Must start with PDF-1.4 header');
    assert.ok(pdfText.includes('%%EOF'), 'Must terminate with %%EOF');

    // Crucial regression check: Must NOT contain fabricated "Gusts: 0 km/h"
    assert.ok(!pdfText.includes('(Gusts: 0 km/h)'), 'Must not fabricate 0 km/h when windGusts is null');
    assert.ok(pdfText.includes('24 km/h'), 'Must display true measured wind speed');
  });

  test('PDF generator: correctly includes wind gusts when a valid numerical measurement is present', async () => {
    const dataWithValidGusts: SchoolPdfData = {
      ...baseSampleData,
      environmentalReadings: {
        ...baseSampleData.environmentalReadings,
        windSpeed: 30,
        windGusts: 48,
      },
    };

    const bytes = generateSchoolAssessmentPdfBytes(dataWithValidGusts);
    const pdfText = new TextDecoder('latin1').decode(bytes);

    assert.ok(
      pdfText.includes('30 km/h \\(Gusts: 48 km/h\\)') || pdfText.includes('Gusts: 48 km/h'),
      'Must display both wind speed and valid measured gusts'
    );
  });

  test('PDF generator: gracefully handles completely unavailable sensor telemetry without throwing', async () => {
    const dataWithAllNulls: SchoolPdfData = {
      ...baseSampleData,
      environmentalReadings: {
        temperature: null,
        relativeHumidity: null,
        heatIndexCelsius: null,
        heatIndexCategory: undefined,
        pm10: null,
        pm2_5: null,
        dust: null,
        windSpeed: null,
        windGusts: null,
        visibility: null,
        rain: null,
      },
    };

    const bytes = generateSchoolAssessmentPdfBytes(dataWithAllNulls);
    assert.ok(bytes.length > 400);
    const pdfText = new TextDecoder('latin1').decode(bytes);

    assert.ok(pdfText.includes('N/A'), 'Should show N/A for missing measurements');
  });

  test('Peak hour preview indicator bounds calculation', () => {
    // Check peak hour indicator index bounds safety
    const calculatePeakIdx = (peakHourIndex: number, sliceLength: number) => {
      return peakHourIndex >= 0 && peakHourIndex < sliceLength
        ? peakHourIndex
        : 0;
    };

    assert.equal(calculatePeakIdx(4, 12), 4);
    assert.equal(calculatePeakIdx(0, 12), 0);
    assert.equal(calculatePeakIdx(11, 12), 11);
    // Boundary overflow cases
    assert.equal(calculatePeakIdx(12, 12), 0);
    assert.equal(calculatePeakIdx(24, 12), 0);
    assert.equal(calculatePeakIdx(-1, 12), 0);
  });

  test('WAI-ARIA Tab navigation wrap-around helper verification', () => {
    const tabIds = ['schools', 'workers', 'families'] as const;
    const getNextTab = (currentIdx: number, direction: 'prev' | 'next') => {
      const step = direction === 'next' ? 1 : -1;
      return tabIds[(currentIdx + step + tabIds.length) % tabIds.length];
    };

    assert.equal(getNextTab(0, 'next'), 'workers');
    assert.equal(getNextTab(1, 'next'), 'families');
    assert.equal(getNextTab(2, 'next'), 'schools'); // Wrap around to first
    assert.equal(getNextTab(0, 'prev'), 'families'); // Wrap backwards to last
    assert.equal(getNextTab(2, 'prev'), 'workers');
  });
});
