/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  HeatIndexResult,
  HeatStressCategory,
  HourlySchoolAssessment,
  RawHourlyVariables,
  RuleMetric,
  RuleSourceClassification,
  SchoolActivityAssessment,
  SchoolActivityType,
  SchoolAssessmentStatus,
  SchoolPolicyConfig,
  SchoolPolicyRule,
  SchoolRecommendedAction,
  TriggeredRuleResult,
} from './types.ts';

/**
 * Checks if a value is a valid, finite number (not null, undefined, NaN, Infinity, -Infinity).
 */
export function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

/**
 * Normalizes reading to number or null, safely eliminating NaN, Infinity, -Infinity.
 */
function safeFiniteNumber(val: unknown): number | null {
  return isFiniteNumber(val) ? val : null;
}

/**
 * Normalizes action strings to canonical actions.
 * Maps legacy actions (normal -> continue, modified -> modify, indoor_only -> relocate).
 */
export function canonicalAction(
  action: SchoolRecommendedAction | string
): 'continue' | 'modify' | 'relocate' | 'suspend' | 'human_review' {
  switch (action) {
    case 'suspend':
      return 'suspend';
    case 'relocate':
    case 'indoor_only':
      return 'relocate';
    case 'modify':
    case 'modified':
      return 'modify';
    case 'human_review':
      return 'human_review';
    case 'continue':
    case 'normal':
    default:
      return 'continue';
  }
}

/**
 * Protective ordering of school actions from most protective to least protective.
 * An incomplete or malformed precedence configuration CAN NEVER select a less
 * protective action than any triggered rule demands.
 */
export const ACTION_PROTECTION_LEVEL: Record<string, number> = {
  suspend: 5,
  relocate: 4,
  indoor_only: 4, // legacy alias for relocate
  modify: 3,
  modified: 3, // legacy alias for modify
  human_review: 2,
  continue: 1,
  normal: 1, // legacy alias for continue
};

export const STANDARD_PROTECTIVE_PRECEDENCE: SchoolRecommendedAction[] = [
  'suspend',
  'relocate',
  'modify',
  'human_review',
  'continue',
];

/**
 * Detects unsupported claims that conditions or outdoor activities are completely safe or approved.
 * Distinguishes unverified overclaims from valid cautious advice (e.g. routine precautions).
 */
export function hasUnsupportedSafetyClaims(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const overclaimPatterns = [
    /\b(?:conditions|air|environment|outdoor\s+play|outdoor\s+activities|it)\s+(?:are|is)\s+(?:completely\s+|entirely\s+|totally\s+)?safe\b/i,
    /\b(?:completely|guaranteed|entirely|totally)\s+safe\b/i,
    /\bofficially\s+approved\b/i,
    /\bapproved\s+for\s+all\s+(?:outdoor\s+)?activities\b/i,
    /\b(?:no|zero)\s+risk\b/i,
    /\bsafe\s+to\s+proceed\s+without\s+precautions\b/i,
  ];
  return overclaimPatterns.some((pattern) => pattern.test(text));
}

/**
 * Resolves precedence among triggered actions, strictly guaranteeing that an incomplete
 * or malformed precedence configuration can NEVER select a less protective action
 * than any triggered rule requires.
 */
export function resolvePrecedence(
  triggeredActions: SchoolRecommendedAction[],
  configuredPrecedence?: SchoolRecommendedAction[]
): SchoolRecommendedAction {
  if (triggeredActions.length === 0) return 'continue';

  // Highest protection demanded by any triggered rule
  const maxRequiredProtection = Math.max(
    ...triggeredActions.map((a) => ACTION_PROTECTION_LEVEL[a] ?? 1)
  );

  // Build sanitized precedence order: start with valid configured actions, then append remaining standard actions
  const sanitizedOrder: SchoolRecommendedAction[] = [];
  if (Array.isArray(configuredPrecedence)) {
    for (const action of configuredPrecedence) {
      if (
        ACTION_PROTECTION_LEVEL[action] !== undefined &&
        !sanitizedOrder.includes(action)
      ) {
        sanitizedOrder.push(action);
      }
    }
  }
  for (const action of STANDARD_PROTECTIVE_PRECEDENCE) {
    if (!sanitizedOrder.includes(action)) {
      sanitizedOrder.push(action);
    }
  }

  // Find candidate action from sanitized precedence order
  let candidate: SchoolRecommendedAction = triggeredActions[0] || 'continue';
  for (const action of sanitizedOrder) {
    if (triggeredActions.includes(action)) {
      candidate = action;
      break;
    }
  }

  // Safety invariant: incomplete or malformed precedence configuration
  // CANNOT select a less protective action than any triggered rule demands!
  if ((ACTION_PROTECTION_LEVEL[candidate] ?? 1) < maxRequiredProtection) {
    const protectiveAction = triggeredActions.find(
      (a) => (ACTION_PROTECTION_LEVEL[a] ?? 1) === maxRequiredProtection
    );
    if (protectiveAction) {
      candidate = protectiveAction;
    }
  }

  return candidate;
}

/**
 * Calculates the Heat Index using the official NOAA / Steadman regression equation.
 * Returns both Celsius and Fahrenheit values and standard heat stress category.
 *
 * Requirements:
 * - If inputs are missing or non-finite (null, undefined, NaN, Infinity, -Infinity), explicitly returns unavailable.
 * - Never treats missing temperature or humidity as zero.
 */
export function calculateHeatIndex(
  temperatureCelsius: number | null | undefined,
  relativeHumidity: number | null | undefined
): HeatIndexResult {
  if (
    !isFiniteNumber(temperatureCelsius) ||
    !isFiniteNumber(relativeHumidity)
  ) {
    return {
      heatIndexCelsius: null,
      heatIndexFahrenheit: null,
      category: 'not applicable',
      isAvailable: false,
      notes: 'Assessment unavailable: required temperature or humidity data is missing or invalid.',
    };
  }

  // Convert Celsius to Fahrenheit for NOAA formula
  const T = temperatureCelsius * 1.8 + 32;
  const RH = relativeHumidity;

  // For low ambient temperature (< 68°F / 20°C), heat index is not meaningful
  if (T < 68) {
    return {
      heatIndexCelsius: null,
      heatIndexFahrenheit: null,
      category: 'not applicable',
      isAvailable: false,
      notes: 'Heat index is not meaningful when ambient temperature is below 20°C (68°F).',
    };
  }

  // Simple preliminary heat index
  let hi = 0.5 * (T + 61.0 + (T - 68.0) * 1.2 + RH * 0.094);

  // If average is 80°F or above, apply the full Rothfusz regression
  if (hi >= 80) {
    hi =
      -42.379 +
      2.04901523 * T +
      10.14333127 * RH -
      0.22475541 * T * RH -
      0.00683783 * T * T -
      0.05481717 * RH * RH +
      0.00122874 * T * T * RH +
      0.00085282 * T * RH * RH -
      0.00000199 * T * T * RH * RH;

    // NOAA low-humidity adjustment
    if (RH < 13 && T >= 80 && T <= 112) {
      const adj = ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95.0)) / 17);
      hi -= adj;
    }
    // NOAA high-humidity adjustment
    else if (RH > 85 && T >= 80 && T <= 87) {
      const adj = ((RH - 85) / 10) * ((87 - T) / 5);
      hi += adj;
    }
  }

  const hiF = Math.round(hi * 10) / 10;
  const hiC = Math.round(((hi - 32) / 1.8) * 10) / 10;

  // Standard NOAA Heat Stress Categories (NWS general reference, not school policy)
  let category: HeatStressCategory = 'Below Caution range';
  let notes = 'Heat index is below the Caution range (NWS general reference, not school policy).';

  if (hiC >= 54) {
    category = 'Extreme Danger';
    notes = 'Heat stroke highly likely with continued outdoor exposure.';
  } else if (hiC >= 41) {
    category = 'Danger';
    notes = 'Sunstroke and heat exhaustion likely; heat stroke possible with prolonged activity.';
  } else if (hiC >= 32) {
    category = 'Extreme Caution';
    notes = 'Sunstroke, muscle cramps, and heat exhaustion possible with prolonged physical activity.';
  } else if (hiC >= 27) {
    category = 'Caution';
    notes = 'Fatigue possible with prolonged exposure and physical activity.';
  }

  return {
    heatIndexCelsius: hiC,
    heatIndexFahrenheit: hiF,
    category,
    isAvailable: true,
    notes,
  };
}

/**
 * Checklist of required information that a school must supply before an approved policy can be active.
 */
export const STARTER_REQUIRED_INFO_CHECKLIST = [
  {
    id: 'school_identity',
    title: 'School Identity & Campus Location',
    description: 'Formal school name, campus address/municipality, and designated health & safety officer or committee.',
  },
  {
    id: 'approval_metadata',
    title: 'Official Approval & Versioning',
    description: 'Document title, policy version number, effective date, and name/title of the approving school official or governing board.',
  },
  {
    id: 'activity_scope',
    title: 'Activity Scope & Categories',
    description: 'Applicability across student activities: PE/sports, outdoor break/recess, lunch/outdoor play, and assemblies/queues.',
  },
  {
    id: 'threshold_limits',
    title: 'Approved Threshold Limits & Units',
    description: 'Authorized numerical limits for heat index (°C), PM10 (µg/m³), rain rate (mm/h), accumulated rainfall (mm), and wind gusts (km/h).',
  },
  {
    id: 'precedence_and_missing_data',
    title: 'Action Precedence & Missing Data Protocol',
    description: 'Protocol specifying action priority (suspend > relocate > modify > continue) and default behavior when telemetry is unavailable (mandate human review).',
  },
];

/**
 * Default Starter Configuration Policy.
 * Clearly labeled: "Starter configuration — not an approved school policy."
 * Contains disabled example rules and requires school approval before producing any positive determination.
 */
export const DEFAULT_UNCONFIGURED_POLICY: SchoolPolicyConfig = {
  isConfigured: false,
  isApproved: false,
  isStarterConfig: true,
  schoolName: 'Pending Policy Configuration',
  policyVersion: '0.0 (Starter)',
  effectiveDate: 'Pending Approved Guidelines',
  approvedBy: undefined,
  sourceDocument: 'Starter configuration — not an approved school policy.',
  isFictionalDemo: false,
  missingDataBehavior: 'not_evaluated',
  precedenceOrder: ['suspend', 'relocate', 'modify', 'human_review', 'continue'],
  rules: [
    {
      id: 'starter-heat-pe',
      name: 'Example: High Heat Index PE Restriction',
      activity: 'pe',
      metric: 'heat_index',
      operator: '>=',
      threshold: null,
      value: null,
      unit: '°C',
      recommendedAction: 'relocate',
      actionTitle: 'Move PE indoors (Example rule — disabled)',
      actionGuidance: 'Example guidance for PE under high heat. Must be reviewed and approved by school administration.',
      reason: 'Starter template placeholder; not an approved school rule.',
      enabled: false,
      sourceClassification: 'proposed_example',
      sourceReference: 'Example Template',
      severity: 2,
    },
    {
      id: 'starter-pm10-all',
      name: 'Example: Particulate (PM10) Advisory',
      activity: 'all',
      metric: 'pm10',
      operator: '>=',
      threshold: null,
      value: null,
      unit: 'µg/m³',
      recommendedAction: 'modify',
      actionTitle: 'Accommodate sensitive students (Example rule — disabled)',
      actionGuidance: 'Example guidance for blowing dust or elevated PM10. Must be reviewed and approved by school administration.',
      reason: 'Starter template placeholder; not an approved school rule.',
      enabled: false,
      sourceClassification: 'proposed_example',
      sourceReference: 'Example Template',
      severity: 1,
    },
    {
      id: 'starter-rain-rate-all',
      name: 'Example: Heavy Rain Downpour Restriction',
      activity: 'all',
      metric: 'rain_rate',
      operator: '>=',
      threshold: null,
      value: null,
      unit: 'mm/h',
      recommendedAction: 'relocate',
      actionTitle: 'Move activities indoors during heavy rain (Example rule — disabled)',
      actionGuidance: 'Example guidance for rain downpours. Requires school approval.',
      reason: 'Starter template placeholder; not an approved school rule.',
      enabled: false,
      sourceClassification: 'proposed_example',
      sourceReference: 'Example Template',
      severity: 2,
    },
    {
      id: 'starter-rain-accum-all',
      name: 'Example: Accumulated Precipitation Precaution',
      activity: 'all',
      metric: 'accumulated_rain',
      operator: '>=',
      threshold: null,
      value: null,
      unit: 'mm',
      recommendedAction: 'suspend',
      actionTitle: 'Suspend outdoor activities due to water accumulation (Example rule — disabled)',
      actionGuidance: 'Example guidance for waterlogged grounds or drainage pooling.',
      reason: 'Starter template placeholder; not an approved school rule.',
      enabled: false,
      sourceClassification: 'proposed_example',
      sourceReference: 'Example Template',
      severity: 3,
    },
    {
      id: 'starter-wind-gust-break',
      name: 'Example: High Wind Gusts Hazard',
      activity: 'break',
      metric: 'wind_gusts',
      operator: '>=',
      threshold: null,
      value: null,
      unit: 'km/h',
      recommendedAction: 'relocate',
      actionTitle: 'Restrict outdoor playground use during wind gusts (Example rule — disabled)',
      actionGuidance: 'Example guidance for flying debris or eye irritation.',
      reason: 'Starter template placeholder; not an approved school rule.',
      enabled: false,
      sourceClassification: 'proposed_example',
      sourceReference: 'Example Template',
      severity: 2,
    },
    {
      id: 'starter-ncm-warning',
      name: 'Example: Official NCM Alert Policy',
      activity: 'all',
      metric: 'ncm_warning',
      operator: '==',
      threshold: null,
      value: null,
      unit: 'warning',
      recommendedAction: 'suspend',
      actionTitle: 'Suspend outdoor activities when official NCM Red/Amber warning is verified',
      actionGuidance: 'Direct automated alert feed is unconnected. Staff must verify active warnings at ncm.ae.',
      reason: 'Starter template placeholder; requires school policy decision.',
      enabled: false,
      sourceClassification: 'proposed_example',
      sourceReference: 'Example Template',
      severity: 4,
    },
  ],
};

export const STARTER_CONFIGURATION_POLICY = DEFAULT_UNCONFIGURED_POLICY;

/**
 * Sample Approved School Policy for verification and testing of operational workflows.
 * Represents an officially ratified school policy that produces genuine operational assessments.
 */
export const SAMPLE_APPROVED_SCHOOL_POLICY: SchoolPolicyConfig = {
  isConfigured: true,
  isApproved: true,
  isFictionalDemo: false,
  schoolName: 'Al Noor Academy (Ratified Safety Policy)',
  policyVersion: '2026.1',
  effectiveDate: '2026-09-01',
  approvedBy: 'Health & Safety Governance Board',
  sourceDocument: 'Al Noor Student Health & Outdoor Physical Activity Policy',
  missingDataBehavior: 'not_evaluated',
  rules: [
    {
      id: 'approved-heat-break',
      name: 'High Heat Index Outdoor Break Restriction',
      activity: 'break',
      metric: 'heat_index',
      operator: '>=',
      threshold: 38,
      unit: '°C',
      recommendedAction: 'relocate',
      actionTitle: 'Move break indoors',
      actionGuidance: 'Outdoor break should be moved indoors. Heat index exceeds approved 38°C threshold.',
      reason: 'Calculated Heat Index exceeds school outdoor play limits.',
      sourceClassification: 'school_internal_policy',
      sourceReference: 'Section 4.1',
      severity: 2,
      enabled: true,
    },
    {
      id: 'approved-heat-pe',
      name: 'High Heat Index PE Restriction',
      activity: 'pe',
      metric: 'heat_index',
      operator: '>=',
      threshold: 38,
      unit: '°C',
      recommendedAction: 'relocate',
      actionTitle: 'Move PE indoors to gymnasium',
      actionGuidance: 'Conduct physical education inside sports hall.',
      reason: 'Heat index exceeds approved PE threshold.',
      sourceClassification: 'school_internal_policy',
      sourceReference: 'Section 4.2',
      severity: 2,
      enabled: true,
    },
    {
      id: 'approved-pm10-all',
      name: 'Particulate Air Quality Advisory',
      activity: 'all',
      metric: 'pm10',
      operator: '>=',
      threshold: 150,
      unit: 'µg/m³',
      recommendedAction: 'modify',
      actionTitle: 'Accommodate sensitive students with respiratory conditions',
      actionGuidance: 'Permit students with asthma or allergies to remain indoors in air-conditioned areas.',
      reason: 'PM10 concentration >= 150 µg/m³.',
      sourceClassification: 'school_internal_policy',
      sourceReference: 'Section 5.1',
      severity: 1,
      enabled: true,
    },
  ],
  precedenceOrder: ['suspend', 'relocate', 'modify', 'human_review', 'continue'],
};

/**
 * Fictional Demo Policy.
 * Explicitly labelled for testing and presentation only.
 * Never presented as actual school policy.
 */
export const FICTIONAL_DEMO_POLICY: SchoolPolicyConfig = {
  isConfigured: true,
  isApproved: false,
  isFictionalDemo: true,
  schoolName: 'Example UAE Academy (Demonstration Only)',
  policyVersion: '1.0-DEMO (Fictional Test Data)',
  effectiveDate: '2026-10-01',
  approvedBy: 'Health & Safety Committee (Fictional Test Sample)',
  sourceDocument: 'Fictional School Outdoor Break & Physical Activity Guidelines 2026',
  missingDataBehavior: 'not_evaluated',
  rules: [
    {
      id: 'heat-danger-break',
      name: 'High Heat Stress Outdoor Restriction (Break)',
      activity: 'break',
      metric: 'heat_index',
      operator: '>=',
      threshold: 40,
      unit: '°C',
      recommendedAction: 'relocate',
      actionTitle: 'Move break indoors',
      actionGuidance: 'Outdoor break should be moved indoors. Heat index exceeds the configured 40°C threshold.',
      reason: 'Calculated Heat Index is in the high danger zone for free outdoor play.',
      sourceClassification: 'school_internal_policy',
      sourceReference: 'Fictional Section 4.2',
      severity: 2,
      enabled: true,
    },
    {
      id: 'heat-caution-pe',
      name: 'Moderate Heat Stress Modification (PE)',
      activity: 'pe',
      metric: 'heat_index',
      operator: '>=',
      threshold: 35,
      unit: '°C',
      recommendedAction: 'modify',
      actionTitle: 'Modify PE activities (mandatory hydration and shade)',
      actionGuidance: 'Reduce continuous vigorous cardio. Mandate shade rests and water breaks every 15 minutes.',
      reason: 'Heat index >= 35°C requires reduced physical intensity.',
      sourceClassification: 'school_internal_policy',
      sourceReference: 'Fictional Section 4.3',
      severity: 1,
      enabled: true,
    },
    {
      id: 'heat-danger-pe',
      name: 'High Heat Stress Outdoor Prohibition (PE)',
      activity: 'pe',
      metric: 'heat_index',
      operator: '>=',
      threshold: 41,
      unit: '°C',
      recommendedAction: 'relocate',
      actionTitle: 'Move PE to indoor gymnasium',
      actionGuidance: 'Outdoor physical education sessions are prohibited. Conduct PE inside air-conditioned sports hall.',
      reason: 'Heat index >= 41°C falls into Danger category for vigorous activity.',
      sourceClassification: 'school_internal_policy',
      sourceReference: 'Fictional Section 4.4',
      severity: 2,
      enabled: true,
    },
    {
      id: 'pm10-advisory-all',
      name: 'Elevated Particulate Air Quality Advisory',
      activity: 'all',
      metric: 'pm10',
      operator: '>=',
      threshold: 150,
      unit: 'µg/m³',
      recommendedAction: 'modify',
      actionTitle: 'Accommodate sensitive students with respiratory conditions',
      actionGuidance: 'Permit students with asthma, allergies, or breathing conditions to remain indoors in air-conditioned areas.',
      reason: 'PM10 concentration >= 150 µg/m³ indicates hazy particulate conditions.',
      sourceClassification: 'school_internal_policy',
      sourceReference: 'Fictional Section 5.1',
      severity: 1,
      enabled: true,
    },
    {
      id: 'pm10-severe-all',
      name: 'Severe Particulate Outdoor Restriction',
      activity: 'all',
      metric: 'pm10',
      operator: '>=',
      threshold: 250,
      unit: 'µg/m³',
      recommendedAction: 'relocate',
      actionTitle: 'Keep all students indoors; close perimeter doors',
      actionGuidance: 'Suspend all student outdoor activities. Keep classroom windows and building perimeter doors closed.',
      reason: 'PM10 concentration >= 250 µg/m³ indicates severe particulate pollution or blowing dust.',
      sourceClassification: 'school_internal_policy',
      sourceReference: 'Fictional Section 5.2',
      severity: 2,
      enabled: true,
    },
    {
      id: 'dust-severe-all',
      name: 'Mineral Dust Concentration Alert',
      activity: 'all',
      metric: 'dust',
      operator: '>=',
      threshold: 200,
      unit: 'µg/m³',
      recommendedAction: 'relocate',
      actionTitle: 'Move all student activities indoors due to dust',
      actionGuidance: 'Model-estimated mineral dust concentration exceeds 200 µg/m³. Restrict outdoor exposure.',
      reason: 'Dust forecast exceeds configured threshold.',
      sourceClassification: 'school_internal_policy',
      sourceReference: 'Fictional Section 5.3',
      severity: 2,
      enabled: true,
    },
    {
      id: 'wind-gusts-break',
      name: 'High Wind Gust Hazard',
      activity: 'break',
      metric: 'wind_gusts',
      operator: '>=',
      threshold: 50,
      unit: 'km/h',
      recommendedAction: 'relocate',
      actionTitle: 'Restrict outdoor playground use (wind gusts)',
      actionGuidance: 'High wind gusts can cause flying debris and eye irritation. Move playground activities indoors.',
      reason: 'Wind gusts >= 50 km/h exceed safe playground thresholds.',
      sourceClassification: 'school_internal_policy',
      sourceReference: 'Fictional Section 6.1',
      severity: 2,
      enabled: true,
    },
    {
      id: 'rain-rate-modify',
      name: 'Moderate Rain Rate Shower Precaution',
      activity: 'all',
      metric: 'rain_rate',
      operator: '>=',
      threshold: 2.5,
      unit: 'mm/h',
      recommendedAction: 'modify',
      actionTitle: 'Modify outdoor activities for light/moderate rain',
      actionGuidance: 'Moving activities under covered canopy or sheltered courtyards to prevent wet traction slip hazards.',
      reason: 'Forecast rain rate >= 2.5 mm/h indicates steady wet weather.',
      sourceClassification: 'school_internal_policy',
      sourceReference: 'Fictional Section 7.1',
      severity: 1,
      enabled: true,
    },
    {
      id: 'rain-accum-suspend',
      name: 'Heavy Accumulated Rain Deluge Suspension',
      activity: 'all',
      metric: 'accumulated_rain',
      operator: '>=',
      threshold: 20.0,
      unit: 'mm',
      recommendedAction: 'suspend',
      actionTitle: 'Suspend outdoor activities due to water accumulation',
      actionGuidance: 'Surface waterlogging and desert flash pooling risk. Keep students inside.',
      reason: 'Accumulated precipitation >= 20.0 mm creates acute grounds flooding risk.',
      sourceClassification: 'school_internal_policy',
      sourceReference: 'Fictional Section 7.2',
      severity: 3,
      enabled: true,
    },
  ],
  precedenceOrder: ['suspend', 'relocate', 'modify', 'human_review', 'continue'],
};

export interface MetricDefinition {
  id: RuleMetric;
  label: string;
  unit: string;
  defaultOperator: '>' | '>=' | '<' | '<=' | '==' | '=';
  description: string;
  category: 'Thermal' | 'Particulates' | 'Wind' | 'Moisture & Rain' | 'Official Alerts';
}

export const SUPPORTED_RULE_METRICS: MetricDefinition[] = [
  {
    id: 'heat_index',
    label: 'Heat Index',
    unit: '°C',
    defaultOperator: '>=',
    description: 'Calculated apparent temperature from temperature & humidity (NOAA Steadman)',
    category: 'Thermal',
  },
  {
    id: 'temperature',
    label: 'Air Temperature',
    unit: '°C',
    defaultOperator: '>=',
    description: '2m ambient surface air temperature',
    category: 'Thermal',
  },
  {
    id: 'relative_humidity',
    label: 'Relative Humidity',
    unit: '%',
    defaultOperator: '>=',
    description: 'Atmospheric moisture percentage',
    category: 'Moisture & Rain',
  },
  {
    id: 'pm10',
    label: 'PM10 Coarse Particulates',
    unit: 'µg/m³',
    defaultOperator: '>=',
    description: 'Inhalable coarse particulate matter (blowing dust and sand)',
    category: 'Particulates',
  },
  {
    id: 'pm2_5',
    label: 'PM2.5 Fine Particles',
    unit: 'µg/m³',
    defaultOperator: '>=',
    description: 'Fine respirable particle concentration',
    category: 'Particulates',
  },
  {
    id: 'dust',
    label: 'Mineral Dust Concentration',
    unit: 'µg/m³',
    defaultOperator: '>=',
    description: 'Model-estimated airborne mineral desert dust',
    category: 'Particulates',
  },
  {
    id: 'wind_speed',
    label: 'Sustained Wind Speed',
    unit: 'km/h',
    defaultOperator: '>=',
    description: '10m sustained surface wind velocity',
    category: 'Wind',
  },
  {
    id: 'wind_gusts',
    label: 'Peak Wind Gusts',
    unit: 'km/h',
    defaultOperator: '>=',
    description: '10m maximum wind gusts',
    category: 'Wind',
  },
  {
    id: 'wind_direction',
    label: 'Wind Direction',
    unit: '°',
    defaultOperator: '>=',
    description: '10m meteorological wind direction in degrees',
    category: 'Wind',
  },
  {
    id: 'visibility',
    label: 'Surface Visibility',
    unit: 'm',
    defaultOperator: '<=',
    description: 'Horizontal ground visibility distance in meters',
    category: 'Particulates',
  },
  {
    id: 'rain_rate',
    label: 'Rain Rate',
    unit: 'mm/h',
    defaultOperator: '>=',
    description: 'Instantaneous liquid precipitation intensity',
    category: 'Moisture & Rain',
  },
  {
    id: 'accumulated_rain',
    label: 'Accumulated Precipitation',
    unit: 'mm',
    defaultOperator: '>=',
    description: 'Accumulated rainfall depth over preceding model interval',
    category: 'Moisture & Rain',
  },
  {
    id: 'precipitation',
    label: 'Total Precipitation',
    unit: 'mm',
    defaultOperator: '>=',
    description: 'Total liquid and convective precipitation',
    category: 'Moisture & Rain',
  },
  {
    id: 'rain',
    label: '1-Hour Rain Component',
    unit: 'mm',
    defaultOperator: '>=',
    description: '1-hour accumulated large-scale rain',
    category: 'Moisture & Rain',
  },
  {
    id: 'showers',
    label: '1-Hour Showers Component',
    unit: 'mm',
    defaultOperator: '>=',
    description: '1-hour accumulated convective showers',
    category: 'Moisture & Rain',
  },
  {
    id: 'precipitation_probability',
    label: 'Precipitation Probability',
    unit: '%',
    defaultOperator: '>=',
    description: 'Forecast probability of precipitation occurrence',
    category: 'Moisture & Rain',
  },
  {
    id: 'ncm_warning',
    label: 'Official NCM Warning',
    unit: 'warning',
    defaultOperator: '==',
    description: 'Verified official National Center of Meteorology warning feed',
    category: 'Official Alerts',
  },
];

export function getMetricUnit(metric: RuleMetric | string): string {
  const found = SUPPORTED_RULE_METRICS.find((m) => m.id === metric);
  return found ? found.unit : 'µg/m³';
}

export function createNewDefaultRule(
  metric: RuleMetric = 'pm10',
  activity: SchoolActivityType | 'all' = 'all'
): SchoolPolicyRule {
  const metricInfo = SUPPORTED_RULE_METRICS.find((m) => m.id === metric) || SUPPORTED_RULE_METRICS[3];
  const id = `rule-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  let defaultThresh = 150;
  if (metric === 'heat_index' || metric === 'temperature') defaultThresh = 35;
  else if (metric === 'relative_humidity') defaultThresh = 70;
  else if (metric === 'pm10') defaultThresh = 150;
  else if (metric === 'pm2_5') defaultThresh = 50;
  else if (metric === 'dust') defaultThresh = 100;
  else if (metric === 'wind_speed') defaultThresh = 30;
  else if (metric === 'wind_gusts') defaultThresh = 40;
  else if (metric === 'visibility') defaultThresh = 3000;
  else if (metric === 'rain_rate') defaultThresh = 5;
  else if (metric === 'accumulated_rain' || metric === 'precipitation') defaultThresh = 10;
  else if (metric === 'ncm_warning') defaultThresh = 1;

  const activityLabel = activity === 'all' ? 'All Activities' : activity === 'pe' ? 'PE' : activity === 'break' ? 'Breaks' : activity.toUpperCase();

  return {
    id,
    name: `${metricInfo.label} Rule (${activityLabel})`,
    activity,
    metric: metricInfo.id,
    operator: metricInfo.defaultOperator,
    threshold: defaultThresh,
    value: defaultThresh,
    unit: metricInfo.unit,
    recommendedAction: 'modify',
    actionTitle: `Modify ${activity === 'all' ? 'outdoor activities' : activityLabel}`,
    actionGuidance: `Review environmental conditions and adapt ${activity === 'all' ? 'outdoor activities' : activityLabel} when ${metricInfo.label} threshold is reached.`,
    reason: `${metricInfo.label} threshold reached.`,
    severity: 1,
    enabled: true,
    sourceClassification: 'school_internal_policy',
  };
}

const VALID_METRICS = new Set<string>([
  'heat_index',
  'heatIndex',
  'temperature',
  'relative_humidity',
  'relativeHumidity',
  'pm10',
  'pm2_5',
  'dust',
  'wind_speed',
  'windSpeed',
  'wind_gusts',
  'windGusts',
  'wind_direction',
  'windDirection',
  'visibility',
  'rain_rate',
  'accumulated_rain',
  'precipitation',
  'rain',
  'showers',
  'precipitation_probability',
  'ncm_warning',
]);

const VALID_OPERATORS = new Set<string>(['>', '>=', '<', '<=', '==', '=']);

const VALID_ACTIONS = new Set<string>([
  'continue',
  'modify',
  'relocate',
  'suspend',
  'human_review',
  'normal',
  'modified',
  'indoor_only',
]);

const VALID_ACTIVITIES = new Set<string>([
  'break',
  'pe',
  'lunch_other',
  'lunch',
  'assembly',
  'all',
]);

const VALID_CLASSIFICATIONS = new Set<RuleSourceClassification>([
  'official_uae_rule',
  'school_internal_policy',
  'proposed_example',
  'international_guideline',
]);

// Official UAE government or education authority identification pattern
const OFFICIAL_UAE_AUTHORITY_REGEX =
  /(?:ministry\s+of\s+education|moe|adek|abu\s+dhabi\s+department\s+of\s+education|khda|knowledge\s+and\s+human\s+development|spea|sharjah\s+private\s+education|ncm|national\s+center\s+of\s+meteorology|ncema|national\s+emergency\s+crisis|uae\s+cabinet|civil\s+defense)/i;

/**
 * Validates whether a source reference qualifies as an authentic official UAE rule.
 */
export function isAuthenticOfficialUaeSource(sourceReference?: string): boolean {
  if (!sourceReference || typeof sourceReference !== 'string') return false;
  return OFFICIAL_UAE_AUTHORITY_REGEX.test(sourceReference);
}

/**
 * Validates a policy rule object at runtime.
 */
function isValidRule(rule: unknown): rule is SchoolPolicyRule {
  if (!rule || typeof rule !== 'object') return false;
  const r = rule as Record<string, unknown>;

  if (typeof r.id !== 'string' || r.id.trim().length === 0) return false;
  if (typeof r.name !== 'string' || r.name.trim().length === 0) return false;
  if (typeof r.activity !== 'string' || !VALID_ACTIVITIES.has(r.activity)) return false;
  if (typeof r.metric !== 'string' || !VALID_METRICS.has(r.metric)) return false;
  if (typeof r.operator !== 'string' || !VALID_OPERATORS.has(r.operator)) return false;
  if (typeof r.unit !== 'string') return false;
  if (typeof r.recommendedAction !== 'string' || !VALID_ACTIONS.has(r.recommendedAction)) return false;

  // Provide sensible defaults for optional or user-generated text fields if missing
  if (typeof r.actionTitle !== 'string' || r.actionTitle.trim().length === 0) {
    r.actionTitle = typeof r.name === 'string' ? r.name : 'Configured rule triggered';
  }
  if (typeof r.actionGuidance !== 'string' || r.actionGuidance.trim().length === 0) {
    r.actionGuidance = 'Review school policy guidelines for this activity.';
  }
  if (typeof r.reason !== 'string' || r.reason.trim().length === 0) {
    r.reason = 'Configured policy threshold reached.';
  }
  if (typeof r.severity !== 'number' || !Number.isFinite(r.severity)) {
    r.severity = ACTION_PROTECTION_LEVEL[r.recommendedAction as string] ?? 1;
  }

  // Threshold or value validation
  const rawThresh = r.threshold !== undefined ? r.threshold : r.value;
  if (rawThresh !== null && rawThresh !== undefined && (!Number.isFinite(rawThresh) || typeof rawThresh !== 'number')) {
    return false;
  }

  return true;
}

/**
 * Validates policy data loaded from localStorage or props at runtime.
 *
 * Enforces invariants:
 * - A rule with value: null or threshold: null remains disabled.
 * - Disabled rules never affect a decision.
 * - Enabled rules require valid values, units, activity applicability, source metadata, and supported classifications.
 * - Only genuine official UAE government or education-authority sources may be classified as official_uae_rule.
 * - Invalid persisted policy data must fail safely into an unconfigured state.
 * - Existing valid custom policies are preserved without being overwritten on startup.
 * - Never silently upgrade a proposed, example, or incomplete policy into an approved policy.
 * - Truthful representation: approval status, approver, version, effective date, source document.
 */
export function validateSchoolPolicy(data: unknown): SchoolPolicyConfig {
  if (!data || typeof data !== 'object') {
    return DEFAULT_UNCONFIGURED_POLICY;
  }

  const p = data as Record<string, unknown>;

  if (typeof p.isConfigured !== 'boolean') {
    return DEFAULT_UNCONFIGURED_POLICY;
  }
  if (typeof p.schoolName !== 'string' || p.schoolName.trim().length === 0) {
    return DEFAULT_UNCONFIGURED_POLICY;
  }
  if (typeof p.policyVersion !== 'string') {
    return DEFAULT_UNCONFIGURED_POLICY;
  }
  if (typeof p.effectiveDate !== 'string') {
    return DEFAULT_UNCONFIGURED_POLICY;
  }
  if (!Array.isArray(p.rules)) {
    return DEFAULT_UNCONFIGURED_POLICY;
  }

  // Validate all rules
  const validatedRules: SchoolPolicyRule[] = [];
  for (const rawRule of p.rules) {
    if (!isValidRule(rawRule)) {
      return DEFAULT_UNCONFIGURED_POLICY;
    }

    const r = rawRule as unknown as Record<string, unknown>;
    const rawThresh = r.threshold !== undefined ? r.threshold : r.value;
    const thresh = typeof rawThresh === 'number' && Number.isFinite(rawThresh) ? rawThresh : null;

    // Invariant: A rule with null threshold remains disabled
    const enabled = thresh !== null && r.enabled !== false;

    // Invariant: source classification validation
    let classification: RuleSourceClassification = 'school_internal_policy';
    if (
      typeof r.sourceClassification === 'string' &&
      VALID_CLASSIFICATIONS.has(r.sourceClassification as RuleSourceClassification)
    ) {
      classification = r.sourceClassification as RuleSourceClassification;
    }

    // Invariant: Only genuine official UAE authorities may be classified as official_uae_rule
    if (classification === 'official_uae_rule') {
      const srcRef = typeof r.sourceReference === 'string' ? r.sourceReference : '';
      if (!isAuthenticOfficialUaeSource(srcRef)) {
        // Disallowed: downgrade to internal or proposed example
        classification = 'school_internal_policy';
      }
    }

    const mappedAction = canonicalAction(r.recommendedAction as SchoolRecommendedAction);

    validatedRules.push({
      id: String(r.id),
      name: String(r.name),
      activity: r.activity as SchoolActivityType | 'all',
      metric: r.metric as RuleMetric,
      operator: r.operator as '>' | '>=' | '<' | '<=' | '==' | '=',
      threshold: thresh,
      value: thresh,
      unit: String(r.unit),
      recommendedAction: mappedAction,
      actionTitle: String(r.actionTitle),
      actionGuidance: String(r.actionGuidance),
      reason: String(r.reason),
      sourceReference: typeof r.sourceReference === 'string' ? r.sourceReference : undefined,
      sourceClassification: classification,
      severity: Number(r.severity),
      enabled,
    });
  }

  // Sanitize precedence order
  const precedenceOrder: SchoolRecommendedAction[] = [];
  if (Array.isArray(p.precedenceOrder)) {
    for (const a of p.precedenceOrder) {
      if (typeof a === 'string') {
        const can = canonicalAction(a as SchoolRecommendedAction);
        if (!precedenceOrder.includes(can)) {
          precedenceOrder.push(can);
        }
      }
    }
  }

  // Ensure standard protective actions exist in precedence order
  for (const action of STANDARD_PROTECTIVE_PRECEDENCE) {
    if (!precedenceOrder.includes(action)) {
      precedenceOrder.push(action);
    }
  }

  // SECURE APPROVAL BOUNDARY (Zero-Trust Client Policy Enforcement):
  // A genuine authenticated administrative approval mechanism verified against a server-side
  // authorization backend does NOT currently exist in DustWatch.
  // Therefore, browser-controlled data (localStorage, user form inputs, manipulated client state,
  // or imported JSON documents) CAN NEVER establish official school policy approval.
  // Arbitrary `approvedBy` text, `sourceDocument` references, or client-supplied `isApproved: true`
  // are rejected as proof of ratification.
  // In the absence of an authenticated administrative approval record, all validated custom
  // policies are unconditionally marked as isApproved: false and evaluated exclusively in QA Preview mode.
  const isStarter = p.isStarterConfig === true || (p.isStarterConfig !== false && p.schoolName === DEFAULT_UNCONFIGURED_POLICY.schoolName);
  const isApproved = false; // Zero-trust invariant: client data can never establish official ratification

  // If policy is configured but has 0 enabled rules with valid thresholds, it cannot produce approved determinations
  const hasValidEnabledRules = validatedRules.some((r) => r.enabled && r.threshold !== null);
  const isConfigured = Boolean(p.isConfigured) && !isStarter && hasValidEnabledRules;

  return {
    isConfigured,
    isApproved: isConfigured ? isApproved : false,
    isStarterConfig: isStarter,
    schoolName: String(p.schoolName),
    policyVersion: String(p.policyVersion),
    effectiveDate: String(p.effectiveDate),
    approvedBy: typeof p.approvedBy === 'string' ? p.approvedBy : undefined,
    sourceDocument: typeof p.sourceDocument === 'string' ? p.sourceDocument : undefined,
    isFictionalDemo: p.isFictionalDemo === true,
    missingDataBehavior:
      p.missingDataBehavior === 'human_review' || p.missingDataBehavior === 'most_protective'
        ? p.missingDataBehavior
        : 'not_evaluated',
    rules: validatedRules,
    precedenceOrder,
  };
}

/**
 * Extracts the metric value corresponding to a rule from the raw environmental variables.
 * Returns null if the reading is missing, non-finite, or unavailable.
 */
export function getMetricValue(
  metric: RuleMetric | string,
  raw: RawHourlyVariables,
  heatIndex?: HeatIndexResult | null
): number | null {
  let val: number | null = null;
  switch (metric as string) {
    case 'heat_index':
    case 'heatIndex':
      val = heatIndex ? heatIndex.heatIndexCelsius : null;
      break;
    case 'temperature':
      val = raw.temperature_2m;
      break;
    case 'relative_humidity':
    case 'relativeHumidity':
      val = raw.relative_humidity_2m;
      break;
    case 'pm10':
      val = raw.pm10;
      break;
    case 'pm2_5':
      val = raw.pm2_5;
      break;
    case 'dust':
      val = raw.dust;
      break;
    case 'wind_speed':
    case 'windSpeed':
      val = raw.wind_speed_10m;
      break;
    case 'wind_gusts':
    case 'windGusts':
      val = raw.wind_gusts_10m;
      break;
    case 'wind_direction':
    case 'windDirection':
      val = raw.wind_direction_10m;
      break;
    case 'visibility':
      val = raw.visibility;
      break;
    case 'rain_rate':
      // Instantaneous/hourly rain rate in mm/h
      val = raw.rain_rate !== undefined ? raw.rain_rate : (raw.precipitation_rate !== undefined ? raw.precipitation_rate : null);
      break;
    case 'rain':
      // 1-hour accumulated rain component in mm
      val = raw.rain !== undefined ? raw.rain : null;
      break;
    case 'showers':
      // 1-hour accumulated showers component in mm
      val = raw.showers !== undefined ? raw.showers : null;
      break;
    case 'precipitation_probability':
      // Probability of precipitation (percentage 0-100)
      val = raw.precipitation_probability !== undefined ? raw.precipitation_probability : null;
      break;
    case 'accumulated_rain':
    case 'precipitation':
      // Accumulated liquid precipitation in mm over preceding model interval
      val = raw.precipitation !== undefined ? raw.precipitation : null;
      break;
    case 'ncm_warning':
      // Only returns numeric indicator if verified feed is connected.
      // If feed is unavailable or unconnected, returns null (data unavailable, not satisfied).
      if (raw.ncm_warning_status === 'active') return 1;
      if (raw.ncm_warning_status === 'inactive') return 0;
      val = null; // Unavailable!
      break;
    default:
      val = null;
  }
  return isFiniteNumber(val) ? val : null;
}

/**
 * Evaluates whether an observed value triggers a rule threshold.
 */
function isRuleTriggered(
  operator: SchoolPolicyRule['operator'],
  value: number,
  threshold: number
): boolean {
  switch (operator) {
    case '>':
      return value > threshold;
    case '>=':
      return value >= threshold;
    case '<':
      return value < threshold;
    case '<=':
      return value <= threshold;
    case '==':
    case '=':
      return value === threshold;
    default:
      return false;
  }
}

/**
 * Evaluates a single hour of environmental readings against a configured school policy
 * for a specific activity type (Break, PE, Lunch/Other, Assembly).
 *
 * Keeps School Mode evaluation deterministic and completely separate from regional dust scoring.
 *
 * Distinct assessment outcomes:
 * 1. policy_not_configured (or policy_unconfigured): Policy not configured/approved.
 * 2. no_applicable_rules (or not_evaluated): Policy configured, but no rules apply to this activity.
 * 3. not_evaluated (or assessment_unavailable): Required metrics are missing, stale, or invalid.
 * 4. human_review: Missing data behavior or rule specifies manual staff assessment.
 * 5. criteria_met_no_actions: All applicable rules evaluated and no thresholds exceeded.
 * 6. action_triggered: One or more rules were triggered.
 */
export function evaluateActivityPolicy(
  raw: RawHourlyVariables,
  heatIndex: HeatIndexResult,
  policy: SchoolPolicyConfig,
  activity: SchoolActivityType
): SchoolActivityAssessment {
  // 1. Outcome: Policy not configured or starter configuration
  const isStarter = Boolean(!policy || !policy.isConfigured || policy.isStarterConfig);
  const isFictional = Boolean(policy?.isFictionalDemo);
  const isApprovedPolicy = Boolean(policy?.isConfigured && policy?.isApproved && !isFictional && !isStarter);
  const isUnapprovedCustom = Boolean(policy?.isConfigured && !policy?.isApproved && !isFictional && !isStarter);

  if (isStarter) {
    return {
      status: 'policy_not_configured',
      recommendedAction: 'continue',
      actionTitle: 'School policy configuration required',
      primaryGuidance: 'Review the applicable school policy. Authorized school thresholds have not been configured or approved yet.',
      reason: 'School policy is not configured or approved.',
      triggeredRules: [],
      conflictingRules: false,
      dataMissingForAssessment: false,
      isIncomplete: false,
      evaluatedRulesCount: 0,
      totalApplicableRulesCount: 0,
      isPolicyConfigured: false,
      isStarterConfig: true,
      isFictionalDemo: false,
      requiresHumanReview: false,
      isApprovedPolicy: false,
      isUnapprovedCustom: false,
    };
  }

  // Filter enabled, valid rules that apply to this activity or 'all'
  const relevantRules = policy.rules.filter((r) => {
    if (r.enabled === false) return false;
    const thresh = r.threshold !== null && r.threshold !== undefined ? r.threshold : r.value;
    if (thresh === null || thresh === undefined || !Number.isFinite(thresh)) return false;

    if (r.activity === 'all') return true;
    if (r.activity === activity) return true;
    if (activity === 'lunch_other' && (r.activity as string) === 'lunch') return true;
    if (activity === 'lunch' && (r.activity as string) === 'lunch_other') return true;
    return false;
  });

  // 2. Outcome: No applicable rules configured for this activity
  // Must NEVER be reported as "Conditions meet the configured criteria"
  if (relevantRules.length === 0) {
    return {
      status: 'no_applicable_rules',
      recommendedAction: 'continue',
      actionTitle: 'No applicable rules configured for this activity',
      primaryGuidance: 'No approved policy rules are defined for this activity under the active school policy. Review school operational guidelines or configure activity-specific rules.',
      reason: 'No applicable rules configured for this activity.',
      triggeredRules: [],
      conflictingRules: false,
      dataMissingForAssessment: false,
      isIncomplete: false,
      evaluatedRulesCount: 0,
      totalApplicableRulesCount: 0,
      isPolicyConfigured: true,
      isStarterConfig: false,
      isFictionalDemo: isFictional,
      requiresHumanReview: false,
      isApprovedPolicy,
      isUnapprovedCustom,
    };
  }

  const triggeredResults: TriggeredRuleResult[] = [];
  let evaluatedRulesCount = 0;
  let missingRulesCount = 0;

  for (const rule of relevantRules) {
    const thresh = (rule.threshold !== null && rule.threshold !== undefined ? rule.threshold : rule.value)!;
    const val = getMetricValue(rule.metric, raw, heatIndex);

    if (val === null) {
      // Special case: heat index not applicable because T < 20°C (68°F),
      // while temperature and humidity are valid finite numbers:
      if (
        (rule.metric === 'heat_index' || (rule.metric as string) === 'heatIndex') &&
        isFiniteNumber(raw.temperature_2m) &&
        isFiniteNumber(raw.relative_humidity_2m) &&
        raw.temperature_2m < 20
      ) {
        // For high-heat safety threshold rules (operator '>=' or '>' with threshold >= 20°C):
        // Apparent temperature at T < 20°C cannot exceed a high-heat threshold >= 20°C.
        if ((rule.operator === '>=' || rule.operator === '>') && thresh >= 20) {
          evaluatedRulesCount++;
          triggeredResults.push({
            rule,
            observedValue: null,
            unit: rule.unit,
            thresholdValue: thresh,
            isTriggered: false,
            isDataMissing: false,
          });
          continue;
        }
      }

      // Genuinely missing, stale, or unavailable reading
      missingRulesCount++;
      triggeredResults.push({
        rule,
        observedValue: null,
        unit: rule.unit,
        thresholdValue: thresh,
        isTriggered: false,
        isDataMissing: true,
      });
      continue;
    }

    evaluatedRulesCount++;
    const triggered = isRuleTriggered(rule.operator, val, thresh);
    triggeredResults.push({
      rule,
      observedValue: val,
      unit: rule.unit,
      thresholdValue: thresh,
      isTriggered: triggered,
      isDataMissing: false,
    });
  }

  const actuallyTriggered = triggeredResults.filter((r) => r.isTriggered);

  // Group triggered rules by Human Review vs Operational Actions
  const humanReviewRules = actuallyTriggered.filter(
    (tr) => canonicalAction(tr.rule.recommendedAction) === 'human_review'
  );
  const operationalRules = actuallyTriggered.filter(
    (tr) => canonicalAction(tr.rule.recommendedAction) !== 'human_review'
  );
  const requiresHumanReview = humanReviewRules.length > 0;

  // Outcomes when NO rules triggered
  if (actuallyTriggered.length === 0) {
    if (missingRulesCount > 0) {
      // Missing data prevents full evaluation: never default to continue without human review or incomplete status
      const action: SchoolRecommendedAction = 'human_review';
      const status: SchoolAssessmentStatus =
        policy.missingDataBehavior === 'human_review' ? 'human_review' : 'not_evaluated';

      return {
        status,
        recommendedAction: action,
        actionTitle: 'Assessment unavailable: required data is missing',
        primaryGuidance: 'Review the applicable school policy. Some environmental readings are unavailable and cannot be verified against school thresholds.',
        reason: 'One or more required inputs are missing, stale, or invalid.',
        triggeredRules: triggeredResults,
        conflictingRules: false,
        dataMissingForAssessment: true,
        isIncomplete: true,
        evaluatedRulesCount,
        totalApplicableRulesCount: relevantRules.length,
        isPolicyConfigured: true,
        isStarterConfig: false,
        isFictionalDemo: isFictional,
        requiresHumanReview: true,
        isApprovedPolicy,
        isUnapprovedCustom,
      };
    }

    // All applicable rules evaluated and none triggered
    let noActionTitle = 'Conditions meet the configured criteria for this activity';
    let noActionGuidance = 'Conditions meet the configured criteria for this activity under current school thresholds. Continue monitoring for changing conditions.';
    let noActionReason = 'No configured school policy thresholds were exceeded for this hour.';

    if (isFictional) {
      noActionTitle = 'Demonstration Result — Not Operational';
      noActionGuidance = 'No fictional demonstration thresholds were exceeded for this hour. This result is for rule-engine testing only and is not an operational safety determination or approval for outdoor activities.';
      noActionReason = 'No fictional demonstration thresholds were exceeded for this hour. For testing only.';
    } else if (isUnapprovedCustom) {
      noActionTitle = 'QA Preview: Criteria Met (Unapproved Custom Policy — Non-Operational)';
      noActionGuidance = 'QA Testing Preview: No custom thresholds were exceeded for this hour. This preview is for testing rule criteria in the browser and must NOT be used as official school guidance or administrative authorization.';
      noActionReason = 'QA Preview: No thresholds exceeded under unapproved custom policy.';
    }

    return {
      status: 'criteria_met_no_actions',
      recommendedAction: 'continue',
      actionTitle: noActionTitle,
      primaryGuidance: noActionGuidance,
      reason: noActionReason,
      triggeredRules: [],
      conflictingRules: false,
      dataMissingForAssessment: false,
      isIncomplete: false,
      evaluatedRulesCount,
      totalApplicableRulesCount: relevantRules.length,
      isPolicyConfigured: true,
      isStarterConfig: false,
      isFictionalDemo: isFictional,
      requiresHumanReview: false,
      isApprovedPolicy,
      isUnapprovedCustom,
    };
  }

  // Outcome: One or more rules were triggered
  const isIncomplete = missingRulesCount > 0;
  let winningAction: SchoolRecommendedAction = 'continue';
  let outcomeStatus: SchoolAssessmentStatus = 'action_triggered';
  let winningRule: SchoolPolicyRule | undefined;
  let conflicting = false;
  let titleText = '';
  let guidanceText = '';
  let reasonText = '';

  if (operationalRules.length > 0) {
    // Resolve the most protective applicable operational action independently
    const operationalActions = operationalRules.map((tr) => tr.rule.recommendedAction);
    winningAction = resolvePrecedence(operationalActions, policy.precedenceOrder);

    const matchingRules = operationalRules.filter(
      (tr) => canonicalAction(tr.rule.recommendedAction) === canonicalAction(winningAction)
    );
    matchingRules.sort((a, b) => b.rule.severity - a.rule.severity);
    winningRule = matchingRules[0]?.rule;

    outcomeStatus = 'action_triggered';
    const uniqueActions = new Set(actuallyTriggered.map((tr) => canonicalAction(tr.rule.recommendedAction)));
    conflicting = uniqueActions.size > 1;

    let baseTitle = winningRule?.actionTitle || 'A configured threshold has been exceeded';
    let baseGuidance = winningRule?.actionGuidance || 'Review the applicable school policy for recommended activity adjustments.';
    let baseReason = winningRule
      ? `A configured threshold has been exceeded: ${winningRule.name} (${winningRule.metric} ${winningRule.operator} ${winningRule.threshold ?? winningRule.value} ${winningRule.unit}).`
      : 'A configured school threshold has been exceeded.';

    // If human review was also requested by any rule, it must NEVER disappear!
    if (requiresHumanReview) {
      baseTitle = `${baseTitle} (Staff Human Review Required)`;
      baseGuidance = `${baseGuidance} In addition, an applicable rule (${humanReviewRules[0].rule.name}) mandates on-site staff human review before proceeding.`;
      baseReason = `${baseReason} Additionally, staff human review is explicitly required by rule "${humanReviewRules[0].rule.name}".`;
    }

    if (isFictional) {
      titleText = `Demonstration: ${baseTitle}`;
      guidanceText = `Demonstration result only (not an operational school instruction): ${baseGuidance}`;
      reasonText = `Demonstration rule threshold exceeded (fictional testing): ${baseReason}`;
    } else if (isUnapprovedCustom) {
      titleText = `QA Preview: ${baseTitle} (Unapproved Custom Policy)`;
      guidanceText = `QA Testing Preview (Non-Operational): ${baseGuidance} Policy Verification Notice: This custom rule has not been officially ratified by school administration.`;
      reasonText = `QA Preview Evaluation: ${baseReason} (Unapproved policy: not official school guidance).`;
    } else {
      titleText = baseTitle;
      guidanceText = baseGuidance;
      reasonText = baseReason;
    }
  } else {
    // Human Review alone triggered
    winningAction = 'human_review';
    outcomeStatus = 'human_review';
    winningRule = humanReviewRules[0]?.rule;
    conflicting = false;

    let baseTitle = winningRule?.actionTitle || 'Staff Human Review Required';
    let baseGuidance = winningRule?.actionGuidance || 'Review the applicable school policy for recommended activity adjustments.';
    let baseReason = winningRule
      ? `A configured threshold has been exceeded: ${winningRule.name} (${winningRule.metric} ${winningRule.operator} ${winningRule.threshold ?? winningRule.value} ${winningRule.unit}).`
      : 'Staff human review threshold reached.';

    if (isFictional) {
      titleText = `Demonstration: ${baseTitle}`;
      guidanceText = `Demonstration result only (not an operational school instruction): ${baseGuidance}`;
      reasonText = `Demonstration rule threshold exceeded (fictional testing): ${baseReason}`;
    } else if (isUnapprovedCustom) {
      titleText = `QA Preview: ${baseTitle} (Unapproved Custom Policy)`;
      guidanceText = `QA Testing Preview (Non-Operational): ${baseGuidance} Policy Verification Notice: This custom rule has not been officially ratified by school administration.`;
      reasonText = `QA Preview Evaluation: ${baseReason} (Unapproved policy: not official school guidance).`;
    } else {
      titleText = baseTitle;
      guidanceText = baseGuidance;
      reasonText = baseReason;
    }
  }

  if (isIncomplete) {
    guidanceText += ' Note: This assessment is partial; additional applicable environmental readings were unavailable.';
    reasonText += ' (Assessment is incomplete: some rule metrics were missing/invalid).';
  }

  return {
    status: outcomeStatus,
    recommendedAction: winningAction,
    actionTitle: titleText,
    primaryGuidance: guidanceText,
    reason: reasonText,
    triggeredRules: triggeredResults,
    conflictingRules: conflicting,
    dataMissingForAssessment: isIncomplete,
    isIncomplete,
    evaluatedRulesCount,
    totalApplicableRulesCount: relevantRules.length,
    isPolicyConfigured: true,
    isStarterConfig: false,
    isFictionalDemo: isFictional,
    requiresHumanReview,
    isApprovedPolicy,
    isUnapprovedCustom,
  };
}

/**
 * Builds the complete 12-hour school assessment for a city.
 */
export function buildHourlySchoolAssessments(
  hourlyVariables: RawHourlyVariables[],
  policy: SchoolPolicyConfig
): HourlySchoolAssessment[] {
  return hourlyVariables.map((raw, idx) => {
    const tempSafe = safeFiniteNumber(raw.temperature_2m);
    const rhSafe = safeFiniteNumber(raw.relative_humidity_2m);
    const pm10Safe = safeFiniteNumber(raw.pm10);
    const pm2_5Safe = safeFiniteNumber(raw.pm2_5);
    const dustSafe = safeFiniteNumber(raw.dust);
    const windSpeedSafe = safeFiniteNumber(raw.wind_speed_10m);
    const windGustsSafe = safeFiniteNumber(raw.wind_gusts_10m);
    const windDirSafe = safeFiniteNumber(raw.wind_direction_10m);
    const visSafe = safeFiniteNumber(raw.visibility);
    const rainSafe = safeFiniteNumber(raw.rain);
    const showersSafe = safeFiniteNumber(raw.showers);
    const precipSafe = safeFiniteNumber(raw.precipitation);
    const probSafe = safeFiniteNumber(raw.precipitation_probability);
    const rainRateSafe = safeFiniteNumber(
      raw.rain_rate !== undefined ? raw.rain_rate : (raw.precipitation_rate !== undefined ? raw.precipitation_rate : null)
    );

    const heatIndex = calculateHeatIndex(tempSafe, rhSafe);

    const missingReadings: string[] = [];
    if (tempSafe === null) missingReadings.push('Temperature');
    if (rhSafe === null) missingReadings.push('Relative humidity');
    if (pm10Safe === null) missingReadings.push('PM10');
    if (pm2_5Safe === null) missingReadings.push('PM2.5');
    if (dustSafe === null) missingReadings.push('Dust');
    if (windSpeedSafe === null) missingReadings.push('Wind speed');
    if (windGustsSafe === null) missingReadings.push('Wind gusts');
    if (rainRateSafe === null && precipSafe === null) missingReadings.push('Precipitation');

    const cleanRaw: RawHourlyVariables = {
      ...raw,
      temperature_2m: tempSafe,
      relative_humidity_2m: rhSafe,
      pm10: pm10Safe,
      pm2_5: pm2_5Safe,
      dust: dustSafe,
      wind_speed_10m: windSpeedSafe,
      wind_gusts_10m: windGustsSafe,
      wind_direction_10m: windDirSafe,
      visibility: visSafe,
      rain_rate: rainRateSafe,
      precipitation: precipSafe,
      rain: rainSafe,
      showers: showersSafe,
      precipitation_probability: probSafe,
      ncm_warning_status: raw.ncm_warning_status || 'unavailable',
    };

    const breakAssessment = evaluateActivityPolicy(cleanRaw, heatIndex, policy, 'break');
    const peAssessment = evaluateActivityPolicy(cleanRaw, heatIndex, policy, 'pe');
    const lunchAssessment = evaluateActivityPolicy(cleanRaw, heatIndex, policy, 'lunch_other');
    const assemblyAssessment = evaluateActivityPolicy(cleanRaw, heatIndex, policy, 'assembly');

    const displayHour = raw.time.includes('T')
      ? raw.time.split('T')[1].substring(0, 5)
      : raw.time;

    return {
      hourIndex: idx,
      time: raw.time,
      displayHour,
      environmentalReadings: {
        temperature: tempSafe,
        relativeHumidity: rhSafe,
        heatIndex,
        pm10: pm10Safe,
        pm2_5: pm2_5Safe,
        dust: dustSafe,
        windSpeed: windSpeedSafe,
        windGusts: windGustsSafe,
        windDirection: windDirSafe,
        visibility: visSafe,
        rainRate: rainRateSafe,
        accumulatedRain: precipSafe,
        precipitation: precipSafe,
        rain: rainSafe,
        showers: showersSafe,
        precipitationProbability: probSafe,
        ncmWarningStatus: raw.ncm_warning_status || 'unavailable',
        ncmWarningNotes: 'Official warning status unavailable — check ncm.ae',
      },
      missingReadings,
      activityAssessments: {
        break: breakAssessment,
        pe: peAssessment,
        lunch_other: lunchAssessment,
        lunch: lunchAssessment,
        assembly: assemblyAssessment,
      },
      officialAlertDetected: false,
      officialAlertFeedStatus: 'unconnected_external_source',
    };
  });
}
