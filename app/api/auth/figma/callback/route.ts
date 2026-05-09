import { type NextRequest, NextResponse } from "next/server";

const TOKEN_URL = "https://api.figma.com/v1/oauth/token";
const REDIRECT_URI =
  process.env.FIGMA_REDIRECT_URI ??
  "https://dezinr.vercel.app/api/auth/figma/callback";

export async function GET(request: NextRequest) {
  const clientId = process.env.FIGMA_CLIENT_ID;
  const clientSecret = process.env.FIGMA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/dashboard?figma_error=" + error, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard?figma_error=missing_code", request.url));
  }

  // Exchange code for token
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    code,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenJson.access_token) {
    return NextResponse.redirect(
      new URL("/dashboard?figma_error=token_exchange_failed", request.url)
    );
  }

  const successUrl = new URL("/figma-success", request.url);
  successUrl.searchParams.set("token", tokenJson.access_token);
  return NextResponse.redirect(successUrl);
}