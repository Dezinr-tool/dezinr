import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TOKEN_URL = "https://api.figma.com/v1/oauth/token";
const REDIRECT_URI =
  process.env.FIGMA_REDIRECT_URI ??
  "https://dezinr.vercel.app/api/auth/figma/callback";

export async function GET(request: NextRequest) {
  const clientId = process.env.FIGMA_CLIENT_ID;
  const clientSecret = process.env.FIGMA_CLIENT_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!clientId || !clientSecret || !serviceRoleKey || !supabaseUrl) {
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

  const figmaToken = tokenJson.access_token;

  // Save token to cookie for status check
  const dashboard = new URL("/dashboard", request.url);
  const res = NextResponse.redirect(dashboard);
  res.cookies.set("figma_token", figmaToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  // Also try to save to Supabase using service role (works regardless of RLS)
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Get user from auth cookie
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anonKey) {
      // Get session from request cookies
      const cookieHeader = request.headers.get("cookie") || "";
      const authTokenMatch = cookieHeader.match(/sb-[^-]+-auth-token=([^;]+)/);
      
      if (authTokenMatch) {
        const authToken = decodeURIComponent(authTokenMatch[1]);
        try {
          const parsed = JSON.parse(authToken);
          const accessToken = Array.isArray(parsed) ? parsed[0] : parsed?.access_token;
          
          if (accessToken) {
            const userClient = createClient(supabaseUrl, anonKey, {
              global: { headers: { Authorization: `Bearer ${accessToken}` } },
            });
            const { data: { user } } = await userClient.auth.getUser();
            
            if (user?.id) {
              await supabase.from("profiles").upsert({
                id: user.id,
                figma_access_token: figmaToken,
              });
            }
          }
        } catch {
          // Silent fail - cookie approach will still work
        }
      }
    }
  } catch {
    // Silent fail
  }

  res.headers.set("Cache-Control", "no-store");
  return res;
}