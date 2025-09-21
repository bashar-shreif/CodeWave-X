export type CoverageSummary = {
  lines?: { pct: number };
  statements?: { pct: number };
  branches?: { pct: number };
  functions?: { pct: number };
};