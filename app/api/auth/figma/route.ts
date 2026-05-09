import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";
import { type NextRequest, NextResponse } from "next/server";

const FIGMA_OAUTH_BASE = "https://www.figma.com/oauth";
const REDIRECT_URI =
  process.env.FIGMA_REDIRECT_URI ??
  "https://dezinr.vercel.app/api/auth/figma/callback";

export async function GET(request: NextRequest) {
  const clientId = process.env.FIGMA_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "FIGMA_CLIENT_ID is not configured" },
      { status: 500 },
    );
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

  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: "file_content:read,file_metadata:read",
    state,
    response_type: "code",
  });

  const figmaUrl = `${FIGMA_OAUTH_BASE}?${params.toString()}`;
  const res = NextResponse.redirect(figmaUrl);

  res.cookies.set("figma_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return res;
}
