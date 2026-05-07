/** Parsed Claude JSON shape for /api/analyze and results UI */

export type CategoryReview = {
  score: number;
  issues: string[];
  issue_priorities?: PriorityLevel[];
  issue_impacts?: string[];
  suggestions: string[];
  suggestion_priorities?: PriorityLevel[];
};

export type PriorityLevel = "must_have" | "good_to_have" | "advanced";

export type AnalysisAiResponse = {
  overall_score: number;
  summary: string;
  categories: {
    visual_hierarchy: CategoryReview;
    ux_consistency: CategoryReview;
    conversion_potential: CategoryReview;
    accessibility: CategoryReview;
    content_clarity: CategoryReview;
    information_architecture: CategoryReview;
    product_strategy: CategoryReview;
  };
  top_3_priorities: [string, string, string] | string[];
  ab_test_suggestion: string;
};

export type MultiPageAnalysisAiResponse = {
  overall_score: number;
  summary: string;
  common_issues: string[];
  pages: Array<{
    page_label: string;
    input_value: string;
    result: AnalysisAiResponse;
  }>;
};

export function isMultiPageAnalysisAiResponse(
  v: unknown,
): v is MultiPageAnalysisAiResponse {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.overall_score === "number" &&
    typeof o.summary === "string" &&
    Array.isArray(o.pages)
  );
}

export function isAnalysisAiResponse(v: unknown): v is AnalysisAiResponse {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.overall_score === "number" &&
    typeof o.summary === "string" &&
    o.categories !== null &&
    typeof o.categories === "object"
  );
}
