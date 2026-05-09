"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function FigmaSuccessContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) return;
    window.postMessage({ type: "DZN_FIGMA_TOKEN", token: token }, "*");
  }, [token]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4">
      <div className="w-full rounded-xl border border-emerald-300 bg-emerald-50 p-8 text-center">
        <div className="text-4xl">✅</div>
        <h1 className="mt-4 text-2xl font-semibold text-emerald-900">Figma Connected!</h1>
        <p className="mt-2 text-emerald-800">You can close this tab.</p>
      </div>
    </main>
  );
}

export default function FigmaSuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FigmaSuccessContent />
    </Suspense>
  );
}
