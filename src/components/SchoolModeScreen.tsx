/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudRain,
  ExternalLink,
  Download,
  Eye,
  GraduationCap,
  HelpCircle,
  Info,
  Printer,
  RotateCcw,
  School,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  Thermometer,
  Trash2,
  Wind,
  X,
  ChevronDown,
  ChevronUp,
  Plus,
} from 'lucide-react';
import { APP_CONFIG, CITIES } from '../config.ts';
import { STRINGS } from '../strings.ts';
import {
  CityOutlook,
  HourlySchoolAssessment,
  RawCityData,
  RuleMetric,
  SchoolActivityAssessment,
  SchoolActivityType,
  SchoolPolicyConfig,
  SchoolPolicyRule,
  SchoolRecommendedAction,
} from '../types.ts';
import {
  DEFAULT_UNCONFIGURED_POLICY,
  STARTER_CONFIGURATION_POLICY,
  STARTER_REQUIRED_INFO_CHECKLIST,
  FICTIONAL_DEMO_POLICY,
  SUPPORTED_RULE_METRICS,
  createNewDefaultRule,
  getMetricUnit,
  buildHourlySchoolAssessments,
  validateSchoolPolicy,
  canonicalAction,
} from '../schoolPolicy.ts';
import { extract12Hours, getCurrentDubaiHour, extractCurrentPrecipitation } from '../dataService.ts';
import { getSchoolModeAdvice, serializeSchoolAdviceInputs } from '../geminiService.ts';
import {
  OutlineDrawCard,
  OutlineDrawHeading,
  OutlineDrawBody,
  OutlineDrawVisual,
} from './OutlineDrawCard.tsx';
import { SchoolPrintReport } from './SchoolPrintReport.tsx';
import {
  triggerPrintLifecycle,
  getActivityLabel,
  getActionPrintBadge,
  getPolicyStatusDetails,
  formatDubaiDateTime,
} from '../utils/printReport.ts';
import { saveSchoolAssessmentPdf, SchoolPdfData } from '../utils/pdfGenerator.ts';

interface SchoolModeScreenProps {
  outlooks: Record<string, CityOutlook>;
  rawCityData: Record<string, RawCityData>;
  selectedCityId: string;
  onSelectCity: (id: string) => void;
  lastUpdatedFormatted: string;
  schoolPolicy?: SchoolPolicyConfig;
  onUpdateSchoolPolicy?: (policy: SchoolPolicyConfig) => void;
  isDemoMode?: boolean;
}

export const SchoolModeScreen: React.FC<SchoolModeScreenProps> = ({
  outlooks,
  rawCityData,
  selectedCityId,
  onSelectCity,
  lastUpdatedFormatted,
  schoolPolicy: propSchoolPolicy,
  onUpdateSchoolPolicy,
  isDemoMode: propIsDemoMode = false,
}) => {
  const currentOutlook = outlooks[selectedCityId];
  const currentRaw = rawCityData[selectedCityId];
  const isDemoMode = Boolean(
    propIsDemoMode ||
    currentOutlook?.dataSourceType === 'sample' ||
    currentOutlook?.dataSourceType === 'snapshot'
  );
  const selectedCityInfo = CITIES.find((c) => c.id === selectedCityId) || {
    id: selectedCityId,
    name: selectedCityId,
    latitude: 0,
    longitude: 0,
  };

  // Activities: Show Break and PE only (Lunch behind config.schoolActivities, off by default)
  const showLunch = APP_CONFIG.schoolActivities?.showLunch ?? false;
  const [selectedActivity, setSelectedActivity] = useState<SchoolActivityType>('break');

  // Track if rules were edited in the browser
  const [isLocallyEdited, setIsLocallyEdited] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dustwatch_policy_is_locally_edited') === 'true';
    } catch {
      return false;
    }
  });

  // Base configured policy preset
  const [baseConfiguredPreset, setBaseConfiguredPreset] = useState<'unconfigured' | 'demo'>(() => {
    try {
      const preset = localStorage.getItem('dustwatch_base_preset');
      return preset === 'demo' ? 'demo' : 'unconfigured';
    } catch {
      return 'unconfigured';
    }
  });

  // School policy configuration state
  const [schoolPolicy, setSchoolPolicy] = useState<SchoolPolicyConfig>(() => {
    if (propSchoolPolicy) return validateSchoolPolicy(propSchoolPolicy);
    try {
      const saved = localStorage.getItem('dustwatch_school_policy');
      if (saved) return validateSchoolPolicy(JSON.parse(saved));
    } catch {
      // ignore
    }
    return DEFAULT_UNCONFIGURED_POLICY;
  });

  useEffect(() => {
    if (propSchoolPolicy) {
      setSchoolPolicy(propSchoolPolicy);
      setEditableRules(propSchoolPolicy.rules);
    }
  }, [propSchoolPolicy]);

  const updatePolicy = (newPolicy: SchoolPolicyConfig) => {
    setSchoolPolicy(newPolicy);
    setEditableRules(newPolicy.rules);
    onUpdateSchoolPolicy?.(newPolicy);
  };

  // Selected hour index within the 12-hour outlook
  const [selectedHourIndex, setSelectedHourIndex] = useState<number>(0);

  // Policy Editor Modal state
  const [showPolicyModal, setShowPolicyModal] = useState<boolean>(false);
  const [editableRules, setEditableRules] = useState<SchoolPolicyRule[]>(schoolPolicy.rules);
  const [modalValidationError, setModalValidationError] = useState<string | null>(null);

  // Gemini advice state for school mode, tracked with request key to prevent stale advice
  const [activeAdviceState, setActiveAdviceState] = useState<{
    key: string;
    summary: string;
    isAI: boolean;
  } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // Collapsible detail sections states (collapsed by default)
  const [showDistinctionDetails, setShowDistinctionDetails] = useState<boolean>(false);
  const [showStarterChecklist, setShowStarterChecklist] = useState<boolean>(false);
  const [showPrecipitationDetails, setShowPrecipitationDetails] = useState<boolean>(false);
  const [showRuleDetails, setShowRuleDetails] = useState<boolean>(false);
  const [showAiGatingDetails, setShowAiGatingDetails] = useState<boolean>(false);

  // User notification and preview state for print operations
  const [printNotice, setPrintNotice] = useState<string | null>(null);
  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState<boolean>(false);
  const [reportGeneratedAt, setReportGeneratedAt] = useState<Date>(new Date());

  // Reset to 'break' if lunch is disabled and lunch was previously active
  useEffect(() => {
    if (!showLunch && selectedActivity === 'lunch_other') {
      setSelectedActivity('break');
    }
  }, [showLunch, selectedActivity]);

  // Extract 12 hours from raw data
  const { hourString } = getCurrentDubaiHour();
  const raw12Hours = currentRaw ? extract12Hours(currentRaw, hourString) : [];
  const currentPrecipitation = currentRaw ? extractCurrentPrecipitation(currentRaw) : null;

  // Compute 12-hour school assessments
  const hourlyAssessments: HourlySchoolAssessment[] = buildHourlySchoolAssessments(
    raw12Hours,
    schoolPolicy
  );

  const selectedAssessment = hourlyAssessments[selectedHourIndex] || hourlyAssessments[0];
  const currentActivityAssessment = selectedAssessment?.activityAssessments[selectedActivity];
  const aiSummary = activeAdviceState?.summary;
  const isAiGenerated = activeAdviceState?.isAI ?? false;

  const handlePrint = () => {
    setPrintNotice(null);
    setReportGeneratedAt(new Date());
    // Immediately open preview modal so user gets instant visual confirmation and fallback controls
    setShowPrintPreviewModal(true);
    triggerPrintLifecycle({
      onShowPreview: (notice) => {
        setShowPrintPreviewModal(true);
        if (notice) setPrintNotice(notice);
      },
      onGeneratedAt: setReportGeneratedAt,
    });
  };

  const handleSavePdf = () => {
    if (!currentOutlook || !selectedAssessment) return;
    const policyDetails = getPolicyStatusDetails(schoolPolicy);
    const badge = getActionPrintBadge(currentActivityAssessment?.recommendedAction || 'continue');
    const readings = selectedAssessment.environmentalReadings;

    const pdfData: SchoolPdfData = {
      cityName: currentOutlook.city.name,
      emirateName: currentOutlook.city.emirate || currentOutlook.city.name,
      activityLabel: getActivityLabel(selectedActivity),
      generatedDateFormatted: formatDubaiDateTime(reportGeneratedAt),
      assessmentHour: selectedAssessment.displayHour,
      actionTitle: currentActivityAssessment?.actionTitle,
      primaryGuidance: currentActivityAssessment?.primaryGuidance,
      outcomeBadge: {
        label: badge.label,
        description: currentActivityAssessment?.primaryGuidance || badge.description,
        action: currentActivityAssessment?.recommendedAction || 'continue',
      },
      policyStatus: {
        badgeLabel: policyDetails.badgeLabel,
        noticeText: policyDetails.noticeText,
        schoolName: schoolPolicy.schoolName,
        policyVersion: schoolPolicy.policyVersion,
        effectiveDate: schoolPolicy.effectiveDate,
        approvedBy: schoolPolicy.approvedBy,
      },
      environmentalReadings: {
        temperature: readings.temperature,
        relativeHumidity: readings.relativeHumidity,
        heatIndexCelsius: readings.heatIndex?.heatIndexCelsius ?? readings.temperature,
        heatIndexCategory: readings.heatIndex?.category ?? 'Normal',
        pm10: readings.pm10,
        pm2_5: readings.pm2_5,
        dust: readings.dust,
        windSpeed: readings.windSpeed,
        windGusts: readings.windGusts,
        visibility: readings.visibility,
        rain: readings.rain ?? null,
        ncmWarningStatus: readings.ncmWarningStatus,
      },
      appliedRules: (schoolPolicy.rules || []).map((r) => ({
        id: r.id,
        name: r.name,
        metric: r.metric,
        operator: r.operator,
        threshold: r.threshold,
        unit: r.unit,
        recommendedAction: r.recommendedAction,
      })),
    };

    saveSchoolAssessmentPdf(pdfData);
    setPrintNotice('Assessment PDF generated and saved successfully.');
  };

  // Derive canonical request key from current inputs
  const currentRequestKey = React.useMemo(() => {
    if (!currentOutlook || !selectedAssessment || !currentActivityAssessment) return '';
    const lunchAllowed = APP_CONFIG.schoolActivities?.showLunch ?? false;
    let normalizedActivity: 'break' | 'pe' | 'lunch' | 'assembly' = 'break';
    if (selectedActivity === 'pe') normalizedActivity = 'pe';
    else if (selectedActivity === 'assembly') normalizedActivity = 'assembly';
    else if (lunchAllowed && (String(selectedActivity) === 'lunch_other' || String(selectedActivity) === 'lunch')) normalizedActivity = 'lunch';

    const cAction = canonicalAction(currentActivityAssessment.recommendedAction);
    let normalizedAction: 'normal' | 'shorten' | 'cancel' = 'normal';
    if (cAction === 'modify') normalizedAction = 'shorten';
    else if (cAction === 'relocate' || cAction === 'suspend') normalizedAction = 'cancel';

    const readings = selectedAssessment.environmentalReadings;
    const inputPayload = {
      city: currentOutlook.city.name,
      activity: normalizedActivity,
      hour: selectedAssessment.displayHour,
      action: normalizedAction,
      status: currentActivityAssessment.status,
      reason: currentActivityAssessment.reason,
      heatIndex: readings.heatIndex.heatIndexCelsius,
      temperature: readings.temperature,
      humidity: readings.relativeHumidity,
      pm10: readings.pm10,
      pm25: readings.pm2_5,
      dust: readings.dust,
      windSpeed: readings.windSpeed,
      visibility: readings.visibility,
      rainRate: readings.rainRate,
      accumulatedRain: readings.accumulatedRain,
      ncmWarningStatus: readings.ncmWarningStatus,
      triggeredRules: currentActivityAssessment.triggeredRules.map((tr) => ({
        ruleId: tr.rule.id,
        metric: tr.rule.metric,
      })),
      levelNow: currentOutlook.levelNow,
      peakLevel: currentOutlook.peakLevel,
      peakWindow: currentOutlook.worstWindow.displayRange,
      confidence: currentOutlook.confidence,
      lunchEnabled: lunchAllowed,
      isPolicyConfigured: schoolPolicy.isConfigured,
      isStarterConfig: schoolPolicy.isStarterConfig,
      isFictionalDemo: schoolPolicy.isFictionalDemo,
      isDemoMode: Boolean(isDemoMode),
      isIncomplete: currentActivityAssessment.isIncomplete,
      dataMissingForAssessment: currentActivityAssessment.dataMissingForAssessment,
    };
    return serializeSchoolAdviceInputs(inputPayload);
  }, [
    currentOutlook,
    selectedAssessment,
    currentActivityAssessment,
    selectedActivity,
    schoolPolicy,
    isDemoMode,
  ]);

  // Update AI advice when request inputs change
  useEffect(() => {
    if (!currentOutlook || !selectedAssessment || !currentActivityAssessment || !currentRequestKey) {
      setActiveAdviceState(null);
      setIsAiLoading(false);
      return;
    }

    const requestKey = currentRequestKey;
    let isMounted = true;
    setIsAiLoading(true);

    const readings = selectedAssessment.environmentalReadings;

    getSchoolModeAdvice(
      currentOutlook.city.name,
      selectedActivity,
      selectedAssessment.displayHour,
      {
        status: currentActivityAssessment.status,
        recommendedAction: currentActivityAssessment.recommendedAction,
        actionTitle: currentActivityAssessment.actionTitle,
        primaryGuidance: currentActivityAssessment.primaryGuidance,
        reason: currentActivityAssessment.reason,
        triggeredRules: currentActivityAssessment.triggeredRules.map((tr) => ({
          rule: { id: tr.rule.id, metric: tr.rule.metric },
        })),
        dataMissingForAssessment: currentActivityAssessment.dataMissingForAssessment,
        isIncomplete: currentActivityAssessment.isIncomplete,
        isPolicyConfigured: schoolPolicy.isConfigured,
        isStarterConfig: schoolPolicy.isStarterConfig,
        isFictionalDemo: schoolPolicy.isFictionalDemo,
        isDemoMode: Boolean(isDemoMode),
      },
      {
        temperature: readings.temperature,
        relativeHumidity: readings.relativeHumidity,
        heatIndex: {
          heatIndexCelsius: readings.heatIndex.heatIndexCelsius,
          category: readings.heatIndex.category,
        },
        pm10: readings.pm10,
        pm25: readings.pm2_5,
        dust: readings.dust,
        windSpeed: readings.windSpeed,
        visibility: readings.visibility,
        rainRate: readings.rainRate,
        accumulatedRain: readings.accumulatedRain,
        ncmWarningStatus: readings.ncmWarningStatus,
      },
      {
        levelNow: currentOutlook.levelNow,
        peakLevel: currentOutlook.peakLevel,
        peakWindow: currentOutlook.worstWindow.displayRange,
        confidence: currentOutlook.confidence,
        isDemoMode: Boolean(isDemoMode),
      },
      {
        isDemoMode: Boolean(isDemoMode),
      }
    )
      .then((res) => {
        if (isMounted) {
          setActiveAdviceState({
            key: requestKey,
            summary: res.summary,
            isAI: res.isAI,
          });
          setIsAiLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setActiveAdviceState({
            key: requestKey,
            summary: currentActivityAssessment.primaryGuidance,
            isAI: false,
          });
          setIsAiLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentRequestKey]);

  // Load demonstration policy
  const handleLoadFictionalDemo = () => {
    updatePolicy(FICTIONAL_DEMO_POLICY);
    setBaseConfiguredPreset('demo');
    setIsLocallyEdited(false);
    try {
      localStorage.setItem('dustwatch_school_policy', JSON.stringify(FICTIONAL_DEMO_POLICY));
      localStorage.setItem('dustwatch_base_preset', 'demo');
      localStorage.removeItem('dustwatch_policy_is_locally_edited');
    } catch {
      // ignore
    }
  };

  const handleResetToUnconfigured = () => {
    updatePolicy(DEFAULT_UNCONFIGURED_POLICY);
    setBaseConfiguredPreset('unconfigured');
    setIsLocallyEdited(false);
    try {
      localStorage.setItem('dustwatch_school_policy', JSON.stringify(DEFAULT_UNCONFIGURED_POLICY));
      localStorage.setItem('dustwatch_base_preset', 'unconfigured');
      localStorage.removeItem('dustwatch_policy_is_locally_edited');
    } catch {
      // ignore
    }
  };

  // Reset to configured policy (clears local browser rule edits)
  const handleResetToConfiguredPolicy = () => {
    const base = baseConfiguredPreset === 'demo' ? FICTIONAL_DEMO_POLICY : DEFAULT_UNCONFIGURED_POLICY;
    updatePolicy(base);
    setIsLocallyEdited(false);
    try {
      localStorage.setItem('dustwatch_school_policy', JSON.stringify(base));
      localStorage.removeItem('dustwatch_policy_is_locally_edited');
    } catch {
      // ignore
    }
  };

  // Save edits made in browser modal
  const handleSaveModalRuleEdits = () => {
    // Validate that enabled rules have valid numeric thresholds
    for (let i = 0; i < editableRules.length; i++) {
      const r = editableRules[i];
      if (r.enabled !== false) {
        if (r.threshold === null || r.threshold === undefined || isNaN(r.threshold)) {
          setModalValidationError(
            `Rule #${i + 1} ("${r.name || r.metric}") is enabled but has an empty or invalid threshold. Please enter a valid number or disable the rule.`
          );
          return;
        }
      }
    }

    const hasConfiguredRules = editableRules.some(
      (r) => r.enabled !== false && typeof r.threshold === 'number' && !isNaN(r.threshold)
    );

    const updatedPolicy: SchoolPolicyConfig = {
      ...schoolPolicy,
      isConfigured: hasConfiguredRules,
      isStarterConfig: false,
      isApproved: false, // Invariant: Browser edits must preserve isApproved: false
      rules: editableRules.map((r, i) => ({
        ...r,
        name: (r.name || '').trim() || `Rule ${i + 1} (${r.metric})`,
        actionTitle: r.actionTitle || `${r.recommendedAction.toUpperCase()}: ${r.name || r.metric}`,
        actionGuidance: r.actionGuidance || `Operational recommendation: ${r.recommendedAction}`,
        reason: r.reason || `Triggered when ${r.metric} ${r.operator} ${r.threshold} ${r.unit}`,
      })),
    };

    updatePolicy(updatedPolicy);
    setIsLocallyEdited(true);
    setShowPolicyModal(false);
    setModalValidationError(null);
    try {
      localStorage.setItem('dustwatch_school_policy', JSON.stringify(updatedPolicy));
      localStorage.setItem('dustwatch_policy_is_locally_edited', 'true');
    } catch {
      // ignore
    }
  };

  const handleRuleNameChange = (index: number, newName: string) => {
    setEditableRules((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], name: newName };
      return copy;
    });
  };

  const handleRuleActivityChange = (index: number, newActivity: SchoolActivityType | 'all') => {
    setEditableRules((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], activity: newActivity };
      return copy;
    });
  };

  const handleRuleMetricChange = (index: number, newMetric: RuleMetric) => {
    setEditableRules((prev) => {
      const copy = [...prev];
      const metricDef = SUPPORTED_RULE_METRICS.find((m) => m.id === newMetric);
      const newUnit = metricDef?.unit || getMetricUnit(newMetric);
      const currentOp = copy[index].operator;
      const defaultOp = metricDef?.defaultOperator || '>=';
      // keep current operator if valid, else fallback to default operator
      const op = ['>=', '>', '<=', '<', '==', '='].includes(currentOp) ? currentOp : defaultOp;
      copy[index] = {
        ...copy[index],
        metric: newMetric,
        unit: newUnit,
        operator: op,
        reason: `Triggered when ${newMetric} exceeds threshold`,
      };
      return copy;
    });
    setModalValidationError(null);
  };

  const handleRuleOperatorChange = (
    index: number,
    newOperator: '>=' | '>' | '<=' | '<' | '==' | '='
  ) => {
    setEditableRules((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], operator: newOperator };
      return copy;
    });
  };

  const handleRuleThresholdChange = (index: number, newThreshold: number | null) => {
    setEditableRules((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        threshold: newThreshold as any,
        value: newThreshold as any,
      };
      return copy;
    });
    setModalValidationError(null);
  };

  const handleRuleActionChange = (index: number, newAction: SchoolRecommendedAction) => {
    setEditableRules((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], recommendedAction: newAction };
      return copy;
    });
  };

  const handleRuleToggleEnabled = (index: number, enabled: boolean) => {
    setEditableRules((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], enabled };
      return copy;
    });
  };

  const handleDeleteRule = (index: number) => {
    setEditableRules((prev) => prev.filter((_, i) => i !== index));
    setModalValidationError(null);
  };

  const handleAddRule = () => {
    const newRule = createNewDefaultRule('pm10', 'all');
    setEditableRules((prev) => [...prev, newRule]);
    setModalValidationError(null);
  };

  const getActionBadge = (
    actionOrAssessment?: SchoolActivityAssessment | SchoolRecommendedAction | null,
    isConfigured: boolean = true,
    dataMissing?: boolean,
    isFictionalOverride?: boolean
  ) => {
    let status: string | undefined;
    let action: SchoolRecommendedAction = 'continue';
    let isIncomplete = false;
    let isFictional = isFictionalOverride !== undefined ? isFictionalOverride : Boolean(schoolPolicy.isFictionalDemo);

    let isUnapproved = false;
    let requiresHumanReview = false;

    if (actionOrAssessment && typeof actionOrAssessment === 'object') {
      status = actionOrAssessment.status;
      action = actionOrAssessment.recommendedAction;
      isIncomplete = actionOrAssessment.isIncomplete;
      dataMissing = actionOrAssessment.dataMissingForAssessment;
      isUnapproved = Boolean(actionOrAssessment.isUnapprovedCustom);
      requiresHumanReview = Boolean(actionOrAssessment.requiresHumanReview);
      if (actionOrAssessment.isFictionalDemo !== undefined) {
        isFictional = actionOrAssessment.isFictionalDemo;
      }
    } else if (typeof actionOrAssessment === 'string') {
      action = actionOrAssessment as SchoolRecommendedAction;
    }

    if (!isConfigured || status === 'policy_not_configured' || status === 'policy_unconfigured') {
      return (
        <span className="bg-gray-100 text-gray-800 border border-gray-300 px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-gray-600" />
          <span>Policy Configuration Required</span>
        </span>
      );
    }

    if (status === 'human_review') {
      return (
        <span className={`px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1.5 ${
          isFictional
            ? 'bg-purple-100 text-purple-900 border border-purple-300'
            : 'bg-amber-100 text-amber-900 border border-amber-400'
        }`}>
          <AlertTriangle className={`w-3.5 h-3.5 ${isFictional ? 'text-purple-700' : 'text-amber-800'}`} />
          <span>{isFictional ? 'Demo: Human Review' : isUnapproved ? 'QA Preview: Human Review Required' : 'Human Review Required'}{isIncomplete ? ' (Incomplete Data)' : ''}</span>
        </span>
      );
    }

    if (status === 'no_applicable_rules') {
      return (
        <span className="bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-600" />
          <span>No Applicable Rules Configured</span>
        </span>
      );
    }

    if (status === 'not_evaluated' || status === 'assessment_unavailable' || (dataMissing && (!status || status !== 'action_triggered'))) {
      return (
        <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
          <span>Not Evaluated (Missing Data)</span>
        </span>
      );
    }

    // Never display operational "Criteria Met" if assessment is incomplete, fictional demo, or unapproved
    if (status === 'criteria_met_no_actions') {
      if (isIncomplete || dataMissing) {
        return (
          <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            <span>Assessment Incomplete</span>
          </span>
        );
      }

      if (isFictional) {
        return (
          <span className="bg-purple-100 text-purple-900 border border-purple-300 px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-700" />
            <span>Demonstration Result — Not Operational</span>
          </span>
        );
      }

      if (isUnapproved) {
        return (
          <span className="bg-amber-100 text-amber-950 border border-amber-300 px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-amber-800" />
            <span>QA Preview: Criteria Met (Unapproved Policy)</span>
          </span>
        );
      }

      return (
        <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
          <span>Criteria Met</span>
        </span>
      );
    }

    const cAction = canonicalAction(action);

    // If fictional demo and an action triggered, present distinctly as demonstration
    if (isFictional) {
      let demoActionLabel = 'Demo: Rule Triggered';
      if (cAction === 'suspend') demoActionLabel = 'Demo: Suspend Activity';
      else if (cAction === 'relocate') demoActionLabel = 'Demo: Relocate Indoors';
      else if (cAction === 'modify') demoActionLabel = 'Demo: Modify Activity';
      else if (cAction === 'human_review') demoActionLabel = 'Demo: Human Review';
      else if (cAction === 'continue') demoActionLabel = 'Demo: Continue Activity';

      return (
        <span className="bg-purple-100 text-purple-900 border border-purple-300 px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-700" />
          <span>{demoActionLabel}{isIncomplete ? ' (Partial)' : ''}</span>
        </span>
      );
    }

    const prefix = isUnapproved ? 'QA Preview: ' : '';
    const reviewSuffix = requiresHumanReview ? ' + Staff Review' : '';

    switch (cAction) {
      case 'suspend':
        return (
          <span className="bg-red-100 text-red-900 border border-red-300 px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-red-700" />
            <span>{prefix}Suspend Activity{reviewSuffix}{isIncomplete ? ' (Incomplete Data)' : ''}</span>
          </span>
        );
      case 'relocate':
        return (
          <span className="bg-orange-100 text-orange-900 border border-orange-300 px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-orange-700" />
            <span>{prefix}Relocate Indoors{reviewSuffix}{isIncomplete ? ' (Incomplete Data)' : ''}</span>
          </span>
        );
      case 'modify':
        return (
          <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            <span>{prefix}Modify Activity Advised{reviewSuffix}{isIncomplete ? ' (Incomplete Data)' : ''}</span>
          </span>
        );
      case 'human_review':
        return (
          <span className="bg-amber-100 text-amber-900 border border-amber-400 px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-800" />
            <span>{prefix}Human Review Required{isIncomplete ? ' (Incomplete Data)' : ''}</span>
          </span>
        );
      case 'continue':
      default:
        return (
          <span className="bg-blue-100 text-blue-900 border border-blue-300 px-2.5 py-1 rounded text-xs font-bold inline-flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-700" />
            <span>{prefix}Continue Activity Rule Triggered{reviewSuffix}{isIncomplete ? ' (Incomplete Data)' : ''}</span>
          </span>
        );
    }
  };

  // Color mapping: "Below Caution range" replaces "Normal", "not applicable" is neutral gray
  const getHeatCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Extreme Danger':
        return 'text-red-700 bg-red-100 border-red-300';
      case 'Danger':
        return 'text-orange-800 bg-orange-100 border-orange-300';
      case 'Extreme Caution':
        return 'text-amber-800 bg-amber-100 border-amber-300';
      case 'Caution':
        return 'text-yellow-800 bg-yellow-100 border-yellow-300';
      case 'Below Caution range':
        return 'text-emerald-800 bg-emerald-100 border-emerald-300';
      case 'not applicable':
      default:
        return 'text-gray-700 bg-gray-100 border-gray-300';
    }
  };

  if (!currentOutlook || !currentRaw || !selectedAssessment) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg p-5 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#1A1A1A] dark:text-[#F4F6F8] flex items-center gap-2">
                <School className="w-6 h-6 text-blue-700 dark:text-blue-400" />
                <span>DustWatch School Mode</span>
              </h1>
              <span className="text-xs bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded font-semibold">
                Campus Data Unavailable
              </span>
            </div>
            <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2] mt-1">
              Campus Location: <strong>{selectedCityInfo.name}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="school-city-select-fallback" className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F4F6F8]">
              Campus Location:
            </label>
            <select
              id="school-city-select-fallback"
              value={selectedCityId}
              onChange={(e) => onSelectCity(e.target.value)}
              className="border border-[#D5D9DF] dark:border-[#354651] rounded-md px-3 py-2 text-xs font-semibold bg-white dark:bg-[#18242E] text-[#1A1A1A] dark:text-[#F4F6F8] min-h-[44px]"
            >
              {CITIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-8 text-center bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-[#1A1A1A] dark:text-[#F4F6F8]">
            Telemetry Unavailable for {selectedCityInfo.name}
          </h2>
          <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2] max-w-lg mx-auto leading-relaxed">
            Environmental observations and hourly forecasts for the selected campus ({selectedCityInfo.name}) are currently unavailable. DustWatch isolates campus telemetry and never substitutes readings from another city.
          </p>
        </div>
      </div>
    );
  }

  const readings = selectedAssessment.environmentalReadings;

  return (
    <>
      {/* Screen-Only Interactive Dashboard (Hidden during print) */}
      <div className="space-y-6 max-w-6xl mx-auto pb-12 print:hidden">
        {/* 1. Header with UAE Location Selection, Title & Print Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg p-5 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#1A1A1A] dark:text-[#F4F6F8] flex items-center gap-2">
                <School className="w-6 h-6 text-blue-700 dark:text-sky-400" />
                <span>DustWatch School Mode</span>
              </h1>
              <span className="text-xs bg-blue-100 dark:bg-blue-950/70 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 rounded font-semibold">
                Nurse & Staff Workflow
              </span>
            </div>
            <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2] mt-1 max-w-2xl leading-relaxed">
              Support authorised school staff by combining environmental observations with the school’s approved outdoor activity thresholds.
            </p>
          </div>

          {/* City Selector & Print Action Group */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <label htmlFor="school-city-select" className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F4F6F8]">
              Campus Location:
            </label>
            <select
              id="school-city-select"
              value={selectedCityId}
              onChange={(e) => onSelectCity(e.target.value)}
              className="border border-[#D5D9DF] dark:border-[#354651] rounded-md px-3 py-2 text-xs font-semibold bg-white dark:bg-[#18242E] text-[#1A1A1A] dark:text-[#F4F6F8] min-h-[44px]"
            >
              {CITIES.map((c) => (
                <option key={c.id} value={c.id} className="bg-white dark:bg-[#18242E] text-[#1A1A1A] dark:text-[#F4F6F8]">
                  {c.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrint}
                data-testid="print-view-btn"
                aria-label="Print School Assessment Report"
                className="px-3 py-2 bg-gray-100 dark:bg-[#263743] hover:bg-gray-200 dark:hover:bg-[#354651] text-[#1A1A1A] dark:text-[#F4F6F8] border border-[#D5D9DF] dark:border-[#354651] rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer min-h-[44px]"
              >
                <Printer className="w-3.5 h-3.5 text-gray-700 dark:text-[#AAB8C2]" />
                <span>Print Report</span>
              </button>
              <button
                type="button"
                onClick={handleSavePdf}
                data-testid="save-pdf-btn"
                aria-label="Save School Assessment Report as PDF"
                title="Generate and download PDF assessment report"
                className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer min-h-[44px]"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>Save as PDF</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setReportGeneratedAt(new Date());
                  setShowPrintPreviewModal(true);
                }}
                data-testid="preview-report-btn"
                aria-label="Preview A4 School Report"
                title="Preview printable A4 assessment report"
                className="px-2.5 py-2 bg-white dark:bg-[#18242E] hover:bg-gray-100 dark:hover:bg-[#263743] text-[#4A4F57] dark:text-[#AAB8C2] border border-[#D5D9DF] dark:border-[#354651] rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer min-h-[44px]"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Preview</span>
              </button>
            </div>
          </div>
        </div>

      {/* User-facing print notice if browser restrictions block window.print() */}
      {printNotice && (
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-center justify-between gap-3 shadow-xs print:hidden animate-in fade-in duration-150">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Print Notice:</span>{' '}
              <span>{printNotice}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPrintNotice(null)}
            className="text-amber-800 hover:text-amber-950 font-bold text-xs underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Critical Separation Banner: Dust Risk vs School Activity Assessment */}
      <div className="p-4 rounded-lg bg-blue-50/70 border border-blue-200 text-xs text-[#1A1A1A] space-y-1.5 shadow-xs print:hidden">
        <button
          type="button"
          onClick={() => setShowDistinctionDetails((prev) => !prev)}
          aria-expanded={showDistinctionDetails}
          aria-controls="school-distinction-details"
          className="w-full flex items-center justify-between text-left font-bold text-blue-950 hover:text-blue-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          <span className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-700 shrink-0" />
            <span>Understanding the Distinction Between Environmental Dust Risk and School Activity Policy</span>
          </span>
          {showDistinctionDetails ? (
            <ChevronUp className="w-4 h-4 text-blue-700 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-blue-700 shrink-0" />
          )}
        </button>
        {showDistinctionDetails && (
          <p id="school-distinction-details" className="leading-relaxed text-[#4A4F57] pt-1.5 border-t border-blue-200/60">
            <strong>Estimated Dust Risk</strong> is the general atmospheric particulate risk across the region calculated by DustWatch.
            <strong> School Activity Assessment</strong> evaluates multi-factor environmental readings (including heat stress, particulate matter, and wind gusts) against your school’s approved administrative rules. Relative humidity IS used in the regional dust score with a 5% weighting (low humidity reflects dry conditions that facilitate airborne dust). Air temperature is NOT included in the dust score, but is combined with humidity in the separate Heat Index calculation for School Mode.
          </p>
        )}
      </div>

      {/* 2b. Mandatory Local Policy Edits Banner */}
      {isLocallyEdited && (
        <div className="p-3.5 rounded-lg bg-amber-50 border-2 border-amber-400 text-amber-950 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-800 shrink-0" />
            <div>
              <span className="font-bold text-sm block">Using locally edited rules, not the school's approved policy</span>
              <span className="text-[11px] text-amber-900">
                Rule criteria have been customized in this browser. To restore approved administrative rules, reset below.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetToConfiguredPolicy}
            className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-md font-semibold cursor-pointer shrink-0 text-xs shadow-xs"
          >
            Reset to configured policy
          </button>
        </div>
      )}

      {/* 2c. Starter Configuration Checklist Banner */}
      {(!schoolPolicy.isConfigured || schoolPolicy.isStarterConfig) && (
        <OutlineDrawCard
          outlineColor="#E8874A"
          baseBorderColor="rgba(252, 211, 77, 0.7)"
          borderRadius={8}
          duration={0.7}
          delay={0.05}
          className="p-4 rounded-lg bg-amber-50/90 border border-amber-300 text-xs text-amber-950 space-y-3 shadow-xs"
        >
          <OutlineDrawHeading>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
              <h2 className="font-bold text-sm text-amber-950">
                Starter configuration — not an approved school policy
              </h2>
            </div>
          </OutlineDrawHeading>

          <OutlineDrawBody>
            <p className="leading-relaxed text-amber-900">
              DustWatch provides this starter template with disabled example rules to help your school configure operational policies. The starter configuration does not activate example thresholds and produces no positive safety or compliance determination. Authorised school leadership must provide approved parameters.
            </p>
          </OutlineDrawBody>

          <OutlineDrawVisual>
            <div className="bg-white/80 dark:bg-[#18242E]/80 p-3 rounded border border-amber-200 dark:border-amber-900/60 space-y-2">
              <button
                type="button"
                onClick={() => setShowStarterChecklist((prev) => !prev)}
                aria-expanded={showStarterChecklist}
                aria-controls="starter-checklist-items"
                className="w-full flex items-center justify-between text-left font-semibold text-xs text-amber-950 dark:text-amber-200 hover:text-amber-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 rounded"
              >
                <span>Required Information Checklist Before Activation ({STARTER_REQUIRED_INFO_CHECKLIST.length} items)</span>
                {showStarterChecklist ? (
                  <ChevronUp className="w-4 h-4 text-amber-800 dark:text-amber-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-amber-800 dark:text-amber-400 shrink-0" />
                )}
              </button>

              {showStarterChecklist && (
                <ul id="starter-checklist-items" className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-[#4A4F57] dark:text-[#AAB8C2] pt-2 border-t border-amber-200 dark:border-amber-900/60">
                  {STARTER_REQUIRED_INFO_CHECKLIST.map((item) => (
                    <li key={item.id} className="flex items-start gap-1.5">
                      <span className="text-amber-700 dark:text-amber-400 font-bold shrink-0">&bull;</span>
                      <div>
                        <span className="font-semibold text-[#1A1A1A] dark:text-[#F4F6F8]">{item.title}:</span>{' '}
                        <span>{item.description}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </OutlineDrawVisual>
        </OutlineDrawCard>
      )}

      {/* 3. Policy Configuration Status Bar */}
      <div
        className={`p-4 rounded-lg border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
          !schoolPolicy.isConfigured || schoolPolicy.isStarterConfig
            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'
            : schoolPolicy.isFictionalDemo
            ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800 text-purple-950 dark:text-purple-200'
            : !schoolPolicy.isApproved
            ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'
            : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">
              {!schoolPolicy.isConfigured || schoolPolicy.isStarterConfig
                ? 'No approved school policy configured'
                : schoolPolicy.isFictionalDemo
                ? 'FICTIONAL TEST POLICY (Demonstration Only — Not Real Policy)'
                : !schoolPolicy.isApproved
                ? `QA PREVIEW: ${schoolPolicy.schoolName} (Unapproved Custom Policy — Non-Operational)`
                : `Active Approved Policy: ${schoolPolicy.schoolName}`}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/80 dark:bg-[#18242E] border border-gray-300 dark:border-[#354651]">
              v{schoolPolicy.policyVersion}
            </span>
            {!schoolPolicy.isApproved && !schoolPolicy.isStarterConfig && !schoolPolicy.isFictionalDemo && (
              <span className="text-[10px] bg-amber-200 text-amber-950 border border-amber-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                Unapproved Custom (QA Preview Only)
              </span>
            )}
            {isLocallyEdited && (
              <span className="text-[10px] bg-amber-200 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-bold">
                Locally Edited
              </span>
            )}
          </div>
          <p className="text-[#4A4F57] dark:text-[#AAB8C2] text-xs">
            {!schoolPolicy.isConfigured || schoolPolicy.isStarterConfig
              ? 'Approved school operational policy is required before evaluating recommendations. Displaying unconfigured starter state.'
              : schoolPolicy.isFictionalDemo
              ? 'This policy uses fictional demonstration thresholds for testing the rule engine. It must not be mistaken for operational school guidance.'
              : !schoolPolicy.isApproved
              ? 'Custom rules are evaluated in QA/preview mode for testing. They have not been officially ratified by school administration and must never be used for real operational decisions.'
              : `Effective: ${schoolPolicy.effectiveDate}. Approved by: ${schoolPolicy.approvedBy || 'School Leadership'}. Source: ${schoolPolicy.sourceDocument || 'School Safety Guidelines'}.`}
          </p>
        </div>

        {/* Quick Demo Controls */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap print:hidden">
          {!schoolPolicy.isConfigured || schoolPolicy.isStarterConfig ? (
            <button
              type="button"
              onClick={handleLoadFictionalDemo}
              className="px-3 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-md text-xs font-semibold cursor-pointer min-h-[44px]"
            >
              Load Fictional Test Policy (Demo)
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResetToUnconfigured}
              className="px-3 py-2 bg-white dark:bg-[#18242E] border border-gray-300 dark:border-[#354651] hover:bg-gray-100 dark:hover:bg-[#263743] text-gray-800 dark:text-[#F4F6F8] rounded-md text-xs font-semibold cursor-pointer min-h-[44px]"
            >
              Reset to Starter State
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setEditableRules(schoolPolicy.rules);
              setShowPolicyModal(true);
            }}
            className="px-3 py-2 bg-white dark:bg-[#18242E] border border-[#D5D9DF] dark:border-[#354651] hover:bg-gray-50 dark:hover:bg-[#263743] text-[#1A1A1A] dark:text-[#F4F6F8] rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            <Settings className="w-3.5 h-3.5 text-gray-600 dark:text-[#AAB8C2]" />
            <span>View / Edit Policy Rules</span>
          </button>
        </div>
      </div>

      {/* 4. Side-by-Side Dual Assessment Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Card: Estimated Dust Risk */}
        <OutlineDrawCard
          outlineColor="#E8874A"
          baseBorderColor="rgba(213, 217, 223, 0.6)"
          borderRadius={8}
          duration={0.7}
          delay={0}
          className="bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg p-4 shadow-sm space-y-2"
        >
          <OutlineDrawHeading>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#4A4F57] dark:text-[#AAB8C2]">
                Regional Dust Risk (DustWatch)
              </span>
              <span
                style={{
                  backgroundColor: APP_CONFIG.colors[currentOutlook.peakLevel].badgeBg,
                  color: APP_CONFIG.colors[currentOutlook.peakLevel].badgeText,
                  borderColor: APP_CONFIG.colors[currentOutlook.peakLevel].border,
                }}
                className="px-2.5 py-0.5 rounded text-xs font-bold border"
              >
                {currentOutlook.peakLevel} Peak
              </span>
            </div>
          </OutlineDrawHeading>

          <OutlineDrawBody>
            <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2] leading-relaxed">
              Atmospheric model score based on PM10, dust concentration, wind speed, gusts, AOD, humidity (5% weight), and visibility.
            </p>
          </OutlineDrawBody>

          <OutlineDrawVisual>
            <div className="text-xs text-[#1A1A1A] dark:text-[#F4F6F8] pt-1 border-t border-gray-100 dark:border-[#354651] flex justify-between">
              <span>Peak 3-Hour Window:</span>
              <span className="font-semibold">{currentOutlook.worstWindow.displayRange}</span>
            </div>
          </OutlineDrawVisual>
        </OutlineDrawCard>

        {/* Right Card: School Activity Status */}
        <OutlineDrawCard
          outlineColor="#244C3B"
          baseBorderColor="rgba(213, 217, 223, 0.6)"
          borderRadius={8}
          duration={0.7}
          delay={0.1}
          className="bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg p-4 shadow-sm space-y-2"
        >
          <OutlineDrawHeading>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#4A4F57] dark:text-[#AAB8C2]">
                School Activity Status ({selectedActivity.toUpperCase()})
              </span>
              {getActionBadge(currentActivityAssessment, schoolPolicy.isConfigured && !schoolPolicy.isStarterConfig)}
            </div>
          </OutlineDrawHeading>

          <OutlineDrawBody>
            <p className="text-xs text-[#1A1A1A] dark:text-[#F4F6F8] font-medium">
              {currentActivityAssessment?.actionTitle}
            </p>
          </OutlineDrawBody>

          <OutlineDrawVisual>
            <div className="text-xs text-[#4A4F57] dark:text-[#AAB8C2] pt-1 border-t border-gray-100 dark:border-[#354651] flex justify-between">
              <span>Rule Evaluation:</span>
              <span>
                {schoolPolicy.isConfigured && !schoolPolicy.isStarterConfig
                  ? schoolPolicy.isFictionalDemo
                    ? `${currentActivityAssessment?.triggeredRules.filter((r) => r.isTriggered).length || 0} fictional thresholds triggered (demo)`
                    : `${currentActivityAssessment?.triggeredRules.filter((r) => r.isTriggered).length || 0} policy thresholds triggered`
                  : 'Awaiting verified policy'}
              </span>
            </div>
          </OutlineDrawVisual>
        </OutlineDrawCard>
      </div>

      {/* 5. Environmental Conditions Dashboard */}
      <div className="bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#D5D9DF] dark:border-[#354651] pb-3">
          <div>
            <h2 className="text-base font-bold text-[#1A1A1A] dark:text-[#F4F6F8] flex items-center gap-2">
              <Sun className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span>Environmental Conditions Dashboard</span>
            </h2>
            <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2]">
              Hourly meteorological, particulate matter, and precipitation telemetry for {currentOutlook.city.name} at {selectedAssessment.displayHour} GST.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#4A4F57] dark:text-[#AAB8C2]">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated: {lastUpdatedFormatted}</span>
          </div>
        </div>

        {/* Precipitation Semantics: Distinction between Current NWP Model Estimate and Hourly Forecast */}
        <div className="p-3.5 rounded-lg bg-blue-50/50 border border-blue-200 text-xs space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 border-b border-blue-200/60 pb-2">
            <button
              type="button"
              onClick={() => setShowPrecipitationDetails(!showPrecipitationDetails)}
              aria-expanded={showPrecipitationDetails}
              aria-controls="school-precipitation-comparison"
              className="text-left font-bold text-blue-950 hover:text-blue-700 flex items-center gap-2 flex-wrap transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-0.5"
            >
              <CloudRain className="w-4 h-4 text-blue-700 shrink-0" />
              <span>Precipitation Analysis: Current Model Estimate vs Hourly Forecast</span>
              {isDemoMode && (
                <span className="text-[10px] bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-700" />
                  <span>DEMO — SIMULATED RAINFALL</span>
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded font-medium">
                Model Step: {currentPrecipitation?.intervalSeconds ? `${Math.round(currentPrecipitation.intervalSeconds / 60)} min` : '15 min'} • Timestamp: {currentPrecipitation?.time ? currentPrecipitation.time.replace('T', ' ') : 'N/A'} GST
              </span>
              <button
                type="button"
                onClick={() => setShowPrecipitationDetails(!showPrecipitationDetails)}
                aria-expanded={showPrecipitationDetails}
                aria-controls="school-precipitation-comparison"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-900 hover:text-blue-950 bg-blue-100 hover:bg-blue-200/80 px-2.5 py-1 rounded transition-colors cursor-pointer"
              >
                <span>{showPrecipitationDetails ? 'Hide Model Comparison' : 'View Model Step vs 1-Hr Forecast'}</span>
                {showPrecipitationDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>
          {showPrecipitationDetails && (
            <div id="school-precipitation-comparison" className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="bg-white/85 p-2.5 rounded border border-blue-200/80">
                <div className="font-semibold text-blue-950 mb-1 flex items-center justify-between">
                  <span>Current NWP Model Estimate ({currentPrecipitation?.time ? currentPrecipitation.time.split('T')[1] || currentPrecipitation.time : 'Current'})</span>
                  <span className="text-[10px] text-gray-500 font-normal">
                    {isDemoMode ? 'Simulated demonstration estimate (15-min step)' : 'NWP model, not radar observation'}
                  </span>
                </div>
                {currentPrecipitation && currentPrecipitation.isAvailable && !currentPrecipitation.isStale ? (
                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    <div>
                      <span className="text-[#4A4F57]">Total Precip:</span>{' '}
                      <strong className="text-[#1A1A1A]">
                        {currentPrecipitation.precipitation !== null ? `${currentPrecipitation.precipitation} mm` : 'Not available'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#4A4F57]">Rain:</span>{' '}
                      <strong className="text-[#1A1A1A]">
                        {currentPrecipitation.rain !== null ? `${currentPrecipitation.rain} mm` : 'Not available'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#4A4F57]">Showers:</span>{' '}
                      <strong className="text-[#1A1A1A]">
                        {currentPrecipitation.showers !== null ? `${currentPrecipitation.showers} mm` : 'Not available'}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="text-amber-800 font-medium text-xs">
                    {currentPrecipitation?.isStale ? 'Current precipitation telemetry is stale (>2h old)' : 'Not available'}
                  </div>
                )}
                <div className="text-[10px] text-[#4A4F57] mt-1.5 leading-tight">
                  {isDemoMode ? (
                    <span className="text-purple-950 font-medium">
                      <strong>Demonstration Mode:</strong> Precipitation values are simulated test data corresponding to the dashboard convective scenario. Never used for real-time school operations.
                    </span>
                  ) : (
                    <span>
                      Represents liquid precipitation equivalent over preceding model interval. Zero current rain does not infer dry future hours; conversely, future forecast rain does not imply current precipitation. Missing values are never assumed zero.
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white/85 p-2.5 rounded border border-blue-200/80">
                <div className="font-semibold text-blue-950 mb-1 flex items-center justify-between">
                  <span>Forecast for Selected Hour ({selectedAssessment.displayHour} GST)</span>
                  <span className="text-[10px] text-gray-500 font-normal">
                    {isDemoMode ? 'Simulated 1-hr forecast accumulation' : '1-hour accumulation'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <div>
                    <span className="text-[#4A4F57]">1-Hr Total:</span>{' '}
                    <strong className="text-[#1A1A1A]">
                      {readings.precipitation !== null ? `${readings.precipitation} mm` : readings.accumulatedRain !== null ? `${readings.accumulatedRain} mm` : 'Not available'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#4A4F57]">Rain:</span>{' '}
                    <strong className="text-[#1A1A1A]">
                      {readings.rain !== null ? `${readings.rain} mm` : 'Not available'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#4A4F57]">Showers:</span>{' '}
                    <strong className="text-[#1A1A1A]">
                      {readings.showers !== null ? `${readings.showers} mm` : 'Not available'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#4A4F57]">Probability:</span>{' '}
                    <strong className="text-[#1A1A1A]">
                      {readings.precipitationProbability !== null ? `${readings.precipitationProbability} %` : 'Not available'}
                    </strong>
                  </div>
                </div>
                <div className="text-[10px] text-[#4A4F57] mt-1.5 leading-tight">
                  Hourly values represent cumulative 1-hour total precipitation and component forecasts, not instantaneous rainfall observations.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Environmental Telemetry Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {/* Temperature */}
          <div className="p-3 rounded-lg border border-[#D5D9DF] bg-gray-50/70">
            <div className="text-[#4A4F57] font-medium flex items-center gap-1 mb-1">
              <Thermometer className="w-3.5 h-3.5 text-red-600" />
              <span>Air Temperature</span>
            </div>
            <div className="text-lg font-bold text-[#1A1A1A]">
              {readings.temperature !== null ? `${readings.temperature} °C` : <span className="text-gray-500 font-normal text-xs">not applicable</span>}
            </div>
            <div className="text-[10px] text-[#4A4F57] mt-0.5">Forecast (2m ambient)</div>
          </div>

          {/* Relative Humidity */}
          <div className="p-3 rounded-lg border border-[#D5D9DF] bg-gray-50/70">
            <div className="text-[#4A4F57] font-medium flex items-center gap-1 mb-1">
              <Sun className="w-3.5 h-3.5 text-blue-600" />
              <span>Relative Humidity</span>
            </div>
            <div className="text-lg font-bold text-[#1A1A1A]">
              {readings.relativeHumidity !== null ? `${readings.relativeHumidity} %` : <span className="text-gray-500 font-normal text-xs">not applicable</span>}
            </div>
            <div className="text-[10px] text-[#4A4F57] mt-0.5">Used in dust score (5% wt)</div>
          </div>

          {/* Combined Heat Index: Categories labeled NWS general reference, no example thresholds */}
          <div className="p-3 rounded-lg border border-[#D5D9DF] bg-amber-50/40">
            <div className="text-[#4A4F57] font-medium flex items-center justify-between gap-1 mb-1">
              <span>Heat Index (Apparent)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${getHeatCategoryColor(readings.heatIndex.category)}`}>
                {readings.heatIndex.category}
              </span>
            </div>
            <div className="text-lg font-bold text-[#1A1A1A]">
              {readings.heatIndex.heatIndexCelsius !== null
                ? `${readings.heatIndex.heatIndexCelsius} °C`
                : <span className="text-gray-500 font-normal text-xs">not applicable</span>}
            </div>
            <div className="text-[10px] text-[#4A4F57] mt-0.5 font-medium">
              NWS general reference, not school policy
            </div>
          </div>

          {/* 1-Hour Total Precipitation */}
          <div className="p-3 rounded-lg border border-[#D5D9DF] bg-blue-50/40">
            <div className="text-[#4A4F57] font-medium flex items-center justify-between gap-1 mb-1">
              <span className="flex items-center gap-1">
                <CloudRain className="w-3.5 h-3.5 text-blue-600" />
                <span>1-Hr Total Precip</span>
              </span>
              {isDemoMode && (
                <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-purple-100 text-purple-900 border border-purple-200">
                  Demo
                </span>
              )}
            </div>
            <div className="text-lg font-bold text-[#1A1A1A]">
              {readings.precipitation !== null ? (
                `${readings.precipitation} mm`
              ) : readings.accumulatedRain !== null ? (
                `${readings.accumulatedRain} mm`
              ) : (
                <span className="text-gray-500 font-normal text-xs">Not available</span>
              )}
            </div>
            <div className="text-[10px] text-[#4A4F57] mt-0.5">
              {isDemoMode ? 'Simulated 1-hr accum' : '1-hr forecast accum'}
            </div>
          </div>

          {/* Rain / Showers / Probability */}
          <div className="p-3 rounded-lg border border-[#D5D9DF] bg-blue-50/40">
            <div className="text-[#4A4F57] font-medium flex items-center justify-between gap-1 mb-1">
              <span className="flex items-center gap-1">
                <CloudRain className="w-3.5 h-3.5 text-indigo-600" />
                <span>Rain / Probability</span>
              </span>
              {isDemoMode && (
                <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-purple-100 text-purple-900 border border-purple-200">
                  Demo
                </span>
              )}
            </div>
            <div className="text-sm font-bold text-[#1A1A1A]">
              {readings.rain !== null ? `${readings.rain} mm rain` : 'Not available'}{' '}
              <span className="text-xs font-normal text-[#4A4F57]">
                ({readings.precipitationProbability !== null ? `${readings.precipitationProbability}%` : 'Not available'})
              </span>
            </div>
            <div className="text-[10px] text-[#4A4F57] mt-0.5">
              Showers: {readings.showers !== null ? `${readings.showers} mm` : 'Not available'}
            </div>
          </div>

          {/* PM10 Particles */}
          <div className="p-3 rounded-lg border border-[#D5D9DF] bg-gray-50/70">
            <div className="text-[#4A4F57] font-medium flex items-center gap-1 mb-1">
              <Eye className="w-3.5 h-3.5 text-purple-600" />
              <span>PM10 Particulate</span>
            </div>
            <div className="text-lg font-bold text-[#1A1A1A]">
              {readings.pm10 !== null ? `${readings.pm10} µg/m³` : <span className="text-gray-500 font-normal text-xs">not applicable</span>}
            </div>
            <div className="text-[10px] text-[#4A4F57] mt-0.5">Model-based estimate (CAMS)</div>
          </div>

          {/* PM2.5 Particles */}
          <div className="p-3 rounded-lg border border-[#D5D9DF] bg-gray-50/70">
            <div className="text-[#4A4F57] font-medium flex items-center gap-1 mb-1">
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
              <span>PM2.5 Fine Particles</span>
            </div>
            <div className="text-lg font-bold text-[#1A1A1A]">
              {readings.pm2_5 !== null ? `${readings.pm2_5} µg/m³` : <span className="text-gray-500 font-normal text-xs">not applicable</span>}
            </div>
            <div className="text-[10px] text-[#4A4F57] mt-0.5">Model-based estimate (CAMS)</div>
          </div>

          {/* Mineral Dust Concentration */}
          <div className="p-3 rounded-lg border border-[#D5D9DF] bg-gray-50/70">
            <div className="text-[#4A4F57] font-medium flex items-center gap-1 mb-1">
              <Wind className="w-3.5 h-3.5 text-amber-700" />
              <span>Mineral Dust</span>
            </div>
            <div className="text-lg font-bold text-[#1A1A1A]">
              {readings.dust !== null ? `${readings.dust} µg/m³` : <span className="text-gray-500 font-normal text-xs">not applicable</span>}
            </div>
            <div className="text-[10px] text-[#4A4F57] mt-0.5">Atmospheric forecast (CAMS)</div>
          </div>

          {/* Wind Speed & Gusts */}
          <div className="p-3 rounded-lg border border-[#D5D9DF] bg-gray-50/70">
            <div className="text-[#4A4F57] font-medium flex items-center gap-1 mb-1">
              <Wind className="w-3.5 h-3.5 text-blue-700" />
              <span>Wind Speed & Gusts</span>
            </div>
            <div className="text-base font-bold text-[#1A1A1A]">
              {readings.windSpeed !== null ? `${readings.windSpeed} km/h` : 'N/A'}{' '}
              <span className="text-xs font-normal text-[#4A4F57]">
                (Gusts: {readings.windGusts !== null ? `${readings.windGusts} km/h` : 'N/A'})
              </span>
            </div>
            <div className="text-[10px] text-[#4A4F57] mt-0.5">
              Direction: {readings.windDirection !== null ? `${readings.windDirection}°` : 'N/A'}
            </div>
          </div>

          {/* Horizontal Visibility */}
          <div className="p-3 rounded-lg border border-[#D5D9DF] bg-gray-50/70">
            <div className="text-[#4A4F57] font-medium flex items-center gap-1 mb-1">
              <Eye className="w-3.5 h-3.5 text-gray-700" />
              <span>Horizontal Visibility</span>
            </div>
            <div className="text-lg font-bold text-[#1A1A1A]">
              {readings.visibility !== null ? `${readings.visibility} m` : <span className="text-gray-500 font-normal text-xs">not applicable</span>}
            </div>
            <div className="text-[10px] text-[#4A4F57] mt-0.5">Atmospheric visibility</div>
          </div>
        </div>

        {/* NCM Early Warning System link with exact required text */}
        <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0" />
            <span className="text-amber-950 font-medium">
              Official warning status unavailable — check ncm.ae.
            </span>
          </div>
          <a
            href="https://mobile.ncm.gov.ae/maps-warnings?lang=en"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:text-blue-900 underline font-semibold flex items-center gap-1 shrink-0"
          >
            <span>NCM Warnings Portal</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* 6. Hourly School Activity Recommendations */}
      <div className="bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#D5D9DF] dark:border-[#354651] pb-3">
          <div>
            <h2 className="text-base font-bold text-[#1A1A1A] dark:text-[#F4F6F8] flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-700 dark:text-sky-400" />
              <span>12-Hour Activity Schedule Recommendations</span>
            </h2>
            <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2]">
              Evaluated against school approved policy precedence rules. Select an hour to inspect triggered conditions.
            </p>
          </div>

          {/* Activity Category Tabs: Break, PE, Lunch, Assembly - Smooth Horizontal Touch Scroll */}
          <div
            role="tablist"
            aria-label="School Activity Tabs"
            className="flex items-center bg-gray-100 dark:bg-[#18242E] p-1 rounded-lg border border-[#D5D9DF] dark:border-[#354651] overflow-x-auto no-scrollbar max-w-full gap-1 w-full sm:w-auto touch-pan-x"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedActivity === 'break'}
              onClick={() => setSelectedActivity('break')}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer min-h-[44px] whitespace-nowrap interactive-tap flex items-center justify-center ${
                selectedActivity === 'break'
                  ? 'bg-white dark:bg-[#263743] text-blue-700 dark:text-sky-300 shadow-xs'
                  : 'text-[#4A4F57] dark:text-[#AAB8C2] hover:text-[#1A1A1A] dark:hover:text-[#F4F6F8]'
              }`}
            >
              Outdoor Break
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedActivity === 'pe'}
              onClick={() => setSelectedActivity('pe')}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer min-h-[44px] whitespace-nowrap interactive-tap flex items-center justify-center ${
                selectedActivity === 'pe'
                  ? 'bg-white dark:bg-[#263743] text-blue-700 dark:text-sky-300 shadow-xs'
                  : 'text-[#4A4F57] dark:text-[#AAB8C2] hover:text-[#1A1A1A] dark:hover:text-[#F4F6F8]'
              }`}
            >
              Physical Education (PE)
            </button>
            {showLunch && (
              <button
                type="button"
                role="tab"
                aria-selected={selectedActivity === 'lunch_other'}
                onClick={() => setSelectedActivity('lunch_other')}
                className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer min-h-[44px] whitespace-nowrap interactive-tap flex items-center justify-center ${
                  selectedActivity === 'lunch_other'
                    ? 'bg-white dark:bg-[#263743] text-blue-700 dark:text-sky-300 shadow-xs'
                    : 'text-[#4A4F57] dark:text-[#AAB8C2] hover:text-[#1A1A1A] dark:hover:text-[#F4F6F8]'
                }`}
              >
                Lunch / Outdoor Play
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={selectedActivity === 'assembly'}
              onClick={() => setSelectedActivity('assembly')}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer min-h-[44px] whitespace-nowrap interactive-tap flex items-center justify-center ${
                selectedActivity === 'assembly'
                  ? 'bg-white dark:bg-[#263743] text-blue-700 dark:text-sky-300 shadow-xs'
                  : 'text-[#4A4F57] dark:text-[#AAB8C2] hover:text-[#1A1A1A] dark:hover:text-[#F4F6F8]'
              }`}
            >
              Outdoor Assembly
            </button>
          </div>
        </div>

        {/* 12-Hour Selector Pills - Touch-friendly 44px targets with smooth horizontal scrolling */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 print:grid print:grid-cols-6 print:gap-2 touch-pan-x">
          {hourlyAssessments.map((item, idx) => {
            const isSelected = selectedHourIndex === idx;
            const actAssessment = item.activityAssessments[selectedActivity];
            const action = actAssessment.recommendedAction;
            const cAction = canonicalAction(action);
            const isFictional = Boolean(schoolPolicy.isFictionalDemo || actAssessment.isFictionalDemo);
            let badgeBg = 'bg-gray-100 text-[#1A1A1A] border-gray-200';
            let labelText = cAction.replace('_', ' ');

            if (!schoolPolicy.isConfigured || schoolPolicy.isStarterConfig || actAssessment.status === 'policy_not_configured' || actAssessment.status === 'policy_unconfigured') {
              labelText = 'Pending';
              badgeBg = 'bg-gray-100 text-[#1A1A1A] border-gray-200';
            } else if (actAssessment.status === 'human_review') {
              badgeBg = isFictional ? 'bg-purple-50 text-purple-900 border-purple-300' : 'bg-amber-100 text-amber-900 border-amber-400';
              labelText = isFictional ? 'Demo: Review' : 'Review';
            } else if (actAssessment.status === 'not_evaluated' || actAssessment.status === 'assessment_unavailable') {
              badgeBg = 'bg-amber-50 text-amber-900 border-amber-300';
              labelText = 'Data Missing';
            } else if (actAssessment.status === 'no_applicable_rules') {
              badgeBg = 'bg-slate-100 text-slate-800 border-slate-300';
              labelText = 'No Rules';
            } else if (actAssessment.status === 'criteria_met_no_actions') {
              if (isFictional) {
                badgeBg = 'bg-purple-50 text-purple-900 border-purple-200';
                labelText = 'Demo — Below Limits';
              } else {
                badgeBg = 'bg-emerald-50 text-emerald-900 border-emerald-200';
                labelText = 'Criteria Met';
              }
            } else {
              if (isFictional) {
                badgeBg = 'bg-purple-50 text-purple-900 border-purple-200';
                labelText = `Demo: ${cAction}`;
                if (actAssessment.isIncomplete) {
                  labelText += ' (Partial)';
                }
              } else {
                if (cAction === 'continue') badgeBg = 'bg-blue-50 text-blue-900 border-blue-200';
                if (cAction === 'modify') badgeBg = 'bg-amber-50 text-amber-900 border-amber-200';
                if (cAction === 'relocate') badgeBg = 'bg-orange-50 text-orange-900 border-orange-200';
                if (cAction === 'suspend') badgeBg = 'bg-red-50 text-red-900 border-red-200';
                labelText = cAction;
                if (actAssessment.isIncomplete) {
                  labelText += ' (Partial)';
                }
              }
            }

            return (
              <button
                key={item.hourIndex}
                type="button"
                onClick={() => setSelectedHourIndex(idx)}
                aria-pressed={isSelected}
                className={`px-3 py-2 rounded-lg border text-xs flex flex-col items-center justify-center min-w-[76px] min-h-[46px] cursor-pointer transition-all interactive-tap shrink-0 ${badgeBg} ${
                  isSelected ? 'ring-2 ring-blue-600 font-bold shadow-xs' : 'hover:opacity-85'
                }`}
              >
                <span className="font-semibold">{item.displayHour}</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold opacity-85 mt-0.5">
                  {labelText}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Hour Policy Decision Detail Box */}
        <div className="p-4 rounded-lg border border-[#D5D9DF] dark:border-[#354651] bg-gray-50/50 dark:bg-[#18242E] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#1A1A1A] dark:text-[#F4F6F8]">
                {selectedAssessment.displayHour} GST {schoolPolicy.isFictionalDemo ? 'Demonstration Result:' : 'Recommendation:'}
              </span>
              {getActionBadge(currentActivityAssessment, schoolPolicy.isConfigured && !schoolPolicy.isStarterConfig)}
            </div>

            {currentActivityAssessment.conflictingRules && (
              <span className="text-xs bg-red-100 dark:bg-red-950/70 text-red-900 dark:text-red-300 border border-red-300 dark:border-red-800/60 px-2 py-0.5 rounded font-semibold">
                Conflicting policy conditions flagged for authorized staff
              </span>
            )}
          </div>

          {currentActivityAssessment.requiresHumanReview && (
            <div className="p-3 rounded-md bg-amber-50 dark:bg-[#251D18] border-2 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-200 text-xs flex items-start gap-2 shadow-xs">
              <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-950 dark:text-amber-200">Mandatory Staff Human Review Required:</span>{' '}
                <span>At least one triggered policy condition mandates human evaluation by school safety staff. Automatic operational recommendations do not replace staff review.</span>
              </div>
            </div>
          )}

          {currentActivityAssessment.isUnapprovedCustom && (
            <div className="p-2.5 rounded-md bg-amber-50/80 dark:bg-[#251D18] border border-amber-300 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
              <span>
                <strong>QA Preview Only (Non-Operational):</strong> This simulation is evaluated under unapproved custom rules. It has not been officially ratified by school administration and must never be presented as an approved school decision.
              </span>
            </div>
          )}

          {/* Action Title and Primary Guidance */}
          <div className={`p-3 rounded-md border space-y-1 ${
            schoolPolicy.isFictionalDemo ? 'bg-purple-50/40 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/60' : 'bg-white dark:bg-[#1E2D38] border-[#D5D9DF] dark:border-[#354651]'
          }`}>
            <h3 className="font-bold text-sm text-[#1A1A1A] dark:text-[#F4F6F8]">
              {currentActivityAssessment.actionTitle}
            </h3>
            <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2] leading-relaxed">
              {currentActivityAssessment.primaryGuidance}
            </p>
          </div>

          {/* Policy Metadata Display (Shown on every result card and print view) */}
          <div className="text-[11px] text-[#4A4F57] dark:text-[#AAB8C2] bg-white dark:bg-[#1E2D38] p-2.5 rounded border border-[#D5D9DF] dark:border-[#354651] flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong>Policy Source:</strong> {schoolPolicy.sourceDocument || 'School Operational Rules'}
            </span>
            <span>
              <strong>Version:</strong> {schoolPolicy.policyVersion}
            </span>
            <span>
              <strong>Effective Date:</strong> {schoolPolicy.effectiveDate}
            </span>
          </div>

          {/* Triggered Rules Breakdown */}
          <div>
            <div className="hidden print:block font-bold text-xs text-black mb-1 border-b border-gray-300 pb-1">
              Policy Rule Evaluation & Triggered Conditions
            </div>

            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap print:hidden">
              <button
                type="button"
                onClick={() => setShowRuleDetails(!showRuleDetails)}
                aria-expanded={showRuleDetails}
                aria-controls="school-rule-evaluation-breakdown"
                className="text-left text-xs font-semibold text-[#4A4F57] hover:text-[#1A1A1A] flex items-center gap-2 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded p-0.5"
              >
                <span>Policy Rule Evaluation & Triggered Conditions</span>
                {schoolPolicy.isConfigured && currentActivityAssessment.status !== 'policy_unconfigured' && (
                  <span className="text-[11px] font-normal text-gray-500">
                    ({currentActivityAssessment.triggeredRules.filter((r) => r.isTriggered).length} conditions triggered)
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowRuleDetails(!showRuleDetails)}
                aria-expanded={showRuleDetails}
                aria-controls="school-rule-evaluation-breakdown"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1 rounded transition-colors cursor-pointer border border-emerald-200"
              >
                <span>{showRuleDetails ? 'Hide Rule Breakdown' : 'View Rule Breakdown'}</span>
                {showRuleDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            <div id="school-rule-evaluation-breakdown" className={showRuleDetails ? 'block' : 'hidden print:block'}>
              {!schoolPolicy.isConfigured || currentActivityAssessment.status === 'policy_unconfigured' ? (
                  <p className="text-xs text-[#4A4F57] italic">
                    School policy has not been configured yet. Approved school thresholds must be supplied.
                  </p>
                ) : currentActivityAssessment.status === 'no_applicable_rules' ? (
                  <div className="p-3 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-slate-900">
                      <Info className="w-4 h-4 text-slate-600 shrink-0" />
                      <span>No Applicable Rules Configured for {selectedActivity === 'break' ? 'Outdoor Break' : selectedActivity === 'pe' ? 'Physical Education (PE)' : 'Lunch'}</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">
                      The active school policy contains zero rules that apply to this activity. Displaying distinct unconfigured rules state.
                    </p>
                  </div>
                ) : currentActivityAssessment.status === 'assessment_unavailable' ? (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded text-xs text-amber-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Assessment Unavailable: Required Environmental Data Is Missing</span>
                    </div>
                    <p className="text-amber-900 leading-relaxed">
                      One or more required environmental readings are unavailable and cannot be verified against school thresholds. Do not assume conditions are safe.
                    </p>
                  </div>
                ) : currentActivityAssessment.status === 'criteria_met_no_actions' ? (
                  schoolPolicy.isFictionalDemo ? (
                    <p className="text-xs text-purple-900 bg-purple-50 p-2.5 rounded border border-purple-200">
                      No fictional demonstration thresholds were exceeded for this hour. This result is for rule-engine testing only and is not an operational safety determination or approval for outdoor activities.
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-800 bg-emerald-50/80 p-2.5 rounded border border-emerald-200">
                      Conditions meet the configured criteria for this activity under current policy rules. No threshold was exceeded.
                    </p>
                  )
                ) : (
                  <div className="space-y-2">
                    {currentActivityAssessment.isIncomplete && (
                      <div className="p-2.5 rounded bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-center gap-2 font-medium">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Incomplete Assessment: Configured action triggered, but some applicable environmental readings were missing or invalid.</span>
                      </div>
                    )}
                    {currentActivityAssessment.triggeredRules
                      .filter((r) => r.isTriggered)
                      .map((tr) => (
                        <div
                          key={tr.rule.id}
                          className={`p-2.5 rounded border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                            schoolPolicy.isFictionalDemo
                              ? 'bg-purple-50/40 border-purple-200'
                              : 'bg-white border-amber-200'
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-[#1A1A1A]">
                              {schoolPolicy.isFictionalDemo ? `[Demo Test Rule] ${tr.rule.name}` : tr.rule.name}
                            </div>
                            <div className="text-[11px] text-[#4A4F57]">
                              Triggered: Rule <code>{tr.rule.id}</code> on metric <code>{tr.rule.metric}</code> ({tr.observedValue} {tr.unit})
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 border ${
                            schoolPolicy.isFictionalDemo
                              ? 'bg-purple-100 text-purple-900 border-purple-300'
                              : 'bg-amber-100 text-amber-900 border-amber-300'
                          }`}>
                            {schoolPolicy.isFictionalDemo ? `DEMO: ${tr.rule.recommendedAction.replace('_', ' ')}` : tr.rule.recommendedAction.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

          {/* Gemini AI Plain Language Explanation */}
          <div className="pt-2 border-t border-gray-200 print:hidden space-y-2.5">
            {isDemoMode && (
              <div
                data-testid="demo-mode-school-disclaimer"
                className="p-3.5 rounded-md bg-purple-50 border-2 border-purple-300 text-purple-950 text-xs shadow-xs space-y-1"
              >
                <div className="font-bold flex items-center gap-1.5 text-purple-900 uppercase tracking-wide text-xs">
                  <Sparkles className="w-4 h-4 text-purple-700 shrink-0" />
                  <span>DEMONSTRATION ONLY — FICTIONAL DATA</span>
                </div>
                <p className="leading-relaxed text-purple-900 font-medium">
                  This AI-generated guidance uses simulated environmental data and a fictional school policy for demonstration purposes. It is not an assessment of actual school conditions and must not be used for real-world safety decisions.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1A1A1A]">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Plain-Language Summary for School Staff:</span>
              </div>
              {isDemoMode && isAiGenerated && (
                <span className="text-[10px] bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-700" />
                  <span>AI-Generated Demonstration Guidance</span>
                </span>
              )}
            </div>

            {isAiLoading ? (
              <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2] italic">Preparing summary...</p>
            ) : (
              <div
                className={`p-2.5 rounded border text-xs text-[#1A1A1A] dark:text-[#F4F6F8] leading-relaxed ${
                  isDemoMode && isAiGenerated
                    ? 'bg-purple-50/40 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800/60'
                    : 'bg-white dark:bg-[#1E2D38] border-gray-200 dark:border-[#354651]'
                }`}
              >
                {isDemoMode && isAiGenerated && (
                  <div className="text-[10px] font-semibold text-purple-800 dark:text-purple-300 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <span>Simulated Advisory Guidance</span>
                  </div>
                )}
                <p>{aiSummary || currentActivityAssessment.primaryGuidance}</p>
              </div>
            )}

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAiGatingDetails(!showAiGatingDetails)}
                aria-expanded={showAiGatingDetails}
                aria-controls="school-ai-gating-rationale"
                className="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-[#AAB8C2] hover:text-gray-700 dark:hover:text-white cursor-pointer"
              >
                <span>{showAiGatingDetails ? 'Hide AI Gating & Policy Scope Details' : 'View AI Gating & Policy Scope Details'}</span>
                {showAiGatingDetails ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
              </button>
              {showAiGatingDetails && (
                <p id="school-ai-gating-rationale" className="text-[10px] text-[#4A4F57] dark:text-[#AAB8C2] mt-1.5 p-2 rounded bg-gray-50 dark:bg-[#18242E] border border-gray-200 dark:border-[#354651]">
                  {isDemoMode && isAiGenerated
                    ? 'AI-generated demonstration guidance based on simulated environmental data and fictional school policy rules.'
                    : isAiGenerated
                    ? 'Explanation generated by Gemini AI from precomputed risk and policy evaluation facts.'
                    : schoolPolicy.isFictionalDemo && !isDemoMode
                    ? 'AI summary generation is gated for fictional demonstration data. Standard rule-based guidance is displayed.'
                    : schoolPolicy.isFictionalDemo && isDemoMode && (currentActivityAssessment.status === 'assessment_unavailable' || currentActivityAssessment.isIncomplete || currentActivityAssessment.dataMissingForAssessment)
                    ? 'AI summary generation is gated when simulated environmental readings are missing or incomplete.'
                    : currentActivityAssessment.status === 'no_applicable_rules'
                    ? 'AI summary generation is gated when no rules apply to the selected activity.'
                    : currentActivityAssessment.status === 'assessment_unavailable' || currentActivityAssessment.isIncomplete
                    ? 'AI summary generation is gated when environmental readings are missing or incomplete.'
                    : !schoolPolicy.isConfigured
                    ? 'AI summary generation is gated until school policy is configured.'
                    : 'Standard rule-based guidance. DustWatch supports authorised staff; final authority remains with school leadership.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 7. Policy Editor / Viewer Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-[#1E2D38] rounded-lg border border-[#D5D9DF] dark:border-[#354651] shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-[#1A1A1A] dark:text-[#F4F6F8]">
            <div className="p-4 border-b border-[#D5D9DF] dark:border-[#354651] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#1A1A1A] dark:text-[#F4F6F8]">
                  School Policy Dynamic Rules & Thresholds Editor
                </h3>
                <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2]">
                  Configure unlimited custom rules, multiple thresholds per environmental factor, activity scopes, and action triggers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="p-1.5 text-gray-500 dark:text-[#AAB8C2] hover:text-black dark:hover:text-white rounded cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs flex-1">
              {modalValidationError && (
                <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />
                  <span>{modalValidationError}</span>
                </div>
              )}

              <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 leading-relaxed">
                <strong>Policy Verification Notice:</strong> Operational school rules must be officially ratified by school administration and health officers. Any browser edits must not be mistaken for official administrative ratification.
              </div>

              <div>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <div className="font-semibold text-sm text-[#1A1A1A] dark:text-[#F4F6F8]">
                      Configured Activity Rules ({editableRules.length})
                    </div>
                    <p className="text-[11px] text-[#4A4F57] dark:text-[#AAB8C2]">
                      Configure rules independently. Multiple rules may share the same metric or activity scope.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isLocallyEdited && (
                      <button
                        type="button"
                        onClick={handleResetToConfiguredPolicy}
                        className="text-xs text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset to configured</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddRule}
                      data-testid="add-rule-btn"
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Rule</span>
                    </button>
                  </div>
                </div>

                {editableRules.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 dark:bg-[#18242E] rounded-lg border border-dashed border-gray-300 dark:border-[#354651] space-y-3">
                    <p className="text-gray-600 dark:text-[#AAB8C2] italic">
                      No rules configured yet. Click below to add your first rule or load the demonstration preset.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddRule}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Your First Rule</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {editableRules.map((r, i) => (
                      <div
                        key={r.id || i}
                        className={`p-3.5 rounded-lg border transition-colors space-y-3 shadow-xs ${
                          r.enabled === false ? 'bg-gray-100/60 dark:bg-[#18242E]/60 border-gray-200 dark:border-[#354651] opacity-75' : 'bg-gray-50 dark:bg-[#18242E] border-gray-200 dark:border-[#354651]'
                        }`}
                      >
                        {/* Top Header of Rule Card */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 dark:border-[#354651] pb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-[11px] font-mono font-bold text-gray-500 dark:text-[#AAB8C2] bg-gray-200 dark:bg-[#263743] px-1.5 py-0.5 rounded shrink-0">
                              #{i + 1}
                            </span>
                            <input
                              type="text"
                              value={r.name}
                              onChange={(e) => handleRuleNameChange(i, e.target.value)}
                              placeholder="Descriptive rule name"
                              aria-label={`Rule ${i + 1} Name`}
                              className="text-xs font-bold text-[#1A1A1A] dark:text-[#F4F6F8] bg-white dark:bg-[#101820] border border-gray-300 dark:border-[#354651] rounded px-2.5 py-1 w-full max-w-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {/* Activity Scope Selector */}
                            <label className="text-[11px] text-gray-600 dark:text-[#AAB8C2] flex items-center gap-1">
                              <span className="hidden sm:inline">Scope:</span>
                              <select
                                value={r.activity}
                                onChange={(e) => handleRuleActivityChange(i, e.target.value as any)}
                                aria-label={`Rule ${i + 1} Activity Scope`}
                                className="text-xs font-semibold bg-white dark:bg-[#101820] border border-gray-300 dark:border-[#354651] rounded px-2 py-1 text-[#1A1A1A] dark:text-[#F4F6F8]"
                              >
                                <option value="all">ALL ACTIVITIES</option>
                                <option value="pe">PE</option>
                                <option value="break">BREAK</option>
                                <option value="lunch">LUNCH</option>
                                <option value="assembly">ASSEMBLY</option>
                              </select>
                            </label>

                            {/* Enabled Checkbox */}
                            <label className="text-[11px] text-gray-700 dark:text-[#AAB8C2] flex items-center gap-1.5 cursor-pointer ml-1">
                              <input
                                type="checkbox"
                                checked={r.enabled !== false}
                                onChange={(e) => handleRuleToggleEnabled(i, e.target.checked)}
                                aria-label={`Enable Rule ${i + 1}`}
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                              <span className={`font-semibold text-xs ${r.enabled !== false ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400'}`}>
                                {r.enabled !== false ? 'Enabled' : 'Disabled'}
                              </span>
                            </label>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteRule(i)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer ml-1"
                              title="Delete rule"
                              aria-label={`Delete rule ${r.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Configuration Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-end">
                          {/* Metric Selector */}
                          <div>
                            <label className="text-[10px] uppercase font-bold tracking-wider text-gray-500 dark:text-[#AAB8C2] block mb-1">
                              Metric / Factor
                            </label>
                            <select
                              value={r.metric}
                              onChange={(e) => handleRuleMetricChange(i, e.target.value as RuleMetric)}
                              aria-label={`Rule ${i + 1} Metric`}
                              className="w-full text-xs bg-white dark:bg-[#101820] border border-gray-300 dark:border-[#354651] rounded px-2 py-1.5 text-[#1A1A1A] dark:text-[#F4F6F8]"
                            >
                              {SUPPORTED_RULE_METRICS.map((m) => (
                                <option key={m.id} value={m.id} className="dark:bg-[#18242E] dark:text-[#F4F6F8]">
                                  {m.label} ({m.unit})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Operator Selector */}
                          <div>
                            <label className="text-[10px] uppercase font-bold tracking-wider text-gray-500 dark:text-[#AAB8C2] block mb-1">
                              Operator
                            </label>
                            <select
                              value={r.operator}
                              onChange={(e) => handleRuleOperatorChange(i, e.target.value as any)}
                              aria-label={`Rule ${i + 1} Operator`}
                              className="w-full text-xs font-mono font-bold bg-white dark:bg-[#101820] border border-gray-300 dark:border-[#354651] rounded px-2 py-1.5 text-[#1A1A1A] dark:text-[#F4F6F8]"
                            >
                              <option value=">=">&ge; (Greater than or equal)</option>
                              <option value=">">&gt; (Strictly greater than)</option>
                              <option value="<=">&le; (Less than or equal)</option>
                              <option value="<">&lt; (Strictly less than)</option>
                              <option value="==">== (Exact match / Alert)</option>
                            </select>
                          </div>

                          {/* Threshold Input */}
                          <div>
                            <label className="text-[10px] uppercase font-bold tracking-wider text-gray-500 dark:text-[#AAB8C2] block mb-1">
                              Threshold ({r.unit})
                            </label>
                            <div className="flex items-center">
                              <input
                                type="number"
                                step="any"
                                value={r.threshold ?? ''}
                                placeholder="Value"
                                onChange={(e) => {
                                  const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                  handleRuleThresholdChange(i, val);
                                }}
                                aria-label={`Rule ${i + 1} Threshold`}
                                className="w-full text-xs font-mono bg-white dark:bg-[#101820] text-[#1A1A1A] dark:text-[#F4F6F8] border border-gray-300 dark:border-[#354651] rounded-l px-2.5 py-1.5 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="bg-gray-100 dark:bg-[#263743] border border-l-0 border-gray-300 dark:border-[#354651] px-2 py-1.5 text-[11px] text-gray-600 dark:text-[#AAB8C2] font-mono rounded-r shrink-0 min-w-[42px] text-center">
                                {r.unit}
                              </span>
                            </div>
                          </div>

                          {/* Recommended Action */}
                          <div>
                            <label className="text-[10px] uppercase font-bold tracking-wider text-gray-500 dark:text-[#AAB8C2] block mb-1">
                              Action
                            </label>
                            <select
                              value={r.recommendedAction}
                              onChange={(e) => handleRuleActionChange(i, e.target.value as SchoolRecommendedAction)}
                              aria-label={`Rule ${i + 1} Recommended Action`}
                              className="w-full text-xs font-semibold bg-white dark:bg-[#101820] border border-gray-300 dark:border-[#354651] rounded px-2 py-1.5 text-[#1A1A1A] dark:text-[#F4F6F8]"
                            >
                              <option value="continue">Continue</option>
                              <option value="modify">Modify</option>
                              <option value="relocate">Relocate</option>
                              <option value="suspend">Suspend</option>
                              <option value="human_review">Human Review</option>
                            </select>
                          </div>
                        </div>

                        {/* Plain-language preview string */}
                        <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-[#AAB8C2] bg-white/90 dark:bg-[#101820]/90 p-2 rounded border border-gray-200 dark:border-[#354651] flex-wrap gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-gray-500 dark:text-[#AAB8C2]">Condition:</span>
                            <span>IF</span>
                            <span className="font-mono font-bold text-blue-900 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-1 rounded">
                              {r.metric} {r.operator} {r.threshold !== null && !isNaN(r.threshold) ? r.threshold : '—'} {r.unit}
                            </span>
                            <span>during</span>
                            <span className="font-semibold text-purple-900 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-1 rounded">
                              {r.activity.toUpperCase()}
                            </span>
                            <span>THEN</span>
                            <span className={`font-bold px-1.5 py-0.5 rounded uppercase text-[10px] ${
                              r.recommendedAction === 'suspend'
                                ? 'bg-red-100 dark:bg-red-950/50 text-red-900 dark:text-red-300'
                                : r.recommendedAction === 'relocate'
                                ? 'bg-orange-100 dark:bg-orange-950/50 text-orange-900 dark:text-orange-300'
                                : r.recommendedAction === 'modify'
                                ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300'
                                : r.recommendedAction === 'human_review'
                                ? 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-900 dark:text-yellow-300'
                                : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300'
                            }`}>
                              {r.recommendedAction}
                            </span>
                          </div>
                          {r.enabled === false && (
                            <span className="text-[10px] text-gray-400 dark:text-[#AAB8C2] italic">Rule disabled (will not trigger)</span>
                          )}
                        </div>
                      </div>
                    ))}

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleAddRule}
                        data-testid="add-rule-bottom-btn"
                        className="w-full py-2.5 border-2 border-dashed border-gray-300 dark:border-[#354651] hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 rounded-lg text-xs font-semibold text-gray-700 dark:text-[#AAB8C2] hover:text-blue-700 dark:hover:text-blue-400 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Another Activity Rule</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-[#D5D9DF] dark:border-[#354651] bg-gray-50 dark:bg-[#18242E] flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadFictionalDemo}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold cursor-pointer"
                >
                  Load Fictional Demo Preset
                </button>
                <button
                  type="button"
                  onClick={handleResetToUnconfigured}
                  className="px-3 py-2 bg-white dark:bg-[#101820] border border-[#D5D9DF] dark:border-[#354651] hover:bg-gray-100 dark:hover:bg-[#263743] text-gray-700 dark:text-[#F4F6F8] rounded text-xs font-semibold cursor-pointer"
                >
                  Reset to Unconfigured
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPolicyModal(false);
                    setModalValidationError(null);
                  }}
                  className="px-3 py-2 bg-white dark:bg-[#101820] border border-[#D5D9DF] dark:border-[#354651] hover:bg-gray-100 dark:hover:bg-[#263743] text-gray-700 dark:text-[#F4F6F8] rounded text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalRuleEdits}
                  data-testid="save-policy-btn"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
                >
                  Save Policy Rules
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Dedicated Printable A4 Document (Shown ONLY during browser print) */}
      <div className="school-printable-document" data-testid="school-printable-document">
        <SchoolPrintReport
          outlook={currentOutlook}
          selectedAssessment={selectedAssessment}
          selectedActivity={selectedActivity}
          schoolPolicy={schoolPolicy}
          generatedDate={reportGeneratedAt}
        />
      </div>

      {/* On-Screen Print Preview Modal (Provides visual inspection & manual fallback) */}
      {showPrintPreviewModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-preview-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs print:hidden animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#D5D9DF] dark:border-[#354651] flex items-center justify-between bg-slate-50 dark:bg-[#18242E]">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-700 dark:text-sky-400" />
                <div>
                  <h2 id="print-preview-modal-title" className="font-bold text-sm text-[#1A1A1A] dark:text-[#F4F6F8]">
                    School Assessment Report — Print Preview
                  </h2>
                  <p className="text-[11px] text-[#4A4F57] dark:text-[#AAB8C2]">
                    Inspect the generated A4 assessment report before sending to printer or saving as PDF.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSavePdf}
                  data-testid="modal-save-pdf-btn"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save as PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  data-testid="preview-modal-print-btn"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Report</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintPreviewModal(false)}
                  data-testid="close-preview-modal-btn"
                  aria-label="Close preview"
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-[#263743] rounded-md text-[#4A4F57] dark:text-[#AAB8C2] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {printNotice && (
              <div className="mx-4 mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg text-xs text-amber-950 dark:text-amber-200 flex items-center justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                  <span>{printNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPrintNotice(null)}
                  className="text-amber-800 dark:text-amber-400 hover:underline text-xs font-semibold cursor-pointer shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100 dark:bg-[#101820]">
              <div className="bg-white rounded-lg shadow-md border border-slate-300 max-w-[210mm] mx-auto overflow-hidden">
                <SchoolPrintReport
                  outlook={currentOutlook}
                  selectedAssessment={selectedAssessment}
                  selectedActivity={selectedActivity}
                  schoolPolicy={schoolPolicy}
                  generatedDate={reportGeneratedAt}
                />
              </div>
            </div>

            <div className="p-3 border-t border-[#D5D9DF] dark:border-[#354651] bg-slate-50 dark:bg-[#18242E] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[#4A4F57] dark:text-[#AAB8C2]">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#1A1A1A] dark:text-[#F4F6F8]">Actions:</span>
                <span>Click &quot;Save as PDF&quot; to download the file directly, or use &quot;Print Report&quot; / Ctrl+P (Cmd+P) to print.</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintPreviewModal(false)}
                data-testid="footer-close-preview-btn"
                className="px-3 py-1.5 bg-gray-200 dark:bg-[#263743] hover:bg-gray-300 dark:hover:bg-[#354651] text-[#1A1A1A] dark:text-[#F4F6F8] rounded font-semibold cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
