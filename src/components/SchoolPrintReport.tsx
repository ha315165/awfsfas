/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  HourlySchoolAssessment,
  SchoolActivityType,
  SchoolPolicyConfig,
  CityOutlook,
} from '../types.ts';
import {
  formatDubaiDateTime,
  getActivityLabel,
  getActionPrintBadge,
  getPolicyStatusDetails,
} from '../utils/printReport.ts';
import { getMetricUnit } from '../schoolPolicy.ts';

interface SchoolPrintReportProps {
  outlook: CityOutlook;
  selectedAssessment: HourlySchoolAssessment;
  selectedActivity: SchoolActivityType;
  schoolPolicy: SchoolPolicyConfig;
  generatedDate?: Date;
}

export const SchoolPrintReport: React.FC<SchoolPrintReportProps> = ({
  outlook,
  selectedAssessment,
  selectedActivity,
  schoolPolicy,
  generatedDate = new Date(),
}) => {
  const readings = selectedAssessment.environmentalReadings;
  const currentActivityAssessment = selectedAssessment.activityAssessments[selectedActivity];
  const actionBadge = getActionPrintBadge(currentActivityAssessment?.recommendedAction || 'continue');
  const policyStatus = getPolicyStatusDetails(schoolPolicy);
  const formattedDubaiTime = formatDubaiDateTime(generatedDate);

  // Relevant active policy rules evaluated for this activity
  const relevantRules = schoolPolicy.rules.filter(
    (r) => r.enabled !== false && (r.activity === 'all' || r.activity === selectedActivity)
  );

  const triggeredRuleIds = new Set(
    currentActivityAssessment?.triggeredRules
      ?.filter((tr) => tr.isTriggered)
      ?.map((tr) => tr.rule.id) || []
  );

  return (
    <div
      id="school-printable-report"
      data-testid="school-printable-report"
      className="bg-white text-slate-900 font-sans p-6 sm:p-8 max-w-[210mm] mx-auto text-xs leading-normal"
      style={{ color: '#0F172A', backgroundColor: '#FFFFFF' }}
    >
      {/* 1. Header: Branding, Report Title, Timestamp & Reference ID */}
      <div className="border-b-2 border-slate-900 pb-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-black text-lg tracking-wider text-slate-900 uppercase">
                DustWatch UAE
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                Atmospheric Intelligence
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-950 tracking-tight">
              School Outdoor Activity Assessment Report
            </h1>
            <p className="text-[11px] text-slate-600">
              Deterministic evaluation of meteorological conditions against school safety policy criteria.
            </p>
          </div>

          <div className="text-right text-[11px] space-y-0.5 shrink-0">
            <div className="font-bold text-slate-900">
              Generated: <span className="font-mono text-slate-800">{formattedDubaiTime}</span>
            </div>
            <div className="text-slate-600 font-mono text-[10px]">
              Ref: DW-SAR-{outlook.city.id.toUpperCase()}-{selectedAssessment.displayHour.replace(':', '')}
            </div>
            <div className="text-slate-600 text-[10px]">
              Standard: Asia/Dubai (GST, UTC+4)
            </div>
          </div>
        </div>
      </div>

      {/* 2. Parameters Summary Strip: Location, Activity, Hour, Policy Source */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded bg-slate-50 border border-slate-300 mb-4 print-avoid-break">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Campus Location</span>
          <span className="font-bold text-sm text-slate-900">{outlook.city.name}</span>
          <span className="text-[10px] text-slate-500 block">{outlook.city.emirate || 'United Arab Emirates'}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Scheduled Activity</span>
          <span className="font-bold text-sm text-slate-900">{getActivityLabel(selectedActivity)}</span>
          <span className="text-[10px] text-slate-500 block">Target cohort</span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Assessment Window</span>
          <span className="font-bold text-sm text-slate-900">{selectedAssessment.displayHour} GST</span>
          <span className="text-[10px] text-slate-500 block">1-hour forecast horizon</span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Policy Authority</span>
          <span className="font-bold text-sm text-slate-900 truncate block">{schoolPolicy.schoolName}</span>
          <span className="text-[10px] text-slate-500 block font-mono">v{schoolPolicy.policyVersion}</span>
        </div>
      </div>

      {/* 3. Primary Assessment Outcome & Recommended Action */}
      <div
        className="p-4 rounded-lg border-2 mb-4 print-avoid-break"
        style={{
          borderColor: actionBadge.borderColor,
          backgroundColor: actionBadge.bgColor,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-2 mb-2" style={{ borderColor: `${actionBadge.borderColor}40` }}>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600 block">
              Assessment Outcome & Deterministic Recommendation
            </span>
            <span
              className="text-base font-black tracking-wide"
              style={{ color: actionBadge.textColor }}
            >
              {actionBadge.label}
            </span>
          </div>

          <div className="text-right">
            <span
              className="px-2.5 py-1 rounded text-xs font-black uppercase border inline-block"
              style={{
                borderColor: actionBadge.borderColor,
                color: actionBadge.textColor,
                backgroundColor: '#FFFFFF',
              }}
            >
              {currentActivityAssessment?.recommendedAction ? currentActivityAssessment.recommendedAction.replace('_', ' ').toUpperCase() : 'PENDING'}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="font-bold text-sm text-slate-950">
            {currentActivityAssessment?.actionTitle || 'Evaluation Status Pending'}
          </div>
          <p className="text-xs text-slate-800 leading-relaxed">
            {currentActivityAssessment?.primaryGuidance || 'Review school policy guidelines before student activity.'}
          </p>
        </div>

        {currentActivityAssessment?.requiresHumanReview && (
          <div className="mt-2.5 p-2 bg-amber-100 border border-amber-400 rounded text-amber-950 text-[11px] font-semibold">
            ATTENTION: A triggered rule mandates real-time evaluation by school health staff or designated safety officers. Automated advice does not replace manual staff sign-off.
          </div>
        )}

        {currentActivityAssessment?.conflictingRules && (
          <div className="mt-2 p-2 bg-red-100 border border-red-400 rounded text-red-950 text-[11px] font-semibold">
            CONFLICT WARNING: Multiple policy rules specified conflicting action directives. The engine automatically enforced the highest-protection action.
          </div>
        )}
      </div>

      {/* 4. Policy Ratification & Operational Validity Notice */}
      <div
        className={`p-2.5 rounded border mb-4 text-[11px] print-avoid-break ${
          policyStatus.isOperational
            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
            : 'bg-amber-50 border-amber-300 text-amber-950'
        }`}
      >
        <div className="font-bold uppercase tracking-wider text-[10px] mb-0.5">
          {policyStatus.badgeLabel}
        </div>
        <p className="leading-relaxed">{policyStatus.noticeText}</p>
        {schoolPolicy.isApproved && schoolPolicy.isConfigured && !schoolPolicy.isFictionalDemo && (
          <div className="text-[10px] text-slate-600 mt-1">
            Source document: {schoolPolicy.sourceDocument || 'School Health & Safety Guidelines'} · Effective: {schoolPolicy.effectiveDate}
          </div>
        )}
      </div>

      {/* 5. Environmental Telemetry Table for Selected Hour */}
      <div className="mb-4 print-avoid-break">
        <div className="flex items-center justify-between border-b border-slate-300 pb-1.5 mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Environmental Telemetry & Observations ({selectedAssessment.displayHour} GST)
          </h2>
          <span className="text-[10px] text-slate-500">
            Regional Dust Risk: <strong>{outlook.peakLevel}</strong>
          </span>
        </div>

        <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
              <th className="p-2 border-r border-slate-300">Observation Metric</th>
              <th className="p-2 border-r border-slate-300">Measured / Forecast Value</th>
              <th className="p-2 border-r border-slate-300">Observation Metric</th>
              <th className="p-2">Measured / Forecast Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <tr>
              <td className="p-2 font-medium border-r border-slate-200 bg-slate-50/50">Air Temperature</td>
              <td className="p-2 font-bold border-r border-slate-200">
                {readings.temperature !== null ? `${readings.temperature} °C` : <span className="text-amber-800">Unavailable</span>}
              </td>
              <td className="p-2 font-medium border-r border-slate-200 bg-slate-50/50">Relative Humidity</td>
              <td className="p-2 font-bold">
                {readings.relativeHumidity !== null ? `${readings.relativeHumidity} %` : <span className="text-amber-800">Unavailable</span>}
              </td>
            </tr>
            <tr>
              <td className="p-2 font-medium border-r border-slate-200 bg-slate-50/50">Heat Index (Apparent)</td>
              <td className="p-2 font-bold border-r border-slate-200">
                {readings.heatIndex.heatIndexCelsius !== null
                  ? `${readings.heatIndex.heatIndexCelsius} °C (${readings.heatIndex.category})`
                  : <span className="text-amber-800">Unavailable</span>}
              </td>
              <td className="p-2 font-medium border-r border-slate-200 bg-slate-50/50">PM10 Particulate</td>
              <td className="p-2 font-bold">
                {readings.pm10 !== null ? `${readings.pm10} µg/m³` : <span className="text-amber-800">Unavailable</span>}
              </td>
            </tr>
            <tr>
              <td className="p-2 font-medium border-r border-slate-200 bg-slate-50/50">PM2.5 Fine Particles</td>
              <td className="p-2 font-bold border-r border-slate-200">
                {readings.pm2_5 !== null ? `${readings.pm2_5} µg/m³` : <span className="text-amber-800">Unavailable</span>}
              </td>
              <td className="p-2 font-medium border-r border-slate-200 bg-slate-50/50">Mineral Dust Concentration</td>
              <td className="p-2 font-bold">
                {readings.dust !== null ? `${readings.dust} µg/m³` : <span className="text-amber-800">Unavailable</span>}
              </td>
            </tr>
            <tr>
              <td className="p-2 font-medium border-r border-slate-200 bg-slate-50/50">Wind Speed & Gusts</td>
              <td className="p-2 font-bold border-r border-slate-200">
                {readings.windSpeed !== null ? `${readings.windSpeed} km/h` : 'N/A'}{' '}
                {readings.windGusts !== null ? `(Gusts: ${readings.windGusts} km/h)` : ''}
              </td>
              <td className="p-2 font-medium border-r border-slate-200 bg-slate-50/50">Horizontal Visibility</td>
              <td className="p-2 font-bold">
                {readings.visibility !== null ? `${Math.round(readings.visibility)} m` : <span className="text-amber-800">Unavailable</span>}
              </td>
            </tr>
            <tr>
              <td className="p-2 font-medium border-r border-slate-200 bg-slate-50/50">1-Hr Total Precipitation</td>
              <td className="p-2 font-bold border-r border-slate-200">
                {readings.precipitation !== null
                  ? `${readings.precipitation} mm`
                  : readings.accumulatedRain !== null
                  ? `${readings.accumulatedRain} mm`
                  : <span className="text-amber-800">Unavailable</span>}
              </td>
              <td className="p-2 font-medium border-r border-slate-200 bg-slate-50/50">Rain / Showers / Probability</td>
              <td className="p-2 font-bold">
                {readings.rain !== null ? `${readings.rain} mm` : <span className="text-amber-800">Unavailable</span>}{' '}
                {readings.precipitationProbability !== null ? `(${readings.precipitationProbability}%)` : ''}
              </td>
            </tr>
            <tr>
              <td className="p-2 font-medium border-r border-slate-200 bg-slate-50/50">Official NCM Warning Status</td>
              <td colSpan={3} className="p-2 font-medium text-slate-800">
                {readings.ncmWarningStatus || 'Official warning feed unavailable — consult official alerts at ncm.ae'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 6. Applied School Policy Rules Evaluation Table */}
      <div className="mb-4 print-avoid-break">
        <div className="flex items-center justify-between border-b border-slate-300 pb-1.5 mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            School Policy Rules Evaluation ({relevantRules.length} Rules Applicable to Activity)
          </h2>
          <span className="text-[10px] text-slate-600">
            Deterministic Rule-Engine Output
          </span>
        </div>

        {relevantRules.length === 0 ? (
          <div className="p-3 bg-slate-50 border border-slate-200 text-slate-700 text-xs italic">
            No policy rules are configured for this activity in the current school policy.
          </div>
        ) : (
          <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <th className="p-2 border-r border-slate-300">Rule Name & ID</th>
                <th className="p-2 border-r border-slate-300">Target Metric</th>
                <th className="p-2 border-r border-slate-300">Threshold Criteria</th>
                <th className="p-2 border-r border-slate-300">Observed Telemetry</th>
                <th className="p-2 border-r border-slate-300">Evaluation</th>
                <th className="p-2">Triggered Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {relevantRules.map((rule) => {
                const isTriggered = triggeredRuleIds.has(rule.id);
                const unit = getMetricUnit(rule.metric);

                // Find observed value if available
                const tr = currentActivityAssessment?.triggeredRules?.find((r) => r.rule.id === rule.id);
                const observedText = tr
                  ? `${tr.observedValue} ${tr.unit}`
                  : rule.metric === 'temperature'
                  ? readings.temperature !== null ? `${readings.temperature} °C` : 'N/A'
                  : rule.metric === 'heat_index'
                  ? readings.heatIndex.heatIndexCelsius !== null ? `${readings.heatIndex.heatIndexCelsius} °C` : 'N/A'
                  : rule.metric === 'pm10'
                  ? readings.pm10 !== null ? `${readings.pm10} µg/m³` : 'N/A'
                  : rule.metric === 'pm2_5'
                  ? readings.pm2_5 !== null ? `${readings.pm2_5} µg/m³` : 'N/A'
                  : rule.metric === 'dust'
                  ? readings.dust !== null ? `${readings.dust} µg/m³` : 'N/A'
                  : rule.metric === 'wind_speed'
                  ? readings.windSpeed !== null ? `${readings.windSpeed} km/h` : 'N/A'
                  : rule.metric === 'wind_gusts'
                  ? readings.windGusts !== null ? `${readings.windGusts} km/h` : 'N/A'
                  : rule.metric === 'visibility'
                  ? readings.visibility !== null ? `${readings.visibility} m` : 'N/A'
                  : rule.metric === 'rain_rate'
                  ? readings.rainRate !== null ? `${readings.rainRate} mm/h` : readings.rain !== null ? `${readings.rain} mm` : 'N/A'
                  : rule.metric === 'accumulated_rain' || rule.metric === 'precipitation'
                  ? readings.accumulatedRain !== null ? `${readings.accumulatedRain} mm` : readings.precipitation !== null ? `${readings.precipitation} mm` : 'N/A'
                  : 'N/A';

                return (
                  <tr
                    key={rule.id}
                    className={isTriggered ? 'bg-amber-50/70 font-semibold text-slate-900' : 'text-slate-800'}
                  >
                    <td className="p-2 border-r border-slate-200">
                      <div>{rule.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">{rule.id}</div>
                    </td>
                    <td className="p-2 border-r border-slate-200 capitalize font-mono text-[10px]">
                      {(rule.metric || '').replace('_', ' ')}
                    </td>
                    <td className="p-2 border-r border-slate-200 font-mono text-[10px]">
                      {rule.operator} {rule.threshold} {unit}
                    </td>
                    <td className="p-2 border-r border-slate-200 font-mono text-[10px]">
                      {observedText}
                    </td>
                    <td className="p-2 border-r border-slate-200">
                      {isTriggered ? (
                        <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-900 border border-red-300 font-bold text-[10px] uppercase">
                          Triggered
                        </span>
                      ) : (
                        <span className="text-emerald-800 text-[10px] font-medium">
                          Within Limits
                        </span>
                      )}
                    </td>
                    <td className="p-2 font-mono text-[10px] uppercase">
                      {(rule.recommendedAction || 'continue').replace('_', ' ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 7. Missing Telemetry / Warnings Notice */}
      {currentActivityAssessment?.isIncomplete && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded mb-4 text-xs text-amber-950 print-avoid-break">
          <strong>Notice of Incomplete Sensor Telemetry:</strong> One or more environmental parameters required by the school policy could not be verified due to missing or stale sensor feeds. DustWatch enforces safety-first evaluation and never substitutes zeros for missing telemetry.
        </div>
      )}

      {/* 8. Disclaimers, NCM Authority & Regulatory Notes */}
      <div className="p-3.5 bg-slate-50 border border-slate-300 rounded mb-4 text-[10px] text-slate-700 space-y-1.5 print-avoid-break">
        <p className="font-bold text-slate-900">
          DustWatch Operational Disclaimer & Professional Medical / Meteorological Guidance:
        </p>
        <p className="leading-relaxed">
          1. <strong>Deterministic Support:</strong> This report is generated by DustWatch UAE to support school administrative, nursing, and physical education personnel. It provides deterministic evaluations based on numerical weather predictions and approved school criteria.
        </p>
        <p className="leading-relaxed">
          2. <strong>Professional Judgement Required:</strong> This assessment does NOT replace professional medical advice, local campus hazard assessments, or administrative discretion. On-site staff must visually inspect school fields and campus environments prior to releasing students outdoors.
        </p>
        <p className="leading-relaxed">
          3. <strong>Official Warnings Supersede:</strong> National Center of Meteorology (NCM) official weather warnings, Ministry of Education directives, and emergency authority mandates strictly supersede any internal school policy calculations or recommendations.
        </p>
      </div>

      {/* 9. Authorized School Staff Sign-off Section */}
      <div className="border border-slate-300 rounded p-3.5 bg-white print-avoid-break">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">
          Campus Verification & Action Log (For School Health / PE Records)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px] pt-1">
          <div>
            <span className="text-slate-500 block text-[10px]">Evaluated By (Staff Name):</span>
            <div className="border-b border-slate-400 h-6 mt-1"></div>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Designation / Role:</span>
            <div className="border-b border-slate-400 h-6 mt-1"></div>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Action Implemented:</span>
            <div className="flex items-center gap-2 mt-2 text-[10px] font-medium">
              <span>[ ] Approved</span>
              <span>[ ] Modified</span>
              <span>[ ] Relocated</span>
            </div>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Staff Signature & Time:</span>
            <div className="border-b border-slate-400 h-6 mt-1"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
