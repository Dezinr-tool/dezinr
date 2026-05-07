"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewReviewForm() {
  const router = useRouter();
  const [figmaUrl, setFigmaUrl] = useState("");
  const [stagingUrl, setStagingUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/qc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          figma_url: figmaUrl.trim(),
          staging_url: stagingUrl.trim(),
        }),
      });
      const json = (await res.json()) as { error?: string; reviewId?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to start QC review");
        return;
      }
      if (!json.reviewId) {
        setError("Missing review id");
        return;
      }
      router.push(`/qc/${json.reviewId}`);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="text-lg font-medium">New QC Review</h2>
      <div className="mt-4 grid gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Figma URL
          <input
            type="url"
            value={figmaUrl}
            onChange={(e) => setFigmaUrl(e.target.value)}
            placeholder="https://www.figma.com/file/..."
            className="rounded-md border border-zinc-300 bg-background px-3 py-2 dark:border-zinc-600"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Staging or Live URL
          <input
            type="url"
            value={stagingUrl}
            onChange={(e) => setStagingUrl(e.target.value)}
            placeholder="https://staging.example.com"
            className="rounded-md border border-zinc-300 bg-background px-3 py-2 dark:border-zinc-600"
            required
          />
        </label>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="mt-4 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Reviewing..." : "Start QC Review"}
      </button>
    </form>
  );
}
