import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { QcComment } from "@/lib/qc-types";
import { ReviewWorkspace } from "./review-workspace";

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
      "id, project_name, figma_url, staging_url, total_issues, must_fix_count, minor_count, suggestion_count, ai_comments, created_at",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !review) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h1 className="text-xl font-semibold">Review not found</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            The requested QC review could not be found.
          </p>
          <Link
            href="/qc"
            className="mt-4 inline-block rounded-md bg-foreground px-3 py-1.5 text-sm text-background"
          >
            Back to Design QC
          </Link>
        </div>
      </div>
    );
  }

  const comments = (review.ai_comments as unknown as QcComment[]) ?? [];

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

      <ReviewWorkspace
        reviewId={review.id}
        comments={comments}
        stagingUrl={review.staging_url}
      />
    </div>
  );
}
