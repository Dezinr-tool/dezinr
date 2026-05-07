import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isAnalysisAiResponse,
  type AnalysisAiResponse,
  type MultiPageAnalysisAiResponse,
} from "@/lib/analysis-types";

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

function buildCombinedSummary(
  pages: Array<{ inputValue: string; result: AnalysisAiResponse }>,
): MultiPageAnalysisAiResponse {
  const total = pages.reduce((acc, page) => acc + page.result.overall_score, 0);
  const average = pages.length ? Math.round(total / pages.length) : 0;
  const weakest = pages.reduce<{ inputValue: string; score: number } | null>(
    (prev, page) => {
      if (!prev || page.result.overall_score < prev.score) {
        return { inputValue: page.inputValue, score: page.result.overall_score };
      }
      return prev;
    },
    null,
  );

  const issueCounts = new Map<string, number>();
  for (const page of pages) {
    for (const category of Object.values(page.result.categories)) {
      for (const issue of category.issues ?? []) {
        const key = issue.trim();
        if (!key) continue;
        issueCounts.set(key, (issueCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const commonIssues = Array.from(issueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text]) => text);

  const summary =
    pages.length > 1
      ? `Audited ${pages.length} pages. Overall quality is ${average}/100. ${
          weakest
            ? `The weakest page right now is ${weakest.inputValue} (${weakest.score}/100), so that is the best place to focus first.`
            : ""
        }`
      : pages[0]?.result.summary ?? "No pages were audited.";

  return {
    overall_score: average,
    summary,
    common_issues: commonIssues,
    pages: pages.map((page, index) => ({
      page_label: `Page ${index + 1}`,
      input_value: page.inputValue,
      result: page.result,
    })),
  };
}

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
      inputValues?: string[];
      imageBase64?: string;
      mediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    };

    const inputType = body.inputType;
    if (inputType !== "url" && inputType !== "screenshot" && inputType !== "figma") {
      return NextResponse.json({ error: "Invalid inputType" }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    console.log("[api/analyze] calling Claude");

    async function analyzeOne(
      content: Anthropic.MessageCreateParams["messages"][number]["content"],
    ): Promise<AnalysisAiResponse> {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
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
        throw new Error("Model returned invalid JSON");
      }

      if (!isAnalysisAiResponse(parsed)) {
        console.error("[api/analyze] schema mismatch", parsed);
        throw new Error("Model JSON did not match expected schema");
      }

      return parsed;
    }

    let inputValueForDb: string;
    let inputTypeForDb: "url" | "screenshot" | "figma";
    let aiPayload: AnalysisAiResponse | MultiPageAnalysisAiResponse;
    let score: number;

    if (inputType === "screenshot") {
      const data = body.imageBase64?.trim();
      const mediaType = body.mediaType ?? "image/png";
      if (!data) {
        return NextResponse.json(
          { error: "imageBase64 required for screenshot" },
          { status: 400 },
        );
      }
      inputTypeForDb = "screenshot";
      inputValueForDb = "[Screenshot upload]";
      const result = await analyzeOne([
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data },
        },
        {
          type: "text",
          text: "Analyze this design screenshot for UX and UI quality. Respond with the required JSON only.",
        },
      ]);
      aiPayload = result;
      score = Math.round(result.overall_score);
    } else if (inputType === "figma") {
      const figmaUrl = (body.inputValue ?? "").trim();
      if (!figmaUrl) {
        return NextResponse.json({ error: "Figma URL required" }, { status: 400 });
      }
      inputTypeForDb = "figma";
      inputValueForDb = figmaUrl;
      const result = await analyzeOne([
        {
          type: "text",
          text: `This is a Figma design file URL: ${figmaUrl}. Analyze the design for: visual hierarchy, spacing consistency, typography, color usage, component consistency, and UX flow. Give feedback like a senior designer reviewing junior designer's work.`,
        },
      ]);
      aiPayload = result;
      score = Math.round(result.overall_score);
    } else {
      const urls =
        Array.isArray(body.inputValues) && body.inputValues.length > 0
          ? body.inputValues.map((u) => u.trim()).filter(Boolean)
          : [(body.inputValue ?? "").trim()].filter(Boolean);
      if (urls.length === 0) {
        return NextResponse.json({ error: "URL required" }, { status: 400 });
      }
      inputTypeForDb = "url";
      inputValueForDb = urls.join("\n");

      const pageResults: Array<{ inputValue: string; result: AnalysisAiResponse }> = [];
      for (const url of urls) {
        const result = await analyzeOne([
          {
            type: "text",
            text: `Please audit this website/staging URL for UX and UI quality: ${url}`,
          },
        ]);
        pageResults.push({ inputValue: url, result });
      }

      if (pageResults.length === 1) {
        aiPayload = pageResults[0].result;
        score = Math.round(pageResults[0].result.overall_score);
      } else {
        const combined = buildCombinedSummary(pageResults);
        aiPayload = combined;
        score = Math.round(combined.overall_score);
      }
    }

    const { data: row, error: insertError } = await supabase
      .from("analyses")
      .insert({
        user_id: user.id,
        input_type: inputTypeForDb,
        input_value: inputValueForDb,
        ai_response: aiPayload as unknown as Record<string, unknown>,
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
      result: aiPayload,
    });
  } catch (err) {
    console.error("[api/analyze] unhandled", err);
    if (err instanceof Error) {
      if (err.message === "Model returned invalid JSON") {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
      if (err.message === "Model JSON did not match expected schema") {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
