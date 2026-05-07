"use client";

import { useState } from "react";
import type { PriorityLevel } from "@/lib/analysis-types";

type Props = {
  analysisId: string;
  category: string;
  text: string;
  priority?: PriorityLevel;
  impact?: string;
};

function getPriorityMeta(priority?: PriorityLevel) {
  switch (priority) {
    case "must_have":
      return {
        label: "Must Fix",
        className:
          "bg-red-100 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900",
      };
    case "good_to_have":
      return {
        label: "Good to Have",
        className:
          "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
      };
    case "advanced":
    default:
      return {
        label: "Advanced",
        className:
          "bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900",
      };
  }
}

export function AnnotationPoint({
  analysisId,
  category,
  text,
  priority,
  impact,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(text);
  const [isAddingMissed, setIsAddingMissed] = useState(false);
  const [missedText, setMissedText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const priorityMeta = getPriorityMeta(priority);

  async function saveEdit() {
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          analysisId,
          category,
          originalText: text,
          editedText: editedText.trim() || text,
          isAccurate: editedText.trim() === text,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStatus(json.error ?? "Could not save edit");
        return;
      }
      setStatus("Saved");
      setIsEditing(false);
    } catch {
      setStatus("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function saveMissed() {
    const value = missedText.trim();
    if (!value) {
      setStatus("Add your missed point first");
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          analysisId,
          category,
          originalText: text,
          editedText: null,
          addedByUser: value,
          isAccurate: false,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStatus(json.error ?? "Could not save missed point");
        return;
      }
      setStatus("Missed point saved");
      setMissedText("");
      setIsAddingMissed(false);
    } catch {
      setStatus("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md bg-white/80 p-2 text-sm dark:bg-zinc-950/50">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityMeta.className}`}>
          {priorityMeta.label}
        </span>
        {isEditing ? (
          <input
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="min-w-[220px] flex-1 rounded-md border border-zinc-300 bg-background px-2 py-1 text-sm dark:border-zinc-600"
          />
        ) : (
          <p>{text}</p>
        )}
      </div>

      {impact ? <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">📈 {impact}</p> : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={saveEdit}
              disabled={loading}
              className="rounded-md bg-foreground px-2 py-1 text-xs text-background disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditedText(text);
                setIsEditing(false);
              }}
              disabled={loading}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            disabled={loading}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 disabled:opacity-50"
          >
            Edit
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsAddingMissed((v) => !v)}
          disabled={loading}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 disabled:opacity-50"
        >
          Mark as missed
        </button>
      </div>

      {isAddingMissed ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={missedText}
            onChange={(e) => setMissedText(e.target.value)}
            placeholder="Add the missed point"
            className="min-w-[220px] flex-1 rounded-md border border-zinc-300 bg-background px-2 py-1 text-sm dark:border-zinc-600"
          />
          <button
            type="button"
            onClick={saveMissed}
            disabled={loading}
            className="rounded-md bg-foreground px-2 py-1 text-xs text-background disabled:opacity-50"
          >
            Save
          </button>
        </div>
      ) : null}

      {status ? <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{status}</p> : null}
    </div>
  );
}
