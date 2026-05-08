import { NextResponse } from "next/server";
import type { QcComment } from "@/lib/qc-types";
import { createClient } from "@/lib/supabase/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalizeUrl(input: string) {
  const trimmed = input.trim();
  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  return withoutTrailingSlash.toLowerCase();
}

function flexibleUrlMatch(stagingUrl: string, queryUrl: string) {
  const a = normalizeUrl(stagingUrl);
  const b = normalizeUrl(queryUrl);
  return a === b || a.includes(b) || b.includes(a);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url")?.trim();
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400, headers: corsHeaders });
    }

    const supabase = await createClient();
    const { data: reviews, error } = await supabase
      .from("qc_reviews")
      .select("id, staging_url, ai_comments, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }

    const review = (reviews ?? []).find((item) =>
      flexibleUrlMatch(item.staging_url ?? "", url),
    );

    if (!review) {
      return NextResponse.json({ reviewId: "", comments: [] }, { headers: corsHeaders });
    }

    const comments = ((review.ai_comments ?? []) as unknown as QcComment[]).map((c) => ({
      id: c.id,
      title: c.section || `Issue ${c.id}`,
      description: c.issue || c.fix || c.figma_reference || "",
      priority: c.priority,
      x_percent: c.x_percent ?? 0,
      y_percent: c.y_percent ?? 0,
      section: c.section,
    }));

    return NextResponse.json({
      reviewId: review.id,
      comments,
    }, { headers: corsHeaders });
  } catch (err) {
    console.error("[api/extension/reviews] unhandled", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
