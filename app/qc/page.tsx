import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { QcComment } from "@/lib/qc-types";
import { NewReviewForm } from "./new-review-form";

export default async function QcPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/qc");

  const { data: reviews, error } = await supabase
    .from("qc_reviews")
    .select(
      "id, project_name, staging_url, total_issues, must_fix_count, minor_count, suggestion_count, comments, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[qc] load reviews", error);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Design QC</h1>
        <Link href="/dashboard" className="text-sm underline">
          ← Dashboard
        </Link>
      </div>

      <div className="mt-6">
        <NewReviewForm />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Past QC Reviews</h2>
        {!reviews?.length ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No QC reviews yet. Start with a new review above.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {reviews.map((review) => {
              const comments = (review.comments as unknown as QcComment[]) ?? [];
              const resolved = comments.filter((c) => c.status === "resolved").length;
              const progress =
                review.total_issues > 0
                  ? Math.round((resolved / review.total_issues) * 100)
                  : 0;
              return (
                <Link
                  key={review.id}
                  href={`/qc/${review.id}`}
                  className="rounded-xl border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{review.project_name}</p>
                    <p className="text-xs text-zinc-500">
                      {review.created_at ? new Date(review.created_at).toLocaleString() : ""}
                    </p>
                  </div>
                  <p className="mt-1 truncate text-xs text-zinc-500">{review.staging_url}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs">
                    <span>Total: {review.total_issues}</span>
                    <span>Resolved: {resolved}</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
