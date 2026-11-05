/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHeatIndex,
  DEFAULT_UNCONFIGURED_POLICY,
  STARTER_CONFIGURATION_POLICY,
  FICTIONAL_DEMO_POLICY,
  SAMPLE_APPROVED_SCHOOL_POLICY,
  buildHourlySchoolAssessments,
  evaluateActivityPolicy,
  isFiniteNumber,
  resolvePrecedence,
  validateSchoolPolicy,
  canonicalAction,
  getMetricValue,
  SUPPORTED_RULE_METRICS,
  createNewDefaultRule,
  getMetricUnit,
} from './schoolPolicy.ts';
import { RawHourlyVariables, SchoolPolicyConfig } from './types.ts';
import { getSchoolModeAdvice } from './geminiService.ts';
import { calculateHourlyBaseline } from './riskEngine.ts';

test('Heat Index: calculates correct values under moderate and extreme conditions', () => {
  // 1. Moderate heat: 30°C and 50% RH -> ~31°C (Caution)
  const hiModerate = calculateHeatIndex(30, 50);
  assert.equal(hiModerate.isAvailable, true);
  assert.ok(hiModerate.heatIndexCelsius! >= 30 && hiModerate.heatIndexCelsius! <= 33);
  assert.equal(hiModerate.category, 'Caution');

  // 2. High heat: 36°C and 45% RH -> Danger (41 - 54°C)
  const hiDanger = calculateHeatIndex(36, 45);
  assert.equal(hiDanger.isAvailable, true);
  assert.ok(hiDanger.heatIndexCelsius! >= 41 && hiDanger.heatIndexCelsius! < 54);
  assert.equal(hiDanger.category, 'Danger');

  // 3. Cool condition: 18°C (< 20°C / 68°F threshold) -> not applicable
  const hiCool = calculateHeatIndex(18, 55);
  assert.equal(hiCool.isAvailable, false);
  assert.equal(hiCool.heatIndexCelsius, null);
  assert.equal(hiCool.category, 'not applicable');

  // 4. Mild condition: 23°C and 40% RH -> Below Caution range
  const hiMild = calculateHeatIndex(23, 40);
  assert.equal(hiMild.isAvailable, true);
  assert.equal(hiMild.category, 'Below Caution range');
});

test('Heat Index: missing and non-finite inputs return not applicable and never substitute zero', () => {
  const missingTemp = calculateHeatIndex(null, 50);
  assert.equal(missingTemp.isAvailable, false);
  assert.equal(missingTemp.heatIndexCelsius, null);
  assert.equal(missingTemp.category, 'not applicable');
  assert.ok(missingTemp.notes.includes('Assessment unavailable'));

  const nanTemp = calculateHeatIndex(NaN, 50);
  assert.equal(nanTemp.isAvailable, false);
  assert.equal(nanTemp.heatIndexCelsius, null);

  const infTemp = calculateHeatIndex(Infinity, 50);
  assert.equal(infTemp.isAvailable, false);
  assert.equal(infTemp.heatIndexCelsius, null);

  const negInfHumidity = calculateHeatIndex(35, -Infinity);
  assert.equal(negInfHumidity.isAvailable, false);
  assert.equal(negInfHumidity.heatIndexCelsius, null);

  const undefinedHumidity = calculateHeatIndex(35, undefined);
  assert.equal(undefinedHumidity.isAvailable, false);
  assert.equal(undefinedHumidity.heatIndexCelsius, null);
});

test('School Policy: unconfigured policy reports distinct policy_unconfigured status', () => {
  const sampleRaw: RawHourlyVariables = {
    time: '2026-10-21T10:00',
    temperature_2m: 32,
    relative_humidity_2m: 40,
    pm10: 100,
    pm2_5: 30,
    dust: 50,
    wind_speed_10m: 15,
    wind_gusts_10m: 25,
    wind_direction_10m: 300,
    visibility: 9000,
    aerosol_optical_depth: 0.3,
  };

  const hi = calculateHeatIndex(sampleRaw.temperature_2m, sampleRaw.relative_humidity_2m);
  const result = evaluateActivityPolicy(sampleRaw, hi, DEFAULT_UNCONFIGURED_POLICY, 'break');

  assert.ok(result.status === 'policy_not_configured' || result.status === 'policy_unconfigured');
  assert.equal(result.actionTitle, 'School policy configuration required');
  assert.ok(result.primaryGuidance.includes('Review the applicable school policy'));
  assert.equal(result.triggeredRules.length, 0);
  assert.equal(result.isIncomplete, false);
});

test('School Policy: zero applicable rules configured for an activity never reports criteria met', () => {
  // Configured policy with ONLY PE rules, evaluating 'break'
  const peOnlyPolicy: SchoolPolicyConfig = {
    isConfigured: true,
    schoolName: 'PE Only Academy',
    policyVersion: '1.0',
    effectiveDate: '2026-10-01',
    rules: [
      {
        id: 'pe-heat-only',
        name: 'PE Heat Rule',
        activity: 'pe',
        metric: 'temperature',
        operator: '>=',
        threshold: 38,
        unit: '°C',
        recommendedAction: 'indoor_only',
        actionTitle: 'Move PE indoors',
        actionGuidance: 'Outdoor PE suspended.',
        reason: 'High temperature.',
        severity: 2,
      },
    ],
    precedenceOrder: ['suspend', 'indoor_only', 'modified', 'normal'],
  };

  const cleanRaw: RawHourlyVariables = {
    time: '2026-10-21T10:00',
    temperature_2m: 28,
    relative_humidity_2m: 40,
    pm10: 30,
    pm2_5: 10,
    dust: 20,
    wind_speed_10m: 10,
    wind_gusts_10m: 15,
    wind_direction_10m: 300,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
  };

  const hi = calculateHeatIndex(cleanRaw.temperature_2m, cleanRaw.relative_humidity_2m);
  const breakResult = evaluateActivityPolicy(cleanRaw, hi, peOnlyPolicy, 'break');

  // Must report distinct 'no_applicable_rules' state
  assert.equal(breakResult.status, 'no_applicable_rules');
  assert.equal(breakResult.actionTitle, 'No applicable rules configured for this activity');
  assert.ok(breakResult.primaryGuidance.includes('No approved policy rules are defined for this activity'));
  assert.notEqual(breakResult.actionTitle, 'Conditions meet the configured criteria for this activity');
  assert.equal(breakResult.totalApplicableRulesCount, 0);
  assert.equal(breakResult.evaluatedRulesCount, 0);
});

test('School Policy: distinguishes all 5 outcomes clearly', () => {
  const cleanRaw: RawHourlyVariables = {
    time: '2026-10-21T10:00',
    temperature_2m: 28,
    relative_humidity_2m: 40,
    pm10: 30,
    pm2_5: 10,
    dust: 20,
    wind_speed_10m: 10,
    wind_gusts_10m: 15,
    wind_direction_10m: 300,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
    precipitation: 0,
    rain: 0,
    rain_rate: 0,
    precipitation_rate: 0,
  };
  const hiClean = calculateHeatIndex(cleanRaw.temperature_2m, cleanRaw.relative_humidity_2m);

  // 1. policy_unconfigured / policy_not_configured
  const resUnconfigured = evaluateActivityPolicy(cleanRaw, hiClean, DEFAULT_UNCONFIGURED_POLICY, 'break');
  assert.ok(resUnconfigured.status === 'policy_not_configured' || resUnconfigured.status === 'policy_unconfigured');

  // 2. no_applicable_rules
  const lunchPolicy: SchoolPolicyConfig = {
    ...FICTIONAL_DEMO_POLICY,
    rules: FICTIONAL_DEMO_POLICY.rules.filter((r) => r.activity === 'break'),
  };
  const resNoRules = evaluateActivityPolicy(cleanRaw, hiClean, lunchPolicy, 'lunch_other');
  assert.equal(resNoRules.status, 'no_applicable_rules');

  // 3. assessment_unavailable (missing readings when no rules trigger)
  const missingRaw: RawHourlyVariables = {
    ...cleanRaw,
    pm10: null, // PM10 rule cannot be evaluated
    dust: null,
  };
  const hiMissing = calculateHeatIndex(missingRaw.temperature_2m, missingRaw.relative_humidity_2m);
  const resMissing = evaluateActivityPolicy(missingRaw, hiMissing, FICTIONAL_DEMO_POLICY, 'break');
  assert.ok(resMissing.status === 'not_evaluated' || resMissing.status === 'assessment_unavailable');
  assert.equal(resMissing.isIncomplete, true);
  assert.equal(resMissing.dataMissingForAssessment, true);

  // 4. criteria_met_no_actions:
  // Operational approved policy returns operational "Conditions meet the configured criteria"
  const resApproved = evaluateActivityPolicy(cleanRaw, hiClean, SAMPLE_APPROVED_SCHOOL_POLICY, 'break');
  assert.equal(resApproved.status, 'criteria_met_no_actions');
  assert.equal(resApproved.actionTitle, 'Conditions meet the configured criteria for this activity');
  assert.equal(resApproved.isIncomplete, false);

  // Fictional demonstration policy returns non-operational demonstration title
  const resDemo = evaluateActivityPolicy(cleanRaw, hiClean, FICTIONAL_DEMO_POLICY, 'break');
  assert.equal(resDemo.status, 'criteria_met_no_actions');
  assert.equal(resDemo.actionTitle, 'Demonstration Result — Not Operational');
  assert.ok(resDemo.primaryGuidance.includes('not an operational safety determination'));
  assert.equal(resDemo.isIncomplete, false);

  // 5. action_triggered (one or more rules triggered)
  const hazardRaw: RawHourlyVariables = {
    ...cleanRaw,
    pm10: 350, // triggers indoor_only
  };
  const hiHazard = calculateHeatIndex(hazardRaw.temperature_2m, hazardRaw.relative_humidity_2m);
  const resTriggered = evaluateActivityPolicy(hazardRaw, hiHazard, FICTIONAL_DEMO_POLICY, 'break');
  assert.equal(resTriggered.status, 'action_triggered');
  assert.ok(resTriggered.recommendedAction === 'relocate' || resTriggered.recommendedAction === 'indoor_only');
  assert.equal(resTriggered.isIncomplete, false);
});

test('School Policy: partial evaluation preserves triggered action and marks assessment incomplete', () => {
  // Condition: PM10 is 300 µg/m³ (triggers indoor_only), but temperature is NaN (so heat index cannot be evaluated)
  const partialRaw: RawHourlyVariables = {
    time: '2026-10-21T12:00',
    temperature_2m: NaN, // Invalid reading!
    relative_humidity_2m: 50,
    pm10: 300, // triggers indoor_only
    pm2_5: 90,
    dust: 180,
    wind_speed_10m: 20,
    wind_gusts_10m: 30,
    wind_direction_10m: 320,
    visibility: 4000,
    aerosol_optical_depth: 0.8,
  };

  const hi = calculateHeatIndex(partialRaw.temperature_2m, partialRaw.relative_humidity_2m);
  const peRes = evaluateActivityPolicy(partialRaw, hi, FICTIONAL_DEMO_POLICY, 'pe');

  // Triggered action is preserved
  assert.equal(peRes.status, 'action_triggered');
  assert.ok(peRes.recommendedAction === 'relocate' || peRes.recommendedAction === 'indoor_only');
  // Incomplete flag must be explicitly true
  assert.equal(peRes.isIncomplete, true);
  assert.equal(peRes.dataMissingForAssessment, true);
  assert.ok(peRes.primaryGuidance.includes('partial'));
  assert.ok(peRes.reason.includes('incomplete'));
});

test('School Policy: non-finite readings (NaN, Infinity, -Infinity) are treated as unavailable', () => {
  assert.equal(isFiniteNumber(null), false);
  assert.equal(isFiniteNumber(undefined), false);
  assert.equal(isFiniteNumber(NaN), false);
  assert.equal(isFiniteNumber(Infinity), false);
  assert.equal(isFiniteNumber(-Infinity), false);
  assert.equal(isFiniteNumber('100'), false);
  assert.equal(isFiniteNumber(100), true);
  assert.equal(isFiniteNumber(0), true);

  const infRaw: RawHourlyVariables = {
    time: '2026-10-21T12:00',
    temperature_2m: 30,
    relative_humidity_2m: 45,
    pm10: Infinity, // non-finite reading
    pm2_5: -Infinity,
    dust: NaN,
    wind_speed_10m: 15,
    wind_gusts_10m: 20,
    wind_direction_10m: 300,
    visibility: 10000,
    aerosol_optical_depth: 0.2,
  };

  const hi = calculateHeatIndex(infRaw.temperature_2m, infRaw.relative_humidity_2m);
  const res = evaluateActivityPolicy(infRaw, hi, FICTIONAL_DEMO_POLICY, 'break');

  // Non-finite readings must NOT trigger rules by accident or substitute zero
  assert.ok(res.status === 'assessment_unavailable' || res.status === 'not_evaluated');
  assert.equal(res.isIncomplete, true);
});

test('School Policy Precedence: malformed or incomplete precedence configuration cannot select a less protective action', () => {
  // Triggered actions: 'suspend' and 'indoor_only'
  // Malformed precedence order reverses safety: puts 'normal' and 'modified' first, omits 'suspend'
  const malformedPrecedence: any[] = ['normal', 'modified'];
  const winning = resolvePrecedence(['suspend', 'indoor_only'], malformedPrecedence);
  // Must NEVER select 'normal' or 'modified' when 'suspend' or 'indoor_only' is triggered
  assert.equal(winning, 'suspend');

  // When 'indoor_only' and 'modified' triggered with empty precedence order
  const emptyWinning = resolvePrecedence(['modified', 'indoor_only'], []);
  assert.equal(emptyWinning, 'indoor_only');

  // When policy precedence attempts to prefer 'modified' over 'indoor_only'
  const reversePrecedence: any[] = ['modified', 'indoor_only'];
  const safeWinning = resolvePrecedence(['indoor_only', 'modified'], reversePrecedence);
  // 'indoor_only' has protection level 3 > 'modified' level 2
  assert.equal(safeWinning, 'indoor_only');
});

test('School Policy Runtime Validation: localStorage policy validation fails safely to DEFAULT_UNCONFIGURED_POLICY', () => {
  // 1. null or non-object
  assert.equal(validateSchoolPolicy(null).isConfigured, false);
  assert.equal(validateSchoolPolicy('invalid string').isConfigured, false);
  assert.equal(validateSchoolPolicy(12345).isConfigured, false);

  // 2. Missing required fields
  assert.equal(validateSchoolPolicy({ isConfigured: true }).isConfigured, false);

  // 3. Rule with non-finite threshold (NaN)
  const corruptRulePolicy = {
    isConfigured: true,
    schoolName: 'Corrupt Academy',
    policyVersion: '1.0',
    effectiveDate: '2026-10-01',
    rules: [
      {
        id: 'r1',
        name: 'Corrupt Rule',
        activity: 'break',
        metric: 'pm10',
        operator: '>=',
        threshold: NaN, // invalid non-finite threshold
        unit: 'µg/m³',
        recommendedAction: 'indoor_only',
        actionTitle: 'Title',
        actionGuidance: 'Guidance',
        reason: 'Reason',
        severity: 2,
      },
    ],
    precedenceOrder: ['suspend', 'indoor_only', 'modified', 'normal'],
  };
  assert.equal(validateSchoolPolicy(corruptRulePolicy).isConfigured, false);

  // 4. Rule with invalid operator or metric
  const invalidOperatorPolicy = {
    ...corruptRulePolicy,
    rules: [
      {
        ...corruptRulePolicy.rules[0],
        threshold: 150,
        operator: 'LIKE', // invalid operator
      },
    ],
  };
  assert.equal(validateSchoolPolicy(invalidOperatorPolicy).isConfigured, false);

  // 5. Valid policy validates cleanly and ensures complete precedence order
  const validPolicyInput = {
    isConfigured: true,
    schoolName: 'Official Abu Dhabi School',
    policyVersion: '2.1',
    effectiveDate: '2026-10-15',
    rules: [
      {
        id: 'r-valid',
        name: 'Valid PM10 Limit',
        activity: 'break',
        metric: 'pm10',
        operator: '>=',
        threshold: 200,
        unit: 'µg/m³',
        recommendedAction: 'indoor_only',
        actionTitle: 'Keep indoors',
        actionGuidance: 'Blowing dust advisory.',
        reason: 'Particulates elevated.',
        severity: 2,
      },
    ],
    precedenceOrder: ['indoor_only', 'modified'], // missing suspend and normal
  };
  const validated = validateSchoolPolicy(validPolicyInput);
  assert.equal(validated.isConfigured, true);
  assert.equal(validated.schoolName, 'Official Abu Dhabi School');
  assert.equal(validated.rules.length, 1);
  // Sanitizer appended missing actions
  assert.ok(validated.precedenceOrder?.includes('suspend'));
  assert.ok(validated.precedenceOrder?.includes('normal') || validated.precedenceOrder?.includes('continue'));
});

test('AI Summary Gating: getSchoolModeAdvice gates AI call on unconfigured, demo, no applicable rules, or incomplete data', async () => {
  const dummyReadings = {
    temperature: 30,
    relativeHumidity: 45,
    heatIndex: { heatIndexCelsius: 32, category: 'Caution' },
    pm10: 50,
    dust: 25,
    windSpeed: 15,
  };

  // 1. Unconfigured policy
  const unconfiguredRes = await getSchoolModeAdvice(
    'Dubai',
    'break',
    '10:00',
    {
      status: 'policy_unconfigured',
      recommendedAction: 'normal',
      actionTitle: 'School policy configuration required',
      primaryGuidance: 'Review school policy.',
      reason: 'Unconfigured.',
      triggeredRules: [],
      isPolicyConfigured: false,
    },
    dummyReadings
  );
  assert.equal(unconfiguredRes.isAI, false);
  assert.ok(unconfiguredRes.summary.includes('configuration required'));

  // 2. Fictional demonstration policy
  const demoRes = await getSchoolModeAdvice(
    'Dubai',
    'break',
    '10:00',
    {
      status: 'criteria_met_no_actions',
      recommendedAction: 'normal',
      actionTitle: 'Criteria met',
      primaryGuidance: 'Conditions meet criteria.',
      reason: 'None triggered.',
      triggeredRules: [],
      isPolicyConfigured: true,
      isFictionalDemo: true, // DEMO GATED
    },
    dummyReadings
  );
  assert.equal(demoRes.isAI, false);
  assert.ok(demoRes.summary.includes('demonstration') || demoRes.summary.includes('Criteria met'));

  // 3. No applicable rules configured
  const noRulesRes = await getSchoolModeAdvice(
    'Dubai',
    'break',
    '10:00',
    {
      status: 'no_applicable_rules',
      recommendedAction: 'normal',
      actionTitle: 'No applicable rules configured for this activity',
      primaryGuidance: 'No approved policy rules defined.',
      reason: 'No rules.',
      triggeredRules: [],
      isPolicyConfigured: true,
    },
    dummyReadings
  );
  assert.equal(noRulesRes.isAI, false);
  assert.ok(noRulesRes.summary.includes('No applicable rules'));

  // 4. Incomplete / missing assessment data
  const incompleteRes = await getSchoolModeAdvice(
    'Dubai',
    'break',
    '10:00',
    {
      status: 'action_triggered',
      recommendedAction: 'indoor_only',
      actionTitle: 'Move indoors',
      primaryGuidance: 'PM10 elevated.',
      reason: 'Particulates.',
      triggeredRules: [{ rule: { id: 'pm10-severe', metric: 'pm10' } }],
      dataMissingForAssessment: true,
      isIncomplete: true, // INCOMPLETE GATED
      isPolicyConfigured: true,
    },
    dummyReadings
  );
  assert.equal(incompleteRes.isAI, false);
});

test('School Policy: heat-index applicability when temperature is under 20°C', () => {
  const policyWithHeatRule: SchoolPolicyConfig = {
    isConfigured: true,
    schoolName: 'UAE Academy',
    policyVersion: '1.0',
    effectiveDate: '2026-10-01',
    precedenceOrder: ['suspend', 'indoor_only', 'modified', 'normal'],
    rules: [
      {
        id: 'rule-heat-high',
        name: 'High Heat Index Warning',
        activity: 'break',
        metric: 'heat_index',
        operator: '>=',
        threshold: 35,
        unit: '°C',
        recommendedAction: 'modified',
        actionTitle: 'Shorten outdoor play',
        actionGuidance: 'Reduce strenuous outdoor exertion.',
        reason: 'High heat index.',
        severity: 1,
      },
    ],
  };

  // 1. Valid cold/mild day: T=18°C, RH=50%. Heat index is not applicable by NOAA formula (<20°C).
  // Because T=18°C is safely below threshold 35°C, rule must NOT trigger and must NOT be flagged as missing data.
  const rawCool: RawHourlyVariables = {
    time: '2026-10-21T08:00',
    temperature_2m: 18,
    relative_humidity_2m: 50,
    pm10: 40,
    pm2_5: 15,
    dust: 20,
    wind_speed_10m: 10,
    wind_gusts_10m: 15,
    wind_direction_10m: 300,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
  };

  const hiCool = calculateHeatIndex(rawCool.temperature_2m, rawCool.relative_humidity_2m);
  assert.equal(hiCool.isAvailable, false);
  assert.equal(hiCool.category, 'not applicable');

  const evalCool = evaluateActivityPolicy(rawCool, hiCool, policyWithHeatRule, 'break');
  assert.equal(evalCool.status, 'criteria_met_no_actions');
  assert.ok(evalCool.recommendedAction === 'normal' || evalCool.recommendedAction === 'continue');
  assert.equal(evalCool.isIncomplete, false);
  assert.equal(evalCool.dataMissingForAssessment, false);

  // 2. Genuine missing temperature: T=null, RH=50%. Heat index cannot be evaluated.
  const rawMissingTemp: RawHourlyVariables = {
    ...rawCool,
    temperature_2m: null,
  };
  const hiMissing = calculateHeatIndex(rawMissingTemp.temperature_2m, rawMissingTemp.relative_humidity_2m);
  const evalMissing = evaluateActivityPolicy(rawMissingTemp, hiMissing, policyWithHeatRule, 'break');
  assert.ok(evalMissing.status === 'assessment_unavailable' || evalMissing.status === 'not_evaluated');
  assert.equal(evalMissing.dataMissingForAssessment, true);
  assert.equal(evalMissing.triggeredRules.some((r) => r.isDataMissing), true);

  // 3. Mixed rules: Heat rule (T=18°C, safe) + PM10 rule (PM10 is null/missing)
  const policyMixed: SchoolPolicyConfig = {
    ...policyWithHeatRule,
    rules: [
      ...policyWithHeatRule.rules,
      {
        id: 'rule-pm10-mod',
        name: 'PM10 elevated',
        activity: 'break',
        metric: 'pm10',
        operator: '>=',
        threshold: 100,
        unit: 'µg/m³',
        recommendedAction: 'indoor_only',
        actionTitle: 'Move indoors',
        actionGuidance: 'Elevated particulate levels.',
        reason: 'PM10 high',
        severity: 2,
      },
    ],
  };

  const rawMissingPM10: RawHourlyVariables = {
    ...rawCool,
    pm10: null,
  };
  const evalMixedMissing = evaluateActivityPolicy(rawMissingPM10, hiCool, policyMixed, 'break');
  // Since no rule triggered and PM10 is missing, status must be assessment_unavailable or not_evaluated
  assert.ok(evalMixedMissing.status === 'assessment_unavailable' || evalMixedMissing.status === 'not_evaluated');
  assert.equal(evalMixedMissing.dataMissingForAssessment, true);
  assert.equal(evalMixedMissing.triggeredRules.some((r) => r.rule.metric === 'pm10' && r.isDataMissing), true);

  // 4. Mixed rules where one triggers and another is missing
  const policyMixedWithTrigger: SchoolPolicyConfig = {
    ...policyMixed,
    rules: [
      ...policyMixed.rules,
      {
        id: 'rule-wind-gust',
        name: 'Severe Wind Gusts',
        activity: 'break',
        metric: 'wind_gusts',
        operator: '>=',
        threshold: 10,
        unit: 'km/h',
        recommendedAction: 'suspend',
        actionTitle: 'Suspend outdoor activity',
        actionGuidance: 'High winds.',
        reason: 'Wind gusts high',
        severity: 3,
      },
    ],
  };

  const evalMixedTriggerAndMissing = evaluateActivityPolicy(rawMissingPM10, hiCool, policyMixedWithTrigger, 'break');
  // Action was triggered by wind gusts, but PM10 was missing: action preserved, assessment marked incomplete
  assert.equal(evalMixedTriggerAndMissing.status, 'action_triggered');
  assert.equal(evalMixedTriggerAndMissing.recommendedAction, 'suspend');
  assert.equal(evalMixedTriggerAndMissing.isIncomplete, true);
  assert.equal(evalMixedTriggerAndMissing.dataMissingForAssessment, true);
  assert.equal(evalMixedTriggerAndMissing.triggeredRules.some((r) => r.rule.metric === 'pm10' && r.isDataMissing), true);
  assert.equal(evalMixedTriggerAndMissing.triggeredRules.some((r) => r.rule.id === 'rule-wind-gust' && r.isTriggered), true);
});

/* ========================================================================
   SECTION 8 — REGRESSION TESTS FOR TECHNICAL POLICY SPECIFICATION
   ======================================================================== */

const baseTestRaw: RawHourlyVariables = {
  time: '2026-10-21T10:00',
  temperature_2m: 30,
  relative_humidity_2m: 50,
  pm10: 60,
  pm2_5: 25,
  dust: 40,
  wind_speed_10m: 12,
  wind_gusts_10m: 18,
  wind_direction_10m: 290,
  visibility: 10000,
  aerosol_optical_depth: 0.2,
  precipitation: 0,
  rain_rate: 0,
  ncm_warning_status: 'unavailable',
};

// 1. Missing policy returns unconfigured state
test('Section 8.1: Missing policy returns unconfigured state', () => {
  const hi = calculateHeatIndex(baseTestRaw.temperature_2m, baseTestRaw.relative_humidity_2m);
  const result = evaluateActivityPolicy(baseTestRaw, hi, DEFAULT_UNCONFIGURED_POLICY, 'pe');

  assert.ok(
    result.status === 'policy_not_configured' || result.status === 'policy_unconfigured',
    `Expected unconfigured status but got ${result.status}`
  );
  assert.equal(result.isPolicyConfigured, false);
  assert.equal(result.triggeredRules.length, 0);
  assert.ok(result.primaryGuidance.toLowerCase().includes('policy'));
});

// 2. Starter configuration does not activate example thresholds
test('Section 8.2: Starter configuration does not activate example thresholds', () => {
  assert.equal(STARTER_CONFIGURATION_POLICY.isStarterConfig, true);
  assert.equal(STARTER_CONFIGURATION_POLICY.isApproved, false);

  // In starter configuration, every rule must be disabled and have null threshold
  for (const rule of STARTER_CONFIGURATION_POLICY.rules) {
    assert.equal(rule.enabled, false, `Rule ${rule.id} should be disabled`);
    assert.equal(rule.value ?? rule.threshold, null, `Rule ${rule.id} should have null threshold`);
  }

  // Extreme observations: high heat, severe PM10, deluge rain
  const extremeRaw: RawHourlyVariables = {
    ...baseTestRaw,
    temperature_2m: 45,
    relative_humidity_2m: 60,
    pm10: 600,
    dust: 500,
    rain_rate: 50,
    precipitation: 80,
  };
  const hiExtreme = calculateHeatIndex(extremeRaw.temperature_2m, extremeRaw.relative_humidity_2m);
  const evalResult = evaluateActivityPolicy(extremeRaw, hiExtreme, STARTER_CONFIGURATION_POLICY, 'break');

  assert.ok(
    evalResult.status === 'policy_not_configured' || evalResult.status === 'policy_unconfigured'
  );
  assert.equal(evalResult.triggeredRules.length, 0);
  assert.notEqual(evalResult.status, 'action_triggered');
});

// 3. Existing valid custom policies are not overwritten
test('Section 8.3: Existing valid custom policies are not overwritten', () => {
  const customPolicy: SchoolPolicyConfig = {
    isConfigured: true,
    isApproved: true,
    isStarterConfig: false,
    schoolName: 'Al Ain English Academy',
    policyVersion: '2.5.0',
    effectiveDate: '2026-09-01',
    approvedBy: 'Health & Safety Committee (Dr. Fatima Al Nuaimi)',
    sourceDocument: 'Al Ain English Academy Operational Safety Handbook 2026-2027',
    missingDataBehavior: 'human_review',
    rules: [
      {
        id: 'aaea-heat-pe',
        name: 'PE Heat Index Cutoff',
        activity: 'pe',
        metric: 'heat_index',
        operator: '>=',
        threshold: 38,
        unit: '°C',
        recommendedAction: 'relocate',
        actionTitle: 'Relocate PE to air-conditioned sports hall',
        actionGuidance: 'Heat index exceeds 38°C.',
        reason: 'Heat safety protocol',
        severity: 2,
        enabled: true,
        sourceClassification: 'school_internal_policy',
      },
    ],
  };

  const validated = validateSchoolPolicy(customPolicy);
  assert.equal(validated.schoolName, 'Al Ain English Academy');
  assert.equal(validated.policyVersion, '2.5.0');
  assert.equal(validated.effectiveDate, '2026-09-01');
  assert.equal(validated.approvedBy, 'Health & Safety Committee (Dr. Fatima Al Nuaimi)');
  assert.equal(validated.sourceDocument, 'Al Ain English Academy Operational Safety Handbook 2026-2027');
  assert.equal(validated.isConfigured, true);
  assert.equal(validated.isApproved, false, 'Client-controlled policy data can never establish official ratification');
  assert.equal(validated.isStarterConfig, false);
  assert.equal(validated.rules.length, 1);
  assert.equal(validated.rules[0].id, 'aaea-heat-pe');
});

// 4. Invalid persisted policy data fails safely
test('Section 8.4: Invalid persisted policy data fails safely', () => {
  // Non-object
  assert.equal(validateSchoolPolicy(null).isConfigured, false);
  assert.equal(validateSchoolPolicy('corrupted string').isConfigured, false);

  // Missing or corrupted rules array
  assert.equal(validateSchoolPolicy({ isConfigured: true, rules: 'invalid' } as any).isConfigured, false);

  // Attempting to declare official_uae_rule without official UAE authority
  const fakeOfficialPolicy = {
    isConfigured: true,
    schoolName: 'Fake School',
    rules: [
      {
        id: 'fake-official',
        name: 'Bogus Official Rule',
        activity: 'all',
        metric: 'pm10',
        operator: '>=',
        threshold: 100,
        unit: 'µg/m³',
        recommendedAction: 'suspend',
        sourceClassification: 'official_uae_rule',
        sourceReference: 'Random Commercial Blog',
        enabled: true,
      },
    ],
  };
  const safeFallback = validateSchoolPolicy(fakeOfficialPolicy as any);
  assert.equal(safeFallback.isConfigured, false);
  assert.equal(safeFallback.isStarterConfig, true);
});

// 5. Rule with null value or enabled: false cannot trigger
test('Section 8.5: Rule with null value or enabled: false cannot trigger', () => {
  const policyWithDisabledRules: SchoolPolicyConfig = {
    isConfigured: true,
    isApproved: true,
    schoolName: 'Test School',
    policyVersion: '1.0',
    effectiveDate: '2026-10-01',
    rules: [
      {
        id: 'rule-null-val',
        name: 'Null Value Rule',
        activity: 'all',
        metric: 'pm10',
        operator: '>=',
        threshold: null,
        value: null,
        unit: 'µg/m³',
        recommendedAction: 'suspend',
        actionTitle: 'Should not trigger',
        actionGuidance: 'Disabled rule',
        reason: 'Disabled',
        severity: 3,
        enabled: true,
      },
      {
        id: 'rule-disabled-flag',
        name: 'Disabled Flag Rule',
        activity: 'all',
        metric: 'dust',
        operator: '>=',
        threshold: 50,
        value: 50,
        unit: 'µg/m³',
        recommendedAction: 'suspend',
        actionTitle: 'Should not trigger',
        actionGuidance: 'Disabled flag',
        reason: 'Disabled flag',
        severity: 3,
        enabled: false,
      },
    ],
  };

  const highRaw: RawHourlyVariables = {
    ...baseTestRaw,
    pm10: 900,
    dust: 400,
  };
  const hi = calculateHeatIndex(highRaw.temperature_2m, highRaw.relative_humidity_2m);
  const result = evaluateActivityPolicy(highRaw, hi, policyWithDisabledRules, 'break');

  assert.equal(result.triggeredRules.filter((r) => r.isTriggered).length, 0);
  assert.notEqual(result.recommendedAction, 'suspend');
  assert.equal(result.status, 'no_applicable_rules');
});

// 6. Activity-specific rules apply only to correct activities
test('Section 8.6: Activity-specific rules apply only to correct activities', () => {
  const activityPolicy: SchoolPolicyConfig = {
    isConfigured: true,
    isApproved: true,
    schoolName: 'Scope Test Academy',
    policyVersion: '1.0',
    effectiveDate: '2026-10-01',
    rules: [
      {
        id: 'pe-only-rule',
        name: 'PE Strenuous Heat Cutoff',
        activity: 'pe',
        metric: 'heat_index',
        operator: '>=',
        threshold: 35,
        unit: '°C',
        recommendedAction: 'relocate',
        actionTitle: 'Move PE indoors',
        actionGuidance: 'Move PE',
        reason: 'PE only',
        severity: 2,
        enabled: true,
      },
      {
        id: 'assembly-only-rule',
        name: 'Assembly Sun Exposure Cutoff',
        activity: 'assembly',
        metric: 'temperature',
        operator: '>=',
        threshold: 32,
        unit: '°C',
        recommendedAction: 'suspend',
        actionTitle: 'Cancel outdoor assembly',
        actionGuidance: 'Cancel assembly',
        reason: 'Assembly only',
        severity: 3,
        enabled: true,
      },
    ],
  };

  const rawHot: RawHourlyVariables = {
    ...baseTestRaw,
    temperature_2m: 34,
    relative_humidity_2m: 55, // HI ~38°C
  };
  const hi = calculateHeatIndex(rawHot.temperature_2m, rawHot.relative_humidity_2m);

  // Break: neither rule applies -> no_applicable_rules
  const evalBreak = evaluateActivityPolicy(rawHot, hi, activityPolicy, 'break');
  assert.equal(evalBreak.status, 'no_applicable_rules');
  assert.equal(evalBreak.recommendedAction, 'continue');

  // PE: pe-only-rule applies and triggers -> relocate
  const evalPE = evaluateActivityPolicy(rawHot, hi, activityPolicy, 'pe');
  assert.equal(evalPE.status, 'action_triggered');
  assert.equal(evalPE.recommendedAction, 'relocate');
  assert.equal(evalPE.triggeredRules.find((r) => r.isTriggered)?.rule.id, 'pe-only-rule');

  // Assembly: assembly-only-rule applies and triggers -> suspend
  const evalAssembly = evaluateActivityPolicy(rawHot, hi, activityPolicy, 'assembly');
  assert.equal(evalAssembly.status, 'action_triggered');
  assert.equal(evalAssembly.recommendedAction, 'suspend');
  assert.equal(evalAssembly.triggeredRules.find((r) => r.isTriggered)?.rule.id, 'assembly-only-rule');
});

// 7. Missing, stale, invalid or conflicting required data never defaults to continue
test('Section 8.7: Missing, stale, invalid or conflicting required data never defaults to continue', () => {
  const policyRequireData: SchoolPolicyConfig = {
    isConfigured: true,
    isApproved: true,
    schoolName: 'Data Safety Academy',
    policyVersion: '1.0',
    effectiveDate: '2026-10-01',
    missingDataBehavior: 'not_evaluated',
    rules: [
      {
        id: 'req-pm10',
        name: 'PM10 Check',
        activity: 'break',
        metric: 'pm10',
        operator: '>=',
        threshold: 100,
        unit: 'µg/m³',
        recommendedAction: 'relocate',
        actionTitle: 'Move indoors',
        actionGuidance: 'High PM10',
        reason: 'PM10 check',
        severity: 2,
        enabled: true,
      },
    ],
  };

  // Missing PM10
  const rawMissing: RawHourlyVariables = {
    ...baseTestRaw,
    pm10: null,
  };
  const hi = calculateHeatIndex(rawMissing.temperature_2m, rawMissing.relative_humidity_2m);
  const evalMissing = evaluateActivityPolicy(rawMissing, hi, policyRequireData, 'break');

  assert.equal(evalMissing.dataMissingForAssessment, true);
  assert.equal(evalMissing.status, 'not_evaluated');
  assert.notEqual(evalMissing.recommendedAction, 'continue');
  assert.equal(evalMissing.recommendedAction, 'human_review');
  assert.notEqual(evalMissing.actionTitle, 'Criteria Met');

  // When policy configures human_review for missing data
  const policyHumanReview: SchoolPolicyConfig = {
    ...policyRequireData,
    missingDataBehavior: 'human_review',
  };
  const evalReview = evaluateActivityPolicy(rawMissing, hi, policyHumanReview, 'break');
  assert.equal(evalReview.status, 'human_review');
  assert.equal(evalReview.recommendedAction, 'human_review');
});

// 8. Rain above threshold triggers configured action
test('Section 8.8: Rain above threshold triggers configured action', () => {
  const rainPolicy: SchoolPolicyConfig = {
    isConfigured: true,
    isApproved: true,
    schoolName: 'Rain Protocol School',
    policyVersion: '1.0',
    effectiveDate: '2026-10-01',
    rules: [
      {
        id: 'rain-rate-high',
        name: 'Heavy Downpour',
        activity: 'break',
        metric: 'rain_rate',
        operator: '>=',
        threshold: 5.0,
        unit: 'mm/h',
        recommendedAction: 'relocate',
        actionTitle: 'Move students under shelter',
        actionGuidance: 'Rain downpour',
        reason: 'Rain rate exceeded 5 mm/h',
        severity: 2,
        enabled: true,
      },
    ],
  };

  const rawRaining: RawHourlyVariables = {
    ...baseTestRaw,
    rain_rate: 7.5,
  };
  const hi = calculateHeatIndex(rawRaining.temperature_2m, rawRaining.relative_humidity_2m);
  const evalRain = evaluateActivityPolicy(rawRaining, hi, rainPolicy, 'break');

  assert.equal(evalRain.status, 'action_triggered');
  assert.equal(evalRain.recommendedAction, 'relocate');
  assert.equal(evalRain.triggeredRules.filter((r) => r.isTriggered).length, 1);
  assert.equal(evalRain.triggeredRules.find((r) => r.isTriggered)?.observedValue, 7.5);
});

// 9. Rain below threshold does not trigger that rule
test('Section 8.9: Rain below threshold does not trigger that rule', () => {
  const rainPolicy: SchoolPolicyConfig = {
    isConfigured: true,
    isApproved: true,
    schoolName: 'Rain Protocol School',
    policyVersion: '1.0',
    effectiveDate: '2026-10-01',
    rules: [
      {
        id: 'rain-rate-high',
        name: 'Heavy Downpour',
        activity: 'break',
        metric: 'rain_rate',
        operator: '>=',
        threshold: 5.0,
        unit: 'mm/h',
        recommendedAction: 'relocate',
        actionTitle: 'Move students under shelter',
        actionGuidance: 'Rain downpour',
        reason: 'Rain rate exceeded 5 mm/h',
        severity: 2,
        enabled: true,
      },
    ],
  };

  const rawLightRain: RawHourlyVariables = {
    ...baseTestRaw,
    rain_rate: 1.5, // 1.5 < 5.0
  };
  const hi = calculateHeatIndex(rawLightRain.temperature_2m, rawLightRain.relative_humidity_2m);
  const evalLightRain = evaluateActivityPolicy(rawLightRain, hi, rainPolicy, 'break');

  assert.equal(evalLightRain.status, 'criteria_met_no_actions');
  assert.equal(evalLightRain.recommendedAction, 'continue');
  assert.equal(evalLightRain.triggeredRules.filter((r) => r.isTriggered).length, 0);
});

// 10. Rain rate and accumulated rainfall handled as distinct metrics
test('Section 8.10: Rain rate and accumulated rainfall handled as distinct metrics', () => {
  const rainDualPolicy: SchoolPolicyConfig = {
    isConfigured: true,
    isApproved: true,
    schoolName: 'Dual Rain School',
    policyVersion: '1.0',
    effectiveDate: '2026-10-01',
    rules: [
      {
        id: 'rain-rate-cutoff',
        name: 'Active Rain Intensity Cutoff',
        activity: 'break',
        metric: 'rain_rate',
        operator: '>=',
        threshold: 10.0,
        unit: 'mm/h',
        recommendedAction: 'suspend',
        actionTitle: 'Suspend outdoor activities',
        actionGuidance: 'Active torrential rain',
        reason: 'Rain rate >= 10 mm/h',
        severity: 3,
        enabled: true,
      },
      {
        id: 'rain-accum-cutoff',
        name: 'Flooding Grounds Accumulation Cutoff',
        activity: 'break',
        metric: 'accumulated_rain',
        operator: '>=',
        threshold: 25.0,
        unit: 'mm',
        recommendedAction: 'relocate',
        actionTitle: 'Move to indoor recreation',
        actionGuidance: 'Ground waterlogging',
        reason: 'Accumulated rain >= 25 mm',
        severity: 2,
        enabled: true,
      },
    ],
  };

  // Waterlogged grounds after rain has ceased: rain_rate = 0 mm/h, accumulated_rain = 30.0 mm
  const rawPonding: RawHourlyVariables = {
    ...baseTestRaw,
    rain_rate: 0.0,
    precipitation: 30.0,
  };
  const hi = calculateHeatIndex(rawPonding.temperature_2m, rawPonding.relative_humidity_2m);
  const evalPonding = evaluateActivityPolicy(rawPonding, hi, rainDualPolicy, 'break');

  assert.equal(evalPonding.status, 'action_triggered');
  assert.equal(evalPonding.recommendedAction, 'relocate'); // from accumulated_rain
  assert.equal(evalPonding.triggeredRules.filter((r) => r.isTriggered).length, 1);
  const triggeredItem = evalPonding.triggeredRules.find((r) => r.isTriggered);
  assert.equal(triggeredItem?.rule.metric, 'accumulated_rain');
  assert.equal(triggeredItem?.observedValue, 30.0);
});

// 11. Missing rain data is not treated as zero
test('Section 8.11: Missing rain data is not treated as zero', () => {
  const rainPolicy: SchoolPolicyConfig = {
    isConfigured: true,
    isApproved: true,
    schoolName: 'Rain Check School',
    policyVersion: '1.0',
    effectiveDate: '2026-10-01',
    missingDataBehavior: 'not_evaluated',
    rules: [
      {
        id: 'rule-rain',
        name: 'Rain Precaution',
        activity: 'break',
        metric: 'rain_rate',
        operator: '>=',
        threshold: 0.5,
        unit: 'mm/h',
        recommendedAction: 'modify',
        actionTitle: 'Wet weather plan',
        actionGuidance: 'Wet weather',
        reason: 'Rain check',
        severity: 1,
        enabled: true,
      },
    ],
  };

  const rawMissingRain: RawHourlyVariables = {
    ...baseTestRaw,
    rain_rate: null,
  };
  const hi = calculateHeatIndex(rawMissingRain.temperature_2m, rawMissingRain.relative_humidity_2m);
  const evalMissingRain = evaluateActivityPolicy(rawMissingRain, hi, rainPolicy, 'break');

  assert.equal(evalMissingRain.dataMissingForAssessment, true);
  assert.equal(evalMissingRain.status, 'not_evaluated');
  assert.notEqual(evalMissingRain.status, 'criteria_met_no_actions');
  assert.equal(evalMissingRain.triggeredRules.some((r) => r.rule.metric === 'rain_rate' && r.isDataMissing), true);
});

// 12. Simultaneous dust, heat and rain triggers all retained
test('Section 8.12: Simultaneous dust, heat and rain triggers all retained', () => {
  const multiHazardPolicy: SchoolPolicyConfig = {
    isConfigured: true,
    isApproved: true,
    schoolName: 'Multi Hazard School',
    policyVersion: '1.0',
    effectiveDate: '2026-10-01',
    rules: [
      {
        id: 'hazard-heat',
        name: 'Heat Trigger',
        activity: 'break',
        metric: 'heat_index',
        operator: '>=',
        threshold: 38,
        unit: '°C',
        recommendedAction: 'modify',
        actionTitle: 'Modify for heat',
        actionGuidance: 'Heat guidance',
        reason: 'Heat',
        severity: 1,
        enabled: true,
      },
      {
        id: 'hazard-dust',
        name: 'Dust Trigger',
        activity: 'break',
        metric: 'dust',
        operator: '>=',
        threshold: 150,
        unit: 'µg/m³',
        recommendedAction: 'relocate',
        actionTitle: 'Relocate for dust',
        actionGuidance: 'Dust guidance',
        reason: 'Dust',
        severity: 2,
        enabled: true,
      },
      {
        id: 'hazard-rain',
        name: 'Rain Trigger',
        activity: 'break',
        metric: 'rain_rate',
        operator: '>=',
        threshold: 4.0,
        unit: 'mm/h',
        recommendedAction: 'suspend',
        actionTitle: 'Suspend for rain',
        actionGuidance: 'Rain guidance',
        reason: 'Rain',
        severity: 3,
        enabled: true,
      },
    ],
  };

  const rawCompoundHazard: RawHourlyVariables = {
    ...baseTestRaw,
    temperature_2m: 35,
    relative_humidity_2m: 55, // HI ~41°C >= 38
    dust: 220,               // 220 >= 150
    rain_rate: 6.0,          // 6.0 >= 4.0
  };
  const hi = calculateHeatIndex(rawCompoundHazard.temperature_2m, rawCompoundHazard.relative_humidity_2m);
  const result = evaluateActivityPolicy(rawCompoundHazard, hi, multiHazardPolicy, 'break');

  assert.equal(result.status, 'action_triggered');
  assert.equal(result.recommendedAction, 'suspend'); // Most protective action wins
  assert.equal(result.triggeredRules.filter((r) => r.isTriggered).length, 3, 'All 3 simultaneous triggers must be retained');

  const triggeredRuleIds = result.triggeredRules.filter((r) => r.isTriggered).map((tr) => tr.rule.id);
  assert.ok(triggeredRuleIds.includes('hazard-heat'));
  assert.ok(triggeredRuleIds.includes('hazard-dust'));
  assert.ok(triggeredRuleIds.includes('hazard-rain'));
});

// 13. Action precedence cannot select less protective action
test('Section 8.13: Action precedence cannot select less protective action', () => {
  // Even if precedenceOrder is backwards: ['continue', 'modify', 'relocate', 'suspend']
  const backwardsPrecedence: Array<'continue' | 'modify' | 'relocate' | 'suspend' | 'human_review'> = [
    'continue',
    'modify',
    'relocate',
    'suspend',
  ];

  const actionsPresent: Array<'continue' | 'modify' | 'relocate' | 'suspend' | 'human_review'> = [
    'continue',
    'modify',
    'suspend',
  ];

  const chosen = resolvePrecedence(actionsPresent, backwardsPrecedence);
  // Protection invariant: suspend (protection 5) must prevail over continue (1) or modify (3)
  assert.equal(chosen, 'suspend');
});

// 14. Unavailable NCM status never presented as verified absence
test('Section 8.14: Unavailable NCM status never presented as verified absence', () => {
  const rawWithUnavailableNCM: RawHourlyVariables = {
    ...baseTestRaw,
    ncm_warning_status: 'unavailable',
  };

  const metricVal = getMetricValue('ncm_warning', rawWithUnavailableNCM, null);
  assert.equal(metricVal, null, 'Unavailable NCM status must evaluate to null, not none/safe');

  const ncmPolicy: SchoolPolicyConfig = {
    isConfigured: true,
    isApproved: true,
    schoolName: 'NCM Test School',
    policyVersion: '1.0',
    effectiveDate: '2026-10-01',
    missingDataBehavior: 'not_evaluated',
    rules: [
      {
        id: 'rule-ncm',
        name: 'Official NCM Amber/Red Warning',
        activity: 'break',
        metric: 'ncm_warning',
        operator: '==',
        threshold: 1,
        unit: 'warning',
        recommendedAction: 'suspend',
        actionTitle: 'Suspend on official warning',
        actionGuidance: 'Official warning active',
        reason: 'NCM warning check',
        severity: 3,
        enabled: true,
      },
    ],
  };

  const hi = calculateHeatIndex(rawWithUnavailableNCM.temperature_2m, rawWithUnavailableNCM.relative_humidity_2m);
  const evalNCM = evaluateActivityPolicy(rawWithUnavailableNCM, hi, ncmPolicy, 'break');

  assert.equal(evalNCM.dataMissingForAssessment, true);
  assert.equal(evalNCM.status, 'not_evaluated');
  assert.notEqual(evalNCM.status, 'criteria_met_no_actions');
});

// 15. AI explanation cannot override deterministic policy result
test('Section 8.15: AI explanation cannot override deterministic policy result', async () => {
  // Gated condition: policy unconfigured
  const resUnconfigured = await getSchoolModeAdvice(
    'Dubai',
    'break',
    '10:00 GST',
    {
      status: 'policy_unconfigured',
      recommendedAction: 'normal',
      actionTitle: 'School policy configuration required',
      primaryGuidance: 'Operational school policy is required before evaluating recommendations.',
      reason: 'Policy unconfigured',
      triggeredRules: [],
      dataMissingForAssessment: false,
      isIncomplete: false,
      isPolicyConfigured: false,
    },
    {
      temperature: 30,
      relativeHumidity: 50,
      heatIndex: { heatIndexCelsius: 31, category: 'Caution' },
      pm10: 50,
      dust: 30,
    }
  );
  assert.equal(resUnconfigured.isAI, false);
  assert.ok(resUnconfigured.summary.includes('policy'));

  // Gated condition: starter configuration
  const resStarter = await getSchoolModeAdvice(
    'Dubai',
    'break',
    '10:00 GST',
    {
      status: 'policy_not_configured',
      recommendedAction: 'continue',
      actionTitle: 'Starter configuration — not an approved school policy',
      primaryGuidance: 'Starter template; approval required.',
      reason: 'Starter template',
      triggeredRules: [],
      dataMissingForAssessment: false,
      isIncomplete: false,
      isPolicyConfigured: false,
      isStarterConfig: true,
    } as any,
    {
      temperature: 30,
      relativeHumidity: 50,
      heatIndex: { heatIndexCelsius: 31, category: 'Caution' },
      pm10: 50,
      dust: 30,
    }
  );
  assert.equal(resStarter.isAI, false);
  assert.ok(resStarter.summary.includes('Starter configuration'));
});

// 16. Existing dust-risk calculations and unrelated behavior remain unchanged
test('Section 8.16: Existing dust-risk calculations and unrelated behavior remain unchanged', () => {
  const sampleAtmosphere: RawHourlyVariables = {
    time: '2026-10-21T12:00',
    temperature_2m: 35,
    relative_humidity_2m: 25,
    pm10: 120,
    pm2_5: 35,
    dust: 80,
    wind_speed_10m: 22,
    wind_gusts_10m: 32,
    wind_direction_10m: 310,
    visibility: 6000,
    aerosol_optical_depth: 0.45,
  };

  const baseline = calculateHourlyBaseline(0, sampleAtmosphere);
  assert.ok(typeof baseline.finalScore === 'number' && baseline.finalScore >= 0 && baseline.finalScore <= 100);
  assert.ok(['Low', 'Moderate', 'High', 'Very High'].includes(baseline.category));
  assert.equal(baseline.subScores.pm10.variableKey, 'pm10');
  assert.equal(baseline.subScores.dust.variableKey, 'dust');
  assert.equal(baseline.subScores.relative_humidity_2m.variableKey, 'relative_humidity_2m');
  assert.equal(baseline.subScores.relative_humidity_2m.weight, 0.05); // 5% weight
});

// 17. Fictional Policy Presentation Tests
test('Fictional Policy: with no triggered thresholds never displays operational Criteria Met wording', () => {
  const calmConditions: RawHourlyVariables = {
    time: '2026-10-21T09:00',
    temperature_2m: 26,
    relative_humidity_2m: 35,
    pm10: 45,
    pm2_5: 15,
    dust: 25,
    wind_speed_10m: 12,
    wind_gusts_10m: 18,
    wind_direction_10m: 290,
    visibility: 10000,
    aerosol_optical_depth: 0.15,
    rain_rate: 0,
    precipitation: 0,
  };

  const hi = calculateHeatIndex(calmConditions.temperature_2m, calmConditions.relative_humidity_2m);
  
  // Test across all school activities
  const activities: Array<'break' | 'pe' | 'lunch_other' | 'assembly'> = ['break', 'pe', 'lunch_other', 'assembly'];
  for (const act of activities) {
    const assessment = evaluateActivityPolicy(calmConditions, hi, FICTIONAL_DEMO_POLICY, act);
    assert.equal(assessment.isFictionalDemo, true);
    assert.notEqual(assessment.actionTitle, 'Conditions meet the configured criteria for this activity');
    assert.equal(assessment.actionTitle, 'Demonstration Result — Not Operational');
    assert.ok(assessment.primaryGuidance.includes('not an operational safety determination'));
    assert.ok(assessment.primaryGuidance.includes('testing only'));
  }
});

test('Fictional Policy: with triggered thresholds displays demonstration-only status while preserving rule details', () => {
  const hazardConditions: RawHourlyVariables = {
    time: '2026-10-21T13:00',
    temperature_2m: 38,
    relative_humidity_2m: 55, // Heat index ~47°C -> triggers relocate (threshold 40)
    pm10: 280, // PM10 >= 250 -> triggers relocate
    pm2_5: 80,
    dust: 210, // Dust >= 200 -> triggers relocate
    wind_speed_10m: 25,
    wind_gusts_10m: 55, // Gusts >= 50 -> triggers relocate
    wind_direction_10m: 310,
    visibility: 3000,
    aerosol_optical_depth: 0.7,
    rain_rate: 0,
    precipitation: 0,
  };

  const hi = calculateHeatIndex(hazardConditions.temperature_2m, hazardConditions.relative_humidity_2m);
  const assessment = evaluateActivityPolicy(hazardConditions, hi, FICTIONAL_DEMO_POLICY, 'break');

  assert.equal(assessment.status, 'action_triggered');
  assert.equal(assessment.isFictionalDemo, true);
  // Must indicate demonstration-only in actionTitle, primaryGuidance, and reason
  assert.ok(assessment.actionTitle.startsWith('Demonstration:'));
  assert.ok(assessment.primaryGuidance.includes('Demonstration result only'));
  assert.ok(assessment.reason.includes('fictional testing'));
  // Triggered rule details must be fully preserved for verification
  assert.ok(assessment.triggeredRules.length >= 4);
  const heatRule = assessment.triggeredRules.find((tr) => tr.rule.metric === 'heat_index');
  assert.ok(heatRule && heatRule.isTriggered);
  assert.equal(heatRule.thresholdValue, 40);
  const pm10Rule = assessment.triggeredRules.find((tr) => tr.rule.id === 'pm10-severe-all');
  assert.ok(pm10Rule && pm10Rule.isTriggered);
});

test('Fictional Policy: 12-hour timeline assessments carry isFictionalDemo flag and non-operational guidance', () => {
  const calmHours: RawHourlyVariables[] = Array.from({ length: 12 }, (_, i) => ({
    time: `2026-10-21T${String(8 + i).padStart(2, '0')}:00`,
    temperature_2m: 27,
    relative_humidity_2m: 30,
    pm10: 40,
    pm2_5: 12,
    dust: 20,
    wind_speed_10m: 10,
    wind_gusts_10m: 15,
    wind_direction_10m: 280,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
    rain_rate: 0,
    precipitation: 0,
  }));

  const timeline = buildHourlySchoolAssessments(calmHours, FICTIONAL_DEMO_POLICY);
  assert.equal(timeline.length, 12);

  for (const hour of timeline) {
    for (const act of ['break', 'pe', 'assembly'] as const) {
      const actAssessment = hour.activityAssessments[act];
      assert.equal(actAssessment.isFictionalDemo, true);
      assert.equal(actAssessment.actionTitle, 'Demonstration Result — Not Operational');
      assert.notEqual(actAssessment.actionTitle, 'Conditions meet the configured criteria for this activity');
    }
  }
});

test('Approved School Policy: valid non-fictional policy retains operational criteria met status', () => {
  const calmConditions: RawHourlyVariables = {
    time: '2026-10-21T09:00',
    temperature_2m: 25,
    relative_humidity_2m: 35,
    pm10: 40,
    pm2_5: 10,
    dust: 20,
    wind_speed_10m: 10,
    wind_gusts_10m: 15,
    wind_direction_10m: 290,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
    rain_rate: 0,
    precipitation: 0,
  };

  const hi = calculateHeatIndex(calmConditions.temperature_2m, calmConditions.relative_humidity_2m);
  const assessment = evaluateActivityPolicy(calmConditions, hi, SAMPLE_APPROVED_SCHOOL_POLICY, 'break');

  assert.equal(assessment.isFictionalDemo, false);
  assert.equal(assessment.status, 'criteria_met_no_actions');
  assert.equal(assessment.actionTitle, 'Conditions meet the configured criteria for this activity');
  assert.ok(assessment.primaryGuidance.includes('Conditions meet the configured criteria for this activity under current school thresholds'));
});

test('Starter Policy: unconfigured starter template retains policy_not_configured status', () => {
  const calmConditions: RawHourlyVariables = {
    time: '2026-10-21T09:00',
    temperature_2m: 25,
    relative_humidity_2m: 35,
    pm10: 40,
    pm2_5: 10,
    dust: 20,
    wind_speed_10m: 10,
    wind_gusts_10m: 15,
    wind_direction_10m: 290,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
    rain_rate: 0,
    precipitation: 0,
  };

  const hi = calculateHeatIndex(calmConditions.temperature_2m, calmConditions.relative_humidity_2m);
  const assessment = evaluateActivityPolicy(calmConditions, hi, DEFAULT_UNCONFIGURED_POLICY, 'break');

  assert.ok(assessment.status === 'policy_not_configured' || assessment.status === 'policy_unconfigured');
  assert.equal(assessment.actionTitle, 'School policy configuration required');
  assert.notEqual(assessment.actionTitle, 'Criteria Met');
  assert.notEqual(assessment.actionTitle, 'Demonstration Result — Not Operational');
});

/* ========================================================================
   SECTION 9 — DYNAMIC RULES MANAGEMENT & CONCURRENT CONDITIONS TESTS
   ======================================================================== */

test('Dynamic Rules: supports unlimited rules and multiple rules sharing the same metric', () => {
  // Test progressive heat index tiers on the same metric 'heat_index'
  const progressivePolicy: SchoolPolicyConfig = {
    schoolName: 'Dynamic Rules Academy',
    policyVersion: '1.0',
    effectiveDate: '2026-11-01',
    isConfigured: true,
    isApproved: true,
    isStarterConfig: false,
    rules: [
      {
        id: 'rule-heat-modify',
        name: 'Tier 1: Heat Index >= 32°C -> Modify',
        activity: 'pe',
        metric: 'heat_index',
        operator: '>=',
        threshold: 32,
        unit: '°C',
        recommendedAction: 'modify',
        actionTitle: 'Mandate frequent hydration',
        actionGuidance: 'Reduce cardio intensity and take shade breaks.',
        reason: 'Heat index reached Tier 1 advisory level',
        severity: 1,
        enabled: true,
      },
      {
        id: 'rule-heat-relocate',
        name: 'Tier 2: Heat Index >= 38°C -> Relocate',
        activity: 'pe',
        metric: 'heat_index',
        operator: '>=',
        threshold: 38,
        unit: '°C',
        recommendedAction: 'relocate',
        actionTitle: 'Move PE indoors to AC hall',
        actionGuidance: 'No outdoor PE allowed.',
        reason: 'Heat index reached Tier 2 danger level',
        severity: 2,
        enabled: true,
      },
      {
        id: 'rule-heat-suspend',
        name: 'Tier 3: Heat Index >= 44°C -> Suspend',
        activity: 'pe',
        metric: 'heat_index',
        operator: '>=',
        threshold: 44,
        unit: '°C',
        recommendedAction: 'suspend',
        actionTitle: 'Suspend PE completely',
        actionGuidance: 'All physical exertion suspended.',
        reason: 'Heat index reached Tier 3 extreme danger level',
        severity: 3,
        enabled: true,
      },
      // Additional rules to prove unlimited capacity (> 6 rules)
      {
        id: 'rule-pm10-mod',
        name: 'PM10 >= 100 -> Modify',
        activity: 'pe',
        metric: 'pm10',
        operator: '>=',
        threshold: 100,
        unit: 'µg/m³',
        recommendedAction: 'modify',
        actionTitle: 'Accommodate sensitive students',
        actionGuidance: 'Allow students with respiratory sensitivities to remain inside.',
        reason: 'Elevated PM10 particulates',
        severity: 1,
        enabled: true,
      },
      {
        id: 'rule-pm10-rel',
        name: 'PM10 >= 200 -> Relocate',
        activity: 'pe',
        metric: 'pm10',
        operator: '>=',
        threshold: 200,
        unit: 'µg/m³',
        recommendedAction: 'relocate',
        actionTitle: 'Relocate PE inside',
        actionGuidance: 'Particulate levels exceed outdoor sports thresholds.',
        reason: 'Severe PM10 particulates',
        severity: 2,
        enabled: true,
      },
      {
        id: 'rule-wind-1',
        name: 'Wind Speed >= 25 -> Modify',
        activity: 'pe',
        metric: 'wind_speed',
        operator: '>=',
        threshold: 25,
        unit: 'km/h',
        recommendedAction: 'modify',
        actionTitle: 'Secure loose sports equipment',
        actionGuidance: 'Moderate winds on playing fields.',
        reason: 'Breezy conditions',
        severity: 1,
        enabled: true,
      },
      {
        id: 'rule-wind-2',
        name: 'Wind Gusts >= 45 -> Relocate',
        activity: 'pe',
        metric: 'wind_gusts',
        operator: '>=',
        threshold: 45,
        unit: 'km/h',
        recommendedAction: 'relocate',
        actionTitle: 'Move PE indoors (gust hazard)',
        actionGuidance: 'Flying dust and debris hazard.',
        reason: 'High wind gusts',
        severity: 2,
        enabled: true,
      },
      {
        id: 'rule-rain-1',
        name: 'Rain Rate >= 2 -> Modify',
        activity: 'pe',
        metric: 'rain_rate',
        operator: '>=',
        threshold: 2,
        unit: 'mm/h',
        recommendedAction: 'modify',
        actionTitle: 'Under covered canopy only',
        actionGuidance: 'Slip hazards on outdoor court.',
        reason: 'Light to moderate rain shower',
        severity: 1,
        enabled: true,
      },
      {
        id: 'rule-rain-2',
        name: 'Rain Rate >= 15 -> Suspend',
        activity: 'pe',
        metric: 'rain_rate',
        operator: '>=',
        threshold: 15,
        unit: 'mm/h',
        recommendedAction: 'suspend',
        actionTitle: 'Suspend outdoor sessions',
        actionGuidance: 'Heavy rainfall downpour.',
        reason: 'Heavy rain rate',
        severity: 3,
        enabled: true,
      },
    ],
  };

  assert.equal(progressivePolicy.rules.length, 9);
  const validated = validateSchoolPolicy(progressivePolicy);
  assert.equal(validated.isConfigured, true);
  assert.equal(validated.rules.length, 9);

  // Scenario A: Heat index = 34°C -> Only Tier 1 triggers -> modify
  const rawTier1: RawHourlyVariables = {
    time: '2026-11-01T10:00',
    temperature_2m: 31,
    relative_humidity_2m: 55, // hi ~ 34-35°C
    pm10: 50,
    pm2_5: 20,
    dust: 20,
    wind_speed_10m: 10,
    wind_gusts_10m: 15,
    wind_direction_10m: 270,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
    rain_rate: 0,
    precipitation: 0,
  };
  const hiTier1 = calculateHeatIndex(rawTier1.temperature_2m, rawTier1.relative_humidity_2m);
  const evalTier1 = evaluateActivityPolicy(rawTier1, hiTier1, validated, 'pe');
  assert.equal(evalTier1.recommendedAction, 'modify');
  assert.equal(evalTier1.triggeredRules.filter((r) => r.isTriggered).length, 1);

  // Scenario B: Heat index = 40°C -> Both Tier 1 and Tier 2 trigger -> Tier 2 (relocate) wins
  const rawTier2: RawHourlyVariables = {
    ...rawTier1,
    temperature_2m: 35,
    relative_humidity_2m: 50, // hi ~ 40°C
  };
  const hiTier2 = calculateHeatIndex(rawTier2.temperature_2m, rawTier2.relative_humidity_2m);
  const evalTier2 = evaluateActivityPolicy(rawTier2, hiTier2, validated, 'pe');
  assert.equal(evalTier2.recommendedAction, 'relocate');
  // Both Tier 1 & Tier 2 triggered
  const triggeredHeat = evalTier2.triggeredRules.filter((r) => r.isTriggered && r.rule.metric === 'heat_index');
  assert.equal(triggeredHeat.length, 2);

  // Scenario C: Heat index = 46°C -> Tier 1, 2, and 3 trigger -> Tier 3 (suspend) wins
  const rawTier3: RawHourlyVariables = {
    ...rawTier1,
    temperature_2m: 40,
    relative_humidity_2m: 50, // hi ~ 46°C
  };
  const hiTier3 = calculateHeatIndex(rawTier3.temperature_2m, rawTier3.relative_humidity_2m);
  const evalTier3 = evaluateActivityPolicy(rawTier3, hiTier3, validated, 'pe');
  assert.equal(evalTier3.recommendedAction, 'suspend');
});

test('Dynamic Rules: evaluates QA artificial examples correctly', () => {
  // Test the four specific QA artificial examples:
  // 1. Heat index ≥ 35°C → Relocate PE
  // 2. PM10 ≥ 1 µg/m³ → Modify all activities
  // 3. Wind gusts ≥ 40 km/h → Human review during breaks
  // 4. Rain rate ≥ 10 mm/h → Suspend all activities
  const qaPolicy: SchoolPolicyConfig = {
    schoolName: 'QA Validation Campus',
    policyVersion: '1.0',
    effectiveDate: '2026-11-01',
    isConfigured: true,
    isApproved: true,
    isStarterConfig: false,
    rules: [
      {
        id: 'qa-rule-1-heat-pe',
        name: 'Heat index >= 35°C -> Relocate PE',
        activity: 'pe',
        metric: 'heat_index',
        operator: '>=',
        threshold: 35,
        unit: '°C',
        recommendedAction: 'relocate',
        actionTitle: 'Move PE indoors',
        actionGuidance: 'Heat index exceeds 35°C.',
        reason: 'Heat threshold exceeded',
        severity: 2,
        enabled: true,
      },
      {
        id: 'qa-rule-2-pm10-all',
        name: 'PM10 >= 1 µg/m³ -> Modify all activities',
        activity: 'all',
        metric: 'pm10',
        operator: '>=',
        threshold: 1,
        unit: 'µg/m³',
        recommendedAction: 'modify',
        actionTitle: 'Modify outdoor activities',
        actionGuidance: 'PM10 exceeds 1 µg/m³.',
        reason: 'PM10 threshold exceeded',
        severity: 1,
        enabled: true,
      },
      {
        id: 'qa-rule-3-gusts-break',
        name: 'Wind gusts >= 40 km/h -> Human review during breaks',
        activity: 'break',
        metric: 'wind_gusts',
        operator: '>=',
        threshold: 40,
        unit: 'km/h',
        recommendedAction: 'human_review',
        actionTitle: 'Duty staff assessment required',
        actionGuidance: 'Wind gusts >= 40 km/h during break.',
        reason: 'Wind gusts threshold reached',
        severity: 2,
        enabled: true,
      },
      {
        id: 'qa-rule-4-rain-all',
        name: 'Rain rate >= 10 mm/h -> Suspend all activities',
        activity: 'all',
        metric: 'rain_rate',
        operator: '>=',
        threshold: 10,
        unit: 'mm/h',
        recommendedAction: 'suspend',
        actionTitle: 'Suspend outdoor activities',
        actionGuidance: 'Heavy rain rate exceeds 10 mm/h.',
        reason: 'Rain rate threshold reached',
        severity: 3,
        enabled: true,
      },
    ],
  };

  // 1. Test Heat index >= 35°C on PE: should trigger relocate
  const rawPeHeat: RawHourlyVariables = {
    time: '2026-11-01T11:00',
    temperature_2m: 34,
    relative_humidity_2m: 45, // hi ~ 37°C
    pm10: 0, // below 1 to isolate rule 1
    pm2_5: 0,
    dust: 0,
    wind_speed_10m: 10,
    wind_gusts_10m: 15,
    wind_direction_10m: 270,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
    rain_rate: 0,
    precipitation: 0,
  };
  const hiPeHeat = calculateHeatIndex(rawPeHeat.temperature_2m, rawPeHeat.relative_humidity_2m);
  const evalPe = evaluateActivityPolicy(rawPeHeat, hiPeHeat, qaPolicy, 'pe');
  assert.equal(evalPe.recommendedAction, 'relocate');
  assert.equal(evalPe.triggeredRules.find((r) => r.rule.id === 'qa-rule-1-heat-pe')?.isTriggered, true);

  // 2. Test PM10 >= 1 µg/m³ on break: should trigger modify
  const rawPm10: RawHourlyVariables = {
    time: '2026-11-01T11:00',
    temperature_2m: 22,
    relative_humidity_2m: 40, // hi not applicable or low
    pm10: 5, // exceeds 1
    pm2_5: 2,
    dust: 2,
    wind_speed_10m: 10,
    wind_gusts_10m: 20, // below 40
    wind_direction_10m: 270,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
    rain_rate: 0,
    precipitation: 0,
  };
  const hiPm10 = calculateHeatIndex(rawPm10.temperature_2m, rawPm10.relative_humidity_2m);
  const evalPm10 = evaluateActivityPolicy(rawPm10, hiPm10, qaPolicy, 'break');
  assert.equal(evalPm10.recommendedAction, 'modify');
  assert.equal(evalPm10.triggeredRules.find((r) => r.rule.id === 'qa-rule-2-pm10-all')?.isTriggered, true);

  // 3. Test Wind gusts >= 40 km/h on break with PM10 < 1: should trigger human_review with status 'human_review'
  const rawGusts: RawHourlyVariables = {
    ...rawPm10,
    pm10: 0, // below 1
    wind_gusts_10m: 45, // exceeds 40
  };
  const evalGusts = evaluateActivityPolicy(rawGusts, hiPm10, qaPolicy, 'break');
  assert.equal(evalGusts.recommendedAction, 'human_review');
  assert.equal(evalGusts.status, 'human_review'); // Distinguishable from operational decision
  assert.equal(evalGusts.triggeredRules.find((r) => r.rule.id === 'qa-rule-3-gusts-break')?.isTriggered, true);

  // 4. Test Rain rate >= 10 mm/h on all activities: should trigger suspend
  const rawRain: RawHourlyVariables = {
    ...rawPm10,
    pm10: 0,
    rain_rate: 14.5,
  };
  const evalRainBreak = evaluateActivityPolicy(rawRain, hiPm10, qaPolicy, 'break');
  assert.equal(evalRainBreak.recommendedAction, 'suspend');
  const evalRainPE = evaluateActivityPolicy(rawRain, hiPm10, qaPolicy, 'pe');
  assert.equal(evalRainPE.recommendedAction, 'suspend');
});

test('Dynamic Rules: deterministic action precedence and Human Review differentiation', () => {
  // Test conflict resolution: when human review and a protective action (modify, relocate, suspend)
  // trigger simultaneously, the more protective action must win, and conflictingRules must be flagged.
  const conflictPolicy: SchoolPolicyConfig = {
    schoolName: 'Precedence Verification School',
    policyVersion: '1.0',
    effectiveDate: '2026-11-01',
    isConfigured: true,
    isApproved: true,
    isStarterConfig: false,
    rules: [
      {
        id: 'rule-gust-review',
        name: 'Wind gusts >= 40 -> Human Review',
        activity: 'break',
        metric: 'wind_gusts',
        operator: '>=',
        threshold: 40,
        unit: 'km/h',
        recommendedAction: 'human_review',
        actionTitle: 'Human assessment of playground wind',
        actionGuidance: 'Review local playground shelter.',
        reason: 'Wind gusts reached review threshold',
        severity: 1,
        enabled: true,
      },
      {
        id: 'rule-pm10-modify',
        name: 'PM10 >= 50 -> Modify',
        activity: 'break',
        metric: 'pm10',
        operator: '>=',
        threshold: 50,
        unit: 'µg/m³',
        recommendedAction: 'modify',
        actionTitle: 'Modify playground activities',
        actionGuidance: 'Provide indoor alternatives.',
        reason: 'PM10 elevated',
        severity: 1,
        enabled: true,
      },
      {
        id: 'rule-rain-suspend',
        name: 'Rain >= 10 -> Suspend',
        activity: 'break',
        metric: 'rain_rate',
        operator: '>=',
        threshold: 10,
        unit: 'mm/h',
        recommendedAction: 'suspend',
        actionTitle: 'Suspend outdoor break',
        actionGuidance: 'Heavy rain.',
        reason: 'Rain rate high',
        severity: 3,
        enabled: true,
      },
    ],
  };

  const rawConditions: RawHourlyVariables = {
    time: '2026-11-01T12:00',
    temperature_2m: 26,
    relative_humidity_2m: 45,
    pm10: 60, // triggers modify
    pm2_5: 15,
    dust: 20,
    wind_speed_10m: 25,
    wind_gusts_10m: 42, // triggers human_review
    wind_direction_10m: 280,
    visibility: 8000,
    aerosol_optical_depth: 0.1,
    rain_rate: 0,
    precipitation: 0,
  };
  const hi = calculateHeatIndex(rawConditions.temperature_2m, rawConditions.relative_humidity_2m);

  // Both human_review and modify triggered: modify (level 3) overrides human_review (level 2)
  const evalConflict1 = evaluateActivityPolicy(rawConditions, hi, conflictPolicy, 'break');
  assert.equal(evalConflict1.recommendedAction, 'modify');
  assert.equal(evalConflict1.status, 'action_triggered');
  assert.equal(evalConflict1.conflictingRules, true);

  // If rain rate also exceeds 10: suspend (level 5) overrides both modify and human_review
  const rawWithRain: RawHourlyVariables = {
    ...rawConditions,
    rain_rate: 15,
  };
  const evalConflict2 = evaluateActivityPolicy(rawWithRain, hi, conflictPolicy, 'break');
  assert.equal(evalConflict2.recommendedAction, 'suspend');
  assert.equal(evalConflict2.status, 'action_triggered');
  assert.equal(evalConflict2.conflictingRules, true);
});

test('Dynamic Rules: disabled rules never trigger and missing measurements are never treated as zero', () => {
  const testPolicy: SchoolPolicyConfig = {
    schoolName: 'Integrity School',
    policyVersion: '1.0',
    effectiveDate: '2026-11-01',
    isConfigured: true,
    isApproved: true,
    isStarterConfig: false,
    rules: [
      {
        id: 'rule-disabled-suspend',
        name: 'Disabled severe rain suspension',
        activity: 'all',
        metric: 'rain_rate',
        operator: '>=',
        threshold: 5,
        unit: 'mm/h',
        recommendedAction: 'suspend',
        actionTitle: 'Suspend outdoor activities',
        actionGuidance: 'Rain suspension rule.',
        reason: 'Disabled rule reason',
        severity: 3,
        enabled: false, // DISABLED
      },
      {
        id: 'rule-active-pm10',
        name: 'Active PM10 advisory',
        activity: 'all',
        metric: 'pm10',
        operator: '>=',
        threshold: 100,
        unit: 'µg/m³',
        recommendedAction: 'modify',
        actionTitle: 'Dust advisory',
        actionGuidance: 'Active PM10 rule.',
        reason: 'PM10 advisory',
        severity: 1,
        enabled: true,
      },
    ],
  };

  // 1. Rain is 20 mm/h (exceeds 5), but the rain rule is DISABLED. PM10 is missing (null).
  const rawWithRainAndMissingPM10: RawHourlyVariables = {
    time: '2026-11-01T13:00',
    temperature_2m: 24,
    relative_humidity_2m: 45,
    pm10: null, // missing! Must NOT be treated as zero!
    pm2_5: 10,
    dust: 10,
    wind_speed_10m: 10,
    wind_gusts_10m: 15,
    wind_direction_10m: 280,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
    rain_rate: 20,
    precipitation: 5,
  };
  const hi = calculateHeatIndex(rawWithRainAndMissingPM10.temperature_2m, rawWithRainAndMissingPM10.relative_humidity_2m);

  const evalRes = evaluateActivityPolicy(rawWithRainAndMissingPM10, hi, testPolicy, 'break');
  // The disabled rule must NOT trigger
  assert.notEqual(evalRes.recommendedAction, 'suspend');
  // PM10 is missing and active: assessment must reflect missing data, NOT treat PM10 as 0
  assert.equal(evalRes.dataMissingForAssessment, true);
  assert.ok(evalRes.status === 'assessment_unavailable' || evalRes.status === 'not_evaluated');
});

test('Dynamic Rules: helper functions createNewDefaultRule and getMetricUnit align correctly', () => {
  // Test createNewDefaultRule
  const pm10Rule = createNewDefaultRule('pm10', 'all');
  assert.equal(pm10Rule.metric, 'pm10');
  assert.equal(pm10Rule.unit, 'µg/m³');
  assert.equal(pm10Rule.enabled, true);
  assert.ok(typeof pm10Rule.threshold === 'number');

  const heatRule = createNewDefaultRule('heat_index', 'pe');
  assert.equal(heatRule.metric, 'heat_index');
  assert.equal(heatRule.unit, '°C');
  assert.equal(heatRule.activity, 'pe');

  // Test getMetricUnit
  assert.equal(getMetricUnit('heat_index'), '°C');
  assert.equal(getMetricUnit('wind_gusts'), 'km/h');
  assert.equal(getMetricUnit('rain_rate'), 'mm/h');
  assert.equal(getMetricUnit('visibility'), 'm');
  assert.equal(getMetricUnit('relative_humidity'), '%');
  assert.equal(getMetricUnit('wind_direction'), '°');

  // Test validation rejects invalid threshold (null or NaN when validating configured rules)
  const invalidRulePolicy: any = {
    schoolName: 'Test School',
    isConfigured: true,
    isStarterConfig: false,
    rules: [
      {
        id: 'bad-thresh',
        name: 'Bad Threshold Rule',
        activity: 'pe',
        metric: 'pm10',
        operator: '>=',
        threshold: NaN,
        unit: 'µg/m³',
        recommendedAction: 'modify',
        enabled: true,
      },
    ],
  };
  const validatedBad = validateSchoolPolicy(invalidRulePolicy);
  // Policy with invalid rule (e.g. NaN threshold) must fail safely to unconfigured default
  assert.equal(validatedBad.isConfigured, false);
  assert.equal(validatedBad.isStarterConfig, true);
});

/* =========================================================================================
 * AUDIT TESTS: School Policy Safety and Conflict-Resolution
 * ========================================================================================= */

test('Audit 1: Human Review must never disappear when combined with operational actions', () => {
  const baseRules = [
    {
      id: 'rule-gust-review',
      name: 'High Wind Gusts -> Human Review',
      activity: 'all' as const,
      metric: 'wind_gusts' as const,
      operator: '>=' as const,
      threshold: 40,
      unit: 'km/h',
      recommendedAction: 'human_review' as const,
      actionTitle: 'Human assessment of playground wind',
      actionGuidance: 'Authorized staff must inspect playground conditions.',
      reason: 'Wind gusts reached review threshold',
      severity: 1,
      enabled: true,
    },
    {
      id: 'rule-pm10-modify',
      name: 'Moderate PM10 -> Modify Activity',
      activity: 'all' as const,
      metric: 'pm10' as const,
      operator: '>=' as const,
      threshold: 50,
      unit: 'µg/m³',
      recommendedAction: 'modify' as const,
      actionTitle: 'Reduce strenuous outdoor exertion',
      actionGuidance: 'Shorten outdoor drills and provide indoor shaded alternatives.',
      reason: 'PM10 particulate level elevated',
      severity: 2,
      enabled: true,
    },
    {
      id: 'rule-heat-relocate',
      name: 'High Heat Index -> Relocate Indoors',
      activity: 'all' as const,
      metric: 'heat_index' as const,
      operator: '>=' as const,
      threshold: 38,
      unit: '°C',
      recommendedAction: 'relocate' as const,
      actionTitle: 'Relocate outdoor activities to air-conditioned sports hall',
      actionGuidance: 'Heat index in Danger range. All outdoor activities must move indoors.',
      reason: 'Heat index reached relocation threshold',
      severity: 3,
      enabled: true,
    },
    {
      id: 'rule-rain-suspend',
      name: 'Heavy Rain -> Suspend Activity',
      activity: 'all' as const,
      metric: 'rain_rate' as const,
      operator: '>=' as const,
      threshold: 15,
      unit: 'mm/h',
      recommendedAction: 'suspend' as const,
      actionTitle: 'Suspend all outdoor sessions',
      actionGuidance: 'Heavy rainfall and surface ponding. Halt outdoor sessions.',
      reason: 'Rain rate exceeded safety threshold',
      severity: 4,
      enabled: true,
    },
  ];

  const auditPolicy: SchoolPolicyConfig = {
    schoolName: 'Audit Test Academy',
    policyVersion: '2.0',
    effectiveDate: '2026-11-04',
    approvedBy: 'Director of Campus Safety',
    sourceDocument: 'School Safety Manual 2026',
    isConfigured: true,
    isApproved: true,
    isStarterConfig: false,
    rules: baseRules,
    precedenceOrder: ['suspend', 'relocate', 'modify', 'human_review', 'continue'],
  };

  const baseTelemetry: RawHourlyVariables = {
    time: '2026-11-04T10:00',
    temperature_2m: 25,
    relative_humidity_2m: 40,
    pm10: 10,
    pm2_5: 5,
    dust: 5,
    wind_speed_10m: 10,
    wind_gusts_10m: 45, // Exceeds 40 km/h -> triggers Human Review
    wind_direction_10m: 270,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
    rain_rate: 0,
    precipitation: 0,
  };

  // Case 1: Human Review alone
  const hiClean = calculateHeatIndex(baseTelemetry.temperature_2m, baseTelemetry.relative_humidity_2m);
  const evalHrAlone = evaluateActivityPolicy(baseTelemetry, hiClean, auditPolicy, 'break');
  assert.equal(evalHrAlone.recommendedAction, 'human_review');
  assert.equal(evalHrAlone.status, 'human_review');
  assert.equal(evalHrAlone.requiresHumanReview, true);
  assert.equal(evalHrAlone.conflictingRules, false);

  // Case 2: Modify + Human Review
  const rawModifyHr: RawHourlyVariables = {
    ...baseTelemetry,
    pm10: 65, // Exceeds 50 -> triggers Modify
  };
  const evalModifyHr = evaluateActivityPolicy(rawModifyHr, hiClean, auditPolicy, 'break');
  assert.equal(evalModifyHr.recommendedAction, 'modify');
  assert.equal(evalModifyHr.status, 'action_triggered');
  assert.equal(evalModifyHr.requiresHumanReview, true, 'requiresHumanReview must remain true');
  assert.ok(evalModifyHr.actionTitle.includes('Staff Human Review Required'), 'Title must note staff review');
  assert.ok(evalModifyHr.primaryGuidance.includes('mandates on-site staff human review'), 'Guidance must include staff review notice');
  assert.equal(evalModifyHr.conflictingRules, true);

  // Case 3: Relocate + Human Review
  // 35°C and 60% RH -> heat index ~45°C (exceeds 38)
  const hiHot = calculateHeatIndex(35, 60);
  const rawRelocateHr: RawHourlyVariables = {
    ...baseTelemetry,
    temperature_2m: 35,
    relative_humidity_2m: 60,
  };
  const evalRelocateHr = evaluateActivityPolicy(rawRelocateHr, hiHot, auditPolicy, 'pe');
  assert.equal(evalRelocateHr.recommendedAction, 'relocate');
  assert.equal(evalRelocateHr.status, 'action_triggered');
  assert.equal(evalRelocateHr.requiresHumanReview, true, 'requiresHumanReview must remain true');
  assert.ok(evalRelocateHr.actionTitle.includes('Staff Human Review Required'), 'Title must note staff review');
  assert.equal(evalRelocateHr.conflictingRules, true);

  // Case 4: Suspend + Human Review
  const rawSuspendHr: RawHourlyVariables = {
    ...baseTelemetry,
    rain_rate: 22, // Exceeds 15 -> triggers Suspend
  };
  const evalSuspendHr = evaluateActivityPolicy(rawSuspendHr, hiClean, auditPolicy, 'break');
  assert.equal(evalSuspendHr.recommendedAction, 'suspend');
  assert.equal(evalSuspendHr.status, 'action_triggered');
  assert.equal(evalSuspendHr.requiresHumanReview, true, 'requiresHumanReview must remain true');
  assert.ok(evalSuspendHr.actionTitle.includes('Staff Human Review Required'), 'Title must note staff review');
  assert.equal(evalSuspendHr.conflictingRules, true);

  // Case 5: Disabled Human Review rule does NOT set requiresHumanReview
  const policyWithDisabledHr: SchoolPolicyConfig = {
    ...auditPolicy,
    rules: auditPolicy.rules.map((r) => (r.id === 'rule-gust-review' ? { ...r, enabled: false } : r)),
  };
  const evalDisabledHr = evaluateActivityPolicy(rawModifyHr, hiClean, policyWithDisabledHr, 'break');
  assert.equal(evalDisabledHr.recommendedAction, 'modify');
  assert.equal(evalDisabledHr.requiresHumanReview, false, 'Disabled human review rule must not trigger staff review');
  assert.ok(!evalDisabledHr.actionTitle.includes('Staff Human Review Required'), 'Title should not mention staff review when rule is disabled');
});

test('Audit 2: Separate configured policies from officially approved policies', () => {
  // A browser edit or unapproved custom policy must NEVER be marked as isApproved: true
  const locallyEditedCustomPolicy: SchoolPolicyConfig = {
    schoolName: 'Custom Community School',
    policyVersion: '1.0-custom',
    effectiveDate: '2026-11-04',
    approvedBy: 'User Browser Input', // Browser typed text does not constitute official ratification
    sourceDocument: 'Local Custom Rules',
    isConfigured: true,
    isApproved: false, // Explicitly unapproved
    isStarterConfig: false,
    rules: [
      {
        id: 'c-rule-1',
        name: 'Custom Wind Limit',
        activity: 'all',
        metric: 'wind_speed',
        operator: '>=',
        threshold: 20,
        unit: 'km/h',
        recommendedAction: 'modify',
        actionTitle: 'Custom Wind Advisory',
        actionGuidance: 'Adjust outdoor games.',
        reason: 'Wind speed threshold reached.',
        severity: 1,
        enabled: true,
      },
    ],
  };

  // Validation must enforce isApproved: false for locally edited / unratified policies
  const validatedCustom = validateSchoolPolicy({
    ...locallyEditedCustomPolicy,
    isLocallyEdited: true,
    isApproved: true, // Even if an edit attempted to claim isApproved: true
  });
  assert.equal(validatedCustom.isApproved, false, 'Locally edited policy must NEVER be validated as approved');

  // Evaluation of unapproved custom policy must be flagged as QA Preview / non-operational
  const raw: RawHourlyVariables = {
    time: '2026-11-04T11:00',
    temperature_2m: 24,
    relative_humidity_2m: 40,
    pm10: 10,
    pm2_5: 5,
    dust: 5,
    wind_speed_10m: 25, // Exceeds 20
    wind_gusts_10m: 30,
    wind_direction_10m: 270,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
    rain_rate: 0,
    precipitation: 0,
  };
  const hi = calculateHeatIndex(raw.temperature_2m, raw.relative_humidity_2m);
  const evalRes = evaluateActivityPolicy(raw, hi, validatedCustom, 'break');

  assert.equal(evalRes.isApprovedPolicy, false);
  assert.equal(evalRes.isUnapprovedCustom, true);
  assert.ok(evalRes.actionTitle.startsWith('QA Preview:'), 'Title must be prefixed with QA Preview');
  assert.ok(evalRes.actionTitle.includes('(Unapproved Custom Policy)'), 'Title must state unapproved custom policy');
  assert.ok(evalRes.primaryGuidance.includes('QA Testing Preview (Non-Operational)'), 'Guidance must state non-operational QA preview');
  assert.ok(evalRes.primaryGuidance.includes('Policy Verification Notice'), 'Guidance must contain policy verification notice');

  // When criteria met, QA preview is also explicitly labelled
  const rawCalm: RawHourlyVariables = {
    ...raw,
    wind_speed_10m: 10, // Below 20 -> criteria met
  };
  const evalCalm = evaluateActivityPolicy(rawCalm, hi, validatedCustom, 'break');
  assert.equal(evalCalm.status, 'criteria_met_no_actions');
  assert.ok(evalCalm.actionTitle.includes('QA Preview: Criteria Met (Unapproved Custom Policy — Non-Operational)'));
  assert.equal(evalCalm.isUnapprovedCustom, true);
  assert.equal(evalCalm.isApprovedPolicy, false);

  // Fictional demonstration preset remains demonstration-only
  const evalDemo = evaluateActivityPolicy(raw, hi, FICTIONAL_DEMO_POLICY, 'pe');
  assert.equal(evalDemo.isFictionalDemo, true);
  assert.equal(evalDemo.isApprovedPolicy, false);
  assert.equal(evalDemo.isUnapprovedCustom, false);
  assert.ok(evalDemo.actionTitle.includes('Demonstration'));

  // When fictional demo rule triggers
  const rawDemoHazard = { ...raw, pm10: 300 };
  const evalDemoHazard = evaluateActivityPolicy(rawDemoHazard, hi, FICTIONAL_DEMO_POLICY, 'pe');
  assert.equal(evalDemoHazard.isFictionalDemo, true);
  assert.ok(evalDemoHazard.actionTitle.startsWith('Demonstration:'));

  // Starter unconfigured default remains unconfigured
  const evalStarter = evaluateActivityPolicy(raw, hi, DEFAULT_UNCONFIGURED_POLICY, 'break');
  assert.equal(evalStarter.status, 'policy_not_configured');
  assert.equal(evalStarter.isStarterConfig, true);
  assert.equal(evalStarter.isPolicyConfigured, false);
  assert.equal(evalStarter.isApprovedPolicy, false);
});

test('Audit 3: Metric and threshold handling for all 17 supported metrics', () => {
  // Confirm count of supported metrics is 17
  assert.equal(SUPPORTED_RULE_METRICS.length, 17);

  // Confirm every metric has valid unit, category, and non-empty description
  for (const m of SUPPORTED_RULE_METRICS) {
    assert.ok(m.id && m.id.length > 0);
    assert.ok(m.unit && m.unit.length > 0);
    assert.ok(m.category && m.category.length > 0);
    assert.equal(getMetricUnit(m.id), m.unit);
  }

  // 1. Heat Index vs Air Temperature distinctness
  // Test case where air temperature is 28°C (< 32°C), but with high humidity (85%),
  // NOAA heat index is ~33°C (>= 32°C).
  const hiCalc = calculateHeatIndex(28, 85);
  assert.ok(hiCalc.isAvailable);
  assert.ok(hiCalc.heatIndexCelsius! >= 32);

  const rawThermal: RawHourlyVariables = {
    time: '2026-11-04T12:00',
    temperature_2m: 28,
    relative_humidity_2m: 85,
    pm10: 10,
    pm2_5: 5,
    dust: 5,
    wind_speed_10m: 10,
    wind_gusts_10m: 15,
    wind_direction_10m: 270,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
    rain_rate: 0,
    precipitation: 0,
  };

  const thermalPolicy: SchoolPolicyConfig = {
    schoolName: 'Thermal Separation School',
    policyVersion: '1.0',
    effectiveDate: '2026-11-04',
    approvedBy: 'Director',
    sourceDocument: 'Handbook',
    isConfigured: true,
    isApproved: true,
    isStarterConfig: false,
    rules: [
      {
        id: 'rule-heat-index',
        name: 'Heat Index >= 32 -> Relocate',
        activity: 'all',
        metric: 'heat_index',
        operator: '>=',
        threshold: 32,
        unit: '°C',
        recommendedAction: 'relocate',
        actionTitle: 'Heat Index Relocation',
        actionGuidance: 'Relocate indoors due to heat index.',
        reason: 'Apparent temperature high',
        severity: 3,
        enabled: true,
      },
      {
        id: 'rule-air-temp',
        name: 'Air Temp >= 32 -> Suspend',
        activity: 'all',
        metric: 'temperature',
        operator: '>=',
        threshold: 32,
        unit: '°C',
        recommendedAction: 'suspend',
        actionTitle: 'Air Temp Suspension',
        actionGuidance: 'Suspend due to ambient temperature.',
        reason: 'Ambient temperature high',
        severity: 4,
        enabled: true,
      },
    ],
  };

  const evalThermal = evaluateActivityPolicy(rawThermal, hiCalc, thermalPolicy, 'break');
  // Heat index (33°C) triggered relocate, but air temperature (28°C) did NOT trigger suspend!
  assert.equal(evalThermal.recommendedAction, 'relocate');
  assert.equal(evalThermal.triggeredRules.find((r) => r.rule.id === 'rule-heat-index')?.isTriggered, true);
  assert.equal(evalThermal.triggeredRules.find((r) => r.rule.id === 'rule-air-temp')?.isTriggered, false);

  // 2. Rain Rate vs Accumulated Rain distinctness
  // Test condition where rain_rate is 0 mm/h, but accumulated precipitation is 30 mm
  const rawMoisture: RawHourlyVariables = {
    ...rawThermal,
    rain_rate: 0, // instantaneous 0 mm/h
    precipitation: 30, // 30 mm accumulated depth
  };
  const moisturePolicy: SchoolPolicyConfig = {
    schoolName: 'Rain Separation School',
    policyVersion: '1.0',
    effectiveDate: '2026-11-04',
    approvedBy: 'Director',
    sourceDocument: 'Handbook',
    isConfigured: true,
    isApproved: true,
    isStarterConfig: false,
    rules: [
      {
        id: 'rule-rate',
        name: 'Rain Rate >= 5 -> Suspend',
        activity: 'all',
        metric: 'rain_rate',
        operator: '>=',
        threshold: 5,
        unit: 'mm/h',
        recommendedAction: 'suspend',
        actionTitle: 'Heavy Rain Fall',
        actionGuidance: 'Suspend sessions.',
        reason: 'Downpour intensity',
        severity: 4,
        enabled: true,
      },
      {
        id: 'rule-accum',
        name: 'Accumulated Rain >= 25 -> Relocate',
        activity: 'all',
        metric: 'accumulated_rain',
        operator: '>=',
        threshold: 25,
        unit: 'mm',
        recommendedAction: 'relocate',
        actionTitle: 'Flooded Grounds Relocation',
        actionGuidance: 'Relocate indoors due to ground water.',
        reason: 'Ponding on fields',
        severity: 2,
        enabled: true,
      },
    ],
  };

  const evalMoisture = evaluateActivityPolicy(rawMoisture, hiCalc, moisturePolicy, 'break');
  // Rain rate rule did NOT trigger (0 < 5); accumulated rain triggered relocate!
  assert.equal(evalMoisture.recommendedAction, 'relocate');
  assert.equal(evalMoisture.triggeredRules.find((r) => r.rule.id === 'rule-rate')?.isTriggered, false);
  assert.equal(evalMoisture.triggeredRules.find((r) => r.rule.id === 'rule-accum')?.isTriggered, true);

  // 3. NCM Warning: active (1), inactive (0), unavailable (null)
  const ncmPolicy: SchoolPolicyConfig = {
    schoolName: 'NCM Alert School',
    policyVersion: '1.0',
    effectiveDate: '2026-11-04',
    approvedBy: 'Safety Officer',
    sourceDocument: 'NCM Integration Protocol',
    isConfigured: true,
    isApproved: true,
    isStarterConfig: false,
    rules: [
      {
        id: 'rule-ncm-active',
        name: 'NCM Official Warning Active == 1 -> Suspend',
        activity: 'all',
        metric: 'ncm_warning',
        operator: '==',
        threshold: 1,
        unit: 'warning',
        recommendedAction: 'suspend',
        actionTitle: 'NCM Official Warning Active',
        actionGuidance: 'National Center of Meteorology issued weather warning.',
        reason: 'Active official NCM warning broadcast',
        severity: 4,
        enabled: true,
      },
    ],
  };

  // 3a. Active NCM warning -> triggers suspend
  const rawNcmActive: RawHourlyVariables = {
    ...rawThermal,
    ncm_warning_status: 'active',
  };
  const evalNcmActive = evaluateActivityPolicy(rawNcmActive, hiCalc, ncmPolicy, 'pe');
  assert.equal(evalNcmActive.recommendedAction, 'suspend');
  assert.equal(evalNcmActive.triggeredRules[0].isTriggered, true);
  assert.equal(evalNcmActive.triggeredRules[0].observedValue, 1);

  // 3b. Inactive NCM warning -> verified absence, does NOT trigger
  const rawNcmInactive: RawHourlyVariables = {
    ...rawThermal,
    ncm_warning_status: 'inactive',
  };
  assert.equal(getMetricValue('ncm_warning', rawNcmInactive), 0);
  const evalNcmInactive = evaluateActivityPolicy(rawNcmInactive, hiCalc, ncmPolicy, 'pe');
  assert.equal(evalNcmInactive.recommendedAction, 'continue');
  assert.equal(evalNcmInactive.status, 'criteria_met_no_actions');
  assert.equal(evalNcmInactive.triggeredRules.length, 0);

  // 3c. Unavailable NCM warning -> must NOT become inactive warning or 0!
  const rawNcmUnavailable: RawHourlyVariables = {
    ...rawThermal,
    ncm_warning_status: 'unavailable',
  };
  assert.equal(getMetricValue('ncm_warning', rawNcmUnavailable), null);
  const evalNcmUnavailable = evaluateActivityPolicy(rawNcmUnavailable, hiCalc, ncmPolicy, 'pe');
  assert.equal(evalNcmUnavailable.dataMissingForAssessment, true);
  assert.equal(evalNcmUnavailable.triggeredRules[0].isDataMissing, true);
  assert.equal(evalNcmUnavailable.triggeredRules[0].observedValue, null);

  // 4. Invalid and missing values (NaN, Infinity, undefined) cannot trigger false matches
  const rawInvalid: RawHourlyVariables = {
    ...rawThermal,
    pm10: NaN,
    wind_gusts_10m: Infinity,
    temperature_2m: null,
  };
  assert.equal(getMetricValue('pm10', rawInvalid), null);
  assert.equal(getMetricValue('wind_gusts', rawInvalid), null);
  assert.equal(getMetricValue('temperature', rawInvalid), null);
});

test('Audit 4: Dynamic rules regressions (multiple on same metric, >6 rules, independent edit/delete, local persistence, dust risk intact)', () => {
  // 1. Multiple rules on the same metric (PM10: 50 -> modify, 100 -> relocate, 200 -> suspend)
  // Plus additional metrics to total > 6 rules (8 rules)
  const eightRulesPolicy: SchoolPolicyConfig = {
    schoolName: 'Multi-Rule Comprehensive Academy',
    policyVersion: '3.0',
    effectiveDate: '2026-11-04',
    approvedBy: 'Director of Education',
    sourceDocument: 'Comprehensive Outdoor Safety Protocol',
    isConfigured: true,
    isApproved: true,
    isStarterConfig: false,
    rules: [
      {
        id: 'pm10-mod',
        name: 'PM10 >= 50 Modify',
        activity: 'all',
        metric: 'pm10',
        operator: '>=',
        threshold: 50,
        unit: 'µg/m³',
        recommendedAction: 'modify',
        actionTitle: 'Modify for Moderate Dust',
        actionGuidance: 'Reduce outdoor pace.',
        reason: 'PM10 elevated',
        severity: 1,
        enabled: true,
      },
      {
        id: 'pm10-rel',
        name: 'PM10 >= 100 Relocate',
        activity: 'all',
        metric: 'pm10',
        operator: '>=',
        threshold: 100,
        unit: 'µg/m³',
        recommendedAction: 'relocate',
        actionTitle: 'Relocate for Severe Dust',
        actionGuidance: 'Move sports to gym.',
        reason: 'PM10 high',
        severity: 2,
        enabled: true,
      },
      {
        id: 'pm10-susp',
        name: 'PM10 >= 200 Suspend',
        activity: 'all',
        metric: 'pm10',
        operator: '>=',
        threshold: 200,
        unit: 'µg/m³',
        recommendedAction: 'suspend',
        actionTitle: 'Suspend for Extreme Sandstorm',
        actionGuidance: 'Cancel all outdoor sessions.',
        reason: 'PM10 hazardous',
        severity: 4,
        enabled: true,
      },
      {
        id: 'gust-rev',
        name: 'Gusts >= 35 Review',
        activity: 'all',
        metric: 'wind_gusts',
        operator: '>=',
        threshold: 35,
        unit: 'km/h',
        recommendedAction: 'human_review',
        actionTitle: 'Wind Review',
        actionGuidance: 'Check field umbrellas.',
        reason: 'Windy conditions',
        severity: 1,
        enabled: true,
      },
      {
        id: 'temp-mod',
        name: 'Temperature >= 38 Modify',
        activity: 'pe',
        metric: 'temperature',
        operator: '>=',
        threshold: 38,
        unit: '°C',
        recommendedAction: 'modify',
        actionTitle: 'Heat Modification',
        actionGuidance: 'Extra hydration breaks.',
        reason: 'High ambient temperature',
        severity: 1,
        enabled: true,
      },
      {
        id: 'rain-susp',
        name: 'Rain >= 10 Suspend',
        activity: 'all',
        metric: 'rain_rate',
        operator: '>=',
        threshold: 10,
        unit: 'mm/h',
        recommendedAction: 'suspend',
        actionTitle: 'Rain Suspension',
        actionGuidance: 'Rain halt.',
        reason: 'Heavy rain',
        severity: 4,
        enabled: true,
      },
      {
        id: 'vis-rel',
        name: 'Visibility <= 2000 Relocate',
        activity: 'all',
        metric: 'visibility',
        operator: '<=',
        threshold: 2000,
        unit: 'm',
        recommendedAction: 'relocate',
        actionTitle: 'Low Visibility Relocation',
        actionGuidance: 'Poor line of sight.',
        reason: 'Visibility restricted',
        severity: 2,
        enabled: true,
      },
      {
        id: 'hum-mod',
        name: 'Humidity >= 80 Modify',
        activity: 'pe',
        metric: 'relative_humidity',
        operator: '>=',
        threshold: 80,
        unit: '%',
        recommendedAction: 'modify',
        actionTitle: 'High Humidity Advisory',
        actionGuidance: 'Monitor student breathing.',
        reason: 'High humidity',
        severity: 1,
        enabled: true,
      },
    ],
  };

  assert.equal(eightRulesPolicy.rules.length, 8, 'Policy has >6 rules');

  const raw8: RawHourlyVariables = {
    time: '2026-11-04T13:00',
    temperature_2m: 30,
    relative_humidity_2m: 45,
    pm10: 120, // Exceeds 50 and 100, but not 200 -> Relocate should win
    pm2_5: 25,
    dust: 40,
    wind_speed_10m: 15,
    wind_gusts_10m: 40, // Exceeds 35 -> triggers Human Review
    wind_direction_10m: 290,
    visibility: 8000,
    aerosol_optical_depth: 0.2,
    rain_rate: 0,
    precipitation: 0,
  };
  const hi8 = calculateHeatIndex(raw8.temperature_2m, raw8.relative_humidity_2m);
  const eval8 = evaluateActivityPolicy(raw8, hi8, eightRulesPolicy, 'pe');

  // Both PM10 modify and relocate triggered; relocate is more protective and wins.
  // Wind gusts human review also triggered: requiresHumanReview is preserved!
  assert.equal(eval8.recommendedAction, 'relocate');
  assert.equal(eval8.requiresHumanReview, true);
  assert.equal(eval8.conflictingRules, true);
  assert.equal(eval8.totalApplicableRulesCount, 8);

  // 2. Independent rule deletion and toggling
  // Disable the relocate rule: modify should now win
  const modifiedPolicy: SchoolPolicyConfig = {
    ...eightRulesPolicy,
    rules: eightRulesPolicy.rules.map((r) => (r.id === 'pm10-rel' ? { ...r, enabled: false } : r)),
  };
  const evalDisabledRel = evaluateActivityPolicy(raw8, hi8, modifiedPolicy, 'pe');
  assert.equal(evalDisabledRel.recommendedAction, 'modify');
  assert.equal(evalDisabledRel.requiresHumanReview, true);

  // Delete the gust review rule: requiresHumanReview should now be false
  const policyWithDeletedRule: SchoolPolicyConfig = {
    ...modifiedPolicy,
    rules: modifiedPolicy.rules.filter((r) => r.id !== 'gust-rev'),
  };
  const evalDeletedGust = evaluateActivityPolicy(raw8, hi8, policyWithDeletedRule, 'pe');
  assert.equal(evalDeletedGust.recommendedAction, 'modify');
  assert.equal(evalDeletedGust.requiresHumanReview, false);

  // 3. Local persistence simulation (JSON serialize and deserialize)
  const serialized = JSON.stringify(eightRulesPolicy);
  const parsed = JSON.parse(serialized);
  const validatedParsed = validateSchoolPolicy(parsed);
  assert.equal(validatedParsed.rules.length, 8);
  assert.equal(validatedParsed.rules[0].threshold, 50);
  assert.equal(validatedParsed.rules[1].threshold, 100);

  // 4. Regional Dust-Risk Engine Integrity
  // calculateHourlyBaseline must remain completely independent and produce identical results
  const baseline = calculateHourlyBaseline(0, raw8);
  assert.ok(typeof baseline.finalScore === 'number');
  assert.ok(baseline.finalScore >= 0 && baseline.finalScore <= 100);
  assert.ok(['Low', 'Moderate', 'High', 'Very High'].includes(baseline.category));
});

/* =========================================================================================
 * SECURITY REGRESSION TESTS: School Policy Approval-Security & Zero-Trust Boundary
 * ========================================================================================= */

test('Security 1: A custom policy with isApproved: true in localStorage cannot become operational', () => {
  // Simulate forged/manipulated client storage claiming official approval
  const forgedLocalStorageJson = JSON.stringify({
    schoolName: 'Forged Storage Academy',
    policyVersion: '1.0',
    effectiveDate: '2026-11-05',
    approvedBy: 'Campus Health Board',
    sourceDocument: 'School Operations Document',
    isConfigured: true,
    isApproved: true, // Forged client-side flag
    isStarterConfig: false,
    rules: [
      {
        id: 'rule-test-1',
        name: 'PM10 Limit',
        activity: 'all',
        metric: 'pm10',
        operator: '>=',
        threshold: 50,
        unit: 'µg/m³',
        recommendedAction: 'modify',
        actionTitle: 'Modify outdoor activities',
        actionGuidance: 'Reduce pace.',
        reason: 'PM10 elevated',
        severity: 1,
        enabled: true,
      },
    ],
  });

  const parsed = JSON.parse(forgedLocalStorageJson);
  const validated = validateSchoolPolicy(parsed);

  // Invariant 1: Client storage MUST NEVER establish isApproved: true
  assert.equal(validated.isApproved, false, 'localStorage data must never establish approval');
  assert.equal(validated.isConfigured, true, 'Configured rules remain functional');

  // Invariant 2: Evaluator treats it strictly as QA Preview, never operational
  const raw: RawHourlyVariables = {
    time: '2026-11-05T10:00',
    temperature_2m: 25,
    relative_humidity_2m: 40,
    pm10: 60, // Exceeds threshold
    pm2_5: 10,
    dust: 10,
    wind_speed_10m: 10,
    wind_gusts_10m: 15,
    wind_direction_10m: 270,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
    rain_rate: 0,
    precipitation: 0,
  };
  const hi = calculateHeatIndex(raw.temperature_2m, raw.relative_humidity_2m);
  const evalResult = evaluateActivityPolicy(raw, hi, validated, 'break');

  assert.equal(evalResult.isApprovedPolicy, false, 'Assessment must NOT be marked approved');
  assert.equal(evalResult.isUnapprovedCustom, true, 'Assessment must be marked unapproved custom');
  assert.ok(evalResult.actionTitle.startsWith('QA Preview:'), 'Title must be prefixed with QA Preview');
  assert.ok(evalResult.actionTitle.includes('(Unapproved Custom Policy)'), 'Title must state unapproved policy');
  assert.ok(evalResult.primaryGuidance.includes('QA Testing Preview (Non-Operational)'), 'Guidance must state non-operational QA preview');
});

test('Security 2: Arbitrary approvedBy and sourceDocument strings cannot establish approval', () => {
  const arbitraryMetadataPolicy = {
    schoolName: 'Metadata Spoof High School',
    policyVersion: '9.9',
    effectiveDate: '2026-11-05',
    approvedBy: 'UAE Ministry of Education & Health Authority Official Board',
    sourceDocument: 'National Official School Safety Decree No. 42 / 2026',
    isConfigured: true,
    isApproved: true,
    isStarterConfig: false,
    rules: [
      {
        id: 'rule-heat-1',
        name: 'Heat Limit',
        activity: 'pe',
        metric: 'heat_index',
        operator: '>=',
        threshold: 38,
        unit: '°C',
        recommendedAction: 'relocate',
        actionTitle: 'Relocate to Gymnasium',
        actionGuidance: 'Indoor gym only.',
        reason: 'Heat index high',
        severity: 2,
        enabled: true,
      },
    ],
  };

  const validated = validateSchoolPolicy(arbitraryMetadataPolicy);
  assert.equal(validated.isApproved, false, 'Arbitrary official strings cannot establish approval');
  assert.equal(validated.isConfigured, true, 'Rule configuration is preserved for testing');
});

test('Security 3: Imported or manipulated policy JSON cannot bypass approval verification', () => {
  const forgedImportedPayloads = [
    { isConfigured: true, isApproved: true, schoolName: 'Test School 1', rules: [] },
    { isConfigured: true, isApproved: true, schoolName: 'Test School 2', rules: [{ id: '1', metric: 'pm10', threshold: 50, operator: '>=', recommendedAction: 'modify', enabled: true }] },
    { isConfigured: true, isApproved: 'true', schoolName: 'Test School 3', rules: [] },
    { isConfigured: true, isApproved: 1, schoolName: 'Test School 4', rules: [] },
  ];

  for (const payload of forgedImportedPayloads) {
    const validated = validateSchoolPolicy(payload);
    assert.equal(validated.isApproved, false, 'Imported JSON must unconditionally enforce isApproved: false');
  }
});

test('Security 4: Browser edits cannot preserve or create official approval', () => {
  // Even if base preset was supposedly approved, a local edit in browser cannot establish approval
  const editedInBrowser = {
    schoolName: 'Community School (Locally Edited)',
    policyVersion: '1.1',
    effectiveDate: '2026-11-05',
    approvedBy: 'Principal Name',
    sourceDocument: 'School Safety Manual',
    isConfigured: true,
    isApproved: true,
    isLocallyEdited: true, // Edited in browser
    rules: [
      {
        id: 'rule-1',
        name: 'Wind Limit',
        activity: 'all',
        metric: 'wind_gusts',
        operator: '>=',
        threshold: 30,
        unit: 'km/h',
        recommendedAction: 'human_review',
        actionTitle: 'Wind review',
        actionGuidance: 'Check playground.',
        reason: 'Wind gusts elevated',
        severity: 1,
        enabled: true,
      },
    ],
  };

  const validated = validateSchoolPolicy(editedInBrowser);
  assert.equal(validated.isApproved, false, 'Locally edited browser state cannot establish approval');
});

test('Security 5: An unapproved custom policy remains strictly QA Preview in all evaluation states', () => {
  const customPolicy: SchoolPolicyConfig = {
    schoolName: 'Sandbox Academy',
    policyVersion: '1.0',
    effectiveDate: '2026-11-05',
    isConfigured: true,
    isApproved: false,
    isStarterConfig: false,
    rules: [
      {
        id: 'r1',
        name: 'Rain limit',
        activity: 'all',
        metric: 'rain_rate',
        operator: '>=',
        threshold: 5,
        unit: 'mm/h',
        recommendedAction: 'suspend',
        actionTitle: 'Rain suspension',
        actionGuidance: 'Move students inside.',
        reason: 'Rain rate threshold reached.',
        severity: 3,
        enabled: true,
      },
    ],
  };

  const rawTrigger: RawHourlyVariables = {
    time: '2026-11-05T11:00',
    temperature_2m: 22,
    relative_humidity_2m: 60,
    pm10: 10,
    pm2_5: 5,
    dust: 5,
    wind_speed_10m: 10,
    wind_gusts_10m: 15,
    wind_direction_10m: 270,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
    rain_rate: 8, // Exceeds 5
    precipitation: 2,
  };
  const hi = calculateHeatIndex(rawTrigger.temperature_2m, rawTrigger.relative_humidity_2m);
  const evalTriggered = evaluateActivityPolicy(rawTrigger, hi, customPolicy, 'break');

  assert.equal(evalTriggered.isApprovedPolicy, false);
  assert.equal(evalTriggered.isUnapprovedCustom, true);
  assert.ok(evalTriggered.actionTitle.includes('QA Preview:'));
  assert.ok(evalTriggered.primaryGuidance.includes('QA Testing Preview'));

  // When calm / below thresholds
  const rawCalm: RawHourlyVariables = { ...rawTrigger, rain_rate: 0 };
  const evalCalm = evaluateActivityPolicy(rawCalm, hi, customPolicy, 'break');
  assert.equal(evalCalm.isApprovedPolicy, false);
  assert.equal(evalCalm.isUnapprovedCustom, true);
  assert.ok(evalCalm.actionTitle.includes('QA Preview: Criteria Met'));
});

test('Security 6: The fictional demo remains clearly labelled and non-operational', () => {
  assert.equal(FICTIONAL_DEMO_POLICY.isFictionalDemo, true);
  assert.equal(FICTIONAL_DEMO_POLICY.isApproved, false);

  const raw: RawHourlyVariables = {
    time: '2026-11-05T12:00',
    temperature_2m: 25,
    relative_humidity_2m: 40,
    pm10: 10,
    pm2_5: 5,
    dust: 5,
    wind_speed_10m: 10,
    wind_gusts_10m: 15,
    wind_direction_10m: 270,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
    rain_rate: 0,
    precipitation: 0,
  };
  const hi = calculateHeatIndex(raw.temperature_2m, raw.relative_humidity_2m);
  const evalDemo = evaluateActivityPolicy(raw, hi, FICTIONAL_DEMO_POLICY, 'pe');

  assert.equal(evalDemo.isFictionalDemo, true);
  assert.equal(evalDemo.isApprovedPolicy, false);
  assert.equal(evalDemo.isUnapprovedCustom, false);
  assert.ok(evalDemo.actionTitle.includes('Demonstration'));
  assert.ok(evalDemo.primaryGuidance.includes('testing only'));
});

test('Security 7: The default policy remains unconfigured', () => {
  assert.equal(DEFAULT_UNCONFIGURED_POLICY.isConfigured, false);
  assert.equal(DEFAULT_UNCONFIGURED_POLICY.isApproved, false);
  assert.equal(DEFAULT_UNCONFIGURED_POLICY.isStarterConfig, true);

  const raw: RawHourlyVariables = {
    time: '2026-11-05T13:00',
    temperature_2m: 25,
    relative_humidity_2m: 40,
    pm10: 10,
    pm2_5: 5,
    dust: 5,
    wind_speed_10m: 10,
    wind_gusts_10m: 15,
    wind_direction_10m: 270,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
    rain_rate: 0,
    precipitation: 0,
  };
  const hi = calculateHeatIndex(raw.temperature_2m, raw.relative_humidity_2m);
  const evalStarter = evaluateActivityPolicy(raw, hi, DEFAULT_UNCONFIGURED_POLICY, 'break');

  assert.equal(evalStarter.status, 'policy_not_configured');
  assert.equal(evalStarter.isPolicyConfigured, false);
  assert.equal(evalStarter.isStarterConfig, true);
  assert.equal(evalStarter.isApprovedPolicy, false);
});

test('Security 8: Client deserialization never enables operational mode without a verified approval record', () => {
  // If SAMPLE_APPROVED_SCHOOL_POLICY (an in-memory test fixture) is serialized and deserialized via client storage
  const serialized = JSON.stringify(SAMPLE_APPROVED_SCHOOL_POLICY);
  const fromStorage = JSON.parse(serialized);
  const validatedStorage = validateSchoolPolicy(fromStorage);

  // Client deserialization MUST NOT grant isApproved: true
  assert.equal(validatedStorage.isApproved, false, 'Client storage can never ratify a policy');

  // When evaluated, it evaluates in QA Preview mode
  const raw: RawHourlyVariables = {
    time: '2026-11-05T14:00',
    temperature_2m: 25,
    relative_humidity_2m: 40,
    pm10: 10,
    pm2_5: 5,
    dust: 5,
    wind_speed_10m: 10,
    wind_gusts_10m: 15,
    wind_direction_10m: 270,
    visibility: 10000,
    aerosol_optical_depth: 0.1,
    rain_rate: 0,
    precipitation: 0,
  };
  const hi = calculateHeatIndex(raw.temperature_2m, raw.relative_humidity_2m);
  const evalStorage = evaluateActivityPolicy(raw, hi, validatedStorage, 'break');
  assert.equal(evalStorage.isApprovedPolicy, false);
  assert.equal(evalStorage.isUnapprovedCustom, true);
  assert.ok(evalStorage.actionTitle.includes('QA Preview'));
});




