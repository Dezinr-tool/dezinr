import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

const TOKEN_URL = "https://api.figma.com/v1/oauth/token";
const REDIRECT_URI =
  process.env.FIGMA_REDIRECT_URI ??
  "https://dezinr.vercel.app/api/auth/figma/callback";

export async function GET(request: NextRequest) {
  const clientId = process.env.FIGMA_CLIENT_ID;
  const clientSecret = process.env.FIGMA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Figma OAuth is not configured" },
      { status: 500 },
    );
  }

  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    const dashboard = new URL("/dashboard", request.url);
    dashboard.searchParams.set("figma_error", error);
    return NextResponse.redirect(dashboard);
  }

  if (!code || !state) {
    const dashboard = new URL("/dashboard", request.url);
    dashboard.searchParams.set("figma_error", "missing_code_or_state");
    return NextResponse.redirect(dashboard);
  }

  const cookieState = request.cookies.get("figma_oauth_state")?.value;
  if (!cookieState || cookieState !== state) {
    const dashboard = new URL("/dashboard", request.url);
    dashboard.searchParams.set("figma_error", "invalid_state");
    return NextResponse.redirect(dashboard);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", "/api/auth/figma");
    return NextResponse.redirect(loginUrl);
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    code,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenJson.access_token) {
    const dashboard = new URL("/dashboard", request.url);
    dashboard.searchParams.set(
      "figma_error",
      tokenJson.error_description ?? tokenJson.error ?? "token_exchange_failed",
    );
    const res = NextResponse.redirect(dashboard);
    res.cookies.delete("figma_oauth_state");
    return res;
  }

  const { error: upsertError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      figma_access_token: tokenJson.access_token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (upsertError) {
    console.error("[figma/callback] profile upsert", upsertError);
    const dashboard = new URL("/dashboard", request.url);
    dashboard.searchParams.set("figma_error", "save_failed");
    const res = NextResponse.redirect(dashboard);
    res.cookies.delete("figma_oauth_state");
    return res;
  }

  const res = NextResponse.redirect(new URL("/dashboard", request.url));
  res.cookies.delete("figma_oauth_state");
  res.headers.set("Cache-Control", "no-store");
  return res;
}
