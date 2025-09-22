import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { randomUUID, createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { compileReadmeGraph } from '../readme-agent/agent/graph';
import type { GraphState } from '../readme-agent/agent/state';

type RunMode = 'draft' | 'final';

type ProgressEvent =
  | { type: 'node_start'; runId: string; node: string; t: number }
  | { type: 'node_end'; runId: string; node: string; t: number }
  | { type: 'cached_hit'; runId: string; scope: string; t: number }
  | { type: 'done'; runId: string; result: any; t: number }
  | { type: 'error'; runId: string; message: string; t: number };

type CacheEntry = {
  mode: RunMode;
  repoHash: string;
  result: any;
  mtimeMs: number;
  createdAt: number;
};

type RunRecord = {
  runId: string;
  events$: Subject<ProgressEvent>;
  startedAt: number;
};

@Injectable()
export class ReadmeOrchestratorService {
  private readonly log = new Logger('ReadmeOrchestrator');
  private compiled = compileReadmeGraph();
  private cache = new Map<string, CacheEntry>();
  private runs = new Map<string, RunRecord>();
  private queues = new Map<string, Promise<any>>();

  private timeoutMs =
    parseInt(process.env.READMEA_TIMEOUT_MS || '', 10) || 90_000;

  private computeRepoHash = (
    repoRoot: string,
  ): { repoHash: string; mtimeMs: number } => {
    const statDir = fs.statSync(repoRoot);
    let latest = statDir.mtimeMs;
    const walker = (p: string) => {
      const ents = fs.readdirSync(p, { withFileTypes: true });
      for (const e of ents) {
        if (e.name === 'node_modules' || e.name.startsWith('.git')) continue;
        const full = path.join(p, e.name);
        try {
          const st = fs.statSync(full);
          latest = Math.max(latest, st.mtimeMs);
          if (e.isDirectory()) walker(full);
        } catch {}
      }
    };
    walker(repoRoot);
    const h = createHash('sha1')
      .update(repoRoot)
      .update(String(latest))
      .digest('hex')
      .slice(0, 12);
    return { repoHash: h, mtimeMs: latest };
  };

  private key = (repoHash: string, mode: RunMode) => `${repoHash}|${mode}`;

  private withTimeout = async <T>(p: Promise<T>, ms: number): Promise<T> =>
    await Promise.race<T>([
      p,
      new Promise<T>((_, rej) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          rej(new Error(`timeout after ${ms}ms`));
        }, ms);
      }),
    ]);

  private shouldRetry = (err: any) =>
    /EBUSY|EAGAIN|EMFILE|ENFILE|EIO|timeout/i.test(String(err?.message || err));

  private enqueue = <T>(repoRoot: string, fn: () => Promise<T>): Promise<T> => {
    const prev = this.queues.get(repoRoot) || Promise.resolve();
    const next = prev.then(fn, fn);
    this.queues.set(
      repoRoot,
      next.then(
        () => undefined,
        () => undefined,
      ),
    );
    return next;
  };

  private tryCached = (repoHash: string, mode: RunMode, force?: boolean) => {
    if (force) return undefined;
    const k = this.key(repoHash, mode);
    return this.cache.get(k);
  };

  private saveCache = (repoHash: string, mode: RunMode, entry: CacheEntry) => {
    this.cache.set(this.key(repoHash, mode), entry);
  };

  startDraft = async (repoRoot: string, force = false, useLLM?: boolean) => {
    return await this.startRun(repoRoot, 'draft', force, useLLM);
  };

  startFinal = async (repoRoot: string, force = false, useLLM?: boolean) => {
    return await this.startRun(repoRoot, 'final', force, useLLM);
  };

  getProgress = (runId: string): Observable<MessageEvent> => {
    const rec = this.runs.get(runId);
    if (!rec) {
      const s = new Subject<MessageEvent>();
      setTimeout(() => {
        s.next({
          data: JSON.stringify({
            type: 'error',
            runId,
            message: 'unknown runId',
          }),
        } as any);
        s.complete();
      }, 0);
      return s.asObservable();
    }
    return rec.events$.asObservable() as any;
  };

  private startRun = async (
    repoRoot: string,
    mode: RunMode,
    force: boolean,
    useLLM?: boolean,
  ) => {
    const t0 = Date.now();
    const { repoHash, mtimeMs } = this.computeRepoHash(repoRoot);
    const runId = randomUUID();
    const events$ = new Subject<ProgressEvent>();
    this.runs.set(runId, { runId, events$, startedAt: t0 });

    const cached = this.tryCached(repoHash, mode, force);
    if (cached) {
      events$.next({ type: 'cached_hit', runId, scope: mode, t: Date.now() });
      const payload =
        mode === 'draft'
          ? cached.result
          : {
              markdown: cached.result?.markdown ?? cached.result,
              artifactsDir: cached.result?.artifactsDir,
            };
      events$.next({ type: 'done', runId, result: payload, t: Date.now() });
      events$.complete();
      return { runId, ...payload };
    }

    const task = async () => {
      const runOnce = async () => {
        const graph = this.compiled;

        const callbacks = {
          onNodeStart: (node: string) =>
            events$.next({ type: 'node_start', runId, node, t: Date.now() }),
          onNodeEnd: (node: string) =>
            events$.next({ type: 'node_end', runId, node, t: Date.now() }),
        };

        const initial: Partial<GraphState> = {
          repo: { root: repoRoot, hash: repoHash },
          flags: { useLLM: !!useLLM },
          outputs: {},
          __progress: (kind: 'node_start' | 'node_end', node: string) =>
            kind === 'node_start'
              ? callbacks.onNodeStart(node)
              : callbacks.onNodeEnd(node),
        } as any;

        const finalState: any = await graph.invoke(initial, {
          configurable: { mode },
        } as any);

        if (mode === 'draft') {
          const res = {
            sections:
              finalState?.writer?.sections ?? finalState?.sections ?? [],
            markdownPreview:
              finalState?.writer?.markdown ?? finalState?.markdown ?? '',
            decisions: finalState?.decisions ?? {},
            artifactsDir: this.ensureArtifactsDir(repoHash),
          };
          this.saveCache(repoHash, mode, {
            mode,
            repoHash,
            result: res,
            mtimeMs,
            createdAt: Date.now(),
          });
          return res;
        } else {
          const res = {
            markdown: finalState?.final?.markdown ?? finalState?.markdown ?? '',
            artifactsDir: this.ensureArtifactsDir(repoHash),
          };
          this.saveCache(repoHash, mode, {
            mode,
            repoHash,
            result: res,
            mtimeMs,
            createdAt: Date.now(),
          });
          return res;
        }
      };

      try {
        const out = await this.withTimeout(runOnce(), this.timeoutMs);
        events$.next({ type: 'done', runId, result: out, t: Date.now() });
        events$.complete();
        return out;
      } catch (err) {
        if (this.shouldRetry(err)) {
          this.log.warn(`retrying run ${runId}: ${String(err)}`);
          try {
            const out = await this.withTimeout(runOnce(), this.timeoutMs);
            events$.next({ type: 'done', runId, result: out, t: Date.now() });
            events$.complete();
            return out;
          } catch (err2) {
            events$.next({
              type: 'error',
              runId,
              message: String(err2),
              t: Date.now(),
            });
            events$.complete();
            throw err2;
          }
        } else {
          events$.next({
            type: 'error',
            runId,
            message: String(err),
            t: Date.now(),
          });
          events$.complete();
          throw err;
        }
      }
    };

    const result = await this.enqueue(repoRoot, task);
    return { runId, ...result };
  };

  private ensureArtifactsDir = (repoHash: string) => {
    const dir = path.join('artifacts', repoHash);
    if (!fs.existsSync('artifacts')) fs.mkdirSync('artifacts');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  };
}
