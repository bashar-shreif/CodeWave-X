import * as path from 'node:path';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as crypto from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectPathService } from '../project-path/project-path.service';
import { ManifestDiscoveryService } from '../manifest-discovery/manifest-discovery.service';
import { summarizeDependencies } from '../../readme-agent/tools/summarize-dependencies';
import { summarizeSecurity } from '../../readme-agent/tools/summarize-security';
import scanLanguages from 'src/readme-agent/tools/scan-languages';
import { computeStats } from 'src/readme-agent/tools/compute-stats';
import detectStack from 'src/readme-agent/tools/detect-stacks';
import { ManifestEntry } from 'src/readme-agent/types/tools/manifest.type';
import { ScanLanguagesOutput } from 'src/readme-agent/types/tools/io.type';
import { summarizeArchitecture } from 'src/readme-agent/tools/summarize-architecture';
import { summarizeCI } from 'src/readme-agent/tools/summarize-ci';
import summarizeConfig from 'src/readme-agent/tools/summarize-config';
import summarizeDocs from 'src/readme-agent/tools/summarize-docs';
import summarizeRoutes from 'src/readme-agent/tools/summarize-routes';
import summarizeTests from 'src/readme-agent/tools/summarize-tests';

type DepObj = { name: string; version: string; type: string };
const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'vendor',
  'dist',
  'build',
  'out',
  '.next',
  '.cache',
]);
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

type LangDistribution = Record<string, number>;
type SubprojectLang = { name: string; distribution: LangDistribution };
type LanguagesResult = {
  isMonorepo: boolean;
  aggregated: LangDistribution;
  perSubproject: SubprojectLang[];
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

  private async buildManifest(
    dir: string,
    base: string,
  ): Promise<Array<{ path: string; size: number; hash: string }>> {
    const out: Array<{ path: string; size: number; hash: string }> = [];
    const ignoreDirs = new Set([
      '.git',
      'node_modules',
      'vendor',
      'artifacts',
      'dist',
      'build',
      '.next',
      '.cache',
      'tmp',
    ]);
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
        discovered.map((m) => {
          const d = path.dirname(m.path);
          return d === '' || d === '.' ? '.' : d;
        }),
      ),
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
          byLanguage: {} as Record<
            string,
            {
              files: number;
              loc: number;
              symbols?: { functions: number; classes: number; methods: number };
            }
          >,
          totals: {
            files: 0,
            bytes: 0,
            loc: 0,
            functions: 0,
            classes: 0,
            methods: 0,
          },
        },
        manifests: discovered.length,
        isMonorepo: true,
      };

      for (const rootRel of roots) {
        const subRoot =
          rootRel === '.' ? repoRoot : path.join(repoRoot, rootRel);
        const subManifest = await this.buildManifest(subRoot, subRoot);
        const languages = await computeStats({
          repoRoot: subRoot,
          manifest: subManifest,
        });
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
          const cur = agg.languages.byLanguage[lang] || {
            files: 0,
            loc: 0,
            symbols: { functions: 0, classes: 0, methods: 0 },
          };
          agg.languages.byLanguage[lang] = {
            files: cur.files + (st as any).files,
            loc: cur.loc + (st as any).loc,
            symbols: {
              functions:
                (cur.symbols?.functions || 0) +
                ((st as any).symbols?.functions || 0),
              classes:
                (cur.symbols?.classes || 0) +
                ((st as any).symbols?.classes || 0),
              methods:
                (cur.symbols?.methods || 0) +
                ((st as any).symbols?.methods || 0),
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

  async runFiles(opts: { projectId: string }) {
    const repoRoot = this.paths.resolveWorkspaceDir(opts.projectId);
    const discovered = await this.manifests.discover(repoRoot);
    const roots = Array.from(
      new Set(
        discovered.map((m) => {
          const d = path.dirname(m.path);
          return d === '' || d === '.' ? '.' : d;
        }),
      ),
    );

    if (roots.length > 1) {
      const per = [];
      let totalFiles = 0;
      let totalBytes = 0;
      for (const rootRel of roots) {
        const subRoot =
          rootRel === '.' ? repoRoot : path.join(repoRoot, rootRel);
        const files = await this.buildManifest(subRoot, subRoot);
        const bytes = files.reduce((a, b) => a + b.size, 0);
        per.push({
          name: rootRel,
          totalFiles: files.length,
          totalBytes: bytes,
          files,
        } as never);
        totalFiles += files.length;
        totalBytes += bytes;
      }
      return {
        totalFiles,
        totalBytes,
        files: [],
        isMonorepo: true,
        perSubproject: per,
      };
    }

    const files = await this.buildManifest(repoRoot, repoRoot);
    const bytes = files.reduce((a, b) => a + b.size, 0);
    return {
      totalFiles: files.length,
      totalBytes: bytes,
      files,
      isMonorepo: false,
    };
  }

  async runStacks(opts: { projectId: string }) {
    const repoRoot = this.paths.resolveWorkspaceDir(opts.projectId);
    const manifest = await this.manifests.discover(repoRoot);

    const groups = new Map<string, ManifestEntry[]>();
    for (const m of manifest) {
      const slash = m.path.lastIndexOf('/');
      const subdir = slash >= 0 ? m.path.slice(0, slash) : '.';
      const relName = slash >= 0 ? m.path.slice(slash + 1) : m.path;
      const arr = groups.get(subdir) ?? [];
      arr.push({ path: relName, size: m.size, hash: m.hash });
      groups.set(subdir, arr);
    }

    type DetectOut = Awaited<ReturnType<typeof detectStack>>;
    const per: { name: string; stacks: string[]; raw: DetectOut }[] = [];

    for (const [subdir, subManifest] of groups) {
      const subRoot = subdir === '.' ? repoRoot : path.join(repoRoot, subdir);
      const raw = await detectStack({
        repoRoot: subRoot,
        manifest: subManifest,
      });
      const stacks = Array.from(
        new Set((raw?.hits ?? []).map((h) => h.stack).filter(Boolean)),
      ).sort();
      per.push({ name: subdir, stacks, raw });
    }

    const aggregated = Array.from(new Set(per.flatMap((p) => p.stacks))).sort();
    return { isMonorepo: groups.size > 1, aggregated, perSubproject: per };
  }

  private toDistribution(scan: any): Record<string, number> {
    const src = scan?.byLanguage ?? scan?.languages?.byLanguage ?? {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(src)) {
      if (typeof v === 'number') out[k] = v;
      else if (
        v &&
        typeof v === 'object' &&
        typeof (v as any).files === 'number'
      )
        out[k] = (v as any).files;
    }
    return out;
  }

  private mergeDistributions(
    dists: Record<string, number>[],
  ): Record<string, number> {
    const acc: Record<string, number> = {};
    for (const d of dists)
      for (const [k, n] of Object.entries(d)) acc[k] = (acc[k] ?? 0) + n;
    return acc;
  }

  async runLanguages(opts: { projectId: string }) {
    const repoRoot = this.manifests.resolveWorkspaceDir(opts.projectId);
    const groups = await this.manifests.discoverGrouped(repoRoot);

    if (groups.length === 0) {
      const manifest = await this.manifests.discoverAllFiles(repoRoot); // Use all files
      const scan = await scanLanguages({ repoRoot, manifest });
      const distribution = this.toDistribution(scan);

      return {
        isMonorepo: false,
        aggregated: distribution,
        perSubproject: [
          {
            name: path.basename(repoRoot),
            distribution,
          },
        ],
      };
    }

    const scans = await Promise.all(
      groups.map(async (group) => {
        const manifest = await this.manifests.discoverAllFiles(group.dir);
        return scanLanguages({
          repoRoot: group.dir,
          manifest,
        });
      }),
    );

    const perSubproject = groups.map((group, i) => ({
      name: group.name,
      distribution: this.toDistribution(scans[i]),
    }));

    const aggregated = this.mergeDistributions(
      perSubproject.map((p) => p.distribution),
    );

    return {
      isMonorepo: groups.length > 1,
      aggregated,
      perSubproject,
    };
  }

  private toStrings = (v: any): string[] =>
    Array.isArray(v)
      ? v
          .map((x) =>
            typeof x === 'string'
              ? x
              : x && typeof x === 'object'
                ? String(
                    x.name ??
                      x.id ??
                      x.label ??
                      x.title ??
                      x.key ??
                      x.path ??
                      x.type ??
                      '',
                  )
                : String(x ?? ''),
          )
          .filter((s) => s && s.trim().length > 0)
      : [];

  private subprojectManifest = (
    entries: ManifestEntry[],
    rel: string,
  ): ManifestEntry[] => {
    if (rel === '.') return entries;
    const pfx = rel + path.sep;
    return entries
      .filter((en) => en.path.startsWith(pfx))
      .map((en) => ({
        path: en.path.slice(pfx.length),
        size: en.size,
        hash: en.hash,
      }));
  };

  private detectSignals = (entries: ManifestEntry[]) => {
    const feExts = new Set([
      '.html',
      '.css',
      '.scss',
      '.sass',
      '.less',
      '.jsx',
      '.tsx',
      '.vue',
      '.svelte',
    ]);
    const beExts = new Set([
      '.ts',
      '.js',
      '.py',
      '.go',
      '.rs',
      '.java',
      '.cs',
      '.php',
      '.rb',
    ]);
    let hasFrontend = false;
    let hasBackend = false;
    for (const e of entries) {
      const ext = path.extname(e.path).toLowerCase();
      if (feExts.has(ext)) hasFrontend = true;
      if (beExts.has(ext)) hasBackend = true;
      if (hasFrontend && hasBackend) break;
    }
    return { hasFrontend, hasBackend };
  };

  async runArchitecture(repoRoot: string) {
    const entries: ManifestEntry[] = await this.manifests.walk(repoRoot);
    const manifestNames = new Set([
      'package.json',
      'composer.json',
      'pyproject.toml',
      'go.mod',
      'Cargo.toml',
      'Gemfile',
      'pom.xml',
      'build.gradle',
      'build.gradle.kts',
    ]);
    const dirs = new Set<string>();
    for (const e of entries) {
      const bn = path.basename(e.path);
      if (manifestNames.has(bn)) dirs.add(path.dirname(e.path));
    }
    const subDirs = dirs.size ? Array.from(dirs) : ['.'];

    const perSubproject: {
      name: string;
      summary: string;
      components: string[];
      patterns: string[];
    }[] = [];

    for (const rel of subDirs) {
      const name = rel === '.' ? path.basename(repoRoot) : path.basename(rel);
      const subAbs = path.join(repoRoot, rel);
      const manifest = this.subprojectManifest(entries, rel);
      const { hasFrontend, hasBackend } = this.detectSignals(manifest);

      const a: any = await summarizeArchitecture({
        repoRoot: subAbs,
        manifest,
      });

      const summary = String(
        a?.summary ?? a?.text ?? a?.overview ?? a?.description ?? '',
      ).trim();

      const rawComponents = this.toStrings(
        a?.components ?? a?.modules ?? a?.services ?? a?.parts ?? a?.layers,
      );
      const set = new Set(rawComponents);

      if (!hasFrontend && set.has('Frontend')) set.delete('Frontend');
      if (hasFrontend && !set.has('Frontend')) set.add('Frontend');

      if (!hasBackend && set.has('Backend')) set.delete('Backend');
      if (hasBackend && !set.has('Backend')) set.add('Backend');

      const components = Array.from(set);
      const patterns = this.toStrings(
        a?.patterns ?? a?.designPatterns ?? a?.architecturalPatterns,
      );

      perSubproject.push({ name, summary, components, patterns });
    }

    const aggregated = {
      summaries: perSubproject.map((s) => s.summary).filter(Boolean),
      components: Array.from(
        new Set(perSubproject.flatMap((s) => s.components)),
      ),
      patterns: Array.from(new Set(perSubproject.flatMap((s) => s.patterns))),
    };

    return { isMonorepo: subDirs.length > 1, aggregated, perSubproject };
  }

  private parseGhYaml = (content: string) => {
    const triggers = new Set<string>();
    const jobs = new Set<string>();
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const mList = l.match(/^\s*on:\s*\[(.+?)\]\s*$/);
      if (mList) {
        mList[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((x) => triggers.add(x));
        continue;
      }
      const mOne = l.match(/^\s*on:\s*([A-Za-z_][\w-]*)\s*$/);
      if (mOne) {
        triggers.add(mOne[1]);
        continue;
      }
      if (/^\s*on:\s*$/.test(l)) {
        for (let j = i + 1; j < lines.length; j++) {
          const lj = lines[j];
          if (/^\S/.test(lj) || /^\s*jobs:\s*$/.test(lj)) break;
          const mm = lj.match(/^\s{2,}([A-Za-z_][\w-]*)\s*:/);
          if (mm) triggers.add(mm[1]);
        }
      }
    }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^\s*jobs:\s*$/.test(l)) {
        for (let j = i + 1; j < lines.length; j++) {
          const lj = lines[j];
          if (/^\S/.test(lj)) break;
          const mm = lj.match(/^\s{2,}([A-Za-z_][\w-]*)\s*:/);
          if (mm) jobs.add(mm[1]);
        }
      }
    }
    return { triggers: Array.from(triggers), jobs: Array.from(jobs) };
  };

  private async scanCI(manifest: ManifestEntry[], subAbs: string) {
    const providers = new Set<string>();
    const workflows: {
      name: string;
      path: string;
      triggers: string[];
      jobs: string[];
    }[] = [];
    const add = (name: string, p: string, t: string[] = [], j: string[] = []) =>
      workflows.push({ name, path: p, triggers: t, jobs: j });

    for (const e of manifest) {
      const p = e.path.replace(/\\/g, '/');
      if (
        p.startsWith('.github/workflows/') &&
        (p.endsWith('.yml') || p.endsWith('.yaml'))
      ) {
        providers.add('github-actions');
        const abs = path.join(subAbs, p);
        let t: string[] = [];
        let j: string[] = [];
        try {
          const content = await fsp.readFile(abs, 'utf8');
          const parsed = this.parseGhYaml(content);
          t = parsed.triggers;
          j = parsed.jobs;
        } catch {}
        add(path.basename(p, path.extname(p)), p, t, j);
        continue;
      }
      if (p === '.gitlab-ci.yml' || p === '.gitlab-ci.yaml') {
        providers.add('gitlab-ci');
        add('pipeline', p, [], []);
        continue;
      }
      if (p === '.circleci/config.yml' || p === '.circleci/config.yaml') {
        providers.add('circleci');
        add('config', p, [], []);
        continue;
      }
      if (p === 'azure-pipelines.yml' || p === 'azure-pipelines.yaml') {
        providers.add('azure-pipelines');
        add('pipeline', p, [], []);
        continue;
      }
      if (p === 'bitbucket-pipelines.yml' || p === 'bitbucket-pipelines.yaml') {
        providers.add('bitbucket-pipelines');
        add('pipeline', p, [], []);
        continue;
      }
      if (p === '.travis.yml') {
        providers.add('travis-ci');
        add('travis', p, [], []);
        continue;
      }
      if (p === '.drone.yml' || p === '.drone.yaml') {
        providers.add('drone');
        add('drone', p, [], []);
        continue;
      }
      if (p === 'appveyor.yml' || p === 'appveyor.yaml') {
        providers.add('appveyor');
        add('appveyor', p, [], []);
      }
    }
    const dedup = new Map<
      string,
      { name: string; path: string; triggers: string[]; jobs: string[] }
    >();
    for (const w of workflows) dedup.set(w.path, w);
    return {
      providers: Array.from(providers),
      workflows: Array.from(dedup.values()),
    };
  }

  async runCI(repoRoot: string) {
    const entries: ManifestEntry[] = await this.manifests.walk(repoRoot);
    const manifestNames = new Set([
      'package.json',
      'composer.json',
      'pyproject.toml',
      'go.mod',
      'Cargo.toml',
      'Gemfile',
      'pom.xml',
      'build.gradle',
      'build.gradle.kts',
    ]);
    const dirs = new Set<string>();
    for (const e of entries) {
      const bn = path.basename(e.path);
      if (manifestNames.has(bn)) dirs.add(path.dirname(e.path));
    }
    const subDirs = dirs.size ? Array.from(dirs) : ['.'];

    const rootTool: any = await summarizeCI(repoRoot);
    const rootProviders = Array.from(
      new Set(
        this.toStrings(
          rootTool?.providers ?? rootTool?.provider ?? rootTool?.platforms,
        ),
      ),
    );
    const rootScan = await this.scanCI(entries, repoRoot);
    const rootCIProviders = Array.from(
      new Set([...rootProviders, ...rootScan.providers]),
    );
    const rootCIWorkflows = new Map<
      string,
      { name: string; path: string; triggers: string[]; jobs: string[] }
    >();
    [
      ...(Array.isArray(rootTool?.workflows)
        ? rootTool.workflows.map((x: any) => ({
            name: String(x?.name ?? x?.id ?? x?.file ?? x?.path ?? 'workflow'),
            path: String(x?.path ?? x?.file ?? ''),
            triggers: this.toStrings(x?.triggers ?? x?.on ?? x?.events),
            jobs: this.toStrings(x?.jobs ?? x?.steps),
          }))
        : []),
      ...rootScan.workflows,
    ].forEach((w) => rootCIWorkflows.set(w.path, w));

    const perSubproject: {
      name: string;
      providers: string[];
      workflows: {
        name: string;
        path: string;
        triggers: string[];
        jobs: string[];
      }[];
    }[] = [];

    for (const rel of subDirs) {
      const name = rel === '.' ? path.basename(repoRoot) : path.basename(rel);
      const subAbs = path.join(repoRoot, rel);
      const manifest = this.subprojectManifest(entries, rel);

      const out: any = await summarizeCI(subAbs);
      const toolProviders = Array.from(
        new Set(
          this.toStrings(out?.providers ?? out?.provider ?? out?.platforms),
        ),
      );
      const toolWorkflows = Array.isArray(out?.workflows)
        ? out.workflows.map((x: any) => ({
            name: String(x?.name ?? x?.id ?? x?.file ?? x?.path ?? 'workflow'),
            path: String(x?.path ?? x?.file ?? ''),
            triggers: this.toStrings(x?.triggers ?? x?.on ?? x?.events),
            jobs: this.toStrings(x?.jobs ?? x?.steps),
          }))
        : [];

      const fallback = await this.scanCI(manifest, subAbs);

      const byPath = new Map<
        string,
        { name: string; path: string; triggers: string[]; jobs: string[] }
      >();
      [...toolWorkflows, ...fallback.workflows].forEach((w) =>
        byPath.set(w.path, w),
      );
      rootCIWorkflows.forEach((w, p) => byPath.set(p, w));

      const providers = Array.from(
        new Set([...toolProviders, ...fallback.providers, ...rootCIProviders]),
      );
      const workflows = Array.from(byPath.values());

      perSubproject.push({ name, providers, workflows });
    }

    const aggProviders = Array.from(
      new Set(perSubproject.flatMap((s) => s.providers)),
    );
    const aggPaths = new Set<string>();
    perSubproject.forEach((s) =>
      s.workflows.forEach((w) => aggPaths.add(w.path)),
    );

    return {
      isMonorepo: subDirs.length > 1,
      aggregated: { providers: aggProviders, workflowsCount: aggPaths.size },
      perSubproject,
    };
  }

  async runConfig(repoRoot: string) {
    const entries: ManifestEntry[] = await this.manifests.walk(repoRoot);
    const manifestNames = new Set([
      'package.json',
      'composer.json',
      'pyproject.toml',
      'go.mod',
      'Cargo.toml',
      'Gemfile',
      'pom.xml',
      'build.gradle',
      'build.gradle.kts',
    ]);
    const dirs = new Set<string>();
    for (const e of entries) {
      const bn = path.basename(e.path);
      if (manifestNames.has(bn)) dirs.add(path.dirname(e.path));
    }
    const subDirs = dirs.size ? Array.from(dirs) : ['.'];

    const readJson = async (abs: string) => {
      try {
        return JSON.parse(await fsp.readFile(abs, 'utf8'));
      } catch {
        return null;
      }
    };

    const detectFromPkg = (pkg: any) => {
      const keys = new Set<string>();
      const pull = (o: any) => {
        if (o && typeof o === 'object')
          Object.keys(o).forEach((k) => keys.add(k.toLowerCase()));
      };
      pull(pkg?.dependencies);
      pull(pkg?.devDependencies);
      pull(pkg?.peerDependencies);
      pull(pkg?.optionalDependencies);
      const scripts = pkg?.scripts
        ? Object.values<string>(pkg.scripts).join(' ').toLowerCase()
        : '';
      const has = (k: string) =>
        Array.from(keys).some(
          (x) => x === k || x.startsWith(k + '-') || x.includes('/' + k),
        ) || scripts.includes(k);
      const bundlers: string[] = [];
      if (has('vite')) bundlers.push('Vite');
      if (
        has('webpack') ||
        has('react-scripts') ||
        has('@angular-devkit/build-angular')
      )
        bundlers.push('Webpack');
      if (has('rollup')) bundlers.push('Rollup');
      if (has('parcel')) bundlers.push('Parcel');
      if (has('esbuild')) bundlers.push('esbuild');
      if (has('@swc/core') || has('@swc/cli')) bundlers.push('SWC');
      if (has('laravel-mix')) bundlers.push('Laravel Mix');
      if (has('next')) bundlers.push('Next');
      if (has('nuxt')) bundlers.push('Vite');
      if (has('astro')) bundlers.push('Vite');
      if (has('@sveltejs/kit')) bundlers.push('Vite');
      const cssTools: string[] = [];
      if (has('postcss')) cssTools.push('PostCSS');
      if (has('autoprefixer')) cssTools.push('Autoprefixer');
      if (has('tailwindcss')) cssTools.push('Tailwind CSS');
      if (has('sass') || has('node-sass') || has('sass-embedded'))
        cssTools.push('Sass');
      if (has('less')) cssTools.push('Less');
      if (has('stylus')) cssTools.push('Stylus');
      return {
        bundlers: Array.from(new Set(bundlers)),
        cssTools: Array.from(new Set(cssTools)),
      };
    };

    const detectFromFiles = (paths: string[]) => {
      const bundlers: string[] = [];
      const cssTools: string[] = [];
      const test = (re: RegExp) => paths.some((p) => re.test(p));
      if (test(/(^|\/)vite\.config\.(js|ts|mjs|cjs)$/)) bundlers.push('Vite');
      if (test(/(^|\/)webpack(\.[\w-]+)?\.config\.(js|ts|mjs|cjs)$/))
        bundlers.push('Webpack');
      if (test(/(^|\/)rollup\.config\.(js|ts|mjs|cjs)$/))
        bundlers.push('Rollup');
      if (test(/(^|\/)webpack\.mix\.js$/)) bundlers.push('Laravel Mix');
      if (test(/(^|\/)gulpfile\.(js|ts|mjs|cjs)$/)) bundlers.push('Gulp');
      if (test(/(^|\/)postcss\.config\.(js|ts|mjs|cjs)$/))
        cssTools.push('PostCSS');
      if (test(/(^|\/)tailwind\.config\.(js|ts|mjs|cjs)$/))
        cssTools.push('Tailwind CSS');
      if (test(/(^|\/)sass\.config\.(js|ts|mjs|cjs)$/)) cssTools.push('Sass');
      return {
        bundlers: Array.from(new Set(bundlers)),
        cssTools: Array.from(new Set(cssTools)),
      };
    };

    const parseEnvVars = async (abs: string) => {
      try {
        return (await fsp.readFile(abs, 'utf8'))
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#') && l.includes('='))
          .map((l) => l.split('=')[0].trim())
          .filter(Boolean);
      } catch {
        return [];
      }
    };

    const inferFromStack = (stack: any) => {
      const vals: string[] = [];
      const push = (s: any) => vals.push(String(s).toLowerCase());
      if (Array.isArray(stack?.frameworks)) stack.frameworks.forEach(push);
      if (Array.isArray(stack?.detected)) stack.detected.forEach(push);
      if (Array.isArray(stack?.hits))
        stack.hits.forEach((h: any) => push(h?.name ?? h?.id ?? h?.label ?? h));
      const bundlers: string[] = [];
      const cssTools: string[] = [];
      const has = (k: string) => vals.some((v) => v.includes(k));
      if (has('vite')) bundlers.push('Vite');
      if (has('webpack')) bundlers.push('Webpack');
      if (has('rollup')) bundlers.push('Rollup');
      if (has('parcel')) bundlers.push('Parcel');
      if (has('esbuild')) bundlers.push('esbuild');
      if (has('swc')) bundlers.push('SWC');
      if (has('laravel')) bundlers.push('Laravel Mix');
      if (has('next')) bundlers.push('Next');
      if (has('nuxt')) bundlers.push('Vite');
      if (has('astro')) bundlers.push('Vite');
      if (has('svelte')) bundlers.push('Vite');
      if (has('postcss')) cssTools.push('PostCSS');
      if (has('autoprefixer')) cssTools.push('Autoprefixer');
      if (has('tailwind')) cssTools.push('Tailwind CSS');
      if (has('sass')) cssTools.push('Sass');
      if (has('less')) cssTools.push('Less');
      if (has('stylus')) cssTools.push('Stylus');
      return {
        bundlers: Array.from(new Set(bundlers)),
        cssTools: Array.from(new Set(cssTools)),
      };
    };

    const perSubproject: {
      name: string;
      bundlers: string[];
      cssTools: string[];
      env: { files: string[]; variables: string[] };
    }[] = [];

    for (const rel of subDirs) {
      const name = rel === '.' ? path.basename(repoRoot) : path.basename(rel);
      const subAbs = path.join(repoRoot, rel);
      const manifest =
        rel === '.'
          ? entries
          : entries
              .filter((en) => en.path.startsWith(rel + path.sep))
              .map<ManifestEntry>((en) => ({
                path: en.path.slice(rel.length + 1),
                size: en.size,
                hash: en.hash,
              }));
      const pathsRel = manifest.map((m) => m.path.replace(/\\/g, '/'));

      const stack: any = await detectStack({ repoRoot: subAbs, manifest });
      const stackDet = inferFromStack(stack);

      const out: any = await summarizeConfig(subAbs);
      const toolBundlers = this.toStrings(
        out?.bundlers ?? out?.bundler ?? out?.buildTools ?? out?.build?.tools,
      );
      const toolCss = this.toStrings(
        out?.cssTools ??
          out?.css?.tools ??
          out?.preprocessors ??
          out?.postcss?.plugins,
      );

      const fileDet = detectFromFiles(pathsRel);

      const pkgRel = pathsRel.find((p) => p === 'package.json');
      const pkg = pkgRel ? await readJson(path.join(subAbs, pkgRel)) : null;
      const pkgDet = pkg ? detectFromPkg(pkg) : { bundlers: [], cssTools: [] };

      const envFilesScan = pathsRel.filter((p) => {
        const b = path.basename(p);
        return b === '.env' || b.startsWith('.env.');
      });
      const toolEnvFiles = this.toStrings(out?.env?.files ?? out?.envFiles);
      const toolEnvVars = this.toStrings(
        out?.env?.variables ?? out?.env?.vars ?? out?.envVars ?? out?.env?.keys,
      );
      const envVarsSets: string[][] = [];
      for (const ef of envFilesScan)
        envVarsSets.push(await parseEnvVars(path.join(subAbs, ef)));

      const bundlers = Array.from(
        new Set([
          ...toolBundlers,
          ...fileDet.bundlers,
          ...pkgDet.bundlers,
          ...stackDet.bundlers,
        ]),
      );
      const cssTools = Array.from(
        new Set([
          ...toolCss,
          ...fileDet.cssTools,
          ...pkgDet.cssTools,
          ...stackDet.cssTools,
        ]),
      );
      const env = {
        files: Array.from(new Set([...toolEnvFiles, ...envFilesScan])),
        variables: Array.from(new Set([...toolEnvVars, ...envVarsSets.flat()])),
      };

      perSubproject.push({ name, bundlers, cssTools, env });
    }

    const aggregated = {
      bundlers: Array.from(new Set(perSubproject.flatMap((s) => s.bundlers))),
      cssTools: Array.from(new Set(perSubproject.flatMap((s) => s.cssTools))),
      env: {
        files: Array.from(new Set(perSubproject.flatMap((s) => s.env.files))),
        variables: Array.from(
          new Set(perSubproject.flatMap((s) => s.env.variables)),
        ),
      },
    };

    return { isMonorepo: subDirs.length > 1, aggregated, perSubproject };
  }

  async runDocs(repoRoot: string) {
    const entries: ManifestEntry[] = await this.manifests.walk(repoRoot);
    const manifestNames = new Set([
      'package.json',
      'composer.json',
      'pyproject.toml',
      'go.mod',
      'Cargo.toml',
      'Gemfile',
      'pom.xml',
      'build.gradle',
      'build.gradle.kts',
    ]);
    const dirs = new Set<string>();
    for (const e of entries) {
      const bn = path.basename(e.path);
      if (manifestNames.has(bn)) dirs.add(path.dirname(e.path));
    }
    const subDirs = dirs.size ? Array.from(dirs) : ['.'];

    const isDocFile = (p: string) => /\.(md|mdx|rst|adoc|txt|html)$/i.test(p);
    const looksLikePath = (s: string) => {
      const b = path.basename(String(s));
      const hasSep = /[\\/]/.test(String(s));
      const hasExt = /\.[a-z0-9]{1,6}$/i.test(b);
      const isReadme = /^readme(\.[a-z0-9]+)?$/i.test(b);
      return hasSep || hasExt || isReadme;
    };
    const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\.\/+/, '');

    const perSubproject: {
      name: string;
      readmes: string[];
      docs: string[];
      topics: string[];
    }[] = [];

    for (const rel of subDirs) {
      const name = rel === '.' ? path.basename(repoRoot) : path.basename(rel);
      const subAbs = path.join(repoRoot, rel);
      const manifest =
        rel === '.'
          ? entries
          : entries
              .filter((en) => en.path.startsWith(rel + path.sep))
              .map<ManifestEntry>((en) => ({
                path: en.path.slice(rel.length + 1),
                size: en.size,
                hash: en.hash,
              }));
      const pathsRel = manifest.map((m) => m.path.replace(/\\/g, '/'));

      const out: any = await summarizeDocs(subAbs);

      const toolReadmes = this.toStrings(
        out?.readmes ?? out?.readme ?? out?.topReadmes,
      )
        .filter(looksLikePath)
        .map(norm)
        .filter((p) => /^readme(\.[a-z0-9]+)?$/i.test(path.basename(p)));

      const toolDocs = this.toStrings(out?.docs ?? out?.documents ?? out?.files)
        .filter(looksLikePath)
        .map(norm)
        .filter((p) => p.toLowerCase() !== 'readme.md' && isDocFile(p));

      const scanReadmes = pathsRel
        .filter((p) => /^readme(\.[a-z0-9]+)?$/i.test(path.basename(p)))
        .map(norm);

      const scanDocs = pathsRel
        .filter((p) => {
          const np = norm(p);
          if (/^readme(\.[a-z0-9]+)?$/i.test(path.basename(np))) return false;
          if (
            /(^|\/)(docs?|wiki|guides|manual|handbook|documentation)\//i.test(
              np,
            ) &&
            isDocFile(np)
          )
            return true;
          return false;
        })
        .map(norm);

      const readmes = Array.from(new Set([...toolReadmes, ...scanReadmes]));
      const docs = Array.from(new Set([...toolDocs, ...scanDocs]));
      const topics = Array.from(
        new Set(this.toStrings(out?.topics ?? out?.coverage ?? out?.areas)),
      );

      perSubproject.push({ name, readmes, docs, topics });
    }

    const aggregated = {
      readmes: Array.from(new Set(perSubproject.flatMap((s) => s.readmes))),
      topics: Array.from(new Set(perSubproject.flatMap((s) => s.topics))),
      docsCount: perSubproject.reduce((n, s) => n + s.docs.length, 0),
    };

    return { isMonorepo: subDirs.length > 1, aggregated, perSubproject };
  }

  async runRoutes(repoRoot: string) {
    const entries: ManifestEntry[] = await this.manifests.walk(repoRoot);
    const manifestNames = new Set([
      'package.json',
      'composer.json',
      'pyproject.toml',
      'go.mod',
      'Cargo.toml',
      'Gemfile',
      'pom.xml',
      'build.gradle',
      'build.gradle.kts',
    ]);
    const dirs = new Set<string>();
    for (const e of entries) {
      const bn = path.basename(e.path);
      if (manifestNames.has(bn)) dirs.add(path.dirname(e.path));
    }
    const subDirs = dirs.size ? Array.from(dirs) : ['.'];

    const normRoute = (
      r: any,
    ): {
      type: 'api' | 'web';
      method: string;
      path: string;
      source: string;
    } => {
      const method = String(r?.method ?? r?.verb ?? 'GET').toUpperCase();
      const routePath = String(r?.path ?? r?.route ?? r?.url ?? '/');
      const tRaw = String(r?.type ?? r?.kind ?? '').toLowerCase();
      const type: 'api' | 'web' =
        tRaw === 'api' || tRaw === 'rest'
          ? 'api'
          : tRaw === 'web' || tRaw === 'page'
            ? 'web'
            : routePath.startsWith('/api')
              ? 'api'
              : 'web';
      const source = String(
        r?.source ?? r?.file ?? r?.handler ?? r?.location ?? '',
      );
      return { type, method, path: routePath, source };
    };

    const perSubproject: {
      name: string;
      totals: { count: number; httpMethods: string[] };
      routes: {
        type: 'api' | 'web';
        method: string;
        path: string;
        source: string;
      }[];
    }[] = [];

    for (const rel of subDirs) {
      const name = rel === '.' ? path.basename(repoRoot) : path.basename(rel);
      const subAbs = path.join(repoRoot, rel);
      const manifest =
        rel === '.'
          ? entries
          : entries
              .filter((en) => en.path.startsWith(rel + path.sep))
              .map<ManifestEntry>((en) => ({
                path: en.path.slice(rel.length + 1),
                size: en.size,
                hash: en.hash,
              }));

      const out: any = await summarizeRoutes({ repoRoot: subAbs, manifest });

      const list: any[] = Array.isArray(out?.routes)
        ? out.routes
        : [
            ...(Array.isArray(out?.api) ? out.api : []),
            ...(Array.isArray(out?.web) ? out.web : []),
          ];

      const routes = list.map(normRoute).filter((x) => x.path);
      const httpMethods = Array.from(
        new Set(routes.map((r) => r.method)),
      ).sort();
      const totals = { count: routes.length, httpMethods };

      perSubproject.push({ name, totals, routes });
    }

    const allRoutes = perSubproject.flatMap((s) => s.routes);
    const count = allRoutes.length;
    const httpMethods = Array.from(
      new Set(allRoutes.map((r) => r.method)),
    ).sort();
    const apiCount = allRoutes.filter((r) => r.type === 'api').length;
    const webCount = allRoutes.filter((r) => r.type === 'web').length;

    return {
      isMonorepo: subDirs.length > 1,
      aggregated: { count, httpMethods, apiCount, webCount },
      perSubproject,
    };
  }

  async runTests(repoRoot: string) {
    const entries: ManifestEntry[] = await this.manifests.walk(repoRoot);
    const manifestNames = new Set([
      'package.json',
      'composer.json',
      'pyproject.toml',
      'go.mod',
      'Cargo.toml',
      'Gemfile',
      'pom.xml',
      'build.gradle',
      'build.gradle.kts',
    ]);
    const dirs = new Set<string>();
    for (const e of entries) {
      const bn = path.basename(e.path);
      if (manifestNames.has(bn)) dirs.add(path.dirname(e.path));
    }
    const subDirs = dirs.size ? Array.from(dirs) : ['.'];

    const readJson = async (abs: string) => {
      try {
        return JSON.parse(await fsp.readFile(abs, 'utf8'));
      } catch {
        return null;
      }
    };

    const detectFrameworksFromPkg = (pkg: any) => {
      const keys = new Set<string>();
      const pull = (o: any) => {
        if (o && typeof o === 'object')
          Object.keys(o).forEach((k) => keys.add(k.toLowerCase()));
      };
      pull(pkg?.dependencies);
      pull(pkg?.devDependencies);
      pull(pkg?.peerDependencies);
      pull(pkg?.optionalDependencies);
      const scripts = pkg?.scripts
        ? Object.values<string>(pkg.scripts).join(' ').toLowerCase()
        : '';
      const has = (k: string) =>
        Array.from(keys).some(
          (x) => x === k || x.startsWith(k + '-') || x.includes('/' + k),
        ) || scripts.includes(k);
      const out: string[] = [];
      if (has('jest')) out.push('Jest');
      if (has('vitest')) out.push('Vitest');
      if (has('mocha')) out.push('Mocha');
      if (has('chai')) out.push('Chai');
      if (has('ava')) out.push('AVA');
      if (has('karma')) out.push('Karma');
      if (has('@testing-library')) out.push('Testing Library');
      if (has('cypress')) out.push('Cypress');
      if (has('@playwright/test') || has('playwright')) out.push('Playwright');
      return Array.from(new Set(out));
    };

    const detectFrameworksFromFiles = (paths: string[]) => {
      const out: string[] = [];
      const test = (re: RegExp) => paths.some((p) => re.test(p));
      if (test(/(^|\/)jest\.config\.(js|ts|cjs|mjs)$/i)) out.push('Jest');
      if (test(/(^|\/)vitest\.config\.(js|ts|cjs|mjs)$/i)) out.push('Vitest');
      if (test(/(^|\/)karma\.conf\.(js|ts)$/i)) out.push('Karma');
      if (
        test(/(^|\/)cypress\.config\.(js|ts|cjs|mjs)$/i) ||
        test(/(^|\/)cypress\/config\./i)
      )
        out.push('Cypress');
      if (test(/(^|\/)playwright\.config\.(js|ts)$/i)) out.push('Playwright');
      if (test(/(^|\/)phpunit\.xml(\.dist)?$/i)) out.push('PHPUnit');
      if (
        test(/(^|\/)pytest\.ini$/i) ||
        test(/(^|\/)tox\.ini$/i) ||
        test(/(^|\/)setup\.cfg$/i)
      )
        out.push('pytest');
      if (test(/(^|\/)build\.gradle(\.kts)?$/i)) out.push('JUnit');
      return Array.from(new Set(out));
    };

    const collectTestFiles = (paths: string[]) => {
      const picks: string[] = [];
      for (const p of paths) {
        const np = p.replace(/\\/g, '/');
        const b = path.basename(np).toLowerCase();
        if (/(^|\/)__tests__\//i.test(np)) {
          picks.push(np);
          continue;
        }
        if (/\.(test|spec)\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(b)) {
          picks.push(np);
          continue;
        }
        if (/^test_.*\.py$/i.test(b) || /.*_test\.py$/i.test(b)) {
          picks.push(np);
          continue;
        }
        if (/.*_test\.go$/i.test(b)) {
          picks.push(np);
          continue;
        }
        if (
          /.*test\.php$/i.test(b) ||
          (/(^|\/)tests?\//i.test(np) && /\.php$/i.test(b))
        ) {
          picks.push(np);
          continue;
        }
        if (/(^|\/)src\/test\//i.test(np)) {
          picks.push(np);
          continue;
        }
        if (/(^|\/)tests\//i.test(np) && /\.rs$/i.test(b)) {
          picks.push(np);
          continue;
        }
      }
      return picks;
    };

    const perSubproject: {
      name: string;
      frameworks: string[];
      totals: { count: number };
      files: string[];
    }[] = [];

    for (const rel of subDirs) {
      const name = rel === '.' ? path.basename(repoRoot) : path.basename(rel);
      const subAbs = path.join(repoRoot, rel);
      const manifest =
        rel === '.'
          ? entries
          : entries
              .filter((en) => en.path.startsWith(rel + path.sep))
              .map<ManifestEntry>((en) => ({
                path: en.path.slice(rel.length + 1),
                size: en.size,
                hash: en.hash,
              }));
      const pathsRel = manifest.map((m) => m.path.replace(/\\/g, '/'));

      const out: any = await summarizeTests(subAbs);
      const toolFrameworks = Array.from(
        new Set(this.toStrings(out?.frameworks ?? out?.tools)),
      );
      const toolFiles = Array.isArray(out?.locations)
        ? this.toStrings(out.locations)
        : [];

      const pkgRel = pathsRel.find((p) => p === 'package.json');
      const pkg = pkgRel ? await readJson(path.join(subAbs, pkgRel)) : null;

      const fw = Array.from(
        new Set([
          ...toolFrameworks,
          ...detectFrameworksFromPkg(pkg),
          ...detectFrameworksFromFiles(pathsRel),
        ]),
      );

      const files = Array.from(
        new Set([
          ...toolFiles.filter((s) => s.includes('/')),
          ...collectTestFiles(pathsRel),
        ]),
      ).slice(0, 200);

      const totals = { count: files.length };

      perSubproject.push({ name, frameworks: fw, totals, files });
    }

    const aggregated = {
      count: perSubproject.reduce((n, s) => n + s.totals.count, 0),
      frameworks: Array.from(
        new Set(perSubproject.flatMap((s) => s.frameworks)),
      ),
    };

    return { isMonorepo: subDirs.length > 1, aggregated, perSubproject };
  }
}
