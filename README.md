# NBA Analytics MVP

Live NBA scores and player stats — Next.js 14, Supabase, Vercel.

---

## Setup

### 1. Environment variables

Create `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CRON_SECRET=your_random_secret_string
```

### 2. Supabase migration

Run this SQL in your Supabase SQL editor:

```sql
-- Games table
create table if not exists games (
  id text primary key,
  home_team text not null,
  away_team text not null,
  home_score integer default 0,
  away_score integer default 0,
  status text default 'scheduled',
  stats_finalized boolean default false,
  last_updated timestamptz default now()
);

-- Player stats table
create table if not exists player_stats (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  player_id text not null,
  player_name text not null,
  team_abbr text not null,
  points integer,
  rebounds integer,
  assists integer,
  steals integer,
  blocks integer,
  turnovers integer,
  minutes text,
  fg_made integer,
  fg_attempted integer,
  fg3_made integer,
  fg3_attempted integer,
  ft_made integer,
  ft_attempted integer,
  last_updated timestamptz default now(),
  unique(game_id, player_id)
);
```

### 3. Install and run

```bash
npm install
npm run dev
```

### 4. Deploy to Vercel

- Push to GitHub
- Connect repo to Vercel
- Add environment variables in Vercel project settings
- Cron is configured in `vercel.json` (runs every minute)

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/games` | GET | Read all games from Supabase |
| `/api/test-nba` | GET | Manually trigger score fetch + upsert |
| `/api/cron` | GET | Production cron — protected by `CRON_SECRET` |

---

## Architecture

```
NBA API (stats.nba.com)
  └── scoreboardv2      → games table
  └── boxscoretraditionalv2 → player_stats table

Supabase
  └── games (upsert, diff-based)
  └── player_stats (upsert on conflict game_id, player_id)

Vercel Cron (every 1 min)
  └── /api/cron
      ├── fetch scores → upsert games
      ├── filter eligible games (in_progress + unfinalized final)
      ├── batch fetch boxscores (concurrency: 3)
      ├── upsert player_stats
      └── mark stats_finalized after 20-min buffer
```
