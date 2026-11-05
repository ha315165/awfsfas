/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  ExternalLink,
  FileCheck,
  FileText,
  HelpCircle,
  Info,
  Layers,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Terminal,
} from 'lucide-react';
import { APP_CONFIG, CITIES } from '../config.ts';
import { STRINGS } from '../strings.ts';
import {
  CityOutlook,
  ModelFileConfig,
  RawCityData,
  RawHourlyVariables,
  SchoolPolicyConfig,
  WorkbenchEvaluationOutput,
} from '../types.ts';
import { getCityApiUrls } from '../dataService.ts';
import {
  calculateConfidence,
  calculateHourlyBaseline,
  predictRisk,
  scoreToCategory,
} from '../riskEngine.ts';

interface TestViewProps {
  outlooks: Record<string, CityOutlook>;
  rawCityData: Record<string, RawCityData>;
  selectedCityId: string;
  onSelectCity: (id: string) => void;
  onDataRefresh: (force: boolean) => void;
  activeModel: ModelFileConfig | null;
  onSetActiveModel: (model: ModelFileConfig | null) => void;
  schoolPolicy?: SchoolPolicyConfig | null;
  onSendToAccuracyChecker?: (output: WorkbenchEvaluationOutput) => void;
}

export interface SelfCheckResult {
  id: number;
  title: string;
  category: 'Calibration' | 'Robustness' | 'Thresholds' | 'Architecture';
  purpose: string;
  inputsDescription: string;
  expectedBehavior: string;
  actualResult: string;
  passed: boolean;
  isSynthetic: boolean;
  executedAt: string;
}

export const TestView: React.FC<TestViewProps> = ({
  outlooks,
  rawCityData,
  selectedCityId,
  onSelectCity,
  activeModel,
  schoolPolicy = null,
  onSendToAccuracyChecker = () => {},
}) => {
  const currentOutlook = outlooks[selectedCityId] || outlooks[APP_CONFIG.defaultSelectedCityId];

  // Active view tab
  const [activeTab, setActiveTab] = useState<'verification' | 'scenarios' | 'provenance'>('verification');

  // Automated self-checks state
  const [selfCheckResults, setSelfCheckResults] = useState<SelfCheckResult[]>([]);
  const [lastRunTime, setLastRunTime] = useState<string>('');

  // Expandable sections - collapsed by default
  const [expandedCheckId, setExpandedCheckId] = useState<number | null>(null);
  const [showScenariosDetails, setShowScenariosDetails] = useState<boolean>(false);
  const [showTelemetryTable, setShowTelemetryTable] = useState<boolean>(false);
  const [showProvenanceLimitations, setShowProvenanceLimitations] = useState<boolean>(false);

  // Execute the 6 deterministic self-checks
  const runSelfChecks = () => {
    const runTimestamp = new Date().toLocaleTimeString();
    const checks: SelfCheckResult[] = [];

    // Check 1: Low values baseline calibration
    const lowRaw: RawHourlyVariables = {
      time: '2026-10-20T12:00',
      dust: 20,
      pm10: 50,
      wind_gusts_10m: 25,
      wind_speed_10m: 15,
      aerosol_optical_depth: 0.2,
      visibility: 10000,
      relative_humidity_2m: 60,
      pm2_5: 10,
      temperature_2m: 28,
      wind_direction_10m: 300,
    };
    const res1 = calculateHourlyBaseline(0, lowRaw, APP_CONFIG);
    const pass1 = res1.baselineScore === 0 && res1.category === 'Low';
    checks.push({
      id: 1,
      title: 'Low Values Baseline Calibration',
      category: 'Calibration',
      purpose: 'Verify that benign particulate and calm meteorological values produce a minimum risk score (0) and Low category.',
      inputsDescription: 'Dust: 20 µg/m³, PM10: 50 µg/m³, Wind Gust: 25 km/h, Wind Speed: 15 km/h, AOD: 0.2, Visibility: 10,000m, RH: 60%, Temp: 28°C',
      expectedBehavior: 'Score = 0, Category = Low',
      actualResult: `Score = ${res1.baselineScore}, Category = ${res1.category}`,
      passed: pass1,
      isSynthetic: true,
      executedAt: runTimestamp,
    });

    // Check 2: High values baseline calibration
    const highRaw: RawHourlyVariables = {
      time: '2026-10-20T12:00',
      dust: 300,
      pm10: 400,
      wind_gusts_10m: 70,
      wind_speed_10m: 50,
      aerosol_optical_depth: 1.5,
      visibility: 1000,
      relative_humidity_2m: 15,
      pm2_5: 100,
      temperature_2m: 40,
      wind_direction_10m: 320,
    };
    const res2 = calculateHourlyBaseline(0, highRaw, APP_CONFIG);
    const pass2 = res2.baselineScore === 100 && res2.category === 'Very High';
    checks.push({
      id: 2,
      title: 'High Values Baseline Calibration',
      category: 'Calibration',
      purpose: 'Verify that hazardous dust concentrations and severe gale winds produce the ceiling risk score (100) and Very High category.',
      inputsDescription: 'Dust: 300 µg/m³, PM10: 400 µg/m³, Wind Gust: 70 km/h, Wind Speed: 50 km/h, AOD: 1.5, Visibility: 1,000m, RH: 15%, Temp: 40°C',
      expectedBehavior: 'Score = 100, Category = Very High',
      actualResult: `Score = ${res2.baselineScore}, Category = ${res2.category}`,
      passed: pass2,
      isSynthetic: true,
      executedAt: runTimestamp,
    });

    // Check 3: Missing key particle confidence degradation
    const missingDustRaw: RawHourlyVariables = {
      time: '2026-10-20T12:00',
      dust: null,
      pm10: 120,
      wind_gusts_10m: 35,
      wind_speed_10m: 20,
      aerosol_optical_depth: 0.4,
      visibility: 8000,
      relative_humidity_2m: 40,
      pm2_5: 25,
      temperature_2m: 30,
      wind_direction_10m: 310,
    };
    const hourly3 = [calculateHourlyBaseline(0, missingDustRaw, APP_CONFIG)];
    const conf3 = calculateConfidence(hourly3, 0, true, 0.5, true, APP_CONFIG);
    const pass3 = conf3.confidence === 'Low';
    checks.push({
      id: 3,
      title: 'Missing Particulate Telemetry Resilience',
      category: 'Robustness',
      purpose: 'Verify that when core dust aerosol telemetry is null or unavailable, forecast confidence degrades safely to Low.',
      inputsDescription: 'Dust: null (missing), PM10: 120 µg/m³, Wind Gust: 35 km/h, Wind Speed: 20 km/h, AOD: 0.4, Visibility: 8,000m',
      expectedBehavior: 'Confidence = Low, Reason flags missing primary dust variable',
      actualResult: `Confidence = ${conf3.confidence}, Reason: ${conf3.reasons[0] || 'Flagged'}`,
      passed: pass3,
      isSynthetic: true,
      executedAt: runTimestamp,
    });

    // Check 4: Cutoff boundary mapping & confidence penalty
    const cutoffsPassed =
      scoreToCategory(25) === 'Moderate' &&
      scoreToCategory(50) === 'High' &&
      scoreToCategory(75) === 'Very High';
    // Calibrate all 7 atmospheric features to sub-score 25.0 so the resulting weighted sum is exactly 25.0
    // Dust: 20 + 0.25*(300-20) = 90
    // PM10: 50 + 0.25*(400-50) = 137.5
    // Wind gusts: 25 + 0.25*(70-25) = 36.25
    // Wind speed: 15 + 0.25*(50-15) = 23.75
    // AOD: 0.2 + 0.25*(1.5-0.2) = 0.525
    // Visibility (reversed): 10000 - 0.25*(10000-1000) = 7750
    // RH (reversed): 60 - 0.25*(60-15) = 48.75
    const cutoffRaw: RawHourlyVariables = {
      time: '2026-10-20T12:00',
      dust: 90,
      pm10: 137.5,
      wind_gusts_10m: 36.25,
      wind_speed_10m: 23.75,
      aerosol_optical_depth: 0.525,
      visibility: 7750,
      relative_humidity_2m: 48.75,
      pm2_5: 20,
      temperature_2m: 30,
      wind_direction_10m: 300,
    };
    const hourly4 = [calculateHourlyBaseline(0, cutoffRaw, APP_CONFIG)];
    const conf4 = calculateConfidence(hourly4, 0, true, 0.5, true, APP_CONFIG);
    const pass4 = cutoffsPassed && hourly4[0].baselineScore === 25 && conf4.reasons.some((r) => r.includes('cutoff'));
    checks.push({
      id: 4,
      title: 'Cutoff Boundary Mapping & Ambiguity Penalty',
      category: 'Thresholds',
      purpose: 'Verify exact threshold boundaries (25, 50, 75) and confirm that proximity to a category cutoff penalizes forecast confidence.',
      inputsDescription: 'All 7 atmospheric features set to exact sub-score 25.0 (Dust: 90, PM10: 137.5, Gusts: 36.25 km/h, Wind: 23.75 km/h, AOD: 0.525, Vis: 7,750m, RH: 48.75%) -> Baseline Score 25.0',
      expectedBehavior: 'Score 25 -> Moderate, Score 50 -> High, Score 75 -> Very High, Confidence penalty applied',
      actualResult: `Cutoffs: 25->${scoreToCategory(25)}, 50->${scoreToCategory(50)}, 75->${scoreToCategory(75)}, Baseline: ${hourly4[0].baselineScore}, Penalty active: ${conf4.reasons.some((r) => r.includes('cutoff')) ? 'Yes' : 'No'}`,
      passed: pass4,
      isSynthetic: true,
      executedAt: runTimestamp,
    });

    // Check 5: Particle cap suppression of false wind alarms
    const strongWindCleanRaw: RawHourlyVariables = {
      time: '2026-10-20T12:00',
      dust: 20,
      pm10: 50,
      wind_gusts_10m: 90,
      wind_speed_10m: 70,
      aerosol_optical_depth: 1.5,
      visibility: 1000,
      relative_humidity_2m: 15,
      pm2_5: 5,
      temperature_2m: 25,
      wind_direction_10m: 300,
    };
    const res5 = calculateHourlyBaseline(0, strongWindCleanRaw, APP_CONFIG);
    const pass5 = res5.finalScore <= 24 && res5.category === 'Low';
    checks.push({
      id: 5,
      title: 'Particle Cap False-Alarm Suppression',
      category: 'Robustness',
      purpose: 'Verify that gale-force wind gusts (90 km/h) over clean or maritime air cannot elevate risk to High without airborne particles.',
      inputsDescription: 'Wind Gust: 90 km/h, Wind Speed: 70 km/h, but Clean Dust: 20 µg/m³, Clean PM10: 50 µg/m³',
      expectedBehavior: 'Particle cap limits risk to Low (score <= 24)',
      actualResult: `Final Score = ${res5.finalScore} (Capped: ${res5.isParticleCapped ? 'True' : 'False'}), Category = ${res5.category}`,
      passed: pass5,
      isSynthetic: true,
      executedAt: runTimestamp,
    });

    // Check 6: Prediction slot fallback architecture
    const sampleRaw: RawHourlyVariables = {
      time: '2026-10-20T12:00',
      dust: 120,
      pm10: 180,
      wind_gusts_10m: 40,
      wind_speed_10m: 25,
      aerosol_optical_depth: 0.5,
      visibility: 6000,
      relative_humidity_2m: 30,
      pm2_5: 35,
      temperature_2m: 32,
      wind_direction_10m: 310,
    };
    const baseRes6 = calculateHourlyBaseline(0, sampleRaw, APP_CONFIG);
    const predRes6 = predictRisk(0, sampleRaw, null, APP_CONFIG);
    const pass6 = predRes6.finalScore === baseRes6.baselineScore && predRes6.category === baseRes6.baselineCategory;
    checks.push({
      id: 6,
      title: 'Prediction Slot Fallback Architecture',
      category: 'Architecture',
      purpose: 'Verify that when no external statistical model is active, the prediction slot gracefully falls back to the deterministic baseline.',
      inputsDescription: 'Sample multi-factor vector evaluated with activeModel = null',
      expectedBehavior: 'Predicted score and category match baseline calculation exactly',
      actualResult: `Baseline: ${baseRes6.baselineScore} (${baseRes6.baselineCategory}) === Fallback: ${predRes6.finalScore} (${predRes6.category})`,
      passed: pass6,
      isSynthetic: true,
      executedAt: runTimestamp,
    });

    setSelfCheckResults(checks);
    setLastRunTime(runTimestamp);
  };

  // Run self-checks on initial mount
  useEffect(() => {
    runSelfChecks();
  }, []);

  const { airQualityUrl, weatherUrl } = currentOutlook
    ? getCityApiUrls(currentOutlook.city)
    : { airQualityUrl: '', weatherUrl: '' };

  const allChecksPassed = selfCheckResults.length > 0 && selfCheckResults.every((c) => c.passed);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header & Transparency Notice */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-[#244C3B] dark:text-[#F4F6F8] tracking-tight">
                {STRINGS.testView.title}
              </h1>
              <span className="bg-[#E8F0E7] text-[#244C3B] border border-[#C5D9C5] dark:bg-[#1B3A2D] dark:text-[#A7F3D0] dark:border-[#2D5A46] rounded-full px-2.5 py-0.5 text-[11px] font-bold">
                Public Transparency
              </span>
            </div>
            <p className="text-xs text-[#5A453A] dark:text-[#AAB8C2] mt-1 font-medium">
              {STRINGS.testView.subtitle}
            </p>
          </div>

          {/* City Selector for live data inspection */}
          <div className="flex items-center gap-2 bg-[#F7F1E8] dark:bg-[#18242E] px-3 py-1.5 rounded-xl border border-[#DFCBB3] dark:border-[#354651]">
            <label htmlFor="test-city-select" className="text-xs font-bold text-[#244C3B] dark:text-[#F4F6F8]">
              Inspect Station:
            </label>
            <select
              id="test-city-select"
              value={selectedCityId}
              onChange={(e) => onSelectCity(e.target.value)}
              className="border-0 bg-transparent text-xs font-bold text-[#713F2B] dark:text-[#E8874A] focus:outline-none cursor-pointer dark:bg-[#18242E]"
            >
              {CITIES.map((c) => (
                <option key={c.id} value={c.id} className="dark:bg-[#18242E] dark:text-[#F4F6F8]">
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Public Transparency Banner */}
        <div className="p-4 bg-[#F7F1E8] dark:bg-[#18242E] border border-[#DFCBB3] dark:border-[#354651] rounded-2xl flex items-start gap-3">
          <Info className="w-5 h-5 text-[#E8874A] shrink-0 mt-0.5" />
          <div className="text-xs text-[#2D221C] dark:text-[#F4F6F8] space-y-1">
            <p className="font-bold text-[#244C3B] dark:text-[#F4F6F8]">{STRINGS.testView.transparencyNotice}</p>
            <p className="text-[#5A453A] dark:text-[#AAB8C2] text-[11px] leading-relaxed">
              To preserve scientific integrity, this public transparency view strictly separates deterministic unit tests, synthetic boundary benchmarks, and historical hindcast reanalysis. Visitors cannot upload custom models or modify internal server state.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#DFCBB3] dark:border-[#354651] gap-2 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('verification')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'verification'
              ? 'border-[#E8874A] text-[#244C3B] dark:text-[#F4F6F8] bg-[#FFFDF8] dark:bg-[#1E2D38]'
              : 'border-transparent text-[#8C6D58] dark:text-[#AAB8C2] hover:text-[#244C3B] dark:hover:text-[#F4F6F8] hover:bg-[#F7F1E8]/50 dark:hover:bg-[#18242E]/50'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-[#E8874A]" />
          <span>Deterministic Verification Checks</span>
          {selfCheckResults.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#E8F0E7] text-[#244C3B] dark:bg-[#1B3A2D] dark:text-[#A7F3D0] font-bold">
              {selfCheckResults.filter((c) => c.passed).length}/{selfCheckResults.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scenarios')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'scenarios'
              ? 'border-[#E8874A] text-[#244C3B] dark:text-[#F4F6F8] bg-[#FFFDF8] dark:bg-[#1E2D38]'
              : 'border-transparent text-[#8C6D58] dark:text-[#AAB8C2] hover:text-[#244C3B] dark:hover:text-[#F4F6F8] hover:bg-[#F7F1E8]/50 dark:hover:bg-[#18242E]/50'
          }`}
        >
          <BookOpen className="w-4 h-4 text-[#244C3B] dark:text-[#E8874A]" />
          <span>Test Scenarios & Model Architecture</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('provenance')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'provenance'
              ? 'border-[#E8874A] text-[#244C3B] dark:text-[#F4F6F8] bg-[#FFFDF8] dark:bg-[#1E2D38]'
              : 'border-transparent text-[#8C6D58] dark:text-[#AAB8C2] hover:text-[#244C3B] dark:hover:text-[#F4F6F8] hover:bg-[#F7F1E8]/50 dark:hover:bg-[#18242E]/50'
          }`}
        >
          <Database className="w-4 h-4 text-[#713F2B] dark:text-[#E8874A]" />
          <span>Data Provenance & Live Station Feed</span>
        </button>
      </div>

      {/* Tab 1: Deterministic Verification Checks */}
      {activeTab === 'verification' && (
        <div className="space-y-6">
          {/* Summary Control Bar */}
          <div className="p-5 bg-[#FFFDF8] dark:bg-[#1E2D38] border border-[#DFCBB3] dark:border-[#354651] rounded-2xl shadow-xs flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                allChecksPassed ? 'bg-[#E8F0E7] text-[#244C3B] dark:bg-[#1B3A2D] dark:text-[#A7F3D0]' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
              }`}>
                {allChecksPassed ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-sm font-black text-[#244C3B] dark:text-[#F4F6F8]">
                  {allChecksPassed ? 'All 6 Verification Self-Checks Passed' : 'Verification Checks Incomplete'}
                </h2>
                <p className="text-xs text-[#8C6D58] dark:text-[#AAB8C2]">
                  Last executed in browser: <span className="font-mono font-bold">{lastRunTime || 'On page load'}</span> • 100% deterministic test suite
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={runSelfChecks}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#244C3B] hover:bg-[#1B3A2D] dark:bg-[#E8874A] dark:hover:bg-[#d0753b] text-white dark:text-[#101820] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#E8874A] dark:text-[#101820]" />
              <span>{STRINGS.testView.runChecks}</span>
            </button>
          </div>

          {/* Test Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selfCheckResults.map((check) => {
              const isExpanded = expandedCheckId === check.id;
              return (
                <div
                  key={check.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    check.passed
                      ? 'bg-[#FFFDF8] dark:bg-[#1E2D38] border-[#DFCBB3] dark:border-[#354651] shadow-xs'
                      : 'bg-red-50/50 dark:bg-red-950/20 border-red-300 dark:border-red-800 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F7F1E8] dark:bg-[#18242E] text-[#713F2B] dark:text-[#E8874A] border border-[#DFCBB3] dark:border-[#354651]">
                          Test #{check.id}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#E8F0E7] dark:bg-[#1B3A2D] text-[#244C3B] dark:text-[#A7F3D0] border border-[#C5D9C5] dark:border-[#2D5A46]">
                          {check.category}
                        </span>
                        {check.isSynthetic && (
                          <span className="text-[10px] font-semibold text-[#8C6D58] dark:text-[#AAB8C2]">
                            (Synthetic Benchmark)
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-black text-[#244C3B] dark:text-[#F4F6F8]">{check.title}</h3>
                    </div>

                    <span
                      className={`text-xs font-black px-2.5 py-1 rounded-lg border flex items-center gap-1 shrink-0 ${
                        check.passed
                          ? 'bg-[#E8F0E7] text-[#244C3B] border-[#C5D9C5] dark:bg-[#1B3A2D] dark:text-[#A7F3D0] dark:border-[#2D5A46]'
                          : 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800'
                      }`}
                    >
                      {check.passed ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                          <span>PASS</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-red-700 dark:text-red-400" />
                          <span>FAIL</span>
                        </>
                      )}
                    </span>
                  </div>

                  <p className="text-xs text-[#5A453A] dark:text-[#AAB8C2] leading-relaxed mb-3">
                    {check.purpose}
                  </p>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setExpandedCheckId(isExpanded ? null : check.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`test-check-details-${check.id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#713F2B] dark:text-[#E8874A] hover:text-[#244C3B] dark:hover:text-[#F4F6F8] bg-[#F7F1E8] dark:bg-[#18242E] hover:bg-[#EFE6DC] dark:hover:bg-[#263743] px-2.5 py-1 rounded-lg border border-[#DFCBB3] dark:border-[#354651] transition-colors cursor-pointer mb-2"
                    >
                      <span>{isExpanded ? 'Hide Test Inputs & Result' : 'View Test Inputs & Result Details'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {isExpanded && (
                      <div id={`test-check-details-${check.id}`} className="space-y-2 text-[11px] bg-[#F7F1E8] dark:bg-[#18242E] p-3 rounded-xl border border-[#DFCBB3] dark:border-[#354651] font-mono">
                        <div>
                          <span className="font-bold text-[#8C6D58] dark:text-[#AAB8C2] block">Test Inputs:</span>
                          <span className="text-[#2D221C] dark:text-[#F4F6F8] break-words">{check.inputsDescription}</span>
                        </div>
                        <div>
                          <span className="font-bold text-[#8C6D58] dark:text-[#AAB8C2] block">Expected Behavior:</span>
                          <span className="text-[#244C3B] dark:text-[#A7F3D0]">{check.expectedBehavior}</span>
                        </div>
                        <div>
                          <span className="font-bold text-[#8C6D58] dark:text-[#AAB8C2] block">Actual Result:</span>
                          <span className="font-bold text-[#713F2B] dark:text-[#E8874A]">{check.actualResult}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Synthetic Disclosure Note */}
          <div className="p-4 bg-[#FBEBDD] dark:bg-[#2A201A] border border-[#F5DDC9] dark:border-[#423126] rounded-xl text-xs text-[#713F2B] dark:text-[#E8874A] flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-[#E8874A] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Testing Distinction: </strong>
              These automated verification checks are deterministic unit tests using synthetic input boundary vectors. They verify that the scoring math, safety caps, and confidence penalties behave as specified by the physics rules. They are <em>not</em> trained machine-learning models and do not substitute for empirical multi-season field validation.
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Test Scenarios & Model Architecture */}
      {activeTab === 'scenarios' && (
        <div className="space-y-6">
          <div className="bg-[#FFFDF8] dark:bg-[#1E2D38] border border-[#DFCBB3] dark:border-[#354651] rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-base font-black text-[#244C3B] dark:text-[#F4F6F8] flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#E8874A]" />
              <span>Model Architecture &amp; Evaluation Pathways</span>
            </h2>
            <p className="text-xs text-[#5A453A] dark:text-[#AAB8C2] leading-relaxed">
              DustWatch employs a transparent dual-path architecture designed to avoid "black box" decisions while supporting statistical evaluation:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-[#E8F0E7] dark:bg-[#1B3A2D] border border-[#C5D9C5] dark:border-[#2D5A46] rounded-xl space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#244C3B] dark:text-[#A7F3D0] bg-white dark:bg-[#101820] px-2 py-0.5 rounded border border-[#C5D9C5] dark:border-[#2D5A46]">
                  Operational Baseline
                </span>
                <h3 className="text-sm font-bold text-[#244C3B] dark:text-[#F4F6F8]">Deterministic Weighted Rule Engine</h3>
                <p className="text-xs text-[#2D221C] dark:text-[#F4F6F8] leading-relaxed">
                  Active by default across all screens. Computes subscores across 7 meteorological variables with calibrated weightings (PM10: 25%, Dust: 20%, Wind Gusts: 15%, etc.) and enforces a physical particle cap ceiling (≤ 24) to eliminate false alarms during high-wind clean maritime days.
                </p>
              </div>

              <div className="p-4 bg-[#FBEBDD] dark:bg-[#2A201A] border border-[#F5DDC9] dark:border-[#423126] rounded-xl space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#713F2B] dark:text-[#E8874A] bg-white dark:bg-[#101820] px-2 py-0.5 rounded border border-[#F5DDC9] dark:border-[#423126]">
                  Research Evaluation Slot
                </span>
                <h3 className="text-sm font-bold text-[#713F2B] dark:text-[#E8874A]">Statistical Logistic Model Slot</h3>
                <p className="text-xs text-[#2D221C] dark:text-[#F4F6F8] leading-relaxed">
                  An architectural slot designed to evaluate offline-trained logistic regression models against historical event logs. When no model file is loaded, the pipeline deterministically falls back to the baseline rule score to ensure zero disruption.
                </p>
              </div>
            </div>
          </div>

          {/* Test Scenarios Explained */}
          <div className="bg-[#FFFDF8] dark:bg-[#1E2D38] border border-[#DFCBB3] dark:border-[#354651] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowScenariosDetails(!showScenariosDetails)}
                aria-expanded={showScenariosDetails}
                aria-controls="test-view-scenarios-details"
                className="text-left font-black text-[#244C3B] dark:text-[#F4F6F8] hover:text-[#713F2B] dark:hover:text-[#E8874A] text-base flex items-center gap-2 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#713F2B] rounded p-0.5"
              >
                <FileCheck className="w-5 h-5 text-[#713F2B] dark:text-[#E8874A] shrink-0" />
                <span>Standard Evaluation Scenarios</span>
              </button>
              <button
                type="button"
                onClick={() => setShowScenariosDetails(!showScenariosDetails)}
                aria-expanded={showScenariosDetails}
                aria-controls="test-view-scenarios-details"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#713F2B] dark:text-[#E8874A] hover:text-[#244C3B] dark:hover:text-[#F4F6F8] bg-[#F7F1E8] dark:bg-[#18242E] hover:bg-[#EFE6DC] dark:hover:bg-[#263743] px-2.5 py-1 rounded-xl border border-[#DFCBB3] dark:border-[#354651] transition-colors cursor-pointer"
              >
                <span>{showScenariosDetails ? 'Hide Scenario Details' : 'View All 4 Scenario Inputs & Expected Results'}</span>
                {showScenariosDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-xs text-[#5A453A] dark:text-[#AAB8C2] leading-relaxed">
              The platform is tested against four distinct atmospheric scenarios representing both common desert dynamics and critical edge cases:
            </p>

            {showScenariosDetails && (
              <div id="test-view-scenarios-details" className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
                <div className="p-4 bg-[#F7F1E8] dark:bg-[#18242E] border border-[#DFCBB3] dark:border-[#354651] rounded-xl space-y-1.5">
                  <span className="font-bold text-[#713F2B] dark:text-[#E8874A]">Scenario A: Severe Desert Shamal</span>
                  <p className="text-[#5A453A] dark:text-[#AAB8C2] text-[11px] leading-relaxed">
                    <strong>Inputs: </strong>Sustained northerly winds (&gt; 45 km/h), gusts &gt; 65 km/h, PM10 &gt; 350 µg/m³, AOD &gt; 1.2, relative humidity &lt; 20%.
                  </p>
                  <p className="text-[#244C3B] dark:text-[#A7F3D0] font-semibold text-[11px]">
                    <strong>Expected Result: </strong>High or Very High risk across inland corridors with high confidence.
                  </p>
                </div>

                <div className="p-4 bg-[#F7F1E8] dark:bg-[#18242E] border border-[#DFCBB3] dark:border-[#354651] rounded-xl space-y-1.5">
                  <span className="font-bold text-[#713F2B] dark:text-[#E8874A]">Scenario B: Clean High-Wind Maritime Gale</span>
                  <p className="text-[#5A453A] dark:text-[#AAB8C2] text-[11px] leading-relaxed">
                    <strong>Inputs: </strong>Coastal wind gusts &gt; 80 km/h, but PM10 &lt; 60 µg/m³ and dust aerosol &lt; 25 µg/m³ (clean sea breeze).
                  </p>
                  <p className="text-[#244C3B] dark:text-[#A7F3D0] font-semibold text-[11px]">
                    <strong>Expected Result: </strong>Particle cap triggers. Risk remains strictly Low (score ≤ 24) to avoid false closures.
                  </p>
                </div>

                <div className="p-4 bg-[#F7F1E8] dark:bg-[#18242E] border border-[#DFCBB3] dark:border-[#354651] rounded-xl space-y-1.5">
                  <span className="font-bold text-[#713F2B] dark:text-[#E8874A]">Scenario C: Sensor Outage / Incomplete Telemetry</span>
                  <p className="text-[#5A453A] dark:text-[#AAB8C2] text-[11px] leading-relaxed">
                    <strong>Inputs: </strong>Particulate fields (dust or PM10) are null or missing due to upstream feed disruption.
                  </p>
                  <p className="text-[#244C3B] dark:text-[#A7F3D0] font-semibold text-[11px]">
                    <strong>Expected Result: </strong>System degrades confidence to Low, labels data missing, and alerts users rather than assuming 0.
                  </p>
                </div>

                <div className="p-4 bg-[#F7F1E8] dark:bg-[#18242E] border border-[#DFCBB3] dark:border-[#354651] rounded-xl space-y-1.5">
                  <span className="font-bold text-[#713F2B] dark:text-[#E8874A]">Scenario D: Boundary Near-Cutoff Fluctuation</span>
                  <p className="text-[#5A453A] dark:text-[#AAB8C2] text-[11px] leading-relaxed">
                    <strong>Inputs: </strong>Composite score within ± 2 points of a critical threshold (e.g., 24.8 vs 25.0).
                  </p>
                  <p className="text-[#244C3B] dark:text-[#A7F3D0] font-semibold text-[11px]">
                    <strong>Expected Result: </strong>Maps conservatively into the higher hazard category and flags a cutoff confidence penalty.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Data Provenance & Live Station Feed */}
      {activeTab === 'provenance' && (
        <div className="space-y-6">
          <div className="bg-[#FFFDF8] dark:bg-[#1E2D38] border border-[#DFCBB3] dark:border-[#354651] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-black text-[#244C3B] dark:text-[#F4F6F8]">
                {STRINGS.testView.diagnosticsTitle}: {currentOutlook.city.name}
              </h2>
              <span className="font-mono text-xs font-bold text-[#713F2B] dark:text-[#E8874A] bg-[#F7F1E8] dark:bg-[#18242E] px-3 py-1 rounded-xl border border-[#DFCBB3] dark:border-[#354651]">
                {currentOutlook.dataSourceType.toUpperCase()}
              </span>
            </div>

            <div className="text-xs text-[#5A453A] dark:text-[#AAB8C2] space-y-2 pt-1 border-t border-[#DFCBB3] dark:border-[#354651]">
              <p>
                <strong>Observation Coordinates: </strong>
                <span className="font-mono text-[#2D221C] dark:text-[#F4F6F8]">{currentOutlook.city.latitude.toFixed(4)}°N, {currentOutlook.city.longitude.toFixed(4)}°E</span>
              </p>
              <p className="break-all font-mono text-[11px] text-[#5A453A] dark:text-[#AAB8C2]">
                <strong>Air Quality CAMS Feed URL: </strong>
                <a
                  href={airQualityUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[#713F2B] dark:text-[#E8874A] hover:text-[#E8874A] dark:hover:text-[#FFA970] inline-flex items-center gap-1"
                >
                  <span>{airQualityUrl}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
              <p className="break-all font-mono text-[11px] text-[#5A453A] dark:text-[#AAB8C2]">
                <strong>Weather ECMWF Feed URL: </strong>
                <a
                  href={weatherUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[#713F2B] dark:text-[#E8874A] hover:text-[#E8874A] dark:hover:text-[#FFA970] inline-flex items-center gap-1"
                >
                  <span>{weatherUrl}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>

            {/* 12-hour hourly telemetry table */}
            <div className="pt-2">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowTelemetryTable(!showTelemetryTable)}
                  aria-expanded={showTelemetryTable}
                  aria-controls="test-view-telemetry-table"
                  className="text-left font-bold text-xs text-[#244C3B] dark:text-[#F4F6F8] hover:text-[#713F2B] dark:hover:text-[#E8874A] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#713F2B] rounded p-0.5"
                >
                  12-Hour Hourly Telemetry Breakdown ({currentOutlook.hourlyResults.length} Hours)
                </button>
                <button
                  type="button"
                  onClick={() => setShowTelemetryTable(!showTelemetryTable)}
                  aria-expanded={showTelemetryTable}
                  aria-controls="test-view-telemetry-table"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#713F2B] dark:text-[#E8874A] hover:text-[#244C3B] dark:hover:text-[#F4F6F8] bg-[#F7F1E8] dark:bg-[#18242E] hover:bg-[#EFE6DC] dark:hover:bg-[#263743] px-2.5 py-1 rounded-xl border border-[#DFCBB3] dark:border-[#354651] transition-colors cursor-pointer"
                >
                  <span>{showTelemetryTable ? 'Hide 12-Hour Telemetry Table' : 'View 12-Hour Raw Telemetry Table'}</span>
                  {showTelemetryTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showTelemetryTable && (
                <div id="test-view-telemetry-table" className="overflow-x-auto border border-[#DFCBB3] dark:border-[#354651] rounded-xl mt-2">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-[#F7F1E8] dark:bg-[#18242E] border-b border-[#DFCBB3] dark:border-[#354651] text-[#244C3B] dark:text-[#F4F6F8] font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Hour</th>
                        <th className="py-2 px-2">Dust (µg/m³)</th>
                        <th className="py-2 px-2">PM10 (µg/m³)</th>
                        <th className="py-2 px-2">Wind Gust (km/h)</th>
                        <th className="py-2 px-2">Wind Speed (km/h)</th>
                        <th className="py-2 px-2">AOD</th>
                        <th className="py-2 px-2">Visibility (m)</th>
                        <th className="py-2 px-2">Humidity (%)</th>
                        <th className="py-2 px-2 font-bold">Baseline Score</th>
                        <th className="py-2 px-2 font-bold">Risk Level</th>
                        <th className="py-2 px-2">Missing Flags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DFCBB3] dark:divide-[#354651] bg-[#FFFDF8] dark:bg-[#1E2D38]">
                      {currentOutlook.hourlyResults.map((h) => {
                        const isDustMissing = h.subScores.dust?.rawValue === null;
                        const isPm10Missing = h.subScores.pm10?.rawValue === null;

                        return (
                          <tr key={h.hourIndex} className="hover:bg-[#F7F1E8]/50 dark:hover:bg-[#18242E]/50">
                            <td className="py-2.5 px-3 font-bold font-mono text-[#244C3B] dark:text-[#F4F6F8]">{h.displayHour}</td>
                            <td className={`py-2 px-2 font-mono ${isDustMissing ? 'text-red-700 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950/40' : 'text-[#2D221C] dark:text-[#F4F6F8]'}`}>
                              {h.subScores.dust?.rawValue ?? 'NULL'}
                            </td>
                            <td className={`py-2 px-2 font-mono ${isPm10Missing ? 'text-red-700 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950/40' : 'text-[#2D221C] dark:text-[#F4F6F8]'}`}>
                              {h.subScores.pm10?.rawValue ?? 'NULL'}
                            </td>
                            <td className="py-2 px-2 font-mono text-[#2D221C] dark:text-[#F4F6F8]">{h.subScores.wind_gusts_10m?.rawValue ?? 'NULL'}</td>
                            <td className="py-2 px-2 font-mono text-[#2D221C] dark:text-[#F4F6F8]">{h.subScores.wind_speed_10m?.rawValue ?? 'NULL'}</td>
                            <td className="py-2 px-2 font-mono text-[#2D221C] dark:text-[#F4F6F8]">{h.subScores.aerosol_optical_depth?.rawValue ?? 'NULL'}</td>
                            <td className="py-2 px-2 font-mono text-[#2D221C] dark:text-[#F4F6F8]">{h.subScores.visibility?.rawValue ?? 'NULL'}</td>
                            <td className="py-2 px-2 font-mono text-[#2D221C] dark:text-[#F4F6F8]">{h.subScores.relative_humidity_2m?.rawValue ?? 'NULL'}</td>
                            <td className="py-2 px-2 font-mono font-bold text-[#244C3B] dark:text-[#A7F3D0]">
                              {Math.round(h.baselineScore)} ({h.baselineCategory})
                            </td>
                            <td className="py-2 px-2 font-bold">
                              <span
                                style={{
                                  backgroundColor: APP_CONFIG.colors[h.category].badgeBg,
                                  color: APP_CONFIG.colors[h.category].badgeText,
                                }}
                                className="px-2 py-0.5 rounded text-[10px] inline-block font-semibold"
                              >
                                {h.category}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-red-700 dark:text-red-400 font-mono text-[10px]">
                              {h.missingVariables.length > 0 ? h.missingVariables.join(', ') : 'None'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Validation Transparency & Limitations Card */}
          <div className="bg-[#FFFDF8] dark:bg-[#1E2D38] border border-[#DFCBB3] dark:border-[#354651] rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowProvenanceLimitations(!showProvenanceLimitations)}
                aria-expanded={showProvenanceLimitations}
                aria-controls="test-view-limitations-list"
                className="text-left font-black text-sm text-[#244C3B] dark:text-[#F4F6F8] hover:text-[#713F2B] dark:hover:text-[#E8874A] flex items-center gap-2 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#713F2B] rounded p-0.5"
              >
                <Shield className="w-4 h-4 text-[#713F2B] dark:text-[#E8874A] shrink-0" />
                <span>Scientific Limitations &amp; Data Provenance</span>
              </button>
              <button
                type="button"
                onClick={() => setShowProvenanceLimitations(!showProvenanceLimitations)}
                aria-expanded={showProvenanceLimitations}
                aria-controls="test-view-limitations-list"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#713F2B] dark:text-[#E8874A] hover:text-[#244C3B] dark:hover:text-[#F4F6F8] bg-[#F7F1E8] dark:bg-[#18242E] hover:bg-[#EFE6DC] dark:hover:bg-[#263743] px-2.5 py-1 rounded-xl border border-[#DFCBB3] dark:border-[#354651] transition-colors cursor-pointer"
              >
                <span>{showProvenanceLimitations ? 'Hide Scientific Limitations' : 'View Scientific Limitations & Data Provenance'}</span>
                {showProvenanceLimitations ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showProvenanceLimitations && (
              <ul id="test-view-limitations-list" className="text-xs text-[#5A453A] dark:text-[#AAB8C2] space-y-2 list-disc list-inside leading-relaxed pt-1">
                <li>
                  <strong>Atmospheric Model Basis: </strong>
                  Aerosol optical depth, dust surface concentration, and PM10 values originate from Copernicus Atmosphere Monitoring Service (CAMS) forecasts. They represent numerical model runs rather than continuous optical ground truth sensors.
                </li>
                <li>
                  <strong>Spatial Resolution: </strong>
                  Model grid cells span approximately 11 km × 11 km. Localized micro-climate phenomena (e.g., immediate construction dust or hyper-local coastal fog) may differ from regional grid estimates.
                </li>
                <li>
                  <strong>Ground Truth Validation: </strong>
                  Because official ground-station nephelometers across the UAE desert are managed exclusively by government meteorological authorities, historical evaluations are calibrated against reanalysis datasets and school nurse event records.
                </li>
                <li>
                  <strong>Non-Emergency Advisory: </strong>
                  DustWatch is an experimental academic initiative under UMBRA. It is not an official warning service; emergency decisions must rely on the UAE National Center of Meteorology (ncm.ae).
                </li>
              </ul>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
