import { NextResponse } from 'next/server';
import { fetchNBAGames } from '@/lib/api/nba';
import { fetchBoxScore, type PlayerStat } from '@/lib/api/nba-boxscore';
import { upsertGames } from '@/lib/db/games';
import { upsertPlayerStats } from '@/lib/db/player-stats';
import { supabase } from '@/lib/db/client';

const CONCURRENCY = 3;
const STATS_FINALIZE_DELAY_MS = 20 * 60 * 1000; // 20 minutes

async function fetchInBatches(
  gameIds: string[],
  concurrency: number
): Promise<PlayerStat[]> {
  const results: PlayerStat[] = [];

  for (let i = 0; i < gameIds.length; i += concurrency) {
    const batch = gameIds.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (gameId) => {
        try {
          return await fetchBoxScore(gameId);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[cron] safeBoxScore failed for ${gameId}: ${msg}`);
          return [] as PlayerStat[];
        }
      })
    );
    results.push(...batchResults.flat());
  }

  return results;
}

export async function GET(req: Request) {
  const secret = req.headers.get('authorization');
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const cronStart = Date.now();
  console.log(`[cron] start: ${new Date().toISOString()}`);

  // Step 1: Fetch and upsert scores
  const games = await fetchNBAGames();
  await upsertGames(games);
  console.log(`[cron] scores upserted: ${games.length} games`);

  // Step 2: Load games eligible for player stats
  // - in_progress: always fetch (stats changing live)
  // - final + stats_finalized = false: fetch until buffer expires
  const { data: activeGames, error } = await supabase
    .from('games')
    .select('id, status, last_updated, stats_finalized')
    .or('status.eq.in_progress,and(status.eq.final,stats_finalized.eq.false)');

  if (error) {
    console.error('[cron] failed to load active games:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const gameIds = (activeGames || []).map((g: any) => g.id);
  console.log(`[cron] games eligible for player stats: ${gameIds.length}`);

  // Step 3: Batch fetch box scores with per-game failure isolation
  const flatStats = await fetchInBatches(gameIds, CONCURRENCY);
  console.log(`[cron] player stats rows fetched: ${flatStats.length}`);

  if (flatStats.length > 0) {
    await upsertPlayerStats(flatStats);
    console.log('[cron] player stats upserted');
  }

  // Step 4: Mark final games as stats_finalized after the 20-min buffer
  const now = Date.now();
  const toFinalize = (activeGames || [])
    .filter((g: any) => {
      if (g.status !== 'final') return false;
      if (g.stats_finalized) return false;
      const lastUpdated = new Date(g.last_updated).getTime();
      return now - lastUpdated >= STATS_FINALIZE_DELAY_MS;
    })
    .map((g: any) => g.id);

  if (toFinalize.length > 0) {
    const { error: finalizeError } = await supabase
      .from('games')
      .update({ stats_finalized: true })
      .in('id', toFinalize);

    if (finalizeError) {
      console.error('[cron] stats_finalized update error:', finalizeError.message);
    } else {
      console.log(`[cron] stats_finalized set for ${toFinalize.length} games`);
    }
  }

  const elapsed = Date.now() - cronStart;
  console.log(`[cron] done in ${elapsed}ms`);

  return NextResponse.json({
    success: true,
    scoresCount: games.length,
    statsRows: flatStats.length,
    finalized: toFinalize.length,
    elapsedMs: elapsed,
  });
}
