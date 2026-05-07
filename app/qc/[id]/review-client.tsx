"use client";

import { useMemo, useState } from "react";
import type { QcComment, QcPriority, QcStatus } from "@/lib/qc-types";

type Props = {
  reviewId: string;
  comments: QcComment[];
};

type Filter = "all" | QcPriority;

function priorityBadge(priority: QcPriority) {
  if (priority === "must_fix") {
    return "bg-red-100 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900";
  }
  if (priority === "minor") {
    return "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900";
  }
  return "bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900";
}

function priorityLabel(priority: QcPriority) {
  if (priority === "must_fix") return "Must Fix";
  if (priority === "minor") return "Minor";
  return "Suggestion";
}

export function ReviewClient({ reviewId, comments: initialComments }: Props) {
  const [comments, setComments] = useState(initialComments);
  const [filter, setFilter] = useState<Filter>("all");
  const [savingId, setSavingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return comments;
    return comments.filter((c) => c.priority === filter);
  }, [comments, filter]);

  async function updateStatus(commentId: number, status: QcStatus) {
    setSavingId(commentId);
    try {
      const res = await fetch(`/api/qc/${reviewId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ commentId, status }),
      });
      if (!res.ok) return;
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId ? { ...comment, status } : comment,
        ),
      );
    } catch {
      // no-op
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { id: "all", label: "All" },
          { id: "must_fix", label: "Must Fix" },
          { id: "minor", label: "Minor" },
          { id: "suggestion", label: "Suggestions" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id as Filter)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              filter === item.id
                ? "border-foreground bg-foreground text-background"
                : "border-zinc-300 dark:border-zinc-600"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4">
        {filtered.map((comment) => (
          <article
            key={comment.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {comment.section}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityBadge(comment.priority)}`}
              >
                {priorityLabel(comment.priority)}
              </span>
            </div>

            <p className="mt-3 text-sm font-semibold">{comment.issue}</p>

            <div className="mt-3">
              <p className="text-xs font-medium text-zinc-500">Per Figma:</p>
              <p className="mt-1 text-sm">{comment.figma_reference}</p>
            </div>

            <div className="mt-3">
              <p className="text-xs font-medium text-zinc-500">Fix:</p>
              <pre className="mt-1 whitespace-pre-wrap rounded-md bg-zinc-100 p-2 font-mono text-xs dark:bg-zinc-900">
                {comment.fix}
              </pre>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <label className="text-xs text-zinc-500">Status</label>
              <select
                value={comment.status}
                disabled={savingId === comment.id}
                onChange={(e) =>
                  updateStatus(comment.id, e.target.value as QcStatus)
                }
                className="rounded-md border border-zinc-300 bg-background px-2 py-1 text-xs dark:border-zinc-600"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
