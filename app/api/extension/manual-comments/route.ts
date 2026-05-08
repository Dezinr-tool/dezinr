import { NextResponse } from "next/server";
import type { QcComment } from "@/lib/qc-types";
import { createAdminClient } from "@/lib/supabase/admin";

async function getUserIdFromBearer(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromBearer(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      element_selector?: string;
      element_text?: string;
      x_percent?: number;
      y_percent?: number;
      comment_text?: string;
      page_url?: string;
      is_manual?: boolean;
    };

    const commentText = body.comment_text?.trim();
    const pageUrl = body.page_url?.trim();
    if (!commentText || !pageUrl) {
      return NextResponse.json({ error: "comment_text and page_url are required" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: review, error: reviewError } = await admin
      .from("qc_reviews")
      .select("id, ai_comments, total_issues, must_fix_count, minor_count, suggestion_count")
      .eq("user_id", userId)
      .eq("staging_url", pageUrl)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reviewError) {
      return NextResponse.json({ error: reviewError.message }, { status: 500 });
    }

    let reviewId: string | null = review?.id ?? null;
    if (review) {
      const comments = ((review.ai_comments ?? []) as unknown as QcComment[]);
      const nextId = comments.reduce((max, c) => Math.max(max, c.id), 0) + 1;
      const manualComment: QcComment = {
        id: nextId,
        section: "Manual",
        issue: commentText,
        figma_reference: "Manual extension feedback",
        fix: "Review manually",
        priority: "suggestion",
        status: "open",
        is_manual: true,
        x_percent: body.x_percent,
        y_percent: body.y_percent,
      };

      const next = [...comments, manualComment];
      const nextTotal = next.length;
      const nextMustFix = next.filter((c) => c.priority === "must_fix").length;
      const nextMinor = next.filter((c) => c.priority === "minor").length;
      const nextSuggestion = next.filter((c) => c.priority === "suggestion").length;

      const { error: updateError } = await admin
        .from("qc_reviews")
        .update({
          ai_comments: next as unknown as Record<string, unknown>[],
          total_issues: nextTotal,
          must_fix_count: nextMustFix,
          minor_count: nextMinor,
          suggestion_count: nextSuggestion,
        })
        .eq("id", review.id)
        .eq("user_id", userId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      reviewId = review.id;
    }

    const { error: trainingError } = await admin.from("ai_training_data").insert({
      user_id: userId,
      review_id: reviewId,
      action: "manual",
      original_text: commentText,
      element_selector: body.element_selector ?? null,
      element_text: body.element_text ?? null,
      x_percent: typeof body.x_percent === "number" ? body.x_percent : null,
      y_percent: typeof body.y_percent === "number" ? body.y_percent : null,
      page_url: pageUrl,
    });

    if (trainingError) {
      return NextResponse.json({ error: trainingError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, review_id: reviewId });
  } catch (err) {
    console.error("[api/extension/manual-comments] unhandled", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
