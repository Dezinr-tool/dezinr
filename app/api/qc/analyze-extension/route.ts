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
      "status": "open"
    }
  ]
}`;

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function parseText(content: Anthropic.Message["content"]) {
  return content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

export async function POST(request: Request) {
  console.log("analyze-extension called");
  try {
    const body = (await request.json()) as {
      stagingUrl?: string;
      figmaUrl?: string;
    };
    const stagingUrl = body.stagingUrl?.trim();
    const figmaUrl = body.figmaUrl?.trim();
    const token = request.headers.get("authorization")?.replace("Bearer ", "")?.trim();

    if (!stagingUrl || !figmaUrl || !token) {
      console.error("[api/qc/analyze-extension] invalid body", {
        hasStagingUrl: Boolean(stagingUrl),
        hasFigmaUrl: Boolean(figmaUrl),
        hasToken: Boolean(token),
      });
      return NextResponse.json(
        { error: "stagingUrl, figmaUrl and token are required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[api/qc/analyze-extension] missing supabase env");
      return NextResponse.json({ error: "Server config error" }, { status: 500, headers: corsHeaders });
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[api/qc/analyze-extension] token verification failed", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }
    const userId = user.id;
    const domainTitle = (() => {
      try {
        return new URL(stagingUrl).hostname;
      } catch {
        return stagingUrl;
      }
    })();

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    console.log("[api/qc/analyze-extension] calling anthropic", {
      userId,
      stagingUrl,
      figmaUrl,
    });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: QC_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Figma URL: ${figmaUrl}\nStaging URL: ${stagingUrl}\nReview the implementation differences and return the exact JSON schema.`,
            },
          ],
        },
      ],
    });

    const raw = parseText(message.content).replace(/```json/g, "").replace(/```/g, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (parseError) {
      console.error("[api/qc/analyze-extension] JSON parse failed", parseError, {
        rawPreview: raw.slice(0, 500),
      });
      return NextResponse.json(
        { error: "Model returned invalid JSON" },
        { status: 502, headers: corsHeaders },
      );
    }

    if (!isQcReviewPayload(parsed)) {
      console.error("[api/qc/analyze-extension] schema check failed", {
        parsedPreview: JSON.stringify(parsed).slice(0, 500),
      });
      return NextResponse.json(
        { error: "Model JSON did not match expected schema" },
        { status: 502, headers: corsHeaders },
      );
    }

    const review = parsed;
    const comments = review.comments as unknown as Record<string, unknown>[];
    const insertPayload = {
      staging_url: stagingUrl,
      figma_url: figmaUrl,
      user_id: userId,
      ai_comments: comments,
      // requested "title" derived from domain is mapped to project_name column
      project_name: domainTitle,
      total_issues: review.total_issues,
      must_fix_count: review.must_fix_count,
      minor_count: review.minor_count,
      suggestion_count: review.suggestion_count,
    };
    console.log("[api/qc/analyze-extension] inserting review", {
      userId,
      projectName: domainTitle,
      commentCount: comments.length,
    });

    const { data: inserted, error: insertError } = await supabase
      .from("qc_reviews")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("[api/qc/analyze-extension] insert failed", insertError);
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to create review" },
        { status: 500, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      { reviewId: inserted.id, comments: review.comments },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("[api/qc/analyze-extension] unhandled", err);
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: corsHeaders });
  }
}
