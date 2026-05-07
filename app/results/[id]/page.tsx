import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isMultiPageAnalysisAiResponse,
  type AnalysisAiResponse,
  type CategoryReview,
} from "@/lib/analysis-types";
import { FeedbackSection } from "./feedback-section";
import { ExportActions } from "./export-actions";
import { AnnotationPoint } from "./annotation-point";

const CATEGORY_LABELS: Record<string, string> = {
  visual_hierarchy: "Visual hierarchy",
  ux_consistency: "UX consistency",
  conversion_potential: "Conversion potential",
  accessibility: "Accessibility",
  content_clarity: "Content clarity",
  information_architecture: "Information architecture",
  product_strategy: "Product strategy",
};

const CATEGORY_SECTIONS: Record<string, string> = {
  visual_hierarchy: "Hero",
  ux_consistency: "Navigation",
  conversion_potential: "CTA",
  accessibility: "Global",
  content_clarity: "Content",
  information_architecture: "Page structure",
  product_strategy: "Funnel",
};

function renderCategoryCards(
  analysisId: string,
  categories: Record<string, CategoryReview>,
  categoryPrefix = "",
) {
  return (
    <div className="mt-4 grid gap-5">
      {Object.entries(categories).map(([key, cat]) => (
        <article
          key={`${categoryPrefix}${key}`}
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold">{CATEGORY_LABELS[key] ?? key}</h3>
            <span className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-medium dark:border-zinc-700">
              {cat.score}/100
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">Section</span>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {CATEGORY_SECTIONS[key] ?? "General"}
            </span>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full bg-foreground transition-[width]"
              style={{ width: `${Math.min(100, Math.max(0, cat.score))}%` }}
            />
          </div>

          <div className="mt-5 grid gap-4">
            <section className="rounded-md border-l-4 border-red-400 bg-red-50 p-3 dark:border-red-500 dark:bg-red-950/20">
              <h4 className="text-sm font-medium text-red-900 dark:text-red-200">Issues</h4>
              <div className="mt-2 grid gap-2">
                {(cat.issues?.length ? cat.issues : ["No major issues flagged in this section."]).map(
                  (issue, i) => (
                    <AnnotationPoint
                      key={`${categoryPrefix}${key}-issue-${i}`}
                      analysisId={analysisId}
                      category={`${categoryPrefix}${key}`}
                      text={issue}
                      priority={cat.issue_priorities?.[i]}
                      impact={cat.issue_impacts?.[i]}
                    />
                  ),
                )}
              </div>
            </section>

            <section className="rounded-md border-l-4 border-emerald-400 bg-emerald-50 p-3 dark:border-emerald-500 dark:bg-emerald-950/20">
              <h4 className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                Suggestions
              </h4>
              <div className="mt-2 grid gap-2">
                {(cat.suggestions?.length
                  ? cat.suggestions
                  : ["No suggestions were provided for this section."]).map((suggestion, i) => (
                  <AnnotationPoint
                    key={`${categoryPrefix}${key}-suggestion-${i}`}
                    analysisId={analysisId}
                    category={`${categoryPrefix}${key}`}
                    text={suggestion}
                    priority={cat.suggestion_priorities?.[i]}
                  />
                ))}
              </div>
            </section>
          </div>
        </article>
      ))}
    </div>
  );
}


export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/results/${id}`);

  const { data: row, error } = await supabase
    .from("analyses")
    .select("id, input_type, input_value, score, ai_response, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[results] load", error);
    notFound();
  }
  if (!row) notFound();

  const rawAi = row.ai_response as unknown;
  const isMulti = isMultiPageAnalysisAiResponse(rawAi);
  const singleAi = rawAi as AnalysisAiResponse;
  const multiAi = isMulti ? rawAi : null;
  const headerScore = isMulti ? Math.round(multiAi.overall_score) : row.score;
  const headerSummary = isMulti ? multiAi.summary : singleAi.summary;
  const priorities = isMulti
    ? []
    : Array.isArray(singleAi.top_3_priorities)
      ? singleAi.top_3_priorities
      : [];

  return (
    <div className="results-print-container mx-auto max-w-4xl px-4 py-10">
      <div className="results-no-print flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm underline">
            ← Dashboard
          </Link>
          <p className="text-xs text-zinc-500">
            {row.created_at
              ? new Date(row.created_at).toLocaleString()
              : null}
          </p>
        </div>
        <ExportActions />
      </div>

      <header className="mt-8 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <p className="text-sm text-zinc-500">
          {row.input_type}: {row.input_value}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Your design feedback</h1>
        <div
          className="mt-5 flex h-32 w-32 items-center justify-center rounded-full border-4 border-foreground text-4xl font-bold"
          aria-label={`Overall score ${headerScore} out of 100`}
        >
          {headerScore}
        </div>
      </header>

      <section className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/70 dark:bg-blue-950/30">
        <h2 className="text-sm font-medium uppercase tracking-wide text-blue-800 dark:text-blue-200">
          Summary
        </h2>
        <p className="mt-2 text-base leading-relaxed text-blue-950 dark:text-blue-100">
          {headerSummary}
        </p>
      </section>

      {isMulti && multiAi ? (
        <>
          <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/70 dark:bg-amber-950/30">
            <h2 className="text-lg font-medium text-amber-950 dark:text-amber-100">
              Common issues across pages
            </h2>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-amber-900 dark:text-amber-200">
              {(multiAi.common_issues?.length
                ? multiAi.common_issues
                : ["No repeated issues were detected across pages."]).map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </section>

          <section className="mt-10 space-y-4">
            <h2 className="text-lg font-medium">Per-page audit</h2>
            {multiAi.pages.map((page, index) => (
              <details
                key={`${page.page_label}-${index}`}
                open={index === 0}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{page.page_label}</p>
                      <p className="mt-1 text-xs text-zinc-500">{page.input_value}</p>
                    </div>
                    <span className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-medium dark:border-zinc-700">
                      {Math.round(page.result.overall_score)}/100
                    </span>
                  </div>
                </summary>
                {renderCategoryCards(row.id, page.result.categories, `${page.page_label}:`)}
              </details>
            ))}
          </section>
        </>
      ) : (
        <section className="mt-10">
          <h2 className="text-lg font-medium">Category scores</h2>
          {renderCategoryCards(row.id, singleAi.categories)}
        </section>
      )}

      {!isMulti ? (
        <section className="mt-10">
          <h2 className="text-lg font-medium">Top 3 priorities</h2>
          <div className="mt-4 grid gap-3">
            {priorities.map((priority, index) => (
              <article
                key={`${priority}-${index}`}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Priority {index + 1}
                </p>
                <p className="mt-2 text-sm leading-relaxed">{priority}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!isMulti ? (
        <section className="mt-8 rounded-xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-900/70 dark:bg-violet-950/30">
          <h2 className="text-lg font-medium text-violet-950 dark:text-violet-100">
            A/B test idea
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-violet-900 dark:text-violet-200">
            {singleAi.ab_test_suggestion}
          </p>
        </section>
      ) : null}

      <div className="results-no-print">
        <FeedbackSection analysisId={row.id} />
      </div>
    </div>
  );
}
