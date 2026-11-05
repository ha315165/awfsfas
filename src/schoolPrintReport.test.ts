/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDubaiDateTime,
  getActivityLabel,
  getActionPrintBadge,
  getPolicyStatusDetails,
  triggerPrintLifecycle,
} from './utils/printReport.ts';
import {
  DEFAULT_UNCONFIGURED_POLICY,
  FICTIONAL_DEMO_POLICY,
  buildHourlySchoolAssessments,
} from './schoolPolicy.ts';
import { SchoolPolicyConfig } from './types.ts';

describe('School Mode Print Report & Utilities', () => {
  test('formatDubaiDateTime: formats time in Asia/Dubai (GST, UTC+4) timezone', () => {
    // 2026-11-05T12:00:00Z -> In Dubai (UTC+4), this is 16:00
    const utcDate = new Date('2026-11-05T12:00:00Z');
    const formatted = formatDubaiDateTime(utcDate);

    assert.ok(formatted.includes('16:00'), `Expected 16:00 in Dubai, got: ${formatted}`);
    assert.ok(formatted.includes('GST (Asia/Dubai)'), `Expected GST (Asia/Dubai) in timestamp, got: ${formatted}`);
    assert.ok(formatted.includes('05 Nov 2026') || formatted.includes('5 Nov 2026'), `Expected date in timestamp, got: ${formatted}`);
  });

  test('getActivityLabel: returns correct formatted activity titles', () => {
    assert.equal(getActivityLabel('break'), 'Outdoor Break & Recess');
    assert.equal(getActivityLabel('pe'), 'Physical Education (PE) & Outdoor Sports');
    assert.equal(getActivityLabel('lunch_other'), 'Lunch & Unstructured Outdoor Play');
    assert.equal(getActivityLabel('assembly'), 'Outdoor Morning / School Assembly');
  });

  test('getActionPrintBadge: returns appropriate high-contrast print styles and canonical labels', () => {
    const continueBadge = getActionPrintBadge('continue');
    assert.equal(continueBadge.label, 'CONTINUE OUTDOOR ACTIVITY');
    assert.equal(continueBadge.bgColor, '#F0FDF4');
    assert.ok(continueBadge.description.includes('within approved policy limits'));

    const modifyBadge = getActionPrintBadge('modify');
    assert.equal(modifyBadge.label, 'MODIFY OUTDOOR ACTIVITY');
    assert.equal(modifyBadge.bgColor, '#FFFBEB');

    const relocateBadge = getActionPrintBadge('relocate');
    assert.equal(relocateBadge.label, 'RELOCATE INDOORS');

    const suspendBadge = getActionPrintBadge('suspend');
    assert.equal(suspendBadge.label, 'SUSPEND ALL OUTDOOR ACTIVITIES');

    const reviewBadge = getActionPrintBadge('human_review');
    assert.equal(reviewBadge.label, 'MANDATORY STAFF HUMAN REVIEW');
  });

  test('getPolicyStatusDetails: correctly flags starter configuration as non-operational', () => {
    const starterDetails = getPolicyStatusDetails(DEFAULT_UNCONFIGURED_POLICY);
    assert.equal(starterDetails.isOperational, false);
    assert.equal(starterDetails.statusClass, 'starter');
    assert.ok(starterDetails.badgeLabel.includes('NO APPROVED POLICY CONFIGURED'));
    assert.ok(starterDetails.noticeText.includes('unconfigured starter configuration'));
  });

  test('getPolicyStatusDetails: correctly flags fictional demonstration preset as non-operational', () => {
    const demoDetails = getPolicyStatusDetails(FICTIONAL_DEMO_POLICY);
    assert.equal(demoDetails.isOperational, false);
    assert.equal(demoDetails.statusClass, 'demo');
    assert.ok(demoDetails.badgeLabel.includes('FICTIONAL DEMONSTRATION PRESET'));
    assert.ok(demoDetails.noticeText.includes('DEMONSTRATION ONLY'));
  });

  test('getPolicyStatusDetails: correctly flags unapproved custom policy as QA Preview', () => {
    const unapprovedPolicy: SchoolPolicyConfig = {
      schoolName: 'Al Noor Academy Dubai',
      policyVersion: '1.2-draft',
      effectiveDate: '2026-11-01',
      approvedBy: 'Pending Board Ratification',
      sourceDocument: 'Draft Health Protocol',
      isConfigured: true,
      isApproved: false,
      isFictionalDemo: false,
      isStarterConfig: false,
      rules: [],
    };

    const details = getPolicyStatusDetails(unapprovedPolicy);
    assert.equal(details.isOperational, false);
    assert.equal(details.statusClass, 'unapproved');
    assert.ok(details.badgeLabel.includes('QA PREVIEW — UNAPPROVED CUSTOM RULES'));
    assert.ok(details.noticeText.includes('NON-OPERATIONAL SIMULATION'));
  });

  test('getPolicyStatusDetails: correctly recognizes officially ratified approved policy', () => {
    const approvedPolicy: SchoolPolicyConfig = {
      schoolName: 'Dubai International Community School',
      policyVersion: '2.0',
      effectiveDate: '2026-09-01',
      approvedBy: 'School Safety Board & Dr. Mariam Al Falasi',
      sourceDocument: 'Approved Outdoor Activity Policy 2026-2027',
      isConfigured: true,
      isApproved: true,
      isFictionalDemo: false,
      isStarterConfig: false,
      rules: [],
    };

    const details = getPolicyStatusDetails(approvedPolicy);
    assert.equal(details.isOperational, true);
    assert.equal(details.statusClass, 'approved');
    assert.ok(details.badgeLabel.includes('APPROVED OPERATIONAL POLICY'));
    assert.ok(details.noticeText.includes('Officially ratified'));
    assert.ok(details.noticeText.includes('Dr. Mariam Al Falasi'));
  });

  test('Print layout stylesheet: index.css defines .school-printable-document display and media scoping', async () => {
    const fs = await import('node:fs');
    const cssContent = fs.readFileSync('src/index.css', 'utf-8');

    // Verify .school-printable-document is hidden on screen
    assert.ok(
      cssContent.includes('.school-printable-document') && cssContent.includes('@media screen'),
      'Expected @media screen to define .school-printable-document'
    );

    // Verify @media print rules
    assert.ok(cssContent.includes('@media print'), 'Expected @media print block in index.css');
    assert.ok(cssContent.includes('size: A4 portrait'), 'Expected A4 portrait page size in print styles');
    assert.ok(cssContent.includes('#school-printable-report'), 'Expected #school-printable-report in print styles');
    assert.ok(cssContent.includes('break-inside: avoid'), 'Expected break-inside: avoid for pagination');
    assert.ok(cssContent.includes('print-color-adjust: exact'), 'Expected print-color-adjust: exact for clear badges');

    // Verify multi-page A4 table rules
    assert.ok(cssContent.includes('table {\n    break-inside: auto') || cssContent.includes('table {') && cssContent.includes('break-inside: auto !important;'), 'Expected table break-inside: auto for multi-page printing');
    assert.ok(cssContent.includes('display: table-header-group !important;'), 'Expected repeating table headers on multi-page printouts');

    // Verify scoped selector protection for internal report cards
    assert.ok(cssContent.includes(':not(#school-printable-report *)'), 'Expected interactive element hiding to exclude #school-printable-report');
    assert.ok(cssContent.includes('#school-printable-report .flex'), 'Expected report flex preservation rule');
    assert.ok(cssContent.includes('#school-printable-report .grid'), 'Expected report grid preservation rule');
  });

  test('Assessment actions: all 5 canonical actions have defined print styles and badges', () => {
    const actions = ['continue', 'modify', 'relocate', 'suspend', 'human_review'];
    for (const act of actions) {
      const badge = getActionPrintBadge(act);
      assert.ok(badge.label.length > 0, `Action ${act} should have non-empty label`);
      assert.ok(badge.borderColor.startsWith('#'), `Action ${act} should have hex border`);
      assert.ok(badge.textColor.startsWith('#'), `Action ${act} should have hex text color`);
      assert.ok(badge.bgColor.startsWith('#'), `Action ${act} should have hex background`);
      assert.ok(badge.description.length > 0, `Action ${act} should have meaningful description`);
    }
  });

  test('SchoolPrintReport component: renders all mandatory sections and content', async () => {
    const React = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { SchoolPrintReport } = await import('./components/SchoolPrintReport.tsx');

    const mockOutlook: any = {
      city: { id: 'dubai', name: 'Dubai', emirate: 'Dubai' },
      peakLevel: 'Moderate',
      levelNow: 'Moderate',
      confidence: 'High',
      worstWindow: { displayRange: '13:00 - 14:00' },
    };

    const mockAssessment: any = {
      displayHour: '12:00',
      hourIndex: 0,
      environmentalReadings: {
        temperature: 34,
        relativeHumidity: 45,
        heatIndex: { heatIndexCelsius: 38, category: 'Extreme Caution' },
        pm10: 120,
        pm2_5: 45,
        dust: 65,
        windSpeed: 18,
        windGusts: 28,
        visibility: 4500,
        precipitation: 0,
        rain: 0,
        precipitationProbability: 10,
        accumulatedRain: 0,
        ncmWarningStatus: 'Yellow Alert: Dust haze expected across coastal regions',
      },
      activityAssessments: {
        break: {
          activity: 'break',
          status: 'action_triggered',
          recommendedAction: 'modify',
          actionTitle: 'MODIFY OUTDOOR BREAK: High Heat Index',
          primaryGuidance: 'Reduce outdoor recess duration to 15 minutes and ensure hydration.',
          triggeredRules: [],
          isIncomplete: false,
        },
      },
    };

    const mockPolicy: any = {
      schoolName: 'Al Mawakeb School Dubai',
      policyVersion: '3.1',
      effectiveDate: '2026-10-01',
      approvedBy: 'Campus Health Board',
      sourceDocument: 'Safety Manual 2026',
      isConfigured: true,
      isApproved: true,
      isFictionalDemo: false,
      isStarterConfig: false,
      rules: [
        {
          id: 'rule-heat-mod',
          name: 'Heat Index Caution Threshold',
          activity: 'all',
          metric: 'heat_index',
          operator: '>=',
          threshold: 38,
          unit: '°C',
          recommendedAction: 'modify',
          enabled: true,
        },
      ],
    };

    const html = renderToString(
      React.createElement(SchoolPrintReport, {
        outlook: mockOutlook,
        selectedAssessment: mockAssessment,
        selectedActivity: 'break',
        schoolPolicy: mockPolicy,
        generatedDate: new Date('2026-11-05T08:00:00Z'),
      })
    );

    // 1. Branding & Report Title
    assert.ok(html.includes('DustWatch UAE'), 'Should include DustWatch UAE branding');
    assert.ok(html.includes('School Outdoor Activity Assessment Report'), 'Should include report title');

    // 2. Report timestamp in UAE timezone (Asia/Dubai)
    assert.ok(html.includes('GST (Asia/Dubai)'), 'Should include GST (Asia/Dubai) timezone timestamp');
    assert.ok(html.includes('12:00:00'), '08:00 UTC should be 12:00 in GST');

    // 3. Selected Activity & Campus Location
    assert.ok(html.includes('Outdoor Break &amp; Recess') || html.includes('Outdoor Break & Recess'), 'Should include selected activity');
    assert.ok(html.includes('Dubai'), 'Should include campus location');

    // 4. Relevant environmental readings
    assert.ok(html.includes('34 °C'), 'Should include air temperature');
    assert.ok(html.includes('45 %'), 'Should include relative humidity');
    assert.ok(html.includes('38 °C (Extreme Caution)'), 'Should include heat index and category');
    assert.ok(html.includes('120 µg/m³'), 'Should include PM10');
    assert.ok(html.includes('45 µg/m³'), 'Should include PM2.5');
    assert.ok(html.includes('65 µg/m³'), 'Should include mineral dust');
    assert.ok(html.includes('18 km/h'), 'Should include wind speed');
    assert.ok(html.includes('4500 m'), 'Should include visibility');
    assert.ok(html.includes('Yellow Alert: Dust haze expected across coastal regions'), 'Should include NCM warning');

    // 5. Applied school policy rules
    assert.ok(html.includes('Heat Index Caution Threshold'), 'Should include rule name');
    assert.ok(html.includes('rule-heat-mod'), 'Should include rule id');
    assert.ok(html.includes('38') && (html.includes('&gt;=') || html.includes('>=')), 'Should include threshold criteria');

    // 6. Assessment outcome and recommended action
    assert.ok(html.includes('MODIFY OUTDOOR ACTIVITY'), 'Should include action badge label');
    assert.ok(html.includes('MODIFY OUTDOOR BREAK: High Heat Index'), 'Should include action title');
    assert.ok(html.includes('Reduce outdoor recess duration to 15 minutes'), 'Should include primary guidance');

    // 7. Policy status and ratification notice
    assert.ok(html.includes('APPROVED OPERATIONAL POLICY: Al Mawakeb School Dubai'), 'Should include approved policy badge');

    // 8. Disclaimers & Professional Judgement Notice
    assert.ok(html.includes('Deterministic Support'), 'Should include deterministic support disclaimer');
    assert.ok(html.includes('Professional Judgement Required'), 'Should include professional judgement disclaimer');
    assert.ok(html.includes('Official Warnings Supersede'), 'Should include official warnings supersede disclaimer');

    // 9. Campus Verification & Action Log
    assert.ok(html.includes('Campus Verification &amp; Action Log') || html.includes('Campus Verification & Action Log'), 'Should include staff action log');
    assert.ok(html.includes('Evaluated By (Staff Name)'), 'Should include staff name sign-off field');
  });

  describe('Print Button Trigger Lifecycle Regressions', () => {
    test('Trigger executes window.print() synchronously within user activation (no async delays)', () => {
      let printCalled = false;
      let printExecutedSynchronously = false;
      let addedClass = false;
      let removedClass = false;
      let afterPrintListenerAdded = false;

      let afterPrintCallback: (() => void) | null = null;

      const mockBody = {
        classList: {
          add: (cls: string) => {
            if (cls === 'printing-school-report') addedClass = true;
          },
          remove: (cls: string) => {
            if (cls === 'printing-school-report') removedClass = true;
          },
        },
      };

      const mockWindow = {
        print: () => {
          printCalled = true;
          // Must have added printing class before print dialog opens
          assert.equal(addedClass, true, 'Must add printing-school-report before window.print()');
          printExecutedSynchronously = true;
        },
        addEventListener: (event: string, handler: any, options: any) => {
          if (event === 'afterprint') {
            afterPrintListenerAdded = true;
            afterPrintCallback = handler;
            assert.equal(options?.once, true, 'afterprint listener should be once: true');
          }
        },
        removeEventListener: (event: string) => {
          // cleanup
        },
      } as unknown as Window;

      let dateSet: any = null;
      const result = triggerPrintLifecycle({
        targetWindow: mockWindow,
        targetDocument: { body: mockBody } as unknown as Document,
        onGeneratedAt: (d) => {
          dateSet = d;
        },
      });

      assert.equal(result.status, 'printed');
      assert.equal(printCalled, true, 'Native print must be called');
      assert.equal(printExecutedSynchronously, true, 'print() must execute synchronously without deferral');
      assert.equal(afterPrintListenerAdded, true, 'afterprint listener must be registered');
      // The class must NOT be removed prematurely during print preview generation
      assert.equal(removedClass, false, 'Class must not be removed before afterprint fires');

      // Now simulate afterprint event when user finishes or closes print dialog
      if (afterPrintCallback) {
        (afterPrintCallback as () => void)();
      }
      assert.equal(removedClass, true, 'Class must be cleaned up on afterprint');
      assert.ok(dateSet instanceof Date, 'Report timestamp should be updated on trigger');
    });

    test('Trigger handles sandbox/iframe exception by opening preview modal fallback without throwing', () => {
      let previewModalOpened = false;
      let noticeMessage = '';
      let removedClass = false;

      const mockBody = {
        classList: {
          add: () => {},
          remove: (cls: string) => {
            if (cls === 'printing-school-report') removedClass = true;
          },
        },
      };

      const mockWindow = {
        print: () => {
          const err = new Error('The operation is insecure / Blocked by frame sandbox');
          err.name = 'SecurityError';
          throw err;
        },
        addEventListener: () => {},
        removeEventListener: () => {},
      } as unknown as Window;

      const result = triggerPrintLifecycle({
        targetWindow: mockWindow,
        targetDocument: { body: mockBody } as unknown as Document,
        onShowPreview: (msg) => {
          previewModalOpened = true;
          noticeMessage = msg || '';
        },
      });

      assert.equal(result.status, 'preview_fallback');
      assert.equal(previewModalOpened, true, 'Must activate preview modal fallback on print error');
      assert.ok(noticeMessage.includes('blocked by browser sandbox'), 'Notice must explain sandbox restriction');
      assert.equal(removedClass, true, 'Must clean up printing class immediately on error');
    });

    test('Subsequent Print button clicks are never deadlocked (elimination of isPrintInProgressRef lock)', () => {
      let callCount = 0;
      const mockWindow = {
        print: () => {
          callCount++;
        },
        addEventListener: () => {},
        removeEventListener: () => {},
      } as unknown as Window;

      const mockDoc = {
        body: {
          classList: { add: () => {}, remove: () => {} },
        },
      } as unknown as Document;

      // Click 1
      const res1 = triggerPrintLifecycle({ targetWindow: mockWindow, targetDocument: mockDoc });
      assert.equal(res1.status, 'printed');
      assert.equal(callCount, 1);

      // Click 2 (immediately after)
      const res2 = triggerPrintLifecycle({ targetWindow: mockWindow, targetDocument: mockDoc });
      assert.equal(res2.status, 'printed');
      assert.equal(callCount, 2, 'Second click must not be blocked by a stuck print lock');

      // Click 3
      const res3 = triggerPrintLifecycle({ targetWindow: mockWindow, targetDocument: mockDoc });
      assert.equal(res3.status, 'printed');
      assert.equal(callCount, 3, 'Third click must not be blocked');
    });

    test('Gracefully handles missing window.print in non-browser or restricted context', () => {
      let previewOpened = false;
      let notice = '';

      const mockWindowWithoutPrint = {
        addEventListener: () => {},
        removeEventListener: () => {},
      } as unknown as Window;

      const result = triggerPrintLifecycle({
        targetWindow: mockWindowWithoutPrint,
        onShowPreview: (msg) => {
          previewOpened = true;
          notice = msg || '';
        },
      });

      assert.equal(result.status, 'unsupported');
      assert.equal(previewOpened, true, 'Preview must open when window.print is missing');
      assert.ok(notice.includes('Native print dialog is not supported'));
    });

    test('SchoolModeScreen source code verification: dedicated buttons and modal controls wired correctly', async () => {
      const fs = await import('node:fs');
      const screenSource = fs.readFileSync('src/components/SchoolModeScreen.tsx', 'utf-8');

      // Dedicated Print Report button
      assert.ok(
        screenSource.includes('data-testid="print-view-btn"'),
        'SchoolModeScreen must render dedicated Print button with data-testid="print-view-btn"'
      );
      assert.ok(
        screenSource.includes('onClick={handlePrint}'),
        'SchoolModeScreen Print button must wire onClick to handlePrint'
      );

      // Dedicated Save as PDF button on toolbar
      assert.ok(
        screenSource.includes('data-testid="save-pdf-btn"'),
        'SchoolModeScreen must render dedicated Save as PDF toolbar button'
      );
      assert.ok(
        screenSource.includes('onClick={handleSavePdf}'),
        'SchoolModeScreen Save as PDF button must wire onClick to handleSavePdf'
      );

      // Preview modal controls
      assert.ok(
        screenSource.includes('data-testid="modal-save-pdf-btn"'),
        'Preview modal must render dedicated Save as PDF button'
      );
      assert.ok(
        screenSource.includes('data-testid="preview-modal-print-btn"'),
        'Preview modal must retain Print Report button'
      );
      assert.ok(
        screenSource.includes('data-testid="close-preview-modal-btn"'),
        'Preview modal must retain Close button'
      );

      // No lingering deadlock locks
      assert.ok(
        !screenSource.includes('isPrintInProgressRef'),
        'SchoolModeScreen must not retain deadlocking isPrintInProgressRef'
      );
    });
  });

  describe('In-App PDF Generator & Export Mechanism Regressions', () => {
    test('generateSchoolAssessmentPdfBytes generates valid ISO 32000-1 (PDF 1.4) document', async () => {
      const { generateSchoolAssessmentPdfBytes, saveSchoolAssessmentPdf } = await import(
        './utils/pdfGenerator.ts'
      );

      const mockPdfData = {
        cityName: 'Dubai',
        emirateName: 'Dubai',
        activityLabel: 'Outdoor Break & Recess',
        generatedDateFormatted: 'Thu, 05 Nov 2026 12:00:00 GST (Asia/Dubai)',
        assessmentHour: '12:00',
        actionTitle: 'CONTINUE OUTDOOR ACTIVITY',
        primaryGuidance: 'Conditions are within approved policy limits. Standard student hydration applies.',
        outcomeBadge: {
          label: 'CONTINUE OUTDOOR ACTIVITY',
          description: 'Conditions are within approved policy limits.',
          action: 'continue',
        },
        policyStatus: {
          badgeLabel: 'APPROVED OPERATIONAL POLICY: Dubai International School',
          noticeText: 'Officially ratified operational policy.',
          schoolName: 'Dubai International School',
          policyVersion: '2.0',
          effectiveDate: '2026-09-01',
          approvedBy: 'Campus Health Board',
        },
        environmentalReadings: {
          temperature: 32,
          relativeHumidity: 40,
          heatIndexCelsius: 35,
          heatIndexCategory: 'Caution',
          pm10: 85,
          pm2_5: 35,
          dust: 45,
          windSpeed: 16,
          windGusts: 24,
          visibility: 6000,
          rain: 0,
          ncmWarningStatus: 'Green / Normal',
        },
        appliedRules: [
          {
            id: 'rule-heat-mod',
            name: 'Heat Index Caution Threshold',
            metric: 'heat_index',
            operator: '>=',
            threshold: 38,
            unit: '°C',
            recommendedAction: 'modify',
          },
        ],
      };

      const bytes = generateSchoolAssessmentPdfBytes(mockPdfData);
      assert.ok(bytes instanceof Uint8Array, 'PDF output must be Uint8Array');
      assert.ok(bytes.length > 1000, `PDF size must be substantial, got ${bytes.length} bytes`);

      const pdfText = Buffer.from(bytes).toString('utf-8');

      // 1. Magic bytes
      assert.ok(pdfText.startsWith('%PDF-1.4'), 'Must start with %PDF-1.4 header');
      assert.ok(pdfText.includes('%%EOF'), 'Must terminate with %%EOF trailer');

      // 2. Objects and structure
      assert.ok(pdfText.includes('/Type /Catalog'), 'Must contain PDF Catalog');
      assert.ok(pdfText.includes('/Type /Pages'), 'Must contain Pages root');
      assert.ok(pdfText.includes('/Type /Page'), 'Must contain Page object');
      assert.ok(pdfText.includes('/MediaBox [0 0 595.28 841.89]'), 'Must have standard A4 MediaBox');
      assert.ok(pdfText.includes('/BaseFont /Helvetica'), 'Must declare Helvetica Type1 font');
      assert.ok(pdfText.includes('/BaseFont /Helvetica-Bold'), 'Must declare Helvetica-Bold Type1 font');
      assert.ok(pdfText.includes('xref'), 'Must contain cross-reference table');
      assert.ok(pdfText.includes('trailer'), 'Must contain PDF trailer');

      // 3. Content checks
      assert.ok(pdfText.includes('DUSTWATCH UAE'), 'PDF must include DustWatch UAE branding');
      assert.ok(pdfText.includes('School Outdoor Activity Assessment Report'), 'PDF must include report title');
      assert.ok(pdfText.includes('Dubai'), 'PDF must include city');
      assert.ok(pdfText.includes('Outdoor Break & Recess'), 'PDF must include activity');
      assert.ok(pdfText.includes('CONTINUE OUTDOOR ACTIVITY'), 'PDF must include outcome');
      assert.ok(pdfText.includes('32 deg C'), 'PDF must include temperature');
      assert.ok(pdfText.includes('85 ug/m3'), 'PDF must include PM10');
      assert.ok(pdfText.includes('CAMPUS VERIFICATION'), 'PDF must include sign-off section');
      assert.ok(pdfText.includes('IMPORTANT DISCLAIMER'), 'PDF must include disclaimers');

      // 4. saveSchoolAssessmentPdf execution
      const saveResult = saveSchoolAssessmentPdf(mockPdfData, 'test-export.pdf');
      assert.equal(saveResult.success, true);
      assert.equal(saveResult.filename, 'test-export.pdf');
      assert.ok(saveResult.size > 1000, 'Saved PDF size must be greater than 1000 bytes');
      assert.equal(saveResult.blob.type, 'application/pdf');
    });
  });
});


