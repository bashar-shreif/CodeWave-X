import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type {
  ComputeStatsInput,
  ComputeStatsOutput,
} from '../../types/tools/io.type';
import { StatBlock } from '../../types/tools/statBlock.type';
import { analyzeByLang, add, emptyBlock, langFor } from './helpers';

export const computeStats = async (
  input: ComputeStatsInput,
): Promise<ComputeStatsOutput> => {
  const { repoRoot, manifest, includeLangs } = input;

  const byLanguage: Record<string, StatBlock> = {};
  const totals = emptyBlock();

  for (const m of manifest) {
    const lang = langFor(m.path);
    if (!lang) continue;
    if (includeLangs && !includeLangs.includes(lang)) continue;

    const abs = path.join(repoRoot, m.path);
    let src = '';
    try {
      src = await fsp.readFile(abs, 'utf8');
    } catch {
      continue;
    }

    const stats = analyzeByLang(lang, src);
    if (!byLanguage[lang]) byLanguage[lang] = emptyBlock();
    add(byLanguage[lang], stats);
    add(totals, stats);
  }

  return { totals, byLanguage };
};
