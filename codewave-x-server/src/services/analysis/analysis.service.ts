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

    let raw: DepsArtifact;
    try {
      raw = await this.json.readJson<DepsArtifact>(file);
    } catch {
      throw new NotFoundException({
        error: 'not_found',
        message: 'deps.json not found',
        details: { projectId },
      });
    }

    const managers = this.normalizeManagers(raw);
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

  private normalizeManagers(raw: DepsArtifact): DepManagerBlock[] {
    if (Array.isArray(raw.managers) && raw.managers.length > 0)
      return raw.managers;

    const out: DepManagerBlock[] = [];

    if (raw.byManager && typeof raw.byManager === 'object') {
      for (const [name, depsAny] of Object.entries(raw.byManager)) {
        const dependencies = this.normalizeDepsArray(depsAny);
        out.push({ name, dependencies });
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
          ([name, version]) => ({ name, version: String(version) }),
        );
        out.push({ name: 'auto', dependencies: arr });
      }
    }

    return out;
  }

  private normalizeDepsArray(input: any): DependencyItem[] {
    if (Array.isArray(input)) {
      return input
        .map((d: any) => ({
          name: d.name ?? String(d[0] ?? ''),
          version: d.version ?? String(d[1] ?? ''),
          type: d.type,
        }))
        .filter((d) => d.name && d.version);
    }
    return [];
  }
}
