/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ArrowRight,
  Database,
  Calculator,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  MessageSquare,
  AlertTriangle,
  Info,
  ExternalLink,
  BookOpen,
  GraduationCap,
  Thermometer,
  Layers,
} from 'lucide-react';
import { APP_CONFIG } from '../config.ts';
import { STRINGS } from '../strings.ts';
import {
  OutlineDrawCard,
  OutlineDrawHeading,
  OutlineDrawBody,
  OutlineDrawVisual,
} from './OutlineDrawCard.tsx';

export const HowItWorksScreen: React.FC = () => {
  // Expandable sections - collapsed by default
  const [showEventDefDetails, setShowEventDefDetails] = useState<boolean>(false);
  const [showSchoolArchDetails, setShowSchoolArchDetails] = useState<boolean>(false);
  const [showMatrixDetails, setShowMatrixDetails] = useState<boolean>(false);
  const [showPredictsDetails, setShowPredictsDetails] = useState<boolean>(false);
  const [showGeminiDetails, setShowGeminiDetails] = useState<boolean>(false);
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-8 transition-colors duration-200">
      {/* Page Header with Official Project Identity */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2 border-b border-[#DFCBB3] dark:border-[#354651]">
        <div className="space-y-1">
          <div className="text-xs font-bold text-[#E8874A] uppercase tracking-wider mb-1">
            Methodology & Data Pipeline
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#713F2B] dark:text-[#F4F6F8]">
            {STRINGS.howItWorks.title}
          </h1>
          <p className="text-sm text-[#5A453A] dark:text-[#AAB8C2] mt-1 max-w-xl">
            {STRINGS.howItWorks.subtitle}
          </p>
        </div>
        <div className="shrink-0 bg-[#FFFDFB] dark:bg-[#1E2D38] p-3 rounded-xl border border-[#DFCBB3] dark:border-[#354651] shadow-2xs self-start sm:self-auto">
          <img
            src="/assets/dustwatch-logo-transparent.png"
            alt="DustWatch - Official Project Emblem"
            className="h-14 sm:h-16 w-auto object-contain"
            width={102}
            height={64}
            loading="lazy"
          />
        </div>
      </div>

      {/* 1. Visual Flow Diagram (Boxes & Arrows, stacks on mobile) */}
      <OutlineDrawCard
        outlineColor="#E8874A"
        baseBorderColor="rgba(213, 217, 223, 0.6)"
        borderRadius={8}
        duration={0.75}
        delay={0}
        aria-labelledby="flow-heading"
        className="bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg p-5 shadow-sm space-y-4"
      >
        <OutlineDrawHeading>
          <h2 id="flow-heading" className="text-base font-bold text-[#1A1A1A] dark:text-[#F4F6F8]">
            Pipeline Flow Architecture
          </h2>
        </OutlineDrawHeading>

        <OutlineDrawBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-stretch">
            {/* Step 1 */}
            <div className="p-4 rounded-lg bg-[#F7F1E8] dark:bg-[#18242E] border border-[#DFCBB3] dark:border-[#354651] flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#1A1A1A] dark:text-[#F4F6F8] mb-1">
                  {STRINGS.howItWorks.flow.step1Title}
                </h3>
                <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2] leading-relaxed">
                  {STRINGS.howItWorks.flow.step1Desc}
                </p>
              </div>
              <div className="hidden md:flex justify-end pt-2 text-[#8C6D58] dark:text-[#AAB8C2]">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-lg bg-[#F7F1E8] dark:bg-[#18242E] border border-[#DFCBB3] dark:border-[#354651] flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#1A1A1A] dark:text-[#F4F6F8] mb-1">
                  {STRINGS.howItWorks.flow.step2Title}
                </h3>
                <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2] leading-relaxed">
                  {STRINGS.howItWorks.flow.step2Desc}
                </p>
              </div>
              <div className="hidden md:flex justify-end pt-2 text-[#8C6D58] dark:text-[#AAB8C2]">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-lg bg-[#F7F1E8] dark:bg-[#18242E] border border-[#DFCBB3] dark:border-[#354651] flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#1A1A1A] dark:text-[#F4F6F8] mb-1">
                  {STRINGS.howItWorks.flow.step3Title}
                </h3>
                <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2] leading-relaxed">
                  {STRINGS.howItWorks.flow.step3Desc}
                </p>
              </div>
              <div className="hidden md:flex justify-end pt-2 text-[#8C6D58] dark:text-[#AAB8C2]">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-lg bg-[#F7F1E8] dark:bg-[#18242E] border border-[#DFCBB3] dark:border-[#354651] flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#1A1A1A] dark:text-[#F4F6F8] mb-1">
                  {STRINGS.howItWorks.flow.step4Title}
                </h3>
                <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2] leading-relaxed">
                  {STRINGS.howItWorks.flow.step4Desc}
                </p>
              </div>
            </div>
          </div>
        </OutlineDrawBody>
      </OutlineDrawCard>

      {/* 2. Dust Event Definition Box */}
      <OutlineDrawCard
        outlineColor="#E8874A"
        baseBorderColor="rgba(252, 211, 77, 0.7)"
        borderRadius={8}
        duration={0.7}
        delay={0.08}
        className="bg-amber-50 dark:bg-[#2A201A] border border-amber-300 dark:border-amber-800/70 rounded-lg p-5 shadow-xs space-y-3"
      >
        <div className="flex items-start gap-2.5">
          <BookOpen className="w-5 h-5 text-amber-800 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-2 w-full">
            <OutlineDrawHeading>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowEventDefDetails(!showEventDefDetails)}
                  aria-expanded={showEventDefDetails}
                  aria-controls="how-it-works-event-def-details"
                  className="text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 rounded"
                >
                  <h2 className="text-base font-bold text-amber-950 dark:text-[#F4F6F8] hover:text-amber-800 dark:hover:text-amber-400 transition-colors">
                    {STRINGS.howItWorks.eventDefTitle}
                  </h2>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEventDefDetails(!showEventDefDetails)}
                    aria-expanded={showEventDefDetails}
                    aria-controls="how-it-works-event-def-details"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 dark:text-amber-300 hover:text-black dark:hover:text-white bg-amber-100 dark:bg-[#342820] hover:bg-amber-200/80 dark:hover:bg-[#423126] px-2 py-0.5 rounded transition-colors cursor-pointer border border-amber-300 dark:border-amber-700/60"
                  >
                    <span>{showEventDefDetails ? 'Hide Technical Context' : 'View Technical Context'}</span>
                    {showEventDefDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </OutlineDrawHeading>

            <OutlineDrawBody>
              <p className="text-sm text-amber-900 dark:text-amber-200 font-mono bg-white/70 dark:bg-[#1E2D38] p-3 rounded border border-amber-200 dark:border-amber-800/60">
                {APP_CONFIG.eventDefinitionText}
              </p>
            </OutlineDrawBody>

            {showEventDefDetails && (
              <OutlineDrawVisual>
                <div id="how-it-works-event-def-details" className="text-xs text-amber-900 dark:text-amber-200 space-y-1 pt-1 border-t border-amber-200/80 dark:border-amber-800/60">
                  <p className="font-medium text-amber-950 dark:text-amber-100">
                    {APP_CONFIG.eventDefinitionDataSource}
                  </p>
                  <p className="p-2 bg-amber-100/70 dark:bg-[#342820] border border-amber-300 dark:border-amber-700/60 rounded font-semibold text-amber-950 dark:text-amber-100">
                    {APP_CONFIG.eventDefinitionCircularWarning}
                  </p>
                </div>
              </OutlineDrawVisual>
            )}
          </div>
        </div>
      </OutlineDrawCard>

      {/* 2b. Dedicated School Mode & Nurse Decision Support Architecture */}
      <OutlineDrawCard
        outlineColor="#244C3B"
        baseBorderColor="rgba(213, 217, 223, 0.6)"
        borderRadius={8}
        duration={0.75}
        delay={0.06}
        className="bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg p-5 shadow-sm space-y-4"
      >
        <OutlineDrawHeading>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowSchoolArchDetails(!showSchoolArchDetails)}
              aria-expanded={showSchoolArchDetails}
              aria-controls="how-it-works-school-arch"
              className="text-left flex items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded"
            >
              <GraduationCap className="w-5 h-5 text-amber-700 dark:text-[#E8874A]" />
              <h2 className="text-base font-bold text-[#1A1A1A] dark:text-[#F4F6F8] hover:text-emerald-900 dark:hover:text-[#E8874A] transition-colors">
                School Mode: Architecture &amp; Nurse Decision Support
              </h2>
            </button>
            <button
              type="button"
              onClick={() => setShowSchoolArchDetails(!showSchoolArchDetails)}
              aria-expanded={showSchoolArchDetails}
              aria-controls="how-it-works-school-arch"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-900 dark:text-[#A7D7B5] hover:text-black dark:hover:text-white bg-emerald-50 dark:bg-[#1A3026] hover:bg-emerald-100/80 dark:hover:bg-[#244C3B] px-2.5 py-1 rounded transition-colors cursor-pointer border border-emerald-200 dark:border-[#2B5242]"
            >
              <span>{showSchoolArchDetails ? 'Hide Architecture Details' : 'View School Mode Architecture & Nurse Support'}</span>
              {showSchoolArchDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </OutlineDrawHeading>

        <p className="text-sm text-[#1A1A1A] dark:text-[#AAB8C2] leading-relaxed">
          Developed in consultation with UAE school nurses and health coordinators, School Mode introduces a dedicated decision-support workflow for outdoor recess and Physical Education (PE).
        </p>

        {showSchoolArchDetails && (
          <div id="how-it-works-school-arch" className="space-y-4 pt-1">
            <OutlineDrawBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-lg bg-[#F7F1E8] dark:bg-[#18242E] border border-[#DFCBB3] dark:border-[#354651] space-y-2">
                  <h3 className="font-bold text-sm text-[#3A1E13] dark:text-[#F4F6F8] flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#713F2B] dark:text-[#E8874A]" />
                    <span>Strict Separation of Concerns &amp; Humidity Usage</span>
                  </h3>
                  <p className="text-[#333] dark:text-[#AAB8C2] leading-relaxed">
                    <strong>Regional Dust Risk:</strong> A 0–100 atmospheric risk index (Low, Moderate, High, Very High) derived from particulate concentrations, wind dynamics, and relative humidity.
                  </p>
                  <p className="text-[#333] dark:text-[#AAB8C2] leading-relaxed">
                    <strong>Humidity in Dust Score:</strong> Relative humidity IS used in the regional dust score with a 5% weighting (low humidity contributes to higher dust risk because arid ground and dry air facilitate particle lofting). Temperature is NOT used in the dust score.
                  </p>
                  <p className="text-[#333] dark:text-[#AAB8C2] leading-relaxed">
                    <strong>School Policy Evaluation:</strong> A separate evaluation engine that compares multiple environmental parameters (Heat Index, PM10, PM2.5, wind gusts, visibility) against school-approved thresholds for specific student activity types.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-amber-50/70 dark:bg-[#2A201A] border border-amber-200 dark:border-amber-800/60 space-y-2">
                  <h3 className="font-bold text-sm text-amber-950 dark:text-[#F4F6F8] flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4 text-amber-700 dark:text-[#E8874A]" />
                    <span>NOAA Steadman Heat Index</span>
                  </h3>
                  <p className="text-[#333] dark:text-[#AAB8C2] leading-relaxed">
                    Calculated using the official NOAA/NWS Steadman regression formula combining dry-bulb ambient temperature and relative humidity.
                  </p>
                  <p className="text-[#333] dark:text-[#AAB8C2] leading-relaxed">
                    Categorised into five standardized brackets (NWS general reference, not school policy): <strong>Below Caution range</strong>, <strong>Caution</strong>, <strong>Extreme Caution</strong>, <strong>Danger</strong>, and <strong>Extreme Danger</strong>.
                  </p>
                  <p className="text-[#333] dark:text-[#AAB8C2] leading-relaxed">
                    Where the heat index is not meaningful (temperatures below 20°C / 68°F) or data is missing, the system displays <strong>not applicable</strong>. All operational activity rules must come from approved school policy, not general references.
                  </p>
                </div>
              </div>
            </OutlineDrawBody>

            <OutlineDrawVisual>
              <div className="p-3.5 bg-gray-50 dark:bg-[#18242E] rounded-lg border border-gray-200 dark:border-[#354651] text-xs space-y-2">
                <h4 className="font-bold text-[#1A1A1A] dark:text-[#F4F6F8]">Rule Hierarchy &amp; Decision Precedence:</h4>
                <p className="text-[#4A4F57] dark:text-[#AAB8C2] leading-relaxed">
                  When multiple thresholds are simultaneously triggered (e.g. Extreme Heat Index + Elevated Dust), the system applies strict safety precedence:
                  <br />
                  <span className="font-semibold text-red-700 dark:text-red-400">Cancel / Move Indoors</span> takes precedence over <span className="font-semibold text-amber-700 dark:text-amber-400">Shorten / Restrict</span>, which takes precedence over <span className="font-semibold text-emerald-700 dark:text-emerald-400">Normal Outdoor Activity</span>.
                  DustWatch always explains exactly which condition triggered the recommendation.
                </p>
              </div>
            </OutlineDrawVisual>
          </div>
        )}
      </OutlineDrawCard>

      {/* 3. Data Sources & Transparency Matrix */}
      <section className="bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowMatrixDetails(!showMatrixDetails)}
            aria-expanded={showMatrixDetails}
            aria-controls="how-it-works-matrix-details"
            className="text-left flex items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
          >
            <Database className="w-4 h-4 text-blue-700 dark:text-sky-400" />
            <h2 className="text-base font-bold text-[#1A1A1A] dark:text-[#F4F6F8] hover:text-blue-700 dark:hover:text-sky-400 transition-colors">
              Data Sources &amp; Model Provenance Matrix
            </h2>
          </button>
          <button
            type="button"
            onClick={() => setShowMatrixDetails(!showMatrixDetails)}
            aria-expanded={showMatrixDetails}
            aria-controls="how-it-works-matrix-details"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-900 dark:text-sky-300 hover:text-black dark:hover:text-white bg-blue-50 dark:bg-[#263743] hover:bg-blue-100/80 dark:hover:bg-[#354651] px-2.5 py-1 rounded transition-colors cursor-pointer border border-blue-200 dark:border-[#354651]"
          >
            <span>{showMatrixDetails ? 'Hide Data Sources Matrix' : 'View Provenance Matrix & Data Sources'}</span>
            {showMatrixDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-sm text-[#1A1A1A] dark:text-[#AAB8C2] leading-relaxed">
          Full scientific transparency regarding the operational data feeds, physical sensors, and reanalysis models utilized across DustWatch:
        </p>

        {showMatrixDetails && (
          <div id="how-it-works-matrix-details" className="space-y-4 pt-1">
            <div className="overflow-x-auto border border-[#D5D9DF] dark:border-[#354651] rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 dark:bg-[#18242E] border-b border-[#D5D9DF] dark:border-[#354651] text-[#1A1A1A] dark:text-[#F4F6F8]">
                  <tr>
                    <th className="py-2.5 px-3 font-bold">Data Feed / System</th>
                    <th className="py-2.5 px-3 font-bold">Parameters / Variables</th>
                    <th className="py-2.5 px-3 font-bold">Nature / Model Provenance</th>
                    <th className="py-2.5 px-3 font-bold">Role in DustWatch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-[#354651] text-gray-700 dark:text-[#D4DFE6]">
                  <tr className="hover:bg-gray-50 dark:hover:bg-[#263743]/50">
                    <td className="py-2.5 px-3 font-semibold text-blue-900 dark:text-sky-300">Open-Meteo Weather API</td>
                    <td className="py-2.5 px-3">Temperature, Relative Humidity, Wind Speed, Wind Gusts, Wind Direction, Visibility</td>
                    <td className="py-2.5 px-3">Open-Meteo weather model forecast (model selection varies)</td>
                    <td className="py-2.5 px-3">Atmospheric forcing for dust transport, convective gust scoring &amp; Heat Index</td>
                  </tr>
                  <tr className="hover:bg-gray-50 dark:hover:bg-[#263743]/50">
                    <td className="py-2.5 px-3 font-semibold text-amber-900 dark:text-amber-300">Open-Meteo Air Quality API</td>
                    <td className="py-2.5 px-3">PM10, PM2.5, Dust Concentration, Aerosol Optical Depth (AOD @ 550nm)</td>
                    <td className="py-2.5 px-3 text-amber-800 dark:text-amber-200 font-medium">Chemical transport model forecasts (Copernicus CAMS). Model-derived, NOT live ground-level optical monitors.</td>
                    <td className="py-2.5 px-3">Particulate loading for 12-hour dust scoring and school policy checks</td>
                  </tr>
                  <tr className="hover:bg-gray-50 dark:hover:bg-[#263743]/50">
                    <td className="py-2.5 px-3 font-semibold text-purple-900 dark:text-purple-300">NASA Earthdata &amp; Worldview</td>
                    <td className="py-2.5 px-3">True-color imagery &amp; Corrected Reflectance (MODIS Terra/Aqua, VIIRS SNPP/NOAA-20)</td>
                    <td className="py-2.5 px-3">Spaceborne polar-orbiting satellite optical radiometer sensors</td>
                    <td className="py-2.5 px-3">Contextual verification link for visual tracking of synoptic dust plumes (not scored)</td>
                  </tr>
                  <tr className="hover:bg-gray-50 dark:hover:bg-[#263743]/50">
                    <td className="py-2.5 px-3 font-semibold text-emerald-900 dark:text-emerald-300">NASA MERRA-2 Reanalysis</td>
                    <td className="py-2.5 px-3 font-mono">DUCMASS (Dust column mass density, kg/m²), TOTEXTTAU (Aerosol optical thickness extinction @ 550nm)</td>
                    <td className="py-2.5 px-3">Global atmospheric reanalysis incorporating Goddard Earth Observing System (GEOS-5)</td>
                    <td className="py-2.5 px-3">Historical dust climatology research and offline ground-truth event labelling framework</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-[#2A201A] rounded-md border border-amber-200 dark:border-amber-800/60 text-xs text-amber-950 dark:text-amber-200 space-y-1">
              <p>
                <strong>Critical Sensor vs. Model Distinction:</strong> PM10 and PM2.5 fields from open APIs are model-based atmospheric chemistry simulations. They represent total particulate matter from all sources (including combustion, sea spray, and construction), not dust exclusively.
              </p>
              <p>
                <strong>Provisional Calibration:</strong> All thresholds and weights are provisional student team starting points. They have not been clinically or meteorologically validated by government health authorities.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* 4. What DustWatch Predicts and Does Not */}
      <section className="bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPredictsDetails(!showPredictsDetails)}
            aria-expanded={showPredictsDetails}
            aria-controls="how-it-works-predicts-details"
            className="text-left flex items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 rounded"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-base font-bold text-[#1A1A1A] dark:text-[#F4F6F8] hover:text-amber-800 dark:hover:text-amber-400 transition-colors">
              {STRINGS.howItWorks.predictsTitle}
            </h2>
          </button>
          <button
            type="button"
            onClick={() => setShowPredictsDetails(!showPredictsDetails)}
            aria-expanded={showPredictsDetails}
            aria-controls="how-it-works-predicts-details"
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 dark:text-amber-300 hover:text-black dark:hover:text-white bg-amber-50 dark:bg-[#263743] hover:bg-amber-100/80 dark:hover:bg-[#354651] px-2.5 py-1 rounded transition-colors cursor-pointer border border-amber-200 dark:border-[#354651]"
          >
            <span>{showPredictsDetails ? 'Hide Predictive Scope' : 'View Predictive Capabilities & Boundaries'}</span>
            {showPredictsDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showPredictsDetails && (
          <div id="how-it-works-predicts-details" className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {STRINGS.howItWorks.predictsItems.map((item, idx) => (
              <div key={idx} className="p-3 rounded-md bg-gray-50 dark:bg-[#18242E] border border-gray-200 dark:border-[#354651]">
                <h3 className="font-bold text-sm text-[#1A1A1A] dark:text-[#F4F6F8] mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-[#4A4F57] dark:text-[#AAB8C2] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Responsible AI Principles & Human Safety */}
      <section className="bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg p-5 shadow-sm space-y-3">
        <h2 className="text-base font-bold text-[#1A1A1A] dark:text-[#F4F6F8] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          <span>{STRINGS.howItWorks.responsibleTitle}</span>
        </h2>
        <p className="text-sm text-[#1A1A1A] dark:text-[#AAB8C2] leading-relaxed">
          {STRINGS.howItWorks.responsibleDesc}
        </p>
        <div className="pt-2">
          <a
            href={STRINGS.disclaimer.ncmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-sky-400 hover:text-blue-900 dark:hover:text-sky-300 underline"
          >
            <span>Visit the UAE National Center of Meteorology (NCM)</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* 6. What Gemini Does vs. What the Team Built */}
      <section className="bg-white dark:bg-[#1E2D38] border border-[#D5D9DF] dark:border-[#354651] rounded-lg p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowGeminiDetails(!showGeminiDetails)}
            aria-expanded={showGeminiDetails}
            aria-controls="how-it-works-gemini-scope"
            className="text-left flex items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
          >
            <MessageSquare className="w-4 h-4 text-blue-600 dark:text-sky-400" />
            <h2 className="text-base font-bold text-[#1A1A1A] dark:text-[#F4F6F8] hover:text-blue-700 dark:hover:text-sky-400 transition-colors">
              {STRINGS.howItWorks.geminiTitle}
            </h2>
          </button>
          <button
            type="button"
            onClick={() => setShowGeminiDetails(!showGeminiDetails)}
            aria-expanded={showGeminiDetails}
            aria-controls="how-it-works-gemini-scope"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-900 dark:text-sky-300 hover:text-black dark:hover:text-white bg-blue-50 dark:bg-[#263743] hover:bg-blue-100/80 dark:hover:bg-[#354651] px-2.5 py-1 rounded transition-colors cursor-pointer border border-blue-200 dark:border-[#354651]"
          >
            <span>{showGeminiDetails ? 'Hide Model Separation Details' : 'View AI vs Deterministic Logic Scope'}</span>
            {showGeminiDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
        {showGeminiDetails && (
          <p id="how-it-works-gemini-scope" className="text-sm text-[#1A1A1A] dark:text-[#AAB8C2] leading-relaxed pt-1">
            {STRINGS.howItWorks.geminiDesc}
          </p>
        )}
      </section>
    </div>
  );
};
