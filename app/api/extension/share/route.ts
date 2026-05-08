import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    const body = (await request.json()) as { reviewId?: string; emails?: string[] };
    const reviewId = body.reviewId?.trim();
    const emails = Array.isArray(body.emails) ? body.emails.map((e) => e.trim()).filter(Boolean) : [];

    if (!reviewId || !emails.length) {
      return NextResponse.json(
        { error: "reviewId and emails are required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const admin = createAdminClient();
    const rows = emails.map((email) => ({
      review_id: reviewId,
      shared_by_user_id: userId,
      email,
    }));

    const { error } = await admin.from("review_shares").insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }

    rows.forEach((row) => {
      console.log("[share] invite", { reviewId: row.review_id, to: row.email });
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[api/extension/share] unhandled", err);
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: corsHeaders });
  }
}
