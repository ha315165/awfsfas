/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileSpreadsheet,
  Info,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { APP_CONFIG } from '../config.ts';
import { STRINGS } from '../strings.ts';
import {
  CsvEvaluationResult,
  getCsvTemplate,
  parseAndEvaluateCsv,
} from '../evaluation.ts';
import { EvaluationPredictorStats, WorkbenchEvaluationOutput } from '../types.ts';
import {
  OutlineDrawCard,
  OutlineDrawHeading,
  OutlineDrawBody,
  OutlineDrawVisual,
} from './OutlineDrawCard.tsx';

interface AccuracyScreenProps {
  workbenchData?: WorkbenchEvaluationOutput | null;
}

export const AccuracyScreen: React.FC<AccuracyScreenProps> = ({ workbenchData }) => {
  const [csvEvaluation, setCsvEvaluation] = useState<CsvEvaluationResult | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  // Expandable sections - collapsed by default
  const [showMethodologyDetails, setShowMethodologyDetails] = useState<boolean>(false);
  const [showOutcomesDetails, setShowOutcomesDetails] = useState<boolean>(false);
  const [showWorkbenchConfigDetails, setShowWorkbenchConfigDetails] = useState<boolean>(false);
  const [showMissesAlarmsDetails, setShowMissesAlarmsDetails] = useState<boolean>(false);
  const [showLimitationsDetails, setShowLimitationsDetails] = useState<boolean>(false);

  // Automatically load when workbenchData is passed
  React.useEffect(() => {
    if (workbenchData) {
      setCsvError(null);
      const res = parseAndEvaluateCsv(workbenchData.csvText, {
        hindcastLabel: workbenchData.metadata.hindcastLabel,
        searchedPeriod: workbenchData.metadata.searchedPeriod,
        searchedCities: workbenchData.metadata.searchedCities,
        thresholdsUsed: {
          thresholds: APP_CONFIG.thresholds,
          cutoffs: APP_CONFIG.cutoffs,
          eventPredictionLevel: APP_CONFIG.eventPredictionLevel,
          matchToleranceHours: APP_CONFIG.matchToleranceHours,
        },
        splitInfo: workbenchData.splitStats,
        isSynthetic: workbenchData.isSynthetic ?? workbenchData.metadata.isSynthetic,
      });

      if (res.success && res.result) {
        setCsvEvaluation(res.result);
      } else {
        setCsvError(res.error || 'Failed to load workbench data.');
      }
    }
  }, [workbenchData]);

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvError(null);
    setCopiedJson(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const res = parseAndEvaluateCsv(text);
      if (res.success && res.result) {
        setCsvEvaluation(res.result);
      } else {
        setCsvError(res.error || 'Failed to parse CSV');
        setCsvEvaluation(null);
      }
    };
    reader.onerror = () => {
      setCsvError('Failed to read the selected file');
      setCsvEvaluation(null);
    };
    reader.readAsText(file);
  };

  // Download template
  const handleDownloadTemplate = () => {
    const templateContent = getCsvTemplate();
    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'dustwatch_evaluation_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy JSON
  const handleCopyJson = () => {
    if (!csvEvaluation?.jsonOutput) return;
    navigator.clipboard.writeText(csvEvaluation.jsonOutput).then(() => {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 3000);
    });
  };

  const renderStatsRow = (name: string, stats: EvaluationPredictorStats) => {
    const formatPct = (val: number | null) =>
      val !== null ? `${(val * 100).toFixed(1)}%` : 'n/a';

    return (
      <tr key={name} className="hover:bg-gray-50 dark:hover:bg-[#263743] border-b border-[#D5D9DF] dark:border-[#354651]">
        <td className="py-2.5 px-3 font-semibold text-[#1A1A1A] dark:text-[#F4F6F8]">{name}</td>
        <td className="py-2.5 px-3 text-center font-mono dark:text-[#F4F6F8]">{stats.hits}</td>
        <td className="py-2.5 px-3 text-center font-mono text-red-600 dark:text-red-400 font-bold">{stats.misses}</td>
        <td className="py-2.5 px-3 text-center font-mono text-amber-600 dark:text-amber-400">{stats.falseAlarms}</td>
        <td className="py-2.5 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400">{stats.correctNegatives}</td>
        <td className="py-2.5 px-3 text-center font-semibold text-blue-700 dark:text-sky-400">{formatPct(stats.hitRate)}</td>
        <td className="py-2.5 px-3 text-center text-red-700 dark:text-red-400">{formatPct(stats.missRate)}</td>
        <td className="py-2.5 px-3 text-center text-amber-800 dark:text-amber-300">{formatPct(stats.falseAlarmRatio)}</td>
        <td className="py-2.5 px-3 text-center font-bold text-[#1A1A1A] dark:text-[#F4F6F8]">{formatPct(stats.accuracy)}</td>
      </tr>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-8 text-[#2D221C] dark:text-[#F4F6F8]">
      {/* Page Header */}
      <div>
        <div className="text-xs font-bold text-[#E8874A] uppercase tracking-wider mb-1">
          Model Evaluation & Verification
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#713F2B] dark:text-[#F4F6F8]">
          {STRINGS.accuracy.title}
        </h1>
        <p className="text-sm text-[#5A453A] dark:text-[#AAB8C2] mt-1">
          {STRINGS.accuracy.subtitle}
        </p>
      </div>

      {/* 1. How we define a dust event (Top highlighted box) */}
      <OutlineDrawCard
        outlineColor="#E8874A"
        baseBorderColor="rgba(252, 211, 77, 0.7)"
        borderRadius={8}
        duration={0.7}
        delay={0.05}
        className="bg-amber-50 dark:bg-[#251D18] border border-amber-300 dark:border-amber-900/60 rounded-lg p-5 shadow-xs space-y-3"
      >
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-amber-800 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="w-full space-y-2">
            <OutlineDrawHeading>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-base font-bold text-amber-950 dark:text-amber-200">
                  {STRINGS.accuracy.eventDefHeader}
                </h2>
                <span className="text-xs bg-amber-200 dark:bg-[#3D2C20] text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded font-semibold border border-amber-300 dark:border-amber-800/60">
                  {APP_CONFIG.eventDefinitionStatus}
                </span>
              </div>
            </OutlineDrawHeading>

            <OutlineDrawBody>
              <div className="p-3 bg-white/90 dark:bg-[#1E2D38] rounded border border-amber-200 dark:border-amber-900/60 text-sm font-mono text-[#1A1A1A] dark:text-[#F4F6F8]">
                {APP_CONFIG.eventDefinitionText}
              </div>
            </OutlineDrawBody>

            <OutlineDrawVisual>
              <div className="text-xs text-amber-900 dark:text-amber-300 space-y-1">
                <p className="font-medium text-amber-950 dark:text-amber-200">
                  {APP_CONFIG.eventDefinitionDataSource}
                </p>
                <p className="p-2 bg-amber-100/70 dark:bg-[#2F221B] border border-amber-300 dark:border-amber-800/60 rounded font-semibold text-amber-950 dark:text-amber-200">
                  {APP_CONFIG.eventDefinitionCircularWarning}
                </p>
              </div>
            </OutlineDrawVisual>
          </div>
        </div>
      </OutlineDrawCard>

      {/* 1b. Historical Validation Methodology & Benchmarks */}
      <OutlineDrawCard
        outlineColor="#713F2B"
        baseBorderColor="rgba(213, 217, 223, 0.6)"
        borderRadius={8}
        duration={0.75}
        delay={0.08}
        className="bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg p-5 shadow-sm space-y-3"
      >
        <OutlineDrawHeading>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowMethodologyDetails(!showMethodologyDetails)}
              aria-expanded={showMethodologyDetails}
              aria-controls="accuracy-methodology-details"
              className="text-left flex items-center gap-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-0.5"
            >
              <Info className="w-4 h-4 text-blue-700 dark:text-sky-400 shrink-0" />
              <h2 className="text-base font-bold text-[#1A1A1A] dark:text-[#F4F6F8] group-hover:text-blue-900 dark:group-hover:text-sky-300 transition-colors">
                Historical Validation Methodology: Chronological Splits & Benchmarks
              </h2>
            </button>
            <button
              type="button"
              onClick={() => setShowMethodologyDetails(!showMethodologyDetails)}
              aria-expanded={showMethodologyDetails}
              aria-controls="accuracy-methodology-details"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#713F2B] dark:text-[#AAB8C2] hover:text-black dark:hover:text-white bg-stone-100 dark:bg-[#263743] hover:bg-stone-200/80 dark:hover:bg-[#354651] px-2.5 py-1 rounded transition-colors cursor-pointer"
            >
              <span>{showMethodologyDetails ? 'Hide Methodology Details' : 'View Chronological Splits & Benchmarks'}</span>
              {showMethodologyDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </OutlineDrawHeading>

        {showMethodologyDetails && (
          <div id="accuracy-methodology-details" className="space-y-3">
            <OutlineDrawBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-3">
                <div className="p-3 bg-gray-50 dark:bg-[#18242E] rounded border border-gray-200 dark:border-[#354651] space-y-1.5">
                  <h3 className="font-bold text-[#1A1A1A] dark:text-[#F4F6F8]">1. Chronological Time-Series Splits (No Random K-Fold)</h3>
                  <p className="text-[#4A4F57] dark:text-[#AAB8C2] leading-relaxed">
                    Atmospheric data is heavily auto-correlated across consecutive hours and days. Random k-fold cross-validation causes severe data leakage (future hours leaking into training folds).
                    DustWatch strictly mandates chronological train/test partitioning (e.g. 2021–2022 train, 2023–2024 test &mdash; <em>Example of a planned method, not what was done</em>) across all 10 UAE grid points.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-[#18242E] rounded border border-gray-200 dark:border-[#354651] space-y-1.5">
                  <h3 className="font-bold text-[#1A1A1A] dark:text-[#F4F6F8]">2. Persistence Benchmark ("the next 12 hours look like now")</h3>
                  <p className="text-[#4A4F57] dark:text-[#AAB8C2] leading-relaxed">
                    Any valid predictive system must outperform persistence. In weather forecasting, the persistence benchmark assumes the next 12 hours look like now.
                    In our CSV evaluation tool, the persistence benchmark ("the next 12 hours look like now") is tracked alongside the baseline rule score to ensure true skill score gain.
                  </p>
                </div>
              </div>
            </OutlineDrawBody>

            <OutlineDrawVisual>
              <div className="p-3 bg-red-50 dark:bg-[#251D18] rounded border border-red-200 dark:border-red-900/60 text-xs text-red-950 dark:text-red-300">
                <strong>The Rare-Event Imbalance Paradox:</strong> Dust events are usually rare. The team will measure the real share in its own data. A naive predictor that always outputs "Low" would achieve high raw accuracy while missing hazardous dust events. Consequently, <strong>Hit Rate (Recall)</strong> and <strong>Miss Rate</strong> are the primary safety-critical metrics, not overall accuracy.
              </div>
            </OutlineDrawVisual>
          </div>
        )}
      </OutlineDrawCard>

      {/* 2. Plain-language explanation of the four outcomes */}
      <OutlineDrawCard
        outlineColor="#E8874A"
        baseBorderColor="rgba(213, 217, 223, 0.6)"
        borderRadius={8}
        duration={0.7}
        delay={0.12}
        className="bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg p-5 shadow-sm space-y-4"
      >
        <OutlineDrawHeading>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowOutcomesDetails(!showOutcomesDetails)}
              aria-expanded={showOutcomesDetails}
              aria-controls="accuracy-outcomes-details"
              className="text-left group cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 rounded p-0.5"
            >
              <h2 className="text-base font-bold text-[#1A1A1A] dark:text-[#F4F6F8] group-hover:text-amber-900 dark:group-hover:text-amber-300 transition-colors">
                {STRINGS.accuracy.outcomesTitle}
              </h2>
            </button>
            <button
              type="button"
              onClick={() => setShowOutcomesDetails(!showOutcomesDetails)}
              aria-expanded={showOutcomesDetails}
              aria-controls="accuracy-outcomes-details"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#E8874A] hover:text-[#713F2B] dark:hover:text-white bg-amber-50 dark:bg-[#2A201A] hover:bg-amber-100/80 dark:hover:bg-[#35251C] px-2.5 py-1 rounded transition-colors cursor-pointer border border-amber-200 dark:border-amber-900/60"
            >
              <span>{showOutcomesDetails ? 'Hide Outcome Definitions' : 'View Outcome Definitions (Hit, Miss, False Alarm, Correct Negative)'}</span>
              {showOutcomesDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </OutlineDrawHeading>

        {showOutcomesDetails && (
          <OutlineDrawBody>
            <div id="accuracy-outcomes-details" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STRINGS.accuracy.outcomes.map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-lg border border-[#D5D9DF] dark:border-[#354651] bg-gray-50/50 dark:bg-[#18242E]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-[#1A1A1A] dark:text-[#F4F6F8]">{item.name}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                        item.name === 'Hit'
                          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60'
                          : item.name === 'Miss'
                          ? 'bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800/60'
                          : item.name === 'False Alarm'
                          ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/60'
                          : 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800/60'
                      }`}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </OutlineDrawBody>
        )}
      </OutlineDrawCard>

      {/* 3. Official Results Panel */}
      <section className="bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg p-5 shadow-sm space-y-3">
        <h2 className="text-base font-bold text-[#1A1A1A] dark:text-[#F4F6F8] flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-gray-700 dark:text-[#AAB8C2]" />
          <span>{STRINGS.accuracy.officialTitle}</span>
        </h2>

        {!APP_CONFIG.evaluationResults ? (
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-[#18242E] border border-gray-200 dark:border-[#354651] text-center py-6">
            <h3 className="font-bold text-base text-[#1A1A1A] dark:text-[#F4F6F8] mb-1">
              {STRINGS.accuracy.notYetEvaluatedTitle}
            </h3>
            <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2] max-w-xl mx-auto leading-relaxed">
              {STRINGS.accuracy.notYetEvaluatedDesc}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* If filled in config, render official table */}
            <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2]">
              Dataset: {APP_CONFIG.evaluationResults.datasetDescription} ({APP_CONFIG.evaluationResults.period})
            </p>
            <div className="overflow-x-auto border border-[#D5D9DF] dark:border-[#354651] rounded-md">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 dark:bg-[#263743] border-b border-[#D5D9DF] dark:border-[#354651] text-[#4A4F57] dark:text-[#AAB8C2]">
                  <tr>
                    <th className="py-2 px-3">Predictor</th>
                    <th className="py-2 px-3 text-center">Hits</th>
                    <th className="py-2 px-3 text-center">Misses</th>
                    <th className="py-2 px-3 text-center">False Alarms</th>
                    <th className="py-2 px-3 text-center">Correct Neg.</th>
                    <th className="py-2 px-3 text-center">Hit Rate</th>
                    <th className="py-2 px-3 text-center">Miss Rate</th>
                    <th className="py-2 px-3 text-center">FAR</th>
                    <th className="py-2 px-3 text-center">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {renderStatsRow('Baseline Rule Score', APP_CONFIG.evaluationResults.predictors.baselineRuleScore)}
                  {APP_CONFIG.evaluationResults.predictors.trainedModel &&
                    renderStatsRow('Trained Model', APP_CONFIG.evaluationResults.predictors.trainedModel)}
                  {APP_CONFIG.evaluationResults.predictors.persistenceBenchmark &&
                    renderStatsRow('Persistence ("the next 12 hours look like now")', APP_CONFIG.evaluationResults.predictors.persistenceBenchmark)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* 4. Team CSV Evaluation Tool */}
      <section className="bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-[#1A1A1A] dark:text-[#F4F6F8] flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-700 dark:text-sky-400" />
            <span>{STRINGS.accuracy.csvToolTitle}</span>
          </h2>
          <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2] mt-1">
            {STRINGS.accuracy.csvToolDesc}
          </p>
        </div>

        {/* Action Bar: Upload, Download Template */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs sm:text-sm font-semibold cursor-pointer min-h-[44px]">
            <Upload className="w-4 h-4" />
            <span>{STRINGS.accuracy.csvUploadLabel}</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#263743] border border-[#D5D9DF] dark:border-[#354651] text-[#1A1A1A] dark:text-[#F4F6F8] hover:bg-gray-50 dark:hover:bg-[#354651] rounded-md text-xs sm:text-sm font-medium min-h-[44px]"
          >
            <Download className="w-4 h-4 text-gray-600 dark:text-[#AAB8C2]" />
            <span>{STRINGS.accuracy.csvDownloadTemplate}</span>
          </button>
        </div>

        {/* Error message */}
        {csvError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <strong>CSV Error: </strong>
              <span>{csvError}</span>
            </div>
          </div>
        )}

        {/* Evaluation Results Output */}
        {csvEvaluation && (
          <div className="space-y-4 pt-3 border-t border-[#D5D9DF] dark:border-[#354651]">
            {/* Summary counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded bg-gray-50 dark:bg-[#18242E] border border-gray-200 dark:border-[#354651]">
                <span className="text-[#4A4F57] dark:text-[#AAB8C2] block">Valid Data Rows</span>
                <span className="font-bold text-base text-[#1A1A1A] dark:text-[#F4F6F8]">{csvEvaluation.validRowsCount}</span>
              </div>
              <div className="p-2.5 rounded bg-gray-50 dark:bg-[#18242E] border border-gray-200 dark:border-[#354651]">
                <span className="text-[#4A4F57] dark:text-[#AAB8C2] block">Observed Events</span>
                <span className="font-bold text-base text-[#1A1A1A] dark:text-[#F4F6F8]">{csvEvaluation.observedEventsCount}</span>
              </div>
              <div className="p-2.5 rounded bg-gray-50 dark:bg-[#18242E] border border-gray-200 dark:border-[#354651]">
                <span className="text-[#4A4F57] dark:text-[#AAB8C2] block">Ignored Invalid Rows</span>
                <span className="font-bold text-base text-amber-700 dark:text-amber-400">{csvEvaluation.ignoredRowsCount}</span>
              </div>
              <div className="p-2.5 rounded bg-gray-50 dark:bg-[#18242E] border border-gray-200 dark:border-[#354651]">
                <span className="text-[#4A4F57] dark:text-[#AAB8C2] block">Event Threshold</span>
                <span className="font-bold text-base text-blue-700 dark:text-sky-400">&ge; {APP_CONFIG.eventPredictionLevel}</span>
              </div>
            </div>

            {/* Warning if too few events */}
            {!csvEvaluation.hasEnoughEvents && (
              <div className="p-3 bg-amber-50 dark:bg-[#251D18] border border-amber-300 dark:border-amber-900/60 rounded-md text-xs text-amber-900 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{STRINGS.accuracy.tooFewEvents}</span>
              </div>
            )}

            {/* A6: Provenance Display when results are from Workbench */}
            {csvEvaluation.workbenchMetadata && (
              <div className="p-4 bg-blue-50 dark:bg-[#182438] border border-blue-300 dark:border-blue-900/60 rounded-lg space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-100 dark:bg-blue-950/70 text-blue-900 dark:text-blue-300 border border-blue-300 dark:border-blue-800/60 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                      Evaluation Workbench Run
                    </span>
                    <span className="text-xs text-blue-950 dark:text-blue-200 font-semibold">
                      {csvEvaluation.workbenchMetadata.hindcastLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWorkbenchConfigDetails(!showWorkbenchConfigDetails)}
                    aria-expanded={showWorkbenchConfigDetails}
                    aria-controls="accuracy-workbench-config-details"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-900 dark:text-blue-300 hover:text-blue-950 dark:hover:text-white bg-blue-100/80 dark:bg-blue-950/60 hover:bg-blue-200/80 dark:hover:bg-blue-900/60 px-2.5 py-1 rounded transition-colors cursor-pointer border border-blue-300 dark:border-blue-800/60"
                  >
                    <span>{showWorkbenchConfigDetails ? 'Hide Tuning & Partition Setup' : 'View Tuning & Partition Setup'}</span>
                    {showWorkbenchConfigDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {csvEvaluation.workbenchMetadata.isSynthetic && (
                  <div className="p-3 bg-amber-100 dark:bg-[#251D18] border border-amber-400 dark:border-amber-900/60 rounded text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span>
                        Notice: This dataset was generated from synthetic demonstration data. Real-world accuracy claims cannot be substantiated using synthetic data.
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-blue-900 dark:text-blue-300 pt-1">
                  <div>
                    <strong>Searched Period: </strong>
                    <span className="font-mono">
                      {csvEvaluation.workbenchMetadata.searchedPeriod.start} &rarr; {csvEvaluation.workbenchMetadata.searchedPeriod.end}
                    </span>
                  </div>
                  <div>
                    <strong>Searched Cities: </strong>
                    <span>{csvEvaluation.workbenchMetadata.searchedCities.join(', ')}</span>
                  </div>
                </div>

                {/* Collapsible Tuning and Partition Info */}
                {showWorkbenchConfigDetails && (
                  <div id="accuracy-workbench-config-details" className="space-y-3 pt-1">
                    {/* Thresholds used */}
                    <div className="pt-2 border-t border-blue-200 dark:border-blue-900/60 text-xs text-blue-950 dark:text-blue-200 space-y-1">
                      <strong>Thresholds &amp; Cutoffs Tested:</strong>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[11px] pt-1">
                        <span className="bg-white/80 dark:bg-[#1E2D38] p-1 rounded border border-blue-200 dark:border-[#354651]">Dust: 20-300 (30%)</span>
                        <span className="bg-white/80 dark:bg-[#1E2D38] p-1 rounded border border-blue-200 dark:border-[#354651]">PM10: 50-400 (25%)</span>
                        <span className="bg-white/80 dark:bg-[#1E2D38] p-1 rounded border border-blue-200 dark:border-[#354651]">Gusts: 25-70 (10%)</span>
                        <span className="bg-white/80 dark:bg-[#1E2D38] p-1 rounded border border-blue-200 dark:border-[#354651]">Wind: 15-50 (10%)</span>
                        <span className="bg-white/80 dark:bg-[#1E2D38] p-1 rounded border border-blue-200 dark:border-[#354651]">AOD: 0.2-1.5 (10%)</span>
                        <span className="bg-white/80 dark:bg-[#1E2D38] p-1 rounded border border-blue-200 dark:border-[#354651]">Vis: 10k-1k (10%)</span>
                        <span className="bg-white/80 dark:bg-[#1E2D38] p-1 rounded border border-blue-200 dark:border-[#354651]">Humidity: 60-15% (5%)</span>
                        <span className="bg-white/80 dark:bg-[#1E2D38] p-1 rounded border border-blue-200 dark:border-[#354651] font-bold">Event: &ge; {APP_CONFIG.eventPredictionLevel}</span>
                      </div>
                    </div>

                    {/* Chronological Split Display */}
                    {csvEvaluation.workbenchMetadata.splitInfo && (
                      <div className="pt-2 border-t border-blue-200 dark:border-blue-900/60 text-xs text-blue-950 dark:text-blue-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <strong>Chronological Partition Split (Date: {csvEvaluation.workbenchMetadata.splitInfo.splitDate})</strong>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="p-2 bg-white dark:bg-[#1E2D38] rounded border border-blue-200 dark:border-[#354651] space-y-1">
                            <span className="font-bold text-gray-800 dark:text-[#F4F6F8] block">Tuning Period</span>
                            <p className="text-[11px] text-gray-600 dark:text-[#AAB8C2] italic">Only change thresholds using the tuning period.</p>
                            <div className="font-mono text-[11px] pt-1">
                              Hits: {csvEvaluation.workbenchMetadata.splitInfo.tuningPeriod.predictors.baselineRuleScore.hits} |
                              Misses: {csvEvaluation.workbenchMetadata.splitInfo.tuningPeriod.predictors.baselineRuleScore.misses} |
                              FAR: {csvEvaluation.workbenchMetadata.splitInfo.tuningPeriod.predictors.baselineRuleScore.falseAlarmRatio !== null
                                ? `${(csvEvaluation.workbenchMetadata.splitInfo.tuningPeriod.predictors.baselineRuleScore.falseAlarmRatio * 100).toFixed(1)}%`
                                : 'n/a'}
                            </div>
                          </div>

                          <div className="p-2 bg-white dark:bg-[#1E2D38] rounded border border-blue-200 dark:border-[#354651] space-y-1">
                            <span className="font-bold text-blue-900 dark:text-sky-300 block">Test Period</span>
                            <p className="text-[11px] text-blue-900 dark:text-sky-300 font-semibold">Report the test period.</p>
                            <div className="font-mono text-[11px] pt-1">
                              Hits: {csvEvaluation.workbenchMetadata.splitInfo.testPeriod.predictors.baselineRuleScore.hits} |
                              Misses: {csvEvaluation.workbenchMetadata.splitInfo.testPeriod.predictors.baselineRuleScore.misses} |
                              FAR: {csvEvaluation.workbenchMetadata.splitInfo.testPeriod.predictors.baselineRuleScore.falseAlarmRatio !== null
                                ? `${(csvEvaluation.workbenchMetadata.splitInfo.testPeriod.predictors.baselineRuleScore.falseAlarmRatio * 100).toFixed(1)}%`
                                : 'n/a'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Results Table */}
            <div className="overflow-x-auto border border-[#D5D9DF] dark:border-[#354651] rounded-md">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 dark:bg-[#263743] border-b border-[#D5D9DF] dark:border-[#354651] text-[#4A4F57] dark:text-[#AAB8C2]">
                  <tr>
                    <th className="py-2.5 px-3">Predictor</th>
                    <th className="py-2.5 px-3 text-center">Hits</th>
                    <th className="py-2.5 px-3 text-center">Misses</th>
                    <th className="py-2.5 px-3 text-center">False Alarms</th>
                    <th className="py-2.5 px-3 text-center">Correct Neg.</th>
                    <th className="py-2.5 px-3 text-center">Hit Rate</th>
                    <th className="py-2.5 px-3 text-center">Miss Rate</th>
                    <th className="py-2.5 px-3 text-center">FAR</th>
                    <th className="py-2.5 px-3 text-center">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {renderStatsRow('Baseline Rule Score', csvEvaluation.predictors.baselineRuleScore)}
                  {csvEvaluation.predictors.trainedModel &&
                    renderStatsRow('Trained Model', csvEvaluation.predictors.trainedModel)}
                  {csvEvaluation.predictors.persistenceBenchmark &&
                    renderStatsRow('Persistence Benchmark ("the next 12 hours look like now")', csvEvaluation.predictors.persistenceBenchmark)}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-[#4A4F57] dark:text-[#AAB8C2] italic">
              {STRINGS.accuracy.accuracyCaveat}
            </p>

            {/* Example Misses and False Alarms */}
            <div className="pt-2">
              <div className="flex items-center justify-between gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setShowMissesAlarmsDetails(!showMissesAlarmsDetails)}
                  aria-expanded={showMissesAlarmsDetails}
                  aria-controls="accuracy-misses-alarms-details"
                  className="text-left font-semibold text-xs text-[#1A1A1A] dark:text-[#F4F6F8] hover:text-[#713F2B] dark:hover:text-[#E8874A] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#713F2B] rounded p-0.5"
                >
                  Diagnostic Examples: Misses &amp; False Alarms
                </button>
                <button
                  type="button"
                  onClick={() => setShowMissesAlarmsDetails(!showMissesAlarmsDetails)}
                  aria-expanded={showMissesAlarmsDetails}
                  aria-controls="accuracy-misses-alarms-details"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-700 dark:text-[#F4F6F8] hover:text-black dark:hover:text-white bg-stone-100 dark:bg-[#263743] hover:bg-stone-200/80 dark:hover:bg-[#354651] px-2.5 py-1 rounded transition-colors cursor-pointer border border-stone-200 dark:border-[#354651]"
                >
                  <span>{showMissesAlarmsDetails ? 'Hide Diagnostic Examples' : 'View Example Misses & False Alarm Rows'}</span>
                  {showMissesAlarmsDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {showMissesAlarmsDetails && (
                <div id="accuracy-misses-alarms-details" className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="border border-red-200 dark:border-red-900/60 rounded-md p-3 bg-red-50/40 dark:bg-red-950/30">
                    <h4 className="font-bold text-red-900 dark:text-red-300 mb-2">
                      Example Misses (Observed = 1, Predicted &lt; High)
                    </h4>
                    {csvEvaluation.exampleMisses.length === 0 ? (
                      <p className="text-[#4A4F57] dark:text-[#AAB8C2]">No misses detected in evaluated dataset.</p>
                    ) : (
                      <ul className="space-y-1 font-mono text-[11px]">
                        {csvEvaluation.exampleMisses.map((ex, i) => (
                          <li key={i} className="text-[#1A1A1A] dark:text-[#F4F6F8] bg-white/70 dark:bg-[#1E2D38] p-1 rounded border border-red-100 dark:border-red-900/40">
                            Row {ex.rowNumber}: {ex.city} ({ex.timestamp}) - Predicted: {ex.predictedLevel}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="border border-amber-200 dark:border-amber-900/60 rounded-md p-3 bg-amber-50/40 dark:bg-amber-950/30">
                    <h4 className="font-bold text-amber-900 dark:text-amber-300 mb-2">
                      Example False Alarms (Observed = 0, Predicted &ge; High)
                    </h4>
                    {csvEvaluation.exampleFalseAlarms.length === 0 ? (
                      <p className="text-[#4A4F57] dark:text-[#AAB8C2]">No false alarms detected in evaluated dataset.</p>
                    ) : (
                      <ul className="space-y-1 font-mono text-[11px]">
                        {csvEvaluation.exampleFalseAlarms.map((ex, i) => (
                          <li key={i} className="text-[#1A1A1A] dark:text-[#F4F6F8] bg-white/70 dark:bg-[#1E2D38] p-1 rounded border border-amber-100 dark:border-amber-900/40">
                            Row {ex.rowNumber}: {ex.city} ({ex.timestamp}) - Predicted: {ex.predictedLevel}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Copy Results as JSON */}
            <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2]">
                Paste these verified results into <code className="bg-gray-100 dark:bg-[#18242E] dark:text-[#F4F6F8] px-1 py-0.5 rounded border border-transparent dark:border-[#354651]">config.evaluationResults</code> once team review is complete.
              </p>
              <button
                type="button"
                onClick={handleCopyJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 dark:bg-[#263743] hover:bg-black dark:hover:bg-[#354651] text-white rounded text-xs font-semibold cursor-pointer border border-transparent dark:border-[#354651]"
              >
                {copiedJson ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedJson ? STRINGS.accuracy.csvCopiedJson : STRINGS.accuracy.csvCopyJson}</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 5. Known Limitations List */}
      <section className="bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowLimitationsDetails(!showLimitationsDetails)}
            aria-expanded={showLimitationsDetails}
            aria-controls="accuracy-limitations-list"
            className="text-left flex items-center gap-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-stone-500 rounded p-0.5"
          >
            <Info className="w-4 h-4 text-gray-700 dark:text-[#E8874A] shrink-0" />
            <h2 className="text-base font-bold text-[#1A1A1A] dark:text-[#F4F6F8] group-hover:text-stone-900 dark:group-hover:text-white transition-colors">
              {STRINGS.accuracy.limitationsTitle}
            </h2>
          </button>
          <button
            type="button"
            onClick={() => setShowLimitationsDetails(!showLimitationsDetails)}
            aria-expanded={showLimitationsDetails}
            aria-controls="accuracy-limitations-list"
            className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700 dark:text-[#F4F6F8] hover:text-black dark:hover:text-white bg-stone-100 dark:bg-[#263743] hover:bg-stone-200/80 dark:hover:bg-[#354651] px-2.5 py-1 rounded transition-colors cursor-pointer border border-stone-200 dark:border-[#354651]"
          >
            <span>{showLimitationsDetails ? 'Hide Known Limitations' : 'View Known Limitations'}</span>
            {showLimitationsDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
        {showLimitationsDetails && (
          <ul id="accuracy-limitations-list" className="list-disc pl-5 space-y-1.5 text-xs text-[#4A4F57] dark:text-[#AAB8C2] leading-relaxed pt-1">
            {STRINGS.accuracy.limitations.map((lim, idx) => (
              <li key={idx}>{lim}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
