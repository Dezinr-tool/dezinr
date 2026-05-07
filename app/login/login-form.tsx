"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    console.log("[login] submit", mode);

    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { error: signErr } = await supabase.auth.signUp({ email, password });
        if (signErr) {
          setError(signErr.message);
          return;
        }
        router.refresh();
        router.push(nextPath);
        return;
      }

      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signErr) {
        setError(signErr.message);
        return;
      }
      router.refresh();
      router.push(nextPath);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold text-foreground">
        {mode === "signin" ? "Sign in" : "Create account"}
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Email and password only — minimal auth for the MVP.
      </p>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          className={`rounded-md border px-3 py-1.5 text-sm ${
            mode === "signin"
              ? "border-foreground bg-foreground text-background"
              : "border-zinc-300 dark:border-zinc-600"
          }`}
          onClick={() => setMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`rounded-md border px-3 py-1.5 text-sm ${
            mode === "signup"
              ? "border-foreground bg-foreground text-background"
              : "border-zinc-300 dark:border-zinc-600"
          }`}
          onClick={() => setMode("signup")}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-zinc-300 bg-background px-3 py-2 dark:border-zinc-600"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-zinc-300 bg-background px-3 py-2 dark:border-zinc-600"
          />
        </label>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {loading ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-500">
        <Link href="/" className="underline">
          Back to home
        </Link>
      </p>
    </div>
  );
}
