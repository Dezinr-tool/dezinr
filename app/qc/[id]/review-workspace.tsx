"use client";

import { useMemo, useState } from "react";
import type { QcComment, QcPriority, QcStatus } from "@/lib/qc-types";

type Props = {
  reviewId: string;
  stagingUrl: string;
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

export function ReviewWorkspace({ reviewId, stagingUrl, comments: initialComments }: Props) {
  const [comments, setComments] = useState(initialComments);
  const [filter, setFilter] = useState<Filter>("all");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const filtered = useMemo(() => {
    if (filter === "all") return comments;
    return comments.filter((c) => c.priority === filter);
  }, [comments, filter]);

  const screenshotUrl = `https://image.thum.io/get/width/1440/crop/900/${stagingUrl}`;

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
    } finally {
      setSavingId(null);
    }
  }

  function getPinPosition(comment: QcComment, index: number, total: number) {
    const section = comment.section.toLowerCase();
    if (section.includes("navigation") || section.includes("nav")) {
      return { top: "3%", left: "50%" };
    }
    if (section.includes("hero")) {
      return { top: "20%", left: "50%" };
    }
    if (section.includes("features") || section.includes("cards") || section.includes("card")) {
      return { top: "45%", left: "50%" };
    }
    if (section.includes("footer")) {
      return { top: "85%", left: "50%" };
    }
    if (section.includes("cta")) {
      return { top: "60%", left: "50%" };
    }
    const step = 75 / Math.max(1, total);
    return {
      top: `${Math.min(90, 10 + step * index)}%`,
      left: `${20 + ((index * 17) % 60)}%`,
    };
  }

  function highlightComment(commentId: number) {
    setActiveCommentId(commentId);
  }

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[35%_65%]">
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap gap-2">
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

        <div className="mt-4 grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
          {filtered.map((comment, index) => (
            <article
              key={comment.id}
              className={`rounded-xl border p-3 ${
                activeCommentId === comment.id
                  ? "border-foreground bg-zinc-50 dark:bg-zinc-900/40"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => highlightComment(comment.id)}
                  className="text-left text-sm font-medium underline"
                >
                  #{index + 1} {comment.section}
                </button>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityBadge(comment.priority)}`}
                >
                  {priorityLabel(comment.priority)}
                </span>
              </div>

              <p className="mt-2 text-sm font-semibold">{comment.issue}</p>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{comment.fix}</p>

              <div className="mt-3 flex items-center gap-2">
                <label className="text-xs text-zinc-500">Status</label>
                <select
                  value={comment.status}
                  disabled={savingId === comment.id}
                  onChange={(e) => updateStatus(comment.id, e.target.value as QcStatus)}
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
      </section>

      <section className="rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
        <div className="relative min-h-[520px] overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
          {!imageLoaded && !imageError ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-600 dark:text-zinc-300">
              Loading staging preview...
            </div>
          ) : null}

          {imageError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-200/80 px-4 text-center dark:bg-zinc-900/80">
              <p className="text-sm font-medium">Preview unavailable</p>
              <p className="max-w-xl break-all text-xs text-zinc-600 dark:text-zinc-300">
                {stagingUrl}
              </p>
              <a
                href={stagingUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-foreground px-3 py-1.5 text-sm text-background"
              >
                Open Staging Site
              </a>
              <p className="max-w-xl text-xs text-zinc-600 dark:text-zinc-300">
                View staging site directly and refer to numbered issues on left
              </p>
            </div>
          ) : (
            <img
              src={screenshotUrl}
              alt="Staging preview"
              onLoad={() => {
                setImageLoaded(true);
                setImageError(false);
              }}
              onError={() => {
                setImageLoaded(false);
                setImageError(true);
              }}
              style={{ width: "100%", height: "auto" }}
            />
          )}

          {comments.map((comment, index) => {
            const pos = getPinPosition(comment, index, comments.length);
            return (
              <button
                key={comment.id}
                type="button"
                onClick={() => highlightComment(comment.id)}
                title={`${comment.section}: ${comment.issue}`}
                className={`absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-white shadow ${
                  comment.priority === "must_fix"
                    ? "bg-red-600"
                    : comment.priority === "minor"
                      ? "bg-amber-600"
                      : "bg-blue-600"
                } ${activeCommentId === comment.id ? "ring-4 ring-black/70" : ""}`}
                style={{ top: pos.top, left: pos.left }}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
