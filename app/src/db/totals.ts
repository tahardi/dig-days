import type { Db } from './db';
import type { Totals } from './types';

const FILTER = "w.status = 'saved' AND w.trail_id = ? AND (? = 0 OR w.feature_id IS ?)";

async function totalsFor(db: Db, trailId: number, filterFeature: 0 | 1, featureId: number | null): Promise<Totals> {
  const summary = await db.getFirstAsync<{ minutes: number; days: number; first: string | null; last: string | null }>(
    "SELECT COALESCE(SUM(w.duration_minutes), 0) AS minutes, COUNT(DISTINCT date(w.started_at, 'localtime')) AS days, " +
      "MIN(date(w.started_at, 'localtime')) AS first, MAX(date(w.started_at, 'localtime')) AS last " +
      'FROM work_days w WHERE ' +
      FILTER,
    trailId,
    filterFeature,
    featureId,
  );
  const tools = await db.getAllAsync<{ tool: string }>(
    'SELECT MIN(je.value) AS tool FROM work_days w, json_each(w.tools_json) je WHERE ' +
      FILTER +
      ' GROUP BY LOWER(je.value) ORDER BY COUNT(*) DESC, LOWER(je.value) ASC LIMIT 3',
    trailId,
    filterFeature,
    featureId,
  );
  return {
    minutes: summary?.minutes ?? 0,
    days: summary?.days ?? 0,
    firstDate: summary?.first ?? null,
    lastDate: summary?.last ?? null,
    topTools: tools.map((t) => t.tool),
  };
}

export function trailTotals(db: Db, trailId: number): Promise<Totals> {
  return totalsFor(db, trailId, 0, null);
}

export function featureTotals(db: Db, trailId: number, featureId: number | null): Promise<Totals> {
  return totalsFor(db, trailId, 1, featureId);
}

export async function allTrailMinutes(db: Db): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<{ trail_id: number; minutes: number }>(
    "SELECT trail_id, SUM(duration_minutes) AS minutes FROM work_days WHERE status = 'saved' GROUP BY trail_id",
  );
  return new Map(rows.map((r) => [r.trail_id, r.minutes]));
}
