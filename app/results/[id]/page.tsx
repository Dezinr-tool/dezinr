import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AnalysisAiResponse } from "@/lib/analysis-types";
import { FeedbackSection } from "./feedback-section";
import { ExportActions } from "./export-actions";

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

  const ai = row.ai_response as unknown as AnalysisAiResponse;
  const categories = ai.categories;
  const priorities = Array.isArray(ai.top_3_priorities) ? ai.top_3_priorities : [];

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
        <h1 className="mt-1 text-2xl font-semibold">Analysis results</h1>
        <div
          className="mt-5 flex h-32 w-32 items-center justify-center rounded-full border-4 border-foreground text-4xl font-bold"
          aria-label={`Overall score ${row.score} out of 100`}
        >
          {row.score}
        </div>
      </header>

      <section className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/70 dark:bg-blue-950/30">
        <h2 className="text-sm font-medium uppercase tracking-wide text-blue-800 dark:text-blue-200">
          Summary
        </h2>
        <p className="mt-2 text-base leading-relaxed text-blue-950 dark:text-blue-100">
          {ai.summary}
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Category scores</h2>
        <div className="mt-4 grid gap-5">
          {Object.entries(categories).map(([key, cat]) => (
            <article
              key={key}
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
                        <p
                          key={i}
                          className="rounded-md bg-white/80 p-2 text-sm text-red-900 dark:bg-zinc-950/50 dark:text-red-100"
                        >
                          {issue}
                        </p>
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
                      <p
                        key={i}
                        className="rounded-md bg-white/80 p-2 text-sm text-emerald-900 dark:bg-zinc-950/50 dark:text-emerald-100"
                      >
                        {suggestion}
                      </p>
                    ))}
                  </div>
                </section>
              </div>
            </article>
          ))}
        </div>
      </section>

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

      <section className="mt-8 rounded-xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-900/70 dark:bg-violet-950/30">
        <h2 className="text-lg font-medium text-violet-950 dark:text-violet-100">
          A/B test idea
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-violet-900 dark:text-violet-200">
          {ai.ab_test_suggestion}
        </p>
      </section>

      <div className="results-no-print">
        <FeedbackSection analysisId={row.id} />
      </div>
    </div>
  );
}
