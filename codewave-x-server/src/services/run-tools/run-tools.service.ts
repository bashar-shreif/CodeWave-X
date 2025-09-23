import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectPathService } from '../project-path/project-path.service';
import { ManifestDiscoveryService } from '../manifest-discovery/manifest-discovery.service';
import { summarizeDependencies } from '../../readme-agent/tools/summarize-dependencies';
import { summarizeSecurity } from '../../readme-agent/tools/summarize-security';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as crypto from 'node:crypto';
import scanLanguages from 'src/readme-agent/tools/scan-languages';
import { computeStats } from 'src/readme-agent/tools/compute-stats';

type DepObj = { name: string; version: string; type: string };

const normalizeDeps = (val: unknown, defaultType: string): DepObj[] => {
  if (!val) return [];
  if (Array.isArray(val)) {
    const out: DepObj[] = [];
    for (const x of val) {
      if (typeof x === 'string') {
        const idx = x.lastIndexOf('@');
        if (idx > 0)
          out.push({
            name: x.slice(0, idx),
            version: x.slice(idx + 1),
            type: defaultType,
          });
        else out.push({ name: x, version: 'latest', type: defaultType });
      } else if (x && typeof x === 'object' && 'name' in (x as any)) {
        const o = x as any;
        out.push({
          name: String(o.name),
          version: String(o.version ?? 'latest'),
          type: String(o.type ?? defaultType),
        });
      }
    }
    return out;
  }
  if (typeof val === 'object') {
    const out: DepObj[] = [];
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out.push({ name: k, version: String(v ?? 'latest'), type: defaultType });
    }
    return out;
  }
  return [];
};

@Injectable()
export class RunToolsService {
  constructor(
    private readonly paths: ProjectPathService,
    private readonly manifests: ManifestDiscoveryService,
  ) {}

  async runDeps(projectId: string) {
    const repoRoot = this.paths.resolveWorkspaceDir(projectId);
    if (!this.paths.existsWorkspaceDir(projectId)) {
      throw new NotFoundException({
        error: 'not_found',
        message: 'workspace not found',
        details: { projectId, repoRoot },
      });
    }
    const manifest = await this.manifests.discover(repoRoot);
    const t0 = Date.now();

    const perManifest: {
      manifestPath: string;
      runtime: DepObj[];
      dev: DepObj[];
      tools: string[];
      pkgManagers: string[];
      scripts: Record<string, string>;
    }[] = [];

    const key = (d: DepObj) => `${d.type}:${d.name}`;
    const runtimeMap = new Map<string, DepObj>();
    const devMap = new Map<string, DepObj>();
    const toolsSet = new Set<string>();
    const managersSet = new Set<string>();
    const scriptsAgg: Record<string, string> = {};
    const notesAgg: string[] = [];

    for (const m of manifest) {
      const abs = path.join(repoRoot, m.path);
      const subRoot = path.dirname(abs);
      const subManifest = [
        { path: path.basename(abs), size: m.size, hash: m.hash },
      ] as any;

      const single: any = await summarizeDependencies({
        repoRoot: subRoot,
        manifest: subManifest,
      });

      const rt = normalizeDeps(single?.runtime, 'prod');
      const dv = normalizeDeps(single?.dev, 'dev');

      const tools = Array.isArray(single?.tools) ? single.tools : [];
      const pkgManagers = Array.isArray(single?.pkgManagers)
        ? single.pkgManagers
        : [];
      const scripts =
        typeof single?.scripts === 'object' && single?.scripts
          ? single.scripts
          : {};

      perManifest.push({
        manifestPath: m.path,
        runtime: rt,
        dev: dv,
        tools,
        pkgManagers,
        scripts,
      });

      for (const it of rt) runtimeMap.set(key(it), it);
      for (const it of dv) devMap.set(key(it), it);
      for (const t of tools) toolsSet.add(t);
      for (const pm of pkgManagers) managersSet.add(pm);
      for (const [k, v] of Object.entries(scripts)) scriptsAgg[k] = v as string;
      for (const n of Array.isArray(single?.notes) ? single.notes : [])
        notesAgg.push(String(n));
    }

    const tookMs = Date.now() - t0;

    return {
      projectId,
      status: 'ok' as const,
      tookMs,
      manifest,
      perManifest,
      result_runtime: Array.from(runtimeMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      result_dev: Array.from(devMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      result_tools: Array.from(toolsSet).sort(),
      result_pkgManagers: Array.from(managersSet).sort(),
      result_scripts: scriptsAgg,
      result_notes: notesAgg,
    };
  }

  async runSecurity(projectId: string) {
    const repoRoot = this.paths.resolveWorkspaceDir(projectId);
    if (!this.paths.existsWorkspaceDir(projectId)) {
      throw new NotFoundException({
        error: 'not_found',
        message: 'workspace not found',
        details: { projectId, repoRoot },
      });
    }

    const t0 = Date.now();
    const manifest = await this.manifests.discover(repoRoot);

    const subRoots = new Map<string, string>();
    if (manifest.length === 0) {
      subRoots.set('.', repoRoot);
    } else {
      for (const m of manifest) {
        const abs = path.join(repoRoot, m.path);
        const sub = path.dirname(abs);
        const rel = path.relative(repoRoot, sub) || '.';
        subRoots.set(rel, sub);
      }
    }

    const targets: { root: string; result: any }[] = [];
    for (const [rel, abs] of subRoots) {
      const result = await summarizeSecurity(abs);
      targets.push({ root: rel, result });
    }

    const scores = targets.map((t) => Number(t.result?.score ?? 0));
    const scoreMax = scores.length ? Math.max(...scores) : 0;
    const scoreAvg = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) /
        10
      : 0;

    const sum = (
      k: keyof NonNullable<(typeof targets)[number]['result']['issues']>,
    ) =>
      targets.reduce((acc, t) => acc + Number(t.result?.issues?.[k] ?? 0), 0);

    const anyFlag = (k: 'envFilesPresent' | 'secretFilesDetected') =>
      targets.some((t) => Boolean(t.result?.issues?.[k]));

    const aggregate = {
      scoreMax,
      scoreAvg,
      totals: {
        corsWildcardCount: sum('corsWildcardCount' as any),
        debugModeCount: sum('debugModeCount' as any),
        hardcodedKeysCount: sum('hardcodedKeysCount' as any),
        vulnerableDepsCount: sum('vulnerableDepsCount' as any),
      },
      flags: {
        envFilesPresent: anyFlag('envFilesPresent'),
        secretFilesDetected: anyFlag('secretFilesDetected'),
      },
    };

    return {
      projectId,
      status: 'ok' as const,
      tookMs: Date.now() - t0,
      targets,
      aggregate,
    };
  }

  private async walk(root: string) {
    let files = 0;
    let bytes = 0;
    const stack = [root];
    while (stack.length) {
      const cur = stack.pop() as string;
      const ents = await fs.promises
        .readdir(cur, { withFileTypes: true })
        .catch(() => []);
      for (const e of ents) {
        const p = path.join(cur, e.name);
        if (e.isDirectory()) {
          if (
            e.name === '.git' ||
            e.name === 'node_modules' ||
            e.name === 'vendor' ||
            e.name === 'dist' ||
            e.name === 'build'
          )
            continue;
          stack.push(p);
        } else if (e.isFile()) {
          files += 1;
          bytes += (await fs.promises.stat(p).catch(() => ({ size: 0 }))).size;
        }
      }
    }
    return { files, bytes };
  }

 private async hashFile(p: string) {
    const buf = await fsp.readFile(p);
    const h = crypto.createHash('sha1').update(buf).digest('hex');
    return h;
  }

  private async buildManifest(dir: string, base: string): Promise<Array<{ path: string; size: number; hash: string }>> {
    const out: Array<{ path: string; size: number; hash: string }> = [];
    const ignoreDirs = new Set(['.git', 'node_modules', 'vendor', 'artifacts', 'dist', 'build', '.next', '.cache', 'tmp']);
    const stack: string[] = [dir];
    while (stack.length) {
      const cur = stack.pop() as string;
      const ents = await fsp.readdir(cur, { withFileTypes: true });
      for (const e of ents) {
        const abs = path.join(cur, e.name);
        if (e.isDirectory()) {
          if (ignoreDirs.has(e.name)) continue;
          stack.push(abs);
        } else if (e.isFile()) {
          const rel = path.relative(base, abs).replace(/\\/g, '/');
          const stat = await fsp.stat(abs);
          const hash = await this.hashFile(abs);
          out.push({ path: rel, size: stat.size, hash });
        }
      }
    }
    return out;
  }

  async runStats(opts: { projectId: string; force?: boolean }) {
    const repoRoot = this.paths.resolveWorkspaceDir(opts.projectId);
    const discovered = await this.manifests.discover(repoRoot);
    const roots = Array.from(
      new Set(
        discovered.map(m => {
          const d = path.dirname(m.path);
          return d === '' || d === '.' ? '.' : d;
        })
      )
    );

    if (roots.length > 1) {
      const perSubproject: Array<{
        name: string;
        totalFiles: number;
        totalBytes: number;
        languages: any;
        manifests: number;
      }> = [];

      const agg = {
        totalFiles: 0,
        totalBytes: 0,
        languages: {
          byLanguage: {} as Record<string, { files: number; loc: number; symbols?: { functions: number; classes: number; methods: number } }>,
          totals: { files: 0, bytes: 0, loc: 0, functions: 0, classes: 0, methods: 0 },
        },
        manifests: discovered.length,
        isMonorepo: true,
      };

      for (const rootRel of roots) {
        const subRoot = rootRel === '.' ? repoRoot : path.join(repoRoot, rootRel);
        const subManifest = await this.buildManifest(subRoot, subRoot);
        const languages = await computeStats({ repoRoot: subRoot, manifest: subManifest });
        const { files, bytes } = await this.walk(subRoot);

        perSubproject.push({
          name: rootRel,
          totalFiles: files,
          totalBytes: bytes,
          languages,
          manifests: subManifest.length,
        });

        agg.totalFiles += files;
        agg.totalBytes += bytes;

        for (const [lang, st] of Object.entries(languages.byLanguage || {})) {
          const cur = agg.languages.byLanguage[lang] || { files: 0, loc: 0, symbols: { functions: 0, classes: 0, methods: 0 } };
          agg.languages.byLanguage[lang] = {
            files: cur.files + (st as any).files,
            loc: cur.loc + (st as any).loc,
            symbols: {
              functions: (cur.symbols?.functions || 0) + ((st as any).symbols?.functions || 0),
              classes: (cur.symbols?.classes || 0) + ((st as any).symbols?.classes || 0),
              methods: (cur.symbols?.methods || 0) + ((st as any).symbols?.methods || 0),
            },
          };
        }

        agg.languages.totals.files += languages.totals?.files || 0;
        agg.languages.totals.bytes += bytes || 0;
        agg.languages.totals.functions += languages.totals?.functions || 0;
        agg.languages.totals.classes += languages.totals?.classes || 0;
        agg.languages.totals.methods += languages.totals?.methods || 0;
      }

      return { ...agg, perSubproject };
    }

    const manifest = await this.buildManifest(repoRoot, repoRoot);
    const languages = await computeStats({ repoRoot, manifest });
    const { files: totalFiles, bytes: totalBytes } = await this.walk(repoRoot);
    const manifests = manifest.length;
    const isMonorepo = false;
    return { totalFiles, totalBytes, languages, manifests, isMonorepo };
  }
}
