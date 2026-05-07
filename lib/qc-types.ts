export type QcPriority = "must_fix" | "minor" | "suggestion";
export type QcStatus = "open" | "in_progress" | "resolved";

export type QcComment = {
  id: number;
  section: string;
  issue: string;
  figma_reference: string;
  fix: string;
  priority: QcPriority;
  status: QcStatus;
  is_manual?: boolean;
};

export type QcReviewPayload = {
  project_name: string;
  total_issues: number;
  must_fix_count: number;
  minor_count: number;
  suggestion_count: number;
  comments: QcComment[];
};

export function isQcReviewPayload(v: unknown): v is QcReviewPayload {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.project_name === "string" &&
    typeof o.total_issues === "number" &&
    typeof o.must_fix_count === "number" &&
    typeof o.minor_count === "number" &&
    typeof o.suggestion_count === "number" &&
    Array.isArray(o.comments)
  );
}
