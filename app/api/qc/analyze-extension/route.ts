export const maxDuration = 60;

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isQcReviewPayload } from "@/lib/qc-types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const QC_SYSTEM_PROMPT = `You are a UI design reviewer.
Analyze the given website URL and return ONLY 
a valid JSON object.

Rules:
- Use double quotes only
- No CSS code in any field
- No special characters
- Keep all text simple and plain
- Maximum 8 comments
- x_percent and y_percent represent where on the page the issue is visible (0 to 100)
- Spread issues across different parts of the page

JSON format:
{
  "project_name": "Site Name",
  "total_issues": 8,
  "must_fix_count": 3,
  "minor_count": 3,
  "suggestion_count": 2,
  "comments": [
    {
      "id": 1,
      "section": "Hero",
      "issue": "The main headline is too small",
      "figma_reference": "Should be larger and bold",
      "fix": "Increase font size and weight",
      "priority": "must_fix",
      "status": "open",
      "x_percent": 50,
      "y_percent": 10
    }
  ]
}`;

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function parseText(content: Anthropic.Message["content"]) {
  return content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

function extractFigmaFileKey(figmaUrl: string): string | null {
  const match = figmaUrl.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

async function validateFigmaFile(fileKey: string, figmaToken: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=0%3A1`, {
      headers: { "X-Figma-Token": figmaToken },
    });
    if (res.status === 403) return { valid: false, error: "You do not have access to this Figma file." };
    if (res.status === 404) return { valid: false, error: "Figma file not found. Please check the URL." };
    if (!res.ok) return { valid: false, error: "Could not verify Figma file." };
    return { valid: true };
  } catch {
    return { valid: false, error: "Could not connect to Figma API." };
  }
}

export async function POST(request: Request) {
  console.log("analyze-extension called");
  try {
    const body = (await request.json()) as {
      stagingUrl?: string;
      figmaUrl?: string;
      figmaToken?: string;
    };
    const stagingUrl = body.stagingUrl?.trim();
    const figmaUrl = body.figmaUrl?.trim();
    const figmaToken = body.figmaToken?.trim();
    const token = request.headers.get("authorization")?.replace("Bearer ", "")?.trim();

    if (!stagingUrl || !figmaUrl || !figmaToken || !token) {
      return NextResponse.json(
        { error: "stagingUrl, figmaUrl, figmaToken and token are required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const figmaFileKey = extractFigmaFileKey(figmaUrl);
    if (!figmaFileKey) {
      return NextResponse.json({ error: "Invalid Figma URL. Please paste a valid Figma design link." }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Server config error" }, { status: 500, headers: corsHeaders });
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const validation = await validateFigmaFile(figmaFileKey, figmaToken);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error || "Invalid Figma file." }, { status: 400, headers: corsHeaders });
    }

    const userId = user.id;
    const domainTitle = (() => { try { return new URL(stagingUrl).hostname; } catch { return stagingUrl; } })();

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: QC_SYSTEM_PROMPT,
      messages: [{ role: "user", content: [{ type: "text", text: `Figma URL: ${figmaUrl}\nStaging URL: ${stagingUrl}\nReview the implementation differences and return the exact JSON schema.` }] }],
    });

    const raw = parseText(message.content).replace(/```json/g, "").replace(/```/g, "").trim();
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch {
      return NextResponse.json({ error: "Model returned invalid JSON" }, { status: 502, headers: corsHeaders });
    }

    if (!isQcReviewPayload(parsed)) {
      return NextResponse.json({ error: "Model JSON did not match expected schema" }, { status: 502, headers: corsHeaders });
    }

    const review = parsed;
    const comments = review.comments as unknown as Record<string, unknown>[];

    const { data: inserted, error: insertError } = await supabase
      .from("qc_reviews")
      .insert({ staging_url: stagingUrl, figma_url: figmaUrl, user_id: userId, ai_comments: comments, project_name: domainTitle, total_issues: review.total_issues, must_fix_count: review.must_fix_count, minor_count: review.minor_count, suggestion_count: review.suggestion_count })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json({ error: insertError?.message ?? "Failed to create review" }, { status: 500, headers: corsHeaders });
    }

    return NextResponse.json({ reviewId: inserted.id, comments: review.comments }, { headers: corsHeaders });
  } catch (err) {
    console.error("[api/qc/analyze-extension] unhandled", err);
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: corsHeaders });
  }
}