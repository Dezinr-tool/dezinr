"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButtonInner() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
      onClick={async () => {
        console.log("[dashboard] sign out");
        const supabase = createClient();
        await supabase.auth.signOut();
        router.refresh();
        router.push("/login");
      }}
    >
      Log out
    </button>
  );
}
