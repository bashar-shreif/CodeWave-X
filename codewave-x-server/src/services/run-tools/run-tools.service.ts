import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectPathService } from '../project-path/project-path.service';
import { ManifestDiscoveryService } from '../manifest-discovery/manifest-discovery.service';
import { summarizeDependencies } from '../../readme-agent/tools/summarize-dependencies';
import { summarizeSecurity } from '../../readme-agent/tools/summarize-security';
import * as path from 'node:path';

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
}
