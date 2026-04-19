import { NBA_HEADERS } from './constants';

export type PlayerStat = {
  gameId: string;
  playerId: string;
  playerName: string;
  teamAbbr: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  minutes: string;
  fgMade: number;
  fgAttempted: number;
  fg3Made: number;
  fg3Attempted: number;
  ftMade: number;
  ftAttempted: number;
};

export async function fetchBoxScore(gameId: string): Promise<PlayerStat[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `https://stats.nba.com/stats/boxscoretraditionalv2?GameID=${gameId}&StartPeriod=0&EndPeriod=10&StartRange=0&EndRange=28800&RangeType=0`;
    const res = await fetch(url, {
      headers: NBA_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[boxscore] fetch error for ${gameId}: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const playerStatsSet = data.resultSets?.find(
      (r: any) => r.name === 'PlayerStats'
    );

    if (!playerStatsSet) {
      console.error(`[boxscore] no PlayerStats resultSet for game ${gameId}`);
      return [];
    }

    const h = playerStatsSet.headers;
    const idx = {
      gameId: h.indexOf('GAME_ID'),
      playerId: h.indexOf('PLAYER_ID'),
      playerName: h.indexOf('PLAYER_NAME'),
      teamAbbr: h.indexOf('TEAM_ABBREVIATION'),
      minutes: h.indexOf('MIN'),
      fgMade: h.indexOf('FGM'),
      fgAttempted: h.indexOf('FGA'),
      fg3Made: h.indexOf('FG3M'),
      fg3Attempted: h.indexOf('FG3A'),
      ftMade: h.indexOf('FTM'),
      ftAttempted: h.indexOf('FTA'),
      rebounds: h.indexOf('REB'),
      assists: h.indexOf('AST'),
      steals: h.indexOf('STL'),
      blocks: h.indexOf('BLK'),
      turnovers: h.indexOf('TO'),
      points: h.indexOf('PTS'),
    };

    const missingFields = Object.entries(idx)
      .filter(([, v]) => v === -1)
      .map(([k]) => k);

    if (missingFields.length > 0) {
      console.error(
        `[boxscore] schema changed for ${gameId}. Missing: ${missingFields.join(', ')}`
      );
      return [];
    }

    const players: PlayerStat[] = [];

    for (const row of playerStatsSet.rowSet) {
      const minutes = row[idx.minutes];

      // Skip DNP players (null minutes or 0:00)
      if (!minutes || minutes === '0:00') continue;

      players.push({
        gameId: String(row[idx.gameId]),
        playerId: String(row[idx.playerId]),
        playerName: String(row[idx.playerName]),
        teamAbbr: String(row[idx.teamAbbr]),
        points: Number(row[idx.points]) || 0,
        rebounds: Number(row[idx.rebounds]) || 0,
        assists: Number(row[idx.assists]) || 0,
        steals: Number(row[idx.steals]) || 0,
        blocks: Number(row[idx.blocks]) || 0,
        turnovers: Number(row[idx.turnovers]) || 0,
        minutes: String(minutes),
        fgMade: Number(row[idx.fgMade]) || 0,
        fgAttempted: Number(row[idx.fgAttempted]) || 0,
        fg3Made: Number(row[idx.fg3Made]) || 0,
        fg3Attempted: Number(row[idx.fg3Attempted]) || 0,
        ftMade: Number(row[idx.ftMade]) || 0,
        ftAttempted: Number(row[idx.ftAttempted]) || 0,
      });
    }

    return players;
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`[boxscore] timeout for game ${gameId} (aborted after 5s)`);
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[boxscore] fetch failed for game ${gameId}: ${msg}`);
    }
    return [];
  }
}
