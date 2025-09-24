import path from 'node:path';
import {
  ScanLanguagesInput,
  ScanLanguagesOutput,
} from '../../types/tools/io.type';
import { detectLanguage, countLOC, normalizeLang } from './helpers';

export const scanLanguages = async (
  input: ScanLanguagesInput,
): Promise<ScanLanguagesOutput> => {
  const { repoRoot, manifest, normalize = true } = input;

  const byLanguage: Record<string, { files: number; loc: number }> = {};
  const totals = { files: 0, loc: 0 };

  for (const entry of manifest) {
    const rel = entry.path.replace(/\\/g, '/');
    const langRaw = detectLanguage(rel);
    if (langRaw === 'binary') continue;

    const lang = normalize ? normalizeLang(langRaw) : langRaw;

    const abs = path.resolve(repoRoot, rel);
    const loc = await countLOC(abs);

    if (!byLanguage[lang]) byLanguage[lang] = { files: 0, loc: 0 };
    byLanguage[lang].files += 1;
    byLanguage[lang].loc += loc;

    totals.files += 1;
    totals.loc += loc;
  }

  return { byLanguage, totals, method: 'LOC' };
};

export default scanLanguages;