/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SchoolRecommendedAction } from '../types.ts';
import { canonicalAction } from '../schoolPolicy.ts';

export interface SchoolPdfData {
  cityName: string;
  emirateName?: string;
  activityLabel: string;
  generatedDateFormatted: string;
  assessmentHour: string;
  actionTitle?: string;
  primaryGuidance?: string;
  outcomeBadge: {
    label: string;
    description: string;
    action: SchoolRecommendedAction | string;
  };
  policyStatus: {
    badgeLabel: string;
    noticeText: string;
    schoolName: string;
    policyVersion: string;
    effectiveDate: string;
    approvedBy?: string;
  };
  environmentalReadings: {
    temperature: number | null;
    relativeHumidity: number | null;
    heatIndexCelsius: number | null;
    heatIndexCategory?: string;
    pm10: number | null;
    pm2_5: number | null;
    dust: number | null;
    windSpeed: number | null;
    windGusts: number | null;
    visibility: number | null;
    rain?: number | null;
    ncmWarningStatus?: string;
  };
  appliedRules: Array<{
    id: string;
    name: string;
    metric: string;
    operator: string;
    threshold: number | null;
    unit: string;
    recommendedAction: string;
  }>;
}

export interface SavePdfResult {
  success: boolean;
  filename: string;
  blob: Blob;
  size: number;
}

/**
 * Escapes characters for PDF literal strings in parentheses.
 */
function escapePdfString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    // Replace non-ASCII characters with safe representations for standard Type 1 Helvetica
    .replace(/°/g, ' deg ')
    .replace(/µ/g, 'u')
    .replace(/³/g, '3')
    .replace(/—/g, ' - ')
    .replace(/–/g, ' - ')
    .replace(/“/g, '"')
    .replace(/”/g, '"')
    .replace(/‘/g, "'")
    .replace(/’/g, "'");
}

/**
 * Builds a valid, self-contained ISO 32000-1 (PDF 1.4) document containing the
 * complete School Assessment Report.
 */
export function generateSchoolAssessmentPdfBytes(data: SchoolPdfData): Uint8Array {
  // A4 dimensions in PDF points (72 points per inch)
  // Width: 595.28 pt, Height: 841.89 pt
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36; // 0.5 inch margins
  const contentWidth = pageWidth - margin * 2;

  const ops: string[] = [];

  // Helper to draw a filled rectangle
  const fillRect = (x: number, y: number, w: number, h: number, r: number, g: number, b: number) => {
    ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
    ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  };

  // Helper to draw a stroked rectangle
  const strokeRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    g: number,
    b: number,
    lineWidth = 1
  ) => {
    ops.push(`${lineWidth.toFixed(2)} w`);
    ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
    ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
  };

  // Helper to draw a horizontal line
  const drawLine = (x1: number, y1: number, x2: number, y2: number, r: number, g: number, b: number, lineWidth = 1) => {
    ops.push(`${lineWidth.toFixed(2)} w`);
    ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
    ops.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  };

  // Helper to draw text
  const drawText = (
    text: string,
    x: number,
    y: number,
    font = 'F1',
    size = 10,
    r = 0.1,
    g = 0.1,
    b = 0.1
  ) => {
    ops.push('BT');
    ops.push(`/${font} ${size} Tf`);
    ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
    ops.push(`${x.toFixed(2)} ${y.toFixed(2)} Td`);
    ops.push(`(${escapePdfString(text)}) Tj`);
    ops.push('ET');
  };

  // 1. Header Banner (Dark teal background matching DustWatch brand)
  const headerHeight = 62;
  const headerY = pageHeight - margin - headerHeight;
  fillRect(margin, headerY, contentWidth, headerHeight, 0.075, 0.306, 0.29); // #134e4a
  drawText('DUSTWATCH UAE', margin + 14, headerY + 40, 'F2', 15, 1, 1, 1);
  drawText('School Outdoor Activity Assessment Report', margin + 14, headerY + 24, 'F2', 11, 0.95, 0.95, 0.95);
  drawText(
    `Official Assessment: ${data.cityName}${data.emirateName ? ' (' + data.emirateName + ')' : ''} | Generated: ${data.generatedDateFormatted}`,
    margin + 14,
    headerY + 10,
    'F1',
    8.5,
    0.85,
    0.92,
    0.9
  );

  // 2. Action Outcome Card
  const action = canonicalAction(data.outcomeBadge.action);
  let bgR = 0.94, bgG = 0.99, bgB = 0.95; // default light green
  let bdR = 0.08, bdG = 0.5, bdB = 0.24;
  let txR = 0.08, txG = 0.33, txB = 0.18;

  if (action === 'modify') {
    bgR = 1.0; bgG = 0.98; bgB = 0.92; // amber
    bdR = 0.85; bdG = 0.47; bdB = 0.02;
    txR = 0.47; txG = 0.21; txB = 0.06;
  } else if (action === 'relocate') {
    bgR = 1.0; bgG = 0.97; bgB = 0.93; // orange
    bdR = 0.92; bdG = 0.35; bdB = 0.05;
    txR = 0.49; txG = 0.18; txB = 0.07;
  } else if (action === 'suspend') {
    bgR = 0.99; bgG = 0.95; bgB = 0.95; // red
    bdR = 0.86; bdG = 0.15; bdB = 0.15;
    txR = 0.5; txG = 0.11; txB = 0.11;
  } else if (action === 'human_review') {
    bgR = 1.0; bgG = 0.95; bgB = 0.78; // yellow amber
    bdR = 0.71; bdG = 0.33; bdB = 0.04;
    txR = 0.47; txG = 0.21; txB = 0.06;
  }

  const outcomeCardY = headerY - 78;
  fillRect(margin, outcomeCardY, contentWidth, 70, bgR, bgG, bgB);
  strokeRect(margin, outcomeCardY, contentWidth, 70, bdR, bdG, bdB, 1.5);

  drawText(`ASSESSMENT OUTCOME: ${data.outcomeBadge.label}`, margin + 12, outcomeCardY + 52, 'F2', 11, txR, txG, txB);
  drawText(
    `Selected Activity: ${data.activityLabel} | Assessment Hour: ${data.assessmentHour}`,
    margin + 12,
    outcomeCardY + 38,
    'F2',
    9,
    0.15,
    0.2,
    0.25
  );
  if (data.actionTitle) {
    drawText(`Instruction: ${data.actionTitle}`, margin + 12, outcomeCardY + 24, 'F2', 8.5, txR, txG, txB);
  }
  drawText(data.outcomeBadge.description, margin + 12, outcomeCardY + 10, 'F1', 8, 0.2, 0.25, 0.3);

  // 3. Policy Classification Card
  const policyCardY = outcomeCardY - 48;
  fillRect(margin, policyCardY, contentWidth, 40, 0.96, 0.97, 0.98);
  strokeRect(margin, policyCardY, contentWidth, 40, 0.8, 0.84, 0.88, 1);
  drawText(`POLICY STATUS: ${data.policyStatus.badgeLabel}`, margin + 10, policyCardY + 26, 'F2', 9, 0.1, 0.2, 0.35);
  drawText(data.policyStatus.noticeText, margin + 10, policyCardY + 12, 'F1', 8, 0.3, 0.35, 0.4);

  // 4. Environmental Readings Section & Table
  const envHeaderY = policyCardY - 24;
  drawText('ENVIRONMENTAL OBSERVATIONS & MEASUREMENTS', margin, envHeaderY, 'F2', 10, 0.1, 0.15, 0.2);

  const envTableY = envHeaderY - 142;
  const envTableHeight = 136;
  fillRect(margin, envTableY, contentWidth, envTableHeight, 1, 1, 1);
  strokeRect(margin, envTableY, contentWidth, envTableHeight, 0.8, 0.84, 0.88, 1);

  // Table row definitions
  const envRows = [
    { label: 'Ambient Temperature', value: data.environmentalReadings.temperature != null ? `${data.environmentalReadings.temperature} deg C` : 'N/A', note: 'Measured 2m standard' },
    { label: 'Relative Humidity', value: data.environmentalReadings.relativeHumidity != null ? `${data.environmentalReadings.relativeHumidity} %` : 'N/A', note: 'Atmospheric moisture' },
    { label: 'Heat Index (Apparent)', value: data.environmentalReadings.heatIndexCelsius != null ? `${data.environmentalReadings.heatIndexCelsius} deg C (${data.environmentalReadings.heatIndexCategory || 'Normal'})` : 'N/A', note: 'NWS Steadman equation' },
    { label: 'Particulate Matter PM10', value: data.environmentalReadings.pm10 != null ? `${data.environmentalReadings.pm10} ug/m3` : 'N/A', note: 'Inhalable coarse particles' },
    { label: 'Particulate Matter PM2.5', value: data.environmentalReadings.pm2_5 != null ? `${data.environmentalReadings.pm2_5} ug/m3` : 'N/A', note: 'Fine inhalable particles' },
    { label: 'Mineral Dust Concentration', value: data.environmentalReadings.dust != null ? `${data.environmentalReadings.dust} ug/m3` : 'N/A', note: 'Desert mineral aerosol' },
    { label: 'Wind Speed & Gusts', value: data.environmentalReadings.windSpeed != null ? `${data.environmentalReadings.windSpeed} km/h${data.environmentalReadings.windGusts != null ? ` (Gusts: ${data.environmentalReadings.windGusts} km/h)` : ''}` : 'N/A', note: '10m ground anemometer' },
    { label: 'Atmospheric Visibility', value: data.environmentalReadings.visibility != null ? `${data.environmentalReadings.visibility} meters` : 'N/A', note: 'Horizontal optical range' },
  ];

  // Table Header row
  fillRect(margin, envTableY + envTableHeight - 16, contentWidth, 16, 0.93, 0.95, 0.97);
  drawText('Parameter', margin + 8, envTableY + envTableHeight - 12, 'F2', 8, 0.2, 0.25, 0.3);
  drawText('Current Value', margin + 170, envTableY + envTableHeight - 12, 'F2', 8, 0.2, 0.25, 0.3);
  drawText('Measurement Basis', margin + 340, envTableY + envTableHeight - 12, 'F2', 8, 0.2, 0.25, 0.3);

  let rowY = envTableY + envTableHeight - 16;
  envRows.forEach((r, idx) => {
    rowY -= 15;
    if (idx % 2 === 0) {
      fillRect(margin, rowY, contentWidth, 15, 0.985, 0.99, 0.995);
    }
    drawLine(margin, rowY, margin + contentWidth, rowY, 0.9, 0.92, 0.94, 0.5);
    drawText(r.label, margin + 8, rowY + 4, 'F1', 7.5, 0.15, 0.2, 0.25);
    drawText(r.value, margin + 170, rowY + 4, 'F2', 7.5, 0.1, 0.15, 0.2);
    drawText(r.note, margin + 340, rowY + 4, 'F1', 7.5, 0.4, 0.45, 0.5);
  });

  // NCM Warning banner if present
  let currentY = envTableY - 18;
  if (data.environmentalReadings.ncmWarningStatus) {
    fillRect(margin, currentY - 14, contentWidth, 18, 0.99, 0.98, 0.92);
    strokeRect(margin, currentY - 14, contentWidth, 18, 0.9, 0.75, 0.2, 1);
    drawText(`NCM Official Warning: ${data.environmentalReadings.ncmWarningStatus}`, margin + 8, currentY - 8, 'F2', 7.5, 0.55, 0.35, 0.05);
    currentY -= 22;
  }

  // 5. Applied Policy Rules
  currentY -= 6;
  drawText('EVALUATED SCHOOL POLICY THRESHOLDS', margin, currentY, 'F2', 10, 0.1, 0.15, 0.2);
  currentY -= 14;

  const rules = data.appliedRules.slice(0, 4); // Display up to 4 key rules
  const rulesTableHeight = Math.max(34, rules.length * 15 + 16);
  fillRect(margin, currentY - rulesTableHeight, contentWidth, rulesTableHeight, 1, 1, 1);
  strokeRect(margin, currentY - rulesTableHeight, contentWidth, rulesTableHeight, 0.8, 0.84, 0.88, 1);

  // Rules header
  fillRect(margin, currentY - 16, contentWidth, 16, 0.93, 0.95, 0.97);
  drawText('Rule Name / ID', margin + 8, currentY - 12, 'F2', 8, 0.2, 0.25, 0.3);
  drawText('Metric & Condition', margin + 190, currentY - 12, 'F2', 8, 0.2, 0.25, 0.3);
  drawText('Required Action', margin + 370, currentY - 12, 'F2', 8, 0.2, 0.25, 0.3);

  let ruleRowY = currentY - 16;
  if (rules.length === 0) {
    ruleRowY -= 18;
    drawText('No custom threshold rules triggered for this hour.', margin + 8, ruleRowY + 5, 'F1', 8, 0.45, 0.5, 0.55);
  } else {
    rules.forEach((rule, idx) => {
      ruleRowY -= 15;
      if (idx % 2 === 0) {
        fillRect(margin, ruleRowY, contentWidth, 15, 0.985, 0.99, 0.995);
      }
      drawLine(margin, ruleRowY, margin + contentWidth, ruleRowY, 0.9, 0.92, 0.94, 0.5);
      drawText(`${rule.name} (${rule.id})`, margin + 8, ruleRowY + 4, 'F1', 7.5, 0.15, 0.2, 0.25);
      drawText(`${rule.metric} ${rule.operator} ${rule.threshold != null ? rule.threshold : '-'} ${rule.unit}`, margin + 190, ruleRowY + 4, 'F2', 7.5, 0.1, 0.15, 0.2);
      drawText(rule.recommendedAction.toUpperCase(), margin + 370, ruleRowY + 4, 'F2', 7.5, 0.2, 0.4, 0.2);
    });
  }

  currentY -= rulesTableHeight + 12;

  // 6. Campus Sign-Off & Verification
  const signOffHeight = 44;
  fillRect(margin, currentY - signOffHeight, contentWidth, signOffHeight, 0.97, 0.98, 0.99);
  strokeRect(margin, currentY - signOffHeight, contentWidth, signOffHeight, 0.8, 0.84, 0.88, 1);

  drawText('CAMPUS VERIFICATION & STAFF SIGN-OFF', margin + 8, currentY - 12, 'F2', 8, 0.15, 0.2, 0.25);
  drawLine(margin + 8, currentY - 32, margin + 170, currentY - 32, 0.6, 0.65, 0.7, 0.8);
  drawText('Evaluated By (Staff Name / Nurse)', margin + 8, currentY - 40, 'F1', 6.5, 0.4, 0.45, 0.5);

  drawLine(margin + 185, currentY - 32, margin + 345, currentY - 32, 0.6, 0.65, 0.7, 0.8);
  drawText('Staff Signature & Campus Role', margin + 185, currentY - 40, 'F1', 6.5, 0.4, 0.45, 0.5);

  drawLine(margin + 360, currentY - 32, margin + contentWidth - 10, currentY - 32, 0.6, 0.65, 0.7, 0.8);
  drawText('Date & Time Signed (GST)', margin + 360, currentY - 40, 'F1', 6.5, 0.4, 0.45, 0.5);

  currentY -= signOffHeight + 10;

  // 7. Deterministic Support Disclaimers
  drawText(
    'IMPORTANT DISCLAIMER: This automated assessment provides deterministic decision support based on school policy rules and regional sensor models.',
    margin,
    currentY,
    'F2',
    6.8,
    0.35,
    0.4,
    0.45
  );
  drawText(
    'It does NOT replace professional medical or school staff judgement. Official directives from the UAE National Center of Meteorology (NCM) supersede all local policies.',
    margin,
    currentY - 9,
    'F1',
    6.5,
    0.45,
    0.5,
    0.55
  );

  // 8. Footer Line
  drawLine(margin, margin + 14, margin + contentWidth, margin + 14, 0.85, 0.88, 0.9, 0.8);
  drawText('DustWatch UAE - School Mode Safety Protocol | Official Assessment Report', margin, margin + 4, 'F1', 7, 0.5, 0.55, 0.6);
  drawText('Page 1 of 1 (A4 Standard)', margin + contentWidth - 95, margin + 4, 'F1', 7, 0.5, 0.55, 0.6);

  // Assemble PDF Objects
  const streamContent = ops.join('\n');
  const streamLength = Buffer.from(streamContent, 'utf-8').length;

  const objects: string[] = [
    // Object 1: Catalog
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    // Object 2: Pages
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    // Object 3: Page
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n`,
    // Object 4: Contents Stream
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    // Object 5: Font F1 (Helvetica Normal)
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    // Object 6: Font F2 (Helvetica Bold)
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
  ];

  let pdfString = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(Buffer.from(pdfString, 'utf-8').length);
    pdfString += obj;
  }

  const startXref = Buffer.from(pdfString, 'utf-8').length;
  pdfString += `xref\n0 ${objects.length + 1}\n`;
  pdfString += '0000000000 65535 f \n';
  for (const offset of offsets) {
    pdfString += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  pdfString += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(pdfString, 'utf-8'));
}

/**
 * Generates and downloads a real PDF assessment report to the user's filesystem.
 */
export function saveSchoolAssessmentPdf(data: SchoolPdfData, preferredFilename?: string): SavePdfResult {
  const bytes = generateSchoolAssessmentPdfBytes(data);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });

  const dateSlug = new Date().toISOString().slice(0, 10);
  const citySlug = data.cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const filename = preferredFilename || `DustWatch-School-Assessment-${citySlug}-${dateSlug}.pdf`;

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 250);
    } catch (e) {
      console.warn('Direct PDF download link click had an error, returning blob:', e);
    }
  }

  return {
    success: true,
    filename,
    blob,
    size: bytes.length,
  };
}
