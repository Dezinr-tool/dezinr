import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButtonInner } from "./sign-out-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: analyses, error } = await supabase
    .from("analyses")
    .select("id, input_type, input_value, score, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[dashboard] load analyses", error);
  }

  const rows = analyses ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dezinr Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Signed in as {user.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/analyze"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Audit any website or design
          </Link>
          <Link
            href="/qc"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
          >
            Design QC
          </Link>
          <SignOutButtonInner />
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Past audits</h2>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            No audits yet. Start with &quot;Audit any website or design&quot;.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-700"
              >
                <div>
                  <p className="text-sm font-medium">
                    Score: {a.score}/100 · {a.input_type}
                  </p>
                  <p className="mt-0.5 max-w-xl truncate text-xs text-zinc-500">
                    {a.input_value}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {a.created_at
                      ? new Date(a.created_at).toLocaleString()
                      : ""}
                  </p>
                </div>
                <Link
                  href={`/results/${a.id}`}
                  className="text-sm font-medium text-foreground underline"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
