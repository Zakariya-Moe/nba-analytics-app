import { NBA_HEADERS } from './constants';

export type Game = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: 'scheduled' | 'in_progress' | 'final' | 'postponed';
};

export async function fetchNBAGames(
  date: string = new Date().toISOString().split('T')[0]
): Promise<Game[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `https://stats.nba.com/stats/scoreboardv2?GameDate=${date}&LeagueID=00`;
    const res = await fetch(url, {
      headers: NBA_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[nba] scoreboardv2 error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const gameHeaderSet = data.resultSets?.find((r: any) => r.name === 'GameHeader');
    const lineScoreSet = data.resultSets?.find((r: any) => r.name === 'LineScore');

    if (!gameHeaderSet || !lineScoreSet) {
      console.error('[nba] missing resultSets in scoreboardv2 response');
      return [];
    }

    const gh = gameHeaderSet.headers;
    const ls = lineScoreSet.headers;

    const idx = {
      gameId: gh.indexOf('GAME_ID'),
      homeAbbr: gh.indexOf('HOME_TEAM_ABBREVIATION'),
      awayAbbr: gh.indexOf('VISITOR_TEAM_ABBREVIATION'),
      status: gh.indexOf('GAME_STATUS_TEXT'),
      homeId: gh.indexOf('HOME_TEAM_ID'),
      awayId: gh.indexOf('VISITOR_TEAM_ID'),
    };

    const lsIdx = {
      gameId: ls.indexOf('GAME_ID'),
      teamId: ls.indexOf('TEAM_ID'),
      pts: ls.indexOf('PTS'),
    };

    const missingHeader = Object.entries(idx).find(([, v]) => v === -1);
    const missingLs = Object.entries(lsIdx).find(([, v]) => v === -1);

    if (missingHeader || missingLs) {
      console.error('[nba] scoreboardv2 schema changed — missing header fields');
      return [];
    }

    const scoreMap = new Map<string, Record<string, number>>();
    for (const row of lineScoreSet.rowSet) {
      const gameId = String(row[lsIdx.gameId]);
      const teamId = String(row[lsIdx.teamId]);
      const pts = Number(row[lsIdx.pts]) || 0;
      if (!scoreMap.has(gameId)) scoreMap.set(gameId, {});
      scoreMap.get(gameId)![teamId] = pts;
    }

    const games: Game[] = [];

    for (const row of gameHeaderSet.rowSet) {
      const id = String(row[idx.gameId]);
      const homeTeam = String(row[idx.homeAbbr]);
      const awayTeam = String(row[idx.awayAbbr]);
      const statusText = String(row[idx.status] || '');
      const homeTeamId = String(row[idx.homeId]);
      const awayTeamId = String(row[idx.awayId]);

      if (!id || !homeTeam || !awayTeam) continue;

      const scores = scoreMap.get(id) || {};

      let status: Game['status'] = 'scheduled';
      if (statusText.toLowerCase().includes('postponed')) {
        status = 'postponed';
      } else if (statusText.includes('Final') || statusText.includes('OT')) {
        status = 'final';
      } else if (statusText.includes('Q') || statusText.includes('Halftime')) {
        status = 'in_progress';
      }

      games.push({
        id,
        homeTeam,
        awayTeam,
        homeScore: scores[homeTeamId] || 0,
        awayScore: scores[awayTeamId] || 0,
        status,
      });
    }

    return games;
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[nba] scoreboardv2 fetch timed out');
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[nba] scoreboardv2 fetch failed: ${msg}`);
    }
    return [];
  }
}
