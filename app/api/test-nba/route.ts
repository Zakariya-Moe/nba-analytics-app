import { NextResponse } from 'next/server';
import { fetchNBAGames } from '@/lib/api/nba';
import { upsertGames } from '@/lib/db/games';

export async function GET() {
  const games = await fetchNBAGames();
  await upsertGames(games);
  return NextResponse.json({ success: true, count: games.length, games });
}
