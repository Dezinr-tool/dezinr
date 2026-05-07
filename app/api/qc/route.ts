import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isQcReviewPayload } from "@/lib/qc-types";

const QC_SYSTEM_PROMPT = `CRITICAL: Respond with ONLY raw JSON.
Start with { and end with }.
No markdown, no backticks, no explanation.

You are a senior UI designer reviewing a developer's implementation against a Figma design.

Analyze the staging URL and generate specific feedback comments like a designer would leave for a developer.

For EACH issue found, provide:
- Which section of the page (Hero, Navigation, Footer, Cards, Forms etc)
- What exactly is wrong
- How it should look per Figma design standards
- Exact fix for the developer (CSS or simple code)
- Priority: must_fix, minor, or suggestion

CRITICAL: Return ONLY raw JSON starting with {

{
  'project_name': '<website name from URL>',
  'total_issues': <number>,
  'must_fix_count': <number>,
  'minor_count': <number>,
  'suggestion_count': <number>,
  'comments': [
    {
      'id': 1,
      'section': '<Hero/Nav/Footer etc>',
      'issue': '<what is wrong — specific>',
      'figma_reference': '<how it should look>',
      'fix': '<exact CSS or code fix>',
      'priority': '<must_fix/minor/suggestion>',
      'status': 'open'
    }
  ]
}`;

function textFromMessage(content: Anthropic.Message["content"]): string {
  return content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      figma_url?: string;
      staging_url?: string;
      user_id?: string;
    };

    const figmaUrl = body.figma_url?.trim();
    const stagingUrl = body.staging_url?.trim();
    if (!figmaUrl || !stagingUrl) {
      return NextResponse.json(
        { error: "figma_url and staging_url are required" },
        { status: 400 },
      );
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

    const raw = textFromMessage(message.content);
    console.log("[api/qc] raw Claude response", raw);
    const clean = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(clean);
    } catch (err) {
      console.error("[api/qc] JSON.parse failed", err);
      return NextResponse.json(
        { error: "Model returned invalid JSON", detail: raw.slice(0, 400) },
        { status: 502 },
      );
    }

    if (!isQcReviewPayload(parsed)) {
      return NextResponse.json(
        { error: "Model JSON did not match expected schema" },
        { status: 502 },
      );
    }

    const review = parsed;
    const { data, error } = await supabase
      .from("qc_reviews")
      .insert({
        user_id: user.id,
        figma_url: figmaUrl,
        staging_url: stagingUrl,
        project_name: review.project_name,
        total_issues: review.total_issues,
        must_fix_count: review.must_fix_count,
        minor_count: review.minor_count,
        suggestion_count: review.suggestion_count,
        comments: review.comments as unknown as Record<string, unknown>[],
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to save review", detail: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, reviewId: data.id });
  } catch (err) {
    console.error("[api/qc] unhandled", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
