"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return comments;
    return comments.filter((c) => c.priority === filter);
  }, [comments, filter]);

  function postCommentsToIframe() {
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return;
    iframeWindow.postMessage({ type: "qc-comments", comments }, "*");
    if (activeCommentId != null) {
      iframeWindow.postMessage({ type: "qc-highlight", commentId: activeCommentId }, "*");
    }
  }

  useEffect(() => {
    postCommentsToIframe();
  }, [comments, activeCommentId]);

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

  function highlightComment(commentId: number) {
    setActiveCommentId(commentId);
    const iframeWindow = iframeRef.current?.contentWindow;
    iframeWindow?.postMessage({ type: "qc-highlight", commentId }, "*");
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
        <iframe
          ref={iframeRef}
          src={`/api/proxy?url=${encodeURIComponent(stagingUrl)}`}
          onLoad={postCommentsToIframe}
          className="h-[80vh] w-full rounded-md border border-zinc-200 dark:border-zinc-800"
          title="Staging preview with QC overlays"
        />
      </section>
    </div>
  );
}
