import { supabase } from './client';
import type { PlayerStat } from '@/lib/api/nba-boxscore';

export async function upsertPlayerStats(stats: PlayerStat[]) {
  if (!stats.length) return;

  const rows = stats.map((s) => ({
    game_id: s.gameId,
    player_id: s.playerId,
    player_name: s.playerName,
    team_abbr: s.teamAbbr,
    points: s.points,
    rebounds: s.rebounds,
    assists: s.assists,
    steals: s.steals,
    blocks: s.blocks,
    turnovers: s.turnovers,
    minutes: s.minutes,
    fg_made: s.fgMade,
    fg_attempted: s.fgAttempted,
    fg3_made: s.fg3Made,
    fg3_attempted: s.fg3Attempted,
    ft_made: s.ftMade,
    ft_attempted: s.ftAttempted,
    last_updated: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('player_stats')
    .upsert(rows, { onConflict: 'game_id,player_id' });

  if (error) {
    console.error('[db] player_stats upsert error:', error.message);
  }
}
