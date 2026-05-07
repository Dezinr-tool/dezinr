"use client";

import { useState } from "react";

type Props = {
  className?: string;
};

export function ExportActions({ className }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("[results] copy link failed", error);
    }
  }

  function exportPdf() {
    window.print();
  }

  return (
    <>
      <div className={`results-no-print flex flex-wrap items-center gap-2 ${className ?? ""}`}>
          <button
            type="button"
            onClick={exportPdf}
            className="rounded-md bg-foreground px-3 py-1.5 text-sm text-background"
          >
            Export PDF
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            Copy Link
          </button>
          {copied ? (
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Copied!</span>
          ) : null}
      </div>

      <style jsx global>{`
        @media print {
          .results-no-print {
            display: none !important;
          }

          .results-print-container {
            max-width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </>
  );
}
