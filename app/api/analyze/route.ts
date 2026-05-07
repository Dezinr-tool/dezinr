import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAnalysisAiResponse } from "@/lib/analysis-types";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a senior design manager reviewing work for a junior designer. Give warm, direct, specific feedback.

CRITICAL: Your entire response must be ONLY a JSON object.
No markdown. No backticks. No explanation before or after.
Start with { and end with }.

Use this exact structure:
{
  "overall_score": <number 0-100>,
  "summary": "<2-3 sentences like a mentor speaking directly to the designer>",
  "categories": {
    "visual_hierarchy": {
      "score": <0-100>,
      "issues": ["issue text here"],
      "issue_priorities": ["must_have"],
      "issue_impacts": ["fixing this can reduce bounce by 15%"],
      "suggestions": ["suggestion text here"],
      "suggestion_priorities": ["must_have"]
    },
    "ux_consistency": {
      "score": <0-100>,
      "issues": ["issue text here"],
      "issue_priorities": ["must_have"],
      "issue_impacts": ["fixing this can reduce bounce by 15%"],
      "suggestions": ["suggestion text here"],
      "suggestion_priorities": ["must_have"]
    },
    "conversion_potential": {
      "score": <0-100>,
      "issues": ["issue text here"],
      "issue_priorities": ["must_have"],
      "issue_impacts": ["fixing this can reduce bounce by 15%"],
      "suggestions": ["suggestion text here"],
      "suggestion_priorities": ["must_have"]
    },
    "accessibility": {
      "score": <0-100>,
      "issues": ["issue text here"],
      "issue_priorities": ["must_have"],
      "issue_impacts": ["fixing this can reduce bounce by 15%"],
      "suggestions": ["suggestion text here"],
      "suggestion_priorities": ["must_have"]
    },
    "content_clarity": {
      "score": <0-100>,
      "issues": ["issue text here"],
      "issue_priorities": ["must_have"],
      "issue_impacts": ["fixing this can reduce bounce by 15%"],
      "suggestions": ["suggestion text here"],
      "suggestion_priorities": ["must_have"]
    },
    "information_architecture": {
      "score": <0-100>,
      "issues": ["issue text here"],
      "issue_priorities": ["must_have"],
      "issue_impacts": ["fixing this can reduce bounce by 15%"],
      "suggestions": ["suggestion text here"],
      "suggestion_priorities": ["must_have"]
    },
    "product_strategy": {
      "score": <0-100>,
      "issues": ["issue text here"],
      "issue_priorities": ["must_have"],
      "issue_impacts": ["fixing this can reduce bounce by 15%"],
      "suggestions": ["suggestion text here"],
      "suggestion_priorities": ["must_have"]
    }
  },
  "top_3_priorities": ["<priority 1>", "<priority 2>", "<priority 3>"],
  "ab_test_suggestion": "<one specific A/B test idea>"
}

Priority definitions:
- must_have: Fixing this directly affects conversion or trust. Do this first.
- good_to_have: Improves experience but not urgent.
- advanced: Nice to have, complex to implement.

For every issue, provide matching priority and impact in the same array index.
The arrays "issues", "issue_priorities", and "issue_impacts" must always have the same length.
The arrays "suggestions" and "suggestion_priorities" must always have the same length.

For information_architecture, review:
- Navigation structure and labeling
- User flow and journey logic
- Page hierarchy and findability
- Missing or misplaced sections

For product_strategy, review:
- Value proposition clarity
- Target audience alignment
- CTA placement and messaging
- Business goal vs user goal balance
- Conversion funnel logic

CRITICAL: Output ONLY raw JSON.
Start with { end with }.
No markdown, no backticks.`;

function textFromMessage(content: Anthropic.Message["content"]): string {
  return content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
}

function stripMarkdownJsonFence(text: string): string {
  const trimmed = text.trim();

  // Remove common markdown fence wrappers around JSON.
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/im.exec(trimmed);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Fallback: strip any remaining backticks to recover raw JSON.
  return trimmed.replace(/`/g, "").trim();
}

export async function POST(request: Request) {
  try {
    console.log("[api/analyze] POST start");

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[api/analyze] missing ANTHROPIC_API_KEY");
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log("[api/analyze] unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      inputType?: string;
      inputValue?: string;
      imageBase64?: string;
      mediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    };

    const inputType = body.inputType;
    if (inputType !== "url" && inputType !== "screenshot") {
      return NextResponse.json({ error: "Invalid inputType" }, { status: 400 });
    }

    let inputValueForDb: string;
    let userContent: Anthropic.MessageCreateParams["messages"][number]["content"];

    if (inputType === "url") {
      const url = (body.inputValue ?? "").trim();
      if (!url) {
        return NextResponse.json({ error: "URL required" }, { status: 400 });
      }
      inputValueForDb = url;
      let urlNote = "";
      if (url.includes("figma.com")) {
        urlNote =
          "\n\nNote: This is a Figma file URL. You cannot see the canvas; infer what you can from the URL and give a practical design-review checklist and questions the team should validate in Figma and in implementation.";
      }
      userContent = [
        {
          type: "text",
          text: `Please analyze this website/staging URL for UX and UI quality: ${url}${urlNote}`,
        },
      ];
    } else {
      const data = body.imageBase64?.trim();
      const mediaType = body.mediaType ?? "image/png";
      if (!data) {
        return NextResponse.json(
          { error: "imageBase64 required for screenshot" },
          { status: 400 },
        );
      }
      inputValueForDb = "[Screenshot upload]";
      userContent = [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data },
        },
        {
          type: "text",
          text: "Analyze this design screenshot for UX and UI quality. Respond with the required JSON only.",
        },
      ];
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    console.log("[api/analyze] calling Claude");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const rawText = textFromMessage(message.content);
    console.log("[api/analyze] raw Claude response", rawText);
    const cleanedText = stripMarkdownJsonFence(rawText);
    console.log("[api/analyze] Claude response length", cleanedText.length);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (e) {
      console.error("[api/analyze] JSON.parse failed", e);
      console.error("[api/analyze] raw Claude response", rawText);
      return NextResponse.json(
        { error: "Model returned invalid JSON", detail: rawText.slice(0, 400) },
        { status: 502 },
      );
    }

    if (!isAnalysisAiResponse(parsed)) {
      console.error("[api/analyze] schema mismatch", parsed);
      return NextResponse.json(
        { error: "Model JSON did not match expected schema" },
        { status: 502 },
      );
    }

    const aiResponse = parsed;
    const score = Math.round(aiResponse.overall_score);

    const { data: row, error: insertError } = await supabase
      .from("analyses")
      .insert({
        user_id: user.id,
        input_type: inputType,
        input_value: inputValueForDb,
        ai_response: aiResponse as unknown as Record<string, unknown>,
        score,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[api/analyze] supabase insert", insertError);
      return NextResponse.json(
        { error: "Failed to save analysis", detail: insertError.message },
        { status: 500 },
      );
    }

    console.log("[api/analyze] saved", row.id);
    return NextResponse.json({
      success: true,
      analysisId: row.id,
      result: aiResponse,
    });
  } catch (err) {
    console.error("[api/analyze] unhandled", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
