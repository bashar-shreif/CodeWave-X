import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { ManifestEntry } from '../../readme-agent/types/tools/manifest.type';

@Injectable()
export class ManifestDiscoveryService {
  private deny = new Set((process.env.READMEA_DISCOVER_DENY || '.git,node_modules,vendor,dist,build,out,.next,.turbo,.cache,tmp,.tox,.venv,venv,target,.gradle,.idea').split(','));
  private markers = new Set([
    'package.json','composer.json','Cargo.toml','go.mod','pom.xml','build.gradle','build.gradle.kts','Gemfile','mix.exs','pyproject.toml','requirements.txt','Pipfile'
  ]);

  private sha1(p: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const h = crypto.createHash('sha1');
      const s = fs.createReadStream(p);
      s.on('data', d => h.update(d));
      s.on('end', () => resolve(h.digest('hex')));
      s.on('error', reject);
    });
  }

  async discover(repoRoot: string): Promise<ManifestEntry[]> {
    const out: ManifestEntry[] = [];
    const maxDepth = Number(process.env.READMEA_DISCOVER_MAX_DEPTH || 5);
    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth > maxDepth) return;
      let entries: fs.Dirent[] = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (this.deny.has(e.name)) continue;
          await walk(p, depth + 1);
          continue;
        }
        if (!e.isFile()) continue;
        if (!this.markers.has(e.name)) continue;
        const relFile = path.relative(repoRoot, p) || path.basename(p);
        const st = fs.statSync(p);
        const hash = await this.sha1(p);
        out.push({ path: relFile, size: st.size, hash });
      }
    };
    await walk(repoRoot, 0);
    const seen = new Set<string>();
    return out.filter(e => (seen.has(e.path) ? false : (seen.add(e.path), true)));
  }
}
