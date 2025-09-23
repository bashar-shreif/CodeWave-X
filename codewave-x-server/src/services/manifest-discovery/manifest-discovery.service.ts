import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { ManifestEntry } from '../../readme-agent/types/tools/manifest.type';

type Group = { name: string; dir: string; manifest: ManifestEntry[] };

@Injectable()
export class ManifestDiscoveryService {
  async sha1File(file: string) {
    const buf = await fsp.readFile(file);
    return crypto.createHash('sha1').update(buf).digest('hex');
  }

  async walk(root: string): Promise<ManifestEntry[]> {
    const ignore = new Set([
      '.git',
      'node_modules',
      'dist',
      'build',
      '.next',
      '.turbo',
      '.cache',
      'vendor',
      'target',
      '.idea',
      '.vscode',
      '.pytest_cache',
      '__pycache__',
    ]);
    const out: ManifestEntry[] = [];
    const stack: string[] = ['.'];
    while (stack.length) {
      const rel = stack.pop() as string;
      const abs = path.join(root, rel);
      const entries = await fsp
        .readdir(abs, { withFileTypes: true })
        .catch(() => []);
      for (const e of entries) {
        if (ignore.has(e.name)) continue;
        if (e.name.startsWith('.') && e.name !== '.gitignore') continue;
        const childRel = rel === '.' ? e.name : path.join(rel, e.name);
        const childAbs = path.join(root, childRel);
        if (e.isDirectory()) {
          stack.push(childRel);
        } else if (e.isFile()) {
          const st = await fsp.stat(childAbs).catch(() => null);
          if (!st) continue;
          const hash = await this.sha1File(childAbs);
          out.push({ path: childRel.replace(/\\/g, '/'), size: st.size, hash });
        }
      }
    }
    return out;
  }

  async discover(root: string): Promise<ManifestEntry[]> {
    const files: ManifestEntry[] = [];
    const add = async (rel: string) => {
      const abs = path.join(root, rel);
      const stat = await fsp.stat(abs);
      const hash = await this.sha1File(abs);
      files.push({ path: rel, size: stat.size, hash });
    };

    const known = [
      'package.json',
      'pnpm-lock.yaml',
      'yarn.lock',
      'bun.lockb',
      'composer.json',
      'composer.lock',
    ];

    for (const k of known) {
      const p = path.join(root, k);
      try {
        await fsp.access(p);
        await add(k);
      } catch {}
    }

    const dirs = await fsp
      .readdir(root, { withFileTypes: true })
      .then((d) => d.filter((x) => x.isDirectory()))
      .catch(() => []);
    for (const d of dirs) {
      const name = d.name;
      const sub = path.join(root, name);
      for (const k of known) {
        const p = path.join(sub, k);
        try {
          await fsp.access(p);
          await add(path.join(name, k));
        } catch {}
      }
    }

    return files;
  }

  async discoverGrouped(root: string): Promise<Group[]> {
    const entries = await this.discover(root);
    if (entries.length <= 1) return [];
    const rootName = path.basename(root);
    const groups = new Map<string, Group>();
    for (const e of entries) {
      const rel = e.path;
      const seg0 = rel.split(path.sep)[0] || '';
      const key = rel.includes(path.sep) ? seg0 : '__root__';
      const name = key === '__root__' ? rootName : key;
      const dir = key === '__root__' ? root : path.join(root, key);
      if (!groups.has(name)) groups.set(name, { name, dir, manifest: [] });
      groups.get(name)!.manifest.push(e);
    }
    return Array.from(groups.values());
  }

  resolveWorkspaceDir(projectId: string): string {
    const rootEnv = process.env.READMEA_WORKSPACES_ROOT?.trim() || 'workspaces';
    const base = path.isAbsolute(rootEnv)
      ? rootEnv
      : path.resolve(process.cwd(), rootEnv);
    const dir = path.resolve(base, projectId);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      throw new NotFoundException({
        error: 'not_found',
        message: 'workspace not found',
        details: { projectId, repoRoot: dir },
      });
    }
    return dir;
  }

  async discoverAllFiles(
    root: string,
    maxDepth: number = 3,
  ): Promise<ManifestEntry[]> {
    const files: ManifestEntry[] = [];
    const ignoreDirs = new Set([
      'node_modules',
      '.git',
      '.svn',
      '.hg',
      'dist',
      'build',
      'target',
      'vendor',
      '__pycache__',
      '.pytest_cache',
      '.vscode',
      '.idea',
    ]);

    const scanDir = async (dir: string, currentDepth: number = 0) => {
      if (currentDepth > maxDepth) return;
      const entries = await fsp
        .readdir(dir, { withFileTypes: true })
        .catch(() => []);
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue;
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(root, fullPath);
        if (entry.isDirectory()) {
          if (!ignoreDirs.has(entry.name))
            await scanDir(fullPath, currentDepth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          const sourceExts = new Set([
            '.js',
            '.ts',
            '.jsx',
            '.tsx',
            '.py',
            '.java',
            '.cpp',
            '.c',
            '.h',
            '.cs',
            '.php',
            '.rb',
            '.go',
            '.rs',
            '.swift',
            '.kt',
            '.scala',
            '.html',
            '.css',
            '.scss',
            '.sass',
            '.less',
            '.vue',
            '.svelte',
            '.json',
            '.yaml',
            '.yml',
            '.xml',
            '.md',
            '.sql',
            '.sh',
            '.bat',
          ]);
          if (
            sourceExts.has(ext) ||
            entry.name === 'Dockerfile' ||
            entry.name === 'Makefile'
          ) {
            const stat = await fsp.stat(fullPath).catch(() => null);
            if (!stat) continue;
            const hash = await this.sha1File(fullPath);
            files.push({
              path: relativePath.replace(/\\/g, '/'),
              size: stat.size,
              hash,
            });
          }
        }
      }
    };

    await scanDir(root);
    return files;
  }
}
