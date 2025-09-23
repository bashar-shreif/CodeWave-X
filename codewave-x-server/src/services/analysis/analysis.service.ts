import { Injectable, NotFoundException } from '@nestjs/common';
import * as path from 'node:path';
import { ProjectPathService } from '../project-path/project-path.service';
import { JsonFileService } from '../json-file/json-file.service';
import {
  DepsArtifact,
  DepManagerBlock,
  DependencyItem,
} from '../../types/analysis/analysis.types';

@Injectable()
export class AnalysisService {
  constructor(
    private readonly paths: ProjectPathService,
    private readonly json: JsonFileService,
  ) {}

  async getDeps(projectId: string) {
    if (!this.paths.existsArtifactsDir(projectId)) {
      throw new NotFoundException({
        error: 'not_found',
        message: 'Artifacts not found',
        details: { projectId },
      });
    }
    const dir = this.paths.resolveArtifactsDir(projectId);
    const file = path.resolve(dir, 'deps.json');

    let raw: DepsArtifact | any;
    try {
      raw = await this.json.readJson<DepsArtifact>(file);
    } catch {
      throw new NotFoundException({
        error: 'not_found',
        message: 'deps.json not found',
        details: { projectId },
      });
    }

    const managers = this.normalizeManagers(raw || {});
    const totalManagers = managers.length;
    const totalDependencies = managers.reduce(
      (acc, m) => acc + (m.dependencies?.length || 0),
      0,
    );

    return {
      projectId,
      generatedAt: raw.generatedAt,
      managers,
      stats: { totalManagers, totalDependencies },
      artifactsDir: dir,
    };
  }

  private normalizeManagers(raw: any): DepManagerBlock[] {
    if (Array.isArray(raw.managers) && raw.managers.length > 0) {
      return raw.managers.map((m: any) => ({
        name: String(m.name ?? 'auto'),
        lock: m.lock,
        dependencies: this.normalizeDepsArray(m.dependencies),
      }));
    }

    const out: DepManagerBlock[] = [];

    const rd = this.collectRuntimeDevLists(raw);
    if (rd) out.push(rd);

    const npmLike = this.collectNpmLike(raw);
    if (npmLike) out.push(npmLike);

    const composer = this.collectComposer(raw);
    if (composer) out.push(composer);

    const python = this.collectPython(raw);
    if (python) out.push(python);

    const cargo = this.collectCargo(raw);
    if (cargo) out.push(cargo);

    const gomod = this.collectGo(raw);
    if (gomod) out.push(gomod);

    if (raw.byManager && typeof raw.byManager === 'object') {
      for (const [name, depsAny] of Object.entries(raw.byManager)) {
        out.push({ name, dependencies: this.normalizeDepsArray(depsAny) });
      }
    }

    if (!out.length) {
      if (Array.isArray(raw.dependencies)) {
        out.push({
          name: 'auto',
          dependencies: this.normalizeDepsArray(raw.dependencies),
        });
      } else if (raw.dependencies && typeof raw.dependencies === 'object') {
        const arr: DependencyItem[] = Object.entries(raw.dependencies).map(
          ([name, version]) => ({
            name,
            version: String(version),
          }),
        );
        out.push({ name: 'auto', dependencies: arr });
      }
    }

    return out;
  }

  private collectRuntimeDevLists(raw: any): DepManagerBlock | null {
    const hasRuntime = Array.isArray(raw.runtime);
    const hasDev = Array.isArray(raw.dev);
    if (!hasRuntime && !hasDev) return null;

    const managerName =
      (Array.isArray(raw.pkgManagers) && raw.pkgManagers[0]) || 'npm';

    const dependencies: DependencyItem[] = [];
    if (hasRuntime) {
      for (const s of raw.runtime as string[]) {
        const parsed = this.parseSpec(s);
        if (parsed) dependencies.push({ ...parsed, type: 'prod' });
      }
    }
    if (hasDev) {
      for (const s of raw.dev as string[]) {
        const parsed = this.parseSpec(s);
        if (parsed) dependencies.push({ ...parsed, type: 'dev' });
      }
    }
    return { name: String(managerName), lock: undefined, dependencies };
  }

  private parseSpec(spec: string): { name: string; version: string } | null {
    if (typeof spec !== 'string' || !spec.length) return null;
    const idx = spec.lastIndexOf('@');
    if (idx <= 0 || idx === spec.length - 1) {
      return { name: spec, version: 'latest' };
    }
    const name = spec.slice(0, idx);
    const version = spec.slice(idx + 1);
    if (!name) return null;
    return { name, version };
  }

  private collectNpmLike(raw: any): DepManagerBlock | null {
    const keys = ['npm', 'yarn', 'pnpm', 'bun'];
    for (const key of keys) {
      if (raw[key] && typeof raw[key] === 'object') {
        const grp = raw[key];
        const deps = this.mergeDepGroups({
          dependencies: grp.dependencies,
          devDependencies: grp.devDependencies,
          peerDependencies: grp.peerDependencies,
          optionalDependencies: grp.optionalDependencies,
        });
        return {
          name: key,
          lock: grp.lock || this.detectNpmLock(grp.lockfile || grp.lockFile),
          dependencies: deps,
        };
      }
    }
    const top = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ].some((k) => raw[k]);
    if (top) {
      return {
        name: 'npm',
        lock: this.detectNpmLock(raw.lockfile || raw.lockFile),
        dependencies: this.mergeDepGroups({
          dependencies: raw.dependencies,
          devDependencies: raw.devDependencies,
          peerDependencies: raw.peerDependencies,
          optionalDependencies: raw.optionalDependencies,
        }),
      };
    }
    return null;
  }

  private detectNpmLock(lock?: string): string | undefined {
    if (!lock) return undefined;
    const known = [
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
      'bun.lockb',
    ];
    return known.includes(lock) ? lock : undefined;
  }

  private collectComposer(raw: any): DepManagerBlock | null {
    const node = raw.composer || raw.php;
    if (!node || typeof node !== 'object') return null;
    const deps = this.mergeDepGroups(
      { require: node.require, 'require-dev': node['require-dev'] },
      { require: 'prod', 'require-dev': 'dev' },
    );
    return {
      name: 'composer',
      lock: node.lock || 'composer.lock',
      dependencies: deps,
    };
  }

  private collectPython(raw: any): DepManagerBlock | null {
    if (raw.poetry && typeof raw.poetry === 'object') {
      const deps = this.mergeDepGroups(
        {
          dependencies: raw.poetry.dependencies,
          'dev-dependencies': raw.poetry['dev-dependencies'],
        },
        { dependencies: 'prod', 'dev-dependencies': 'dev' },
      );
      return {
        name: 'poetry',
        lock: raw.poetry.lock || 'poetry.lock',
        dependencies: deps,
      };
    }
    if (raw.pip && typeof raw.pip === 'object') {
      const deps = this.normalizeDepsMap(
        raw.pip.packages || raw.pip.dependencies,
      );
      return { name: 'pip', lock: raw.pip.lock, dependencies: deps };
    }
    return null;
  }

  private collectCargo(raw: any): DepManagerBlock | null {
    if (!raw.cargo || typeof raw.cargo !== 'object') return null;
    const deps = this.mergeDepGroups(
      {
        dependencies: raw.cargo.dependencies,
        'dev-dependencies': raw.cargo['dev-dependencies'],
      },
      { dependencies: 'prod', 'dev-dependencies': 'dev' },
    );
    return { name: 'cargo', lock: 'Cargo.lock', dependencies: deps };
  }

  private collectGo(raw: any): DepManagerBlock | null {
    if (!raw.go || typeof raw.go !== 'object') return null;
    const items: DependencyItem[] = [];
    const mods = Array.isArray(raw.go.modules) ? raw.go.modules : [];
    for (const m of mods) {
      if (m?.name && m?.version)
        items.push({
          name: String(m.name),
          version: String(m.version),
          type: 'prod',
        });
    }
    if (!items.length) return null;
    return { name: 'go', lock: 'go.sum', dependencies: items };
  }

  private mergeDepGroups(
    groups: Record<string, any>,
    typeMap?: Record<string, 'prod' | 'dev' | 'peer' | 'optional'>,
  ): DependencyItem[] {
    const acc: DependencyItem[] = [];
    for (const [groupName, payload] of Object.entries(groups || {})) {
      if (!payload) continue;
      const t =
        typeMap?.[groupName] ||
        (groupName.includes('dev')
          ? 'dev'
          : groupName.includes('peer')
            ? 'peer'
            : groupName.includes('optional')
              ? 'optional'
              : 'prod');
      if (Array.isArray(payload)) {
        for (const p of payload) {
          const name = p?.name ?? p?.[0];
          const version = p?.version ?? p?.[1];
          if (name && version)
            acc.push({ name: String(name), version: String(version), type: t });
        }
      } else if (typeof payload === 'object') {
        for (const [name, version] of Object.entries(payload)) {
          acc.push({ name, version: String(version), type: t });
        }
      }
    }
    return acc;
  }

  private normalizeDepsMap(obj: any): DependencyItem[] {
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).map(([name, version]) => ({
      name,
      version: String(version),
      type: 'prod' as const,
    }));
  }

  private normalizeDepsArray(input: any): DependencyItem[] {
    if (Array.isArray(input)) {
      return input
        .map((d: any) => {
          if (typeof d === 'string') return this.parseSpec(d);
          return {
            name: d?.name ?? String(d?.[0] ?? ''),
            version: d?.version ?? String(d?.[1] ?? ''),
          };
        })
        .filter(Boolean)
        .map((d: any) => ({
          name: d.name,
          version: d.version,
        })) as DependencyItem[];
    }
    if (input && typeof input === 'object') {
      return this.normalizeDepsMap(input);
    }
    return [];
  }
}
