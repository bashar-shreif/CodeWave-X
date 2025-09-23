import { Subject } from 'rxjs';

export type RunMode = 'draft' | 'final';

export type ProgressEvent =
  | { type: 'node_start'; runId: string; node: string; t: number }
  | { type: 'node_end'; runId: string; node: string; t: number }
  | { type: 'cached_hit'; runId: string; scope: string; t: number }
  | { type: 'done'; runId: string; result: any; t: number }
  | { type: 'error'; runId: string; message: string; t: number };

export type CacheEntry = {
  mode: RunMode;
  repoHash: string;
  result: any;
  mtimeMs: number;
  createdAt: number;
};

export type RunRecord = {
  runId: string;
  events$: Subject<ProgressEvent>;
  startedAt: number;
};
