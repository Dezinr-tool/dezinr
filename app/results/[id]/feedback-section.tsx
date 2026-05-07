"use client";

import { useState } from "react";

type Props = { analysisId: string };

export function FeedbackSection({ analysisId }: Props) {
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(isHelpful: boolean) {
    setLoading(true);
    setStatus(null);
    console.log("[feedback] submit", analysisId, isHelpful);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          analysisId,
          isHelpful,
          userComment: comment.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStatus(json.error ?? "Could not save");
        return;
      }
      setStatus("Thanks — feedback saved.");
      setComment("");
    } catch {
      setStatus("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-10 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <h2 className="text-lg font-medium">Was this helpful?</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => submit(true)}
          className="rounded-md bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-50"
        >
          Helpful
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => submit(false)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 disabled:opacity-50"
        >
          Not helpful
        </button>
      </div>
      <label className="mt-4 flex flex-col gap-1 text-sm">
        What did we miss? (optional)
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="rounded-md border border-zinc-300 bg-background px-3 py-2 dark:border-zinc-600"
        />
      </label>
      {status ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{status}</p>
      ) : null}
    </section>
  );
}
