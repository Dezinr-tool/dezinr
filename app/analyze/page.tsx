"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Tab = "url" | "screenshot" | "figma";

export default function AnalyzePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("url");
  const [urls, setUrls] = useState<string[]>([""]);
  const [figmaUrl, setFigmaUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalyze(body: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    console.log("[analyze] request", body.inputType);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        error?: string;
        analysisId?: string;
      };

      if (!res.ok) {
        setError(json.error ?? `Request failed (${res.status})`);
        return;
      }

      if (json.analysisId) {
        router.push(`/results/${json.analysisId}`);
        return;
      }
      setError("No analysis id returned");
    } catch (e) {
      console.error("[analyze] fetch error", e);
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function onAnalyzeUrl(e: React.FormEvent) {
    e.preventDefault();
    const sanitized = urls.map((u) => u.trim()).filter(Boolean);
    if (sanitized.length === 0) {
      setError("Enter a URL");
      return;
    }
    if (sanitized.length === 1) {
      await runAnalyze({ inputType: "url", inputValue: sanitized[0] });
      return;
    }
    await runAnalyze({ inputType: "url", inputValues: sanitized });
  }

  async function onAnalyzeFigma(e: React.FormEvent) {
    e.preventDefault();
    const u = figmaUrl.trim();
    if (!u) {
      setError("Enter a Figma URL");
      return;
    }
    await runAnalyze({ inputType: "figma", inputValue: u });
  }

  function updateUrlAt(index: number, value: string) {
    setUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  }

  function addAnotherPage() {
    setUrls((prev) => (prev.length < 5 ? [...prev, ""] : prev));
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result;
      if (typeof result !== "string") {
        setError("Could not read file");
        return;
      }
      const comma = result.indexOf(",");
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      const mediaType = (file.type || "image/png") as
        | "image/jpeg"
        | "image/png"
        | "image/gif"
        | "image/webp";

      await runAnalyze({
        inputType: "screenshot",
        imageBase64: base64,
        mediaType,
      });
    };
    reader.onerror = () => setError("Could not read file");
    reader.readAsDataURL(file);
  }

  let tabContent: React.ReactNode;
  if (tab === "url") {
    tabContent = (
      <form onSubmit={onAnalyzeUrl} className="mt-6 flex flex-col gap-4">
        {urls.map((url, index) => (
          <label key={index} className="flex flex-col gap-1 text-sm">
            {index === 0 ? "Website or staging URL" : `Page ${index + 1} URL`}
            <input
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => updateUrlAt(index, e.target.value)}
              className="rounded-md border border-zinc-300 bg-background px-3 py-2 dark:border-zinc-600"
            />
          </label>
        ))}
        <button
          type="button"
          onClick={addAnotherPage}
          disabled={urls.length >= 5 || loading}
          className="w-fit rounded-md border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-600 disabled:opacity-50"
        >
          + Add another page
        </button>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {loading ? "Auditing..." : "Start audit"}
        </button>
      </form>
    );
  } else if (tab === "screenshot") {
    tabContent = (
      <div className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Upload screenshot
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            disabled={loading}
            onChange={onFileChange}
            className="text-sm"
          />
        </label>
        <p className="text-xs text-zinc-500">
          Image is sent as base64 to Claude vision. Large files may be slow.
        </p>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        {loading ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Auditing...
          </p>
        ) : null}
      </div>
    );
  } else {
    tabContent = (
      <form onSubmit={onAnalyzeFigma} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Figma file URL
          <input
            type="url"
            placeholder="https://www.figma.com/file/..."
            value={figmaUrl}
            onChange={(e) => setFigmaUrl(e.target.value)}
            className="rounded-md border border-zinc-300 bg-background px-3 py-2 dark:border-zinc-600"
          />
        </label>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {loading ? "Auditing..." : "Start audit"}
        </button>
      </form>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Audit any website or design</h1>
        <Link href="/dashboard" className="text-sm underline">
          Dashboard
        </Link>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          className={`rounded-md border px-3 py-1.5 text-sm ${
            tab === "url"
              ? "border-foreground bg-foreground text-background"
              : "border-zinc-300 dark:border-zinc-600"
          }`}
          onClick={() => setTab("url")}
        >
          URL
        </button>
        <button
          type="button"
          className={`rounded-md border px-3 py-1.5 text-sm ${
            tab === "screenshot"
              ? "border-foreground bg-foreground text-background"
              : "border-zinc-300 dark:border-zinc-600"
          }`}
          onClick={() => setTab("screenshot")}
        >
          Screenshot
        </button>
        <button
          type="button"
          className={`rounded-md border px-3 py-1.5 text-sm ${
            tab === "figma"
              ? "border-foreground bg-foreground text-background"
              : "border-zinc-300 dark:border-zinc-600"
          }`}
          onClick={() => setTab("figma")}
        >
          Figma
        </button>
      </div>

      {tabContent}
    </div>
  );
}
