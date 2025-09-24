import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { configDotenv } from 'dotenv';
configDotenv();
@Injectable()
export class ProjectPathService {
  private artifactsRoot = path.resolve(process.cwd(), 'artifacts');
  private workspacesRoot = path.resolve(
    process.cwd(),
    process.env.READMEA_WORKSPACES_ROOT || 'workspaces',
  );

  resolveArtifactsDir(projectId: string) {
    return path.resolve(this.artifactsRoot, projectId);
  }

  existsArtifactsDir(projectId: string) {
    return fs.existsSync(this.resolveArtifactsDir(projectId));
  }

  resolveWorkspaceDir(projectId: string) {
    return path.resolve(this.workspacesRoot, projectId);
  }

  existsWorkspaceDir(projectId: string) {
    return fs.existsSync(this.resolveWorkspaceDir(projectId));
  }
}
