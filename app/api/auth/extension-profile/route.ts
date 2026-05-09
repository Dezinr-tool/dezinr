import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

/**
 * Used by the browser extension: Bearer JWT from extension login.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const jwt = authHeader?.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500, headers: corsHeaders },
    );
  }

  const supabase = createSupabaseClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("figma_access_token")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json(
    {
      figmaConnected: Boolean(profile?.figma_access_token),
    },
    { headers: corsHeaders },
  );
}
