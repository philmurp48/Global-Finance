// lib/driver-trends.ts
// Helper functions to extract drivers and compute percent-change across periods.
//
// Expected input:
//  - driverRows: array of records with at least:
//      { Level4?: string, Level5?: string, period?: string, metricKey?: number }
//  - metricKey: the numeric field name to compare (e.g. "Amount", "AvgAUM_$mm", "Headcount_FTE")
//  - periodField: field name for period (e.g. "Quarter", "Period", "Date")
//  - latestPeriods: number (default 2) — compute % change between last two periods
//
// Output: array of { driverId, driverLabel, latestValue, priorValue, pctChange, recordCount }

type Row = Record<string, any>;

export type DriverTrend = {
  driverId: string;
  driverLabel: string;
  latestValue: number;
  priorValue: number;
  pctChange: number; // (latest - prior) / |prior| * 100, or Infinity if prior is 0
  recordCount: number;
};

function normalizeDriverLabel(row: Row): string {
  // Prefer Level5 if present, otherwise Level4, else join both
  const l5 = row['Level5'] ? String(row['Level5']).trim() : '';
  const l4 = row['Level4'] ? String(row['Level4']).trim() : '';
  if (l5) return l5;
  if (l4) return l4;
  // fallback to any driver-like field
  return [l4, l5].filter(Boolean).join(' - ') || 'UNKNOWN_DRIVER';
}

export function extractDriverRows(rows: Row[]): Row[] {
  // filter rows that contain at least one of Level4/Level5
  return rows.filter(r => r && (r['Level4'] || r['Level5']));
}

export function computeDriverTrends(
  driverRows: Row[],
  metricKey: string,
  periodField: string,
  latestPeriods = 2
): DriverTrend[] {
  if (!Array.isArray(driverRows) || driverRows.length === 0) return [];

  // group by driver label
  const groups = new Map<string, Row[]>();
  for (const r of driverRows) {
    const label = normalizeDriverLabel(r);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(r);
  }

  // helper to parse period into sortable key (try ISO, quarter pattern, fallback to string)
  function sortKeyForPeriod(period: any): string {
    if (!period && period !== 0) return '';
    const s = String(period);
    // try ISO date
    const dt = Date.parse(s);
    if (!isNaN(dt)) return new Date(dt).toISOString();
    // quarter pattern like 2025Q4 -> convert to sortable "2025-04"
    const q = s.match(/(\d{4})\s*[Qq]?([1-4])/);
    if (q) {
      const year = q[1]; const qn = Number(q[2]);
      // map quarter to month roughly for ordering
      const month = String((qn - 1) * 3 + 1).padStart(2, '0');
      return `${year}-${month}`;
    }
    return s;
  }

  const results: DriverTrend[] = [];

  for (const [driverLabel, rows] of groups.entries()) {
    // build map period -> aggregated metric (sum) and count
    const agg = new Map<string, { value: number; count: number }>();
    for (const r of rows) {
      const pRaw = r[periodField] ?? r['Quarter'] ?? r['Period'] ?? '';
      const pKey = sortKeyForPeriod(pRaw);
      const vRaw = r[metricKey];
      const v = (vRaw === null || vRaw === undefined || vRaw === '') ? 0 : Number(vRaw);
      const existing = agg.get(pKey) ?? { value: 0, count: 0 };
      existing.value += isNaN(v) ? 0 : v;
      existing.count += 1;
      agg.set(pKey, existing);
    }

    // order periods ascending
    const orderedPeriods = Array.from(agg.keys()).sort();
    if (orderedPeriods.length === 0) continue;

    // pick the last two periods
    const lastIndex = orderedPeriods.length - 1;
    const latestKey = orderedPeriods[lastIndex];
    const priorKey = orderedPeriods[Math.max(0, lastIndex - 1)];
    const latestAgg = agg.get(latestKey)!;
    const priorAgg = agg.get(priorKey)!;

    const latestValue = latestAgg?.value ?? 0;
    const priorValue = priorAgg?.value ?? 0;
    let pctChange: number;
    if (!priorAgg || priorValue === 0) {
      // if prior is zero or missing, compute absolute change and mark pctChange as Infinity if prior 0
      pctChange = priorValue === 0 ? (latestValue === 0 ? 0 : Infinity) : ((latestValue - priorValue) / Math.abs(priorValue) * 100);
    } else {
      pctChange = ((latestValue - priorValue) / Math.abs(priorValue)) * 100;
    }

    results.push({
      driverId: driverLabel.toLowerCase().replace(/\s+/g, '_'),
      driverLabel,
      latestValue,
      priorValue,
      pctChange,
      recordCount: rows.length
    });
  }

  // sort by pctChange desc. Put Infinity (new drivers) at top if desired, otherwise choose fallback.
  results.sort((a, b) => {
    if (!isFinite(a.pctChange) && !isFinite(b.pctChange)) return 0;
    if (!isFinite(a.pctChange)) return -1;
    if (!isFinite(b.pctChange)) return 1;
    return b.pctChange - a.pctChange;
  });

  return results;
}





