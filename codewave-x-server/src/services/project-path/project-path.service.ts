import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';

@Injectable()
export class ProjectPathService {
  private resolveRoot(): string {
    return process.env.ARTIFACTS_ROOT || path.resolve(process.cwd(), 'artifacts');
  }

  resolveArtifactsDir(projectId: string): string {
    const base = this.resolveRoot();
    const dir = path.resolve(base, projectId);
    return dir;
  }

  existsArtifactsDir(projectId: string): boolean {
    const dir = this.resolveArtifactsDir(projectId);
    try {
      return fs.statSync(dir).isDirectory();
    } catch {
      return false;
    }
  }
}
