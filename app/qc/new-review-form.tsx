"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export function NewReviewForm() {
  const router = useRouter();
  const [figmaUrl, setFigmaUrl] = useState("");
  const [stagingUrl, setStagingUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingStages = useMemo(
    () => [
      { label: "Fetching page content...", percent: 15 },
      { label: "Analyzing visual hierarchy...", percent: 35 },
      { label: "Checking spacing & typography...", percent: 55 },
      { label: "Identifying design issues...", percent: 75 },
      { label: "Generating feedback...", percent: 95 },
      { label: "Almost done...", percent: 100 },
    ],
    [],
  );
  const [currentStage, setCurrentStage] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const stageTimer = window.setInterval(() => {
      setCurrentStage((prev) => Math.min(prev + 1, loadingStages.length - 1));
    }, 1400);
    return () => window.clearInterval(stageTimer);
  }, [loading, loadingStages.length]);

  useEffect(() => {
    if (!loading) return;
    const target = loadingStages[currentStage]?.percent ?? 0;
    const progressTimer = window.setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev >= target) return prev;
        const next = prev + 1;
        return next > target ? target : next;
      });
    }, 35);
    return () => window.clearInterval(progressTimer);
  }, [loading, currentStage, loadingStages]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCurrentStage(0);
    setDisplayProgress(0);
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
      setCurrentStage(0);
      setDisplayProgress(0);
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
      {loading ? (
        <div className="mt-4 rounded-lg border border-indigo-200/80 bg-gradient-to-r from-indigo-500/10 via-cyan-500/10 to-violet-500/10 p-4 shadow-sm dark:border-indigo-800/70">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
            <span className="font-medium">{loadingStages[currentStage]?.label}</span>
            <span>{displayProgress}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-cyan-500 to-violet-500 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, displayProgress))}%` }}
            />
          </div>
          <div className="mt-3 flex gap-1.5">
            {loadingStages.map((stage, index) => (
              <span
                key={stage.label}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  index <= currentStage ? "bg-indigo-500/90 dark:bg-indigo-400/90" : "bg-zinc-300/70 dark:bg-zinc-700/70"
                }`}
              />
            ))}
          </div>
        </div>
      ) : null}
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
