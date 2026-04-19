import { supabase } from './client';
import type { Game } from '@/lib/api/nba';

export async function upsertGames(games: Game[]) {
  if (!games.length) return;

  const ids = games.map((g) => g.id);

  const { data: existing } = await supabase
    .from('games')
    .select('*')
    .in('id', ids);

  const existingMap = new Map((existing || []).map((g: any) => [g.id, g]));

  const updates = [];

  for (const game of games) {
    const prev = existingMap.get(game.id);
    const changed =
      !prev ||
      prev.home_score !== game.homeScore ||
      prev.away_score !== game.awayScore ||
      prev.status !== game.status;

    if (!changed) continue;

    updates.push({
      id: game.id,
      home_team: game.homeTeam,
      away_team: game.awayTeam,
      home_score: game.homeScore,
      away_score: game.awayScore,
      status: game.status,
      last_updated: new Date().toISOString(),
    });
  }

  if (!updates.length) return;

  const { error } = await supabase.from('games').upsert(updates);
  if (error) {
    console.error('[db] games upsert error:', error.message);
  }
}
