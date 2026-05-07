"use client";

import { useMemo, useRef, useState } from "react";
import type { QcComment, QcPriority, QcStatus } from "@/lib/qc-types";

type Props = {
  reviewId: string;
  stagingUrl: string;
  comments: QcComment[];
};

type Filter = "all" | QcPriority;
type ViewportMode = "desktop" | "mobile";

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
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSection, setNewSection] = useState("Hero");
  const [newPriority, setNewPriority] = useState<QcPriority>("must_fix");
  const [newIssue, setNewIssue] = useState("");
  const [newFix, setNewFix] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");
  const [desktopScale, setDesktopScale] = useState(0.65);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<number | null>(null);
  const [iframeError, setIframeError] = useState(false);
  const [popup, setPopup] = useState<{ x: number; y: number } | null>(null);
  const [popupIssue, setPopupIssue] = useState("");
  const [popupPriority, setPopupPriority] = useState<QcPriority>("must_fix");
  const [popupSaving, setPopupSaving] = useState(false);
  const [popupError, setPopupError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const previewClickLayerRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasHeight = 2000;
  const frameWidth = viewportMode === "desktop" ? 1280 : 390;
  const scale = viewportMode === "desktop" ? desktopScale : 1;
  const scaledFrameHeight = previewCanvasHeight * scale;

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
    } finally {
      setSavingId(null);
    }
  }

  async function addManualComment(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAdding(true);
    try {
      const res = await fetch(`/api/qc/${reviewId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          section: newSection,
          priority: newPriority,
          issue: newIssue.trim(),
          fix: newFix.trim(),
        }),
      });
      const json = (await res.json()) as { error?: string; comment?: QcComment };
      if (!res.ok || !json.comment) {
        setAddError(json.error ?? "Could not add comment");
        return;
      }
      setComments((prev) => [...prev, json.comment!]);
      setShowAddForm(false);
      setNewIssue("");
      setNewFix("");
      setNewSection("Hero");
      setNewPriority("must_fix");
    } catch {
      setAddError("Network error");
    } finally {
      setAdding(false);
    }
  }

  function getPinPosition(comment: QcComment, index: number, total: number) {
    if (
      typeof comment.x_percent === "number" &&
      typeof comment.y_percent === "number"
    ) {
      return {
        top: `${Math.max(0, Math.min(100, comment.y_percent))}%`,
        left: `${Math.max(0, Math.min(100, comment.x_percent))}%`,
      };
    }
    const section = comment.section.toLowerCase();
    if (section.includes("navigation") || section.includes("nav")) {
      return { top: "3%", left: "50%" };
    }
    if (section.includes("hero")) {
      return { top: "15%", left: "50%" };
    }
    if (section.includes("features") || section.includes("cards") || section.includes("card")) {
      return { top: "35%", left: "50%" };
    }
    if (section.includes("footer")) {
      return { top: "80%", left: "50%" };
    }
    if (section.includes("cta")) {
      return { top: "55%", left: "50%" };
    }
    const step = 90 / Math.max(1, total);
    return {
      top: `${Math.min(90, step * index)}%`,
      left: `${20 + ((index * 17) % 60)}%`,
    };
  }

  function highlightComment(commentId: number) {
    setActiveCommentId(commentId);
    const idx = comments.findIndex((comment) => comment.id === commentId);
    if (idx < 0) return;
    const pos = getPinPosition(comments[idx], idx, comments.length);
    const topPercent = Number.parseFloat(pos.top);
    if (Number.isNaN(topPercent)) return;
    const target = (topPercent / 100) * previewCanvasHeight * scale - 120;
    scrollContainerRef.current?.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }

  function onPreviewClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = previewClickLayerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPopup({ x, y });
    setPopupIssue("");
    setPopupPriority("must_fix");
    setPopupError(null);
  }

  function closePopup() {
    setPopup(null);
    setPopupIssue("");
    setPopupError(null);
  }

  async function savePopupComment() {
    if (!popup) return;
    const issue = popupIssue.trim();
    if (!issue) {
      setPopupError("Issue is required");
      return;
    }
    setPopupSaving(true);
    setPopupError(null);
    try {
      const res = await fetch(`/api/qc/${reviewId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          section: "Other",
          priority: popupPriority,
          issue,
          fix: "Manual reviewer note",
          x_percent: popup.x,
          y_percent: popup.y,
        }),
      });
      const json = (await res.json()) as { error?: string; comment?: QcComment };
      if (!res.ok || !json.comment) {
        setPopupError(json.error ?? "Could not add comment");
        return;
      }
      setComments((prev) => [...prev, json.comment]);
      setPopup(null);
      setPopupIssue("");
    } catch {
      setPopupError("Network error");
    } finally {
      setPopupSaving(false);
    }
  }

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[35%_65%]">
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
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
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="ml-auto rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            Add Comment
          </button>
        </div>

        {showAddForm ? (
          <form onSubmit={addManualComment} className="mt-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <div className="grid gap-3">
              <label className="flex flex-col gap-1 text-xs">
                Section
                <select
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                  className="rounded-md border border-zinc-300 bg-background px-2 py-1.5 text-sm dark:border-zinc-600"
                >
                  {["Hero", "Navigation", "Footer", "Cards", "CTA", "Typography", "Colors", "Spacing", "Other"].map(
                    (section) => (
                      <option key={section} value={section}>
                        {section}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Priority
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as QcPriority)}
                  className="rounded-md border border-zinc-300 bg-background px-2 py-1.5 text-sm dark:border-zinc-600"
                >
                  <option value="must_fix">Must Fix</option>
                  <option value="minor">Minor</option>
                  <option value="suggestion">Suggestion</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                What is wrong?
                <textarea
                  value={newIssue}
                  onChange={(e) => setNewIssue(e.target.value)}
                  rows={3}
                  className="rounded-md border border-zinc-300 bg-background px-2 py-1.5 text-sm dark:border-zinc-600"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                How to fix it?
                <textarea
                  value={newFix}
                  onChange={(e) => setNewFix(e.target.value)}
                  rows={3}
                  className="rounded-md border border-zinc-300 bg-background px-2 py-1.5 text-sm dark:border-zinc-600"
                  required
                />
              </label>
            </div>
            {addError ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{addError}</p> : null}
            <button
              type="submit"
              disabled={adding}
              className="mt-3 rounded-md bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-50"
            >
              {adding ? "Adding..." : "Add Comment"}
            </button>
          </form>
        ) : null}

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
                {comment.is_manual ? (
                  <span className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-600 dark:text-zinc-300">
                    Manual
                  </span>
                ) : null}
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
        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setViewportMode("desktop")}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              viewportMode === "desktop"
                ? "border-foreground bg-foreground text-background"
                : "border-zinc-300 dark:border-zinc-600"
            }`}
          >
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setViewportMode("mobile")}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              viewportMode === "mobile"
                ? "border-foreground bg-foreground text-background"
                : "border-zinc-300 dark:border-zinc-600"
            }`}
          >
            Mobile
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDesktopScale((prev) => Math.max(0.4, Number((prev - 0.05).toFixed(2))))}
              disabled={viewportMode !== "desktop" || desktopScale <= 0.4}
              className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 disabled:opacity-50"
            >
              -
            </button>
            <span className="text-xs text-zinc-500">{Math.round(scale * 100)}%</span>
            <button
              type="button"
              onClick={() => setDesktopScale((prev) => Math.min(1, Number((prev + 0.05).toFixed(2))))}
              disabled={viewportMode !== "desktop" || desktopScale >= 1}
              className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 disabled:opacity-50"
            >
              +
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
          <div className="border-b border-zinc-300 bg-zinc-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
            <p className="truncate text-xs text-zinc-700 dark:text-zinc-200">
              {stagingUrl}
            </p>
          </div>

          <div
            ref={scrollContainerRef}
            className="h-[70vh] overflow-y-auto bg-zinc-100 dark:bg-zinc-900"
          >
            <div
              className={`relative ${viewportMode === "mobile" ? "mx-auto" : ""}`}
              style={{
                width: viewportMode === "desktop" ? "100%" : `${frameWidth}px`,
                minHeight: `${scaledFrameHeight}px`,
              }}
            >
              <div
                className="absolute left-0 top-0"
                style={{
                  width: `${frameWidth}px`,
                  minHeight: `${previewCanvasHeight}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                {iframeError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-200/80 px-4 text-center dark:bg-zinc-900/80">
                    <p className="text-sm font-medium">Preview blocked by site security</p>
                    <a
                      href={stagingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md bg-foreground px-3 py-1.5 text-sm text-background"
                    >
                      Open Staging
                    </a>
                  </div>
                ) : (
                  <iframe
                    src={stagingUrl}
                    sandbox="allow-scripts allow-same-origin"
                    style={{
                      width: `${frameWidth}px`,
                      minWidth: viewportMode === "desktop" ? "1280px" : "390px",
                      height: `${previewCanvasHeight}px`,
                      border: "none",
                    }}
                    onError={() => setIframeError(true)}
                    onLoad={() => setIframeError(false)}
                    title="Staging preview"
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

                <div
                  ref={previewClickLayerRef}
                  onClick={onPreviewClick}
                  className="absolute inset-0 z-20 cursor-crosshair"
                />

                {popup ? (
                  <div
                    style={{
                      position: "absolute",
                      left: `${popup.x}%`,
                      top: `${popup.y}%`,
                      zIndex: 1000,
                      background: "white",
                      borderRadius: "8px",
                      padding: "12px",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                      width: "240px",
                    }}
                    className="-translate-x-1/2 -translate-y-1/2 border border-zinc-200 text-zinc-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <textarea
                      value={popupIssue}
                      onChange={(e) => setPopupIssue(e.target.value)}
                      placeholder="What is the issue?"
                      className="w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
                      rows={3}
                    />
                    <select
                      value={popupPriority}
                      onChange={(e) => setPopupPriority(e.target.value as QcPriority)}
                      className="mt-2 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    >
                      <option value="must_fix">Must Fix</option>
                      <option value="minor">Minor</option>
                      <option value="suggestion">Suggestion</option>
                    </select>
                    {popupError ? <p className="mt-2 text-xs text-red-600">{popupError}</p> : null}
                    <div style={{ display: "flex", gap: "8px" }} className="mt-2">
                      <button
                        type="button"
                        onClick={savePopupComment}
                        disabled={popupSaving}
                        className="rounded-md bg-foreground px-2 py-1 text-sm text-background disabled:opacity-50"
                      >
                        {popupSaving ? "Adding..." : "Add"}
                      </button>
                      <button
                        type="button"
                        onClick={closePopup}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
