import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { QcComment } from "@/lib/qc-types";
import { ReviewClient } from "./review-client";

export default async function QcReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/qc/${id}`);

  const { data: review, error } = await supabase
    .from("qc_reviews")
    .select(
      "id, project_name, figma_url, staging_url, total_issues, must_fix_count, minor_count, suggestion_count, comments, created_at",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !review) {
    notFound();
  }

  const comments = (review.comments as unknown as QcComment[]) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{review.project_name}</h1>
          <p className="mt-1 text-xs text-zinc-500">
            {review.created_at ? new Date(review.created_at).toLocaleString() : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={review.figma_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            View Figma
          </a>
          <a
            href={review.staging_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            View Staging
          </a>
          <Link href="/qc" className="rounded-md bg-foreground px-3 py-1.5 text-sm text-background">
            Back to QC
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Total Issues</p>
          <p className="mt-1 text-2xl font-semibold">{review.total_issues}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <p className="text-xs text-red-700 dark:text-red-200">Must Fix</p>
          <p className="mt-1 text-2xl font-semibold text-red-900 dark:text-red-100">
            {review.must_fix_count}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-xs text-amber-700 dark:text-amber-200">Minor</p>
          <p className="mt-1 text-2xl font-semibold text-amber-900 dark:text-amber-100">
            {review.minor_count}
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="text-xs text-blue-700 dark:text-blue-200">Suggestions</p>
          <p className="mt-1 text-2xl font-semibold text-blue-900 dark:text-blue-100">
            {review.suggestion_count}
          </p>
        </div>
      </section>

      <ReviewClient reviewId={review.id} comments={comments} />
    </div>
  );
}
