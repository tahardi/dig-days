import type { Catalog } from '@/api/types';

import type { Db } from './db';

type TrailRow = { id: number; name: string };
type FeatureRow = { id: number; trail_id: number; name: string };

function pickSpelling(counts: Map<string, number>): string {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
}

export async function buildCatalog(db: Db): Promise<Catalog> {
  const trails = await db.getAllAsync<TrailRow>('SELECT id, name FROM trails ORDER BY name');
  const features = await db.getAllAsync<FeatureRow>('SELECT id, trail_id, name FROM features ORDER BY name');
  const used = await db.getAllAsync<{ tool: string }>(
    "SELECT je.value AS tool FROM work_days w, json_each(w.tools_json) je WHERE w.status = 'saved'",
  );

  const groups = new Map<string, Map<string, number>>();
  for (const { tool } of used) {
    const key = tool.toLowerCase();
    const spellings = groups.get(key) ?? new Map<string, number>();
    spellings.set(tool, (spellings.get(tool) ?? 0) + 1);
    groups.set(key, spellings);
  }
  const tools = [...groups.values()].map(pickSpelling).sort((a, b) => a.localeCompare(b));

  return {
    trails: trails.map((trail) => ({
      id: trail.id,
      name: trail.name,
      features: features
        .filter((feature) => feature.trail_id === trail.id)
        .map((feature) => ({ id: feature.id, name: feature.name })),
    })),
    tools,
  };
}
