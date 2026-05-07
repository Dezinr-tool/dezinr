import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-24">
      <h1 className="text-center text-3xl font-semibold tracking-tight">
        AI-powered Design Quality Scanner
      </h1>
      <p className="mt-4 max-w-md text-center text-lg text-zinc-600 dark:text-zinc-400">
        Get instant UX audit with actionable scores
      </p>
      <Link
        href="/login"
        className="mt-10 rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background"
      >
        Try free
      </Link>
    </div>
  );
}
