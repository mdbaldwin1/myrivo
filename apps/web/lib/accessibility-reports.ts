export const ACCESSIBILITY_REPORT_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type AccessibilityReportPriority = (typeof ACCESSIBILITY_REPORT_PRIORITIES)[number];

export const ACCESSIBILITY_REPORT_STATUSES = ["new", "triaged", "in_progress", "resolved", "dismissed"] as const;
export type AccessibilityReportStatus = (typeof ACCESSIBILITY_REPORT_STATUSES)[number];

export type AccessibilityReportRecord = {
  id: string;
  reporter_name: string | null;
  reporter_email: string;
  page_url: string | null;
  feature_area: string;
  issue_summary: string;
  expected_behavior: string | null;
  actual_behavior: string;
  assistive_technology: string | null;
  browser: string | null;
  device: string | null;
  blocks_critical_flow: boolean;
  status: AccessibilityReportStatus;
  priority: AccessibilityReportPriority;
  owner_notes: string | null;
  remediation_notes: string | null;
  source: "public_form" | "support" | "manual";
  triaged_at: string | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export const ACCESSIBILITY_REPORT_PRIORITY_LABELS: Record<AccessibilityReportPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical"
};

export const ACCESSIBILITY_REPORT_STATUS_LABELS: Record<AccessibilityReportStatus, string> = {
  new: "New",
  triaged: "Triaged",
  in_progress: "In progress",
  resolved: "Resolved",
  dismissed: "Dismissed"
};

export function getAccessibilityReportDefaultPriority(blocksCriticalFlow: boolean): AccessibilityReportPriority {
  return blocksCriticalFlow ? "high" : "medium";
}
