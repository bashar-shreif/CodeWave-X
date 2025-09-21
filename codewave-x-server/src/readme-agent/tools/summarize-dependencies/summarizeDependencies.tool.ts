import { SummarizeDepsInput, SummarizeDepsOutput } from '../../types/io.type';
import {
  fromPackageJson,
  fromCargoToml,
  fromComposerJson,
  fromCsproj,
  fromGemfile,
  fromGoMod,
  fromPubspec,
  fromPython,
  readIfExists,
  parseJson,
  pushUnique,
  toPosix,
} from './summarizeHelpers';

export const summarizeDependencies = async (
  input: SummarizeDepsInput,
): Promise<SummarizeDepsOutput> => {
  const { repoRoot, manifest } = input;
  const files = new Set(manifest.map((m) => toPosix(m.path)));

  const pkgTxt = await readIfExists(repoRoot, 'package.json', files);
  const composerTxt = await readIfExists(repoRoot, 'composer.json', files);
  const reqTxt = await readIfExists(repoRoot, 'requirements.txt', files);
  const pyprojTxt = await readIfExists(repoRoot, 'pyproject.toml', files);
  const pubspecTxt = await readIfExists(repoRoot, 'pubspec.yaml', files);
  const goModTxt = await readIfExists(repoRoot, 'go.mod', files);
  const cargoTomlTxt = await readIfExists(repoRoot, 'Cargo.toml', files);
  const gemfileTxt = await readIfExists(repoRoot, 'Gemfile', files);

  const csprojPaths = Array.from(files).filter((p) => p.endsWith('.csproj'));
  const csprojTxts = await Promise.all(
    csprojPaths.map((p) =>
      readIfExists(repoRoot, p, files).then((t) => t || ''),
    ),
  );

  const pkg = parseJson(pkgTxt);
  const composer = parseJson(composerTxt);

  const a = fromPackageJson(pkg);
  const b = fromComposerJson(composer);
  const c = fromPython(reqTxt, pyprojTxt);
  const d = fromPubspec(pubspecTxt);
  const e = fromCsproj(csprojTxts);
  const f = fromGoMod(goModTxt);
  const g = fromCargoToml(cargoTomlTxt);
  const h = fromGemfile(gemfileTxt);

  const runtime: string[] = [];
  const dev: string[] = [];
  const tools: string[] = [];
  const pkgManagers: string[] = [];
  const scripts: Record<string, string> = {};
  const notes: string[] = [];

  const merge = (o: ReturnType<typeof fromPackageJson>) => {
    pushUnique(runtime, ...o.runtime);
    pushUnique(dev, ...o.dev);
    pushUnique(tools, ...o.tools);
    pushUnique(pkgManagers, ...o.pkgManagers);
    Object.assign(scripts, o.scripts);
    pushUnique(notes, ...o.notes);
  };

  [a, b, c, d, e, f, g, h].forEach(merge);

  runtime.sort();
  dev.sort();
  tools.sort();
  pkgManagers.sort();

  return { runtime, dev, tools, pkgManagers, scripts, notes };
};
