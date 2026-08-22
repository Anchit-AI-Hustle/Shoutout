import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase-server';

export async function POST() {
  const supabase = await getServerSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.json({ signedOut: true });
}
