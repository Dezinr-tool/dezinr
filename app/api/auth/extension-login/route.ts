import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const supabase = await createClient();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401, headers: corsHeaders });
    }
    
    return NextResponse.json({ 
      token: data.session?.access_token,
      user: { email: data.user?.email }
    }, { headers: corsHeaders });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: corsHeaders });
  }
}
