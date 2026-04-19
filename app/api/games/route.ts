import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';

export async function GET() {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('last_updated', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, games: data || [] });
}
