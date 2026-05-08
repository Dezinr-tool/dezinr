import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type TrainingAction = "valid" | "edited" | "deleted" | "manual";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = (await request.json()) as {
      review_id?: string;
      comment_id?: string;
      action?: TrainingAction;
      original_text?: string;
      edited_text?: string;
      element_selector?: string;
      element_text?: string;
      x_percent?: number;
      y_percent?: number;
      page_url?: string;
      site_category?: string;
    };

    if (!body.action || !["valid", "edited", "deleted", "manual"].includes(body.action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400, headers: corsHeaders });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("ai_training_data").insert({
      user_id: userId,
      review_id: body.review_id ?? null,
      comment_id: body.comment_id ?? null,
      action: body.action,
      original_text: body.original_text ?? null,
      edited_text: body.edited_text ?? null,
      element_selector: body.element_selector ?? null,
      element_text: body.element_text ?? null,
      x_percent: typeof body.x_percent === "number" ? body.x_percent : null,
      y_percent: typeof body.y_percent === "number" ? body.y_percent : null,
      page_url: body.page_url ?? null,
      site_category: body.site_category ?? null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[api/extension/training-data] unhandled", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
