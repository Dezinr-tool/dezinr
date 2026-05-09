import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    Vary: "Origin",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }
  return headers;
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { headers: corsHeaders(request) });
}

/**
 * Extension: send Authorization: Bearer <JWT> and credentials: 'include' so
 * the figma_token cookie (set after browser OAuth) is sent with the request.
 *
 * - If figma_token cookie exists: connected (and synced to profiles for JWT user when JWT is valid).
 * - Else if JWT valid and profiles.figma_access_token exists: connected (fallback).
 */
export async function GET(request: NextRequest) {
  const headers = corsHeaders(request);
  const cookieToken = request.cookies.get("figma_token")?.value ?? null;
  const authHeader = request.headers.get("Authorization");
  const jwt = authHeader?.replace(/^Bearer\s+/i, "")?.trim() ?? "";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (jwt && supabaseUrl && anonKey) {
    const supabase = createSupabaseClient(supabaseUrl, anonKey, {
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
        { connected: false, error: "Unauthorized" },
        { status: 401, headers },
      );
    }

    if (cookieToken) {
      const { error: upsertError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          figma_access_token: cookieToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (upsertError) {
        console.error("[figma/status] profile sync", upsertError);
      }
      return NextResponse.json({ connected: true }, { headers });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("figma_access_token")
      .eq("id", user.id)
      .maybeSingle();

    const connected = Boolean(profile?.figma_access_token);
    return NextResponse.json({ connected }, { headers });
  }

  // No JWT (e.g. same-origin browser call): cookie alone
  return NextResponse.json(
    { connected: Boolean(cookieToken) },
    { headers },
  );
}
