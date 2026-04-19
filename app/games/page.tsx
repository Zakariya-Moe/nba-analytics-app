'use client';

import useSWR from 'swr';
import { useState } from 'react';

type Game = {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: string;
  last_updated: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'LIVE',
  final: 'Final',
  scheduled: 'Scheduled',
  postponed: 'Postponed',
};

export default function GamesPage() {
  const { data, error, isLoading } = useSWR('/api/games', fetcher, {
    refreshInterval: 30000,
  });

  const [filter, setFilter] = useState<'all' | 'live' | 'final' | 'scheduled'>('all');

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <p>Failed to load games. Check your connection and try again.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: '24px' }}>
        <p>Loading games...</p>
      </div>
    );
  }

  const games: Game[] = data?.games || [];

  const filtered = games.filter((g) => {
    if (filter === 'live') return g.status === 'in_progress';
    if (filter === 'final') return g.status === 'final';
    if (filter === 'scheduled') return g.status === 'scheduled';
    return true;
  });

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>
        NBA Live Scores
      </h1>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(['all', 'live', 'final', 'scheduled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              border: '1px solid #333',
              background: filter === f ? '#333' : 'transparent',
              color: '#ededed',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: '#888', fontSize: '14px' }}>No games found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((g) => (
            <div
              key={g.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                border: '1px solid #222',
                borderRadius: '6px',
                background: '#111',
                fontSize: '14px',
              }}
            >
              <span>
                {g.away_team} {g.away_score} &mdash; {g.home_team} {g.home_score}
              </span>
              <span
                style={{
                  color:
                    g.status === 'in_progress'
                      ? '#4ade80'
                      : g.status === 'postponed'
                      ? '#f87171'
                      : '#888',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                {STATUS_LABEL[g.status] ?? g.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
