/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SchoolActivityType,
  SchoolRecommendedAction,
  SchoolAssessmentStatus,
  SchoolPolicyConfig,
} from '../types.ts';
import { canonicalAction } from '../schoolPolicy.ts';

/**
 * Formats a Date object into UAE Gulf Standard Time (Asia/Dubai, UTC+4).
 * Guarantees consistent UAE timezone representation regardless of client browser local time.
 */
export function formatDubaiDateTime(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return `${formatter.format(date)} GST (Asia/Dubai)`;
}

/**
 * Returns human-readable school activity title.
 */
export function getActivityLabel(activity: SchoolActivityType | string): string {
  switch (activity) {
    case 'break':
      return 'Outdoor Break & Recess';
    case 'pe':
      return 'Physical Education (PE) & Outdoor Sports';
    case 'lunch_other':
    case 'lunch':
      return 'Lunch & Unstructured Outdoor Play';
    case 'assembly':
      return 'Outdoor Morning / School Assembly';
    default:
      return String(activity).replace('_', ' ').toUpperCase();
  }
}

/**
 * Returns canonical action badge display properties for printing.
 */
export function getActionPrintBadge(action: SchoolRecommendedAction | string): {
  label: string;
  borderColor: string;
  textColor: string;
  bgColor: string;
  description: string;
} {
  const c = canonicalAction(action);
  switch (c) {
    case 'continue':
      return {
        label: 'CONTINUE OUTDOOR ACTIVITY',
        borderColor: '#15803D',
        textColor: '#14532D',
        bgColor: '#F0FDF4',
        description: 'Conditions are within approved policy limits. Standard student hydration and supervision apply.',
      };
    case 'modify':
      return {
        label: 'MODIFY OUTDOOR ACTIVITY',
        borderColor: '#D97706',
        textColor: '#78350F',
        bgColor: '#FFFBEB',
        description: 'Conditions exceed cautionary thresholds. Reduce intensity, shorten exposure duration, or provide shade.',
      };
    case 'relocate':
      return {
        label: 'RELOCATE INDOORS',
        borderColor: '#EA580C',
        textColor: '#7C2D12',
        bgColor: '#FFF7ED',
        description: 'Outdoor conditions exceed safe operating criteria. Relocate scheduled activities to indoor facilities.',
      };
    case 'suspend':
      return {
        label: 'SUSPEND ALL OUTDOOR ACTIVITIES',
        borderColor: '#DC2626',
        textColor: '#7F1D1D',
        bgColor: '#FEF2F2',
        description: 'Severe environmental thresholds exceeded. All outdoor exposure is immediately suspended.',
      };
    case 'human_review':
      return {
        label: 'MANDATORY STAFF HUMAN REVIEW',
        borderColor: '#B45309',
        textColor: '#78350F',
        bgColor: '#FEF3C7',
        description: 'Triggered condition mandates real-time evaluation by school nurse or designated safety staff.',
      };
    default:
      return {
        label: String(action).toUpperCase(),
        borderColor: '#64748B',
        textColor: '#1E293B',
        bgColor: '#F8FAFC',
        description: 'Review policy guidelines.',
      };
  }
}

/**
 * Determines operational policy classification for print report.
 */
export function getPolicyStatusDetails(policy: SchoolPolicyConfig): {
  badgeLabel: string;
  isOperational: boolean;
  statusClass: 'approved' | 'unapproved' | 'demo' | 'starter';
  noticeText: string;
} {
  if (!policy.isConfigured || policy.isStarterConfig) {
    return {
      badgeLabel: 'NO APPROVED POLICY CONFIGURED',
      isOperational: false,
      statusClass: 'starter',
      noticeText: 'This report reflects an unconfigured starter configuration. No active thresholds exist and no operational determination can be made.',
    };
  }

  if (policy.isFictionalDemo) {
    return {
      badgeLabel: 'FICTIONAL DEMONSTRATION PRESET',
      isOperational: false,
      statusClass: 'demo',
      noticeText: 'DEMONSTRATION ONLY: This assessment uses fictional test rules for rule-engine verification. It has NOT been ratified for real student safety decisions.',
    };
  }

  if (!policy.isApproved) {
    return {
      badgeLabel: 'QA PREVIEW — UNAPPROVED CUSTOM RULES',
      isOperational: false,
      statusClass: 'unapproved',
      noticeText: 'NON-OPERATIONAL SIMULATION: These rules have been edited locally in the browser and have NOT been approved by school leadership or medical staff.',
    };
  }

  return {
    badgeLabel: `APPROVED OPERATIONAL POLICY: ${policy.schoolName}`,
    isOperational: true,
    statusClass: 'approved',
    noticeText: `Officially ratified operational policy. Effective: ${policy.effectiveDate}. Approved by: ${policy.approvedBy || 'School Leadership'}.`,
  };
}

export interface TriggerPrintOptions {
  onShowPreview?: (notice?: string) => void;
  onGeneratedAt?: (date: Date) => void;
  targetWindow?: Window;
  targetDocument?: Document;
}

export interface TriggerPrintResult {
  status: 'printed' | 'preview_fallback' | 'unsupported';
  error?: unknown;
}

/**
 * Triggers the browser's native print dialog synchronously within the user-activation click gesture.
 * Avoids requestAnimationFrame or setTimeout delays that cause modern browsers to drop transient activation.
 * Includes automatic cleanup, afterprint fallback, and preview-modal graceful degradation.
 */
export function triggerPrintLifecycle(options: TriggerPrintOptions = {}): TriggerPrintResult {
  const targetWin = options.targetWindow ?? (typeof window !== 'undefined' ? window : undefined);
  const targetDoc = options.targetDocument ?? (typeof document !== 'undefined' ? document : undefined);

  if (options.onGeneratedAt) {
    options.onGeneratedAt(new Date());
  }

  if (targetDoc?.body) {
    targetDoc.body.classList.add('printing-school-report');
  }

  let cleanupDone = false;
  let safetyTimer: any = null;

  const cleanup = () => {
    if (cleanupDone) return;
    cleanupDone = true;
    if (safetyTimer) {
      clearTimeout(safetyTimer);
      safetyTimer = null;
    }
    if (targetDoc?.body) {
      targetDoc.body.classList.remove('printing-school-report');
    }
    if (targetWin) {
      targetWin.removeEventListener('afterprint', cleanup);
    }
  };

  if (targetWin) {
    targetWin.addEventListener('afterprint', cleanup, { once: true });
  }

  // Safety fallback: if afterprint doesn't fire (e.g. some headless or non-standard environments), clean up after 60s
  safetyTimer = setTimeout(cleanup, 60000);

  // Synchronous execution within the user gesture
  try {
    if (targetWin && typeof targetWin.print === 'function') {
      targetWin.print();
      return { status: 'printed' };
    } else {
      cleanup();
      if (options.onShowPreview) {
        options.onShowPreview(
          'Native print dialog is not supported in this browser context. You can review the complete A4 assessment report in the preview window below.'
        );
      }
      return { status: 'unsupported' };
    }
  } catch (err: unknown) {
    cleanup();
    console.warn('Native window.print() execution was blocked or failed:', err);
    if (options.onShowPreview) {
      options.onShowPreview(
        'The print dialog was blocked by browser sandbox or security restrictions. You can inspect the report below and use your browser print menu (Ctrl+P / Cmd+P) to print or save as PDF.'
      );
    }
    return { status: 'preview_fallback', error: err };
  }
}

