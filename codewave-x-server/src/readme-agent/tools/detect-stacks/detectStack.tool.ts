import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type { DetectStackInput, DetectStackOutput } from '../../types/io.type';
import {
  detectAngular,
  detectAspNet,
  detectDjango,
  detectFlask,
  detectFlutter,
  detectLaravel,
  detectNest,
  detectNext,
  detectNode,
  detectReact,
  detectVue,
} from './detectHelpers';
import type { StackHit } from '../../types/stackHit.type';

const toPosix = (p: string) => p.replace(/\\/g, '/');

const readIfExists = async (
  root: string,
  rel: string,
  files: Set<string>,
): Promise<string | null> => {
  const posix = toPosix(rel);
  if (!files.has(posix)) return null;
  try {
    return await fsp.readFile(path.join(root, rel), 'utf8');
  } catch {
    return null;
  }
};

const confidence = (score: number): 'low' | 'medium' | 'high' => {
  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
};

const jsonParseSafe = (txt: string | null): any | null => {
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
};

export const detectStack = async (
  input: DetectStackInput,
): Promise<DetectStackOutput> => {
  const { repoRoot, manifest } = input;
  const filesSet = new Set(manifest.map((m) => toPosix(m.path)));
  const roots = ['']; // simple single-root; extend for monorepos if needed

  const pkgTxt = await readIfExists(repoRoot, 'package.json', filesSet);
  const composerTxt = await readIfExists(repoRoot, 'composer.json', filesSet);
  const angularTxt = await readIfExists(repoRoot, 'angular.json', filesSet);
  const pubspecTxt = await readIfExists(repoRoot, 'pubspec.yaml', filesSet);
  const reqTxt =
    (await readIfExists(repoRoot, 'requirements.txt', filesSet)) ??
    (await readIfExists(repoRoot, 'pyproject.toml', filesSet));
  const csprojPaths = Array.from(filesSet).filter((p) => p.endsWith('.csproj'));
  const csprojTxts = await Promise.all(
    csprojPaths.map((p) =>
      readIfExists(repoRoot, p, filesSet).then((t) => t || ''),
    ),
  );

  const pkg = jsonParseSafe(pkgTxt);
  const composer = jsonParseSafe(composerTxt);
  const angularJson = jsonParseSafe(angularTxt);

  const laravel = detectLaravel(filesSet, composer, roots);
  const react = detectReact(pkg, filesSet, roots);
  const next = detectNext(pkg, filesSet);
  const nest = detectNest(pkg, filesSet);
  const angular = detectAngular(pkg, filesSet, angularJson);
  const vue = detectVue(pkg, filesSet);
  const node = detectNode(pkg, filesSet);
  const flutter = detectFlutter(pubspecTxt, filesSet);
  const django = detectDjango(reqTxt, filesSet);
  const flask = detectFlask(reqTxt, filesSet);
  const aspnet = detectAspNet(csprojTxts);

  const raw: StackHit[] = [
    {
      stack: 'Laravel',
      root: '.',
      score: laravel.score,
      reasons: laravel.reasons,
      confidence: confidence(laravel.score),
    },
    {
      stack: 'Next.js',
      root: '.',
      score: next.score,
      reasons: next.reasons,
      confidence: confidence(next.score),
    },
    {
      stack: 'React',
      root: '.',
      score: react.score,
      reasons: react.reasons,
      confidence: confidence(react.score),
    },
    {
      stack: 'NestJS',
      root: '.',
      score: nest.score,
      reasons: nest.reasons,
      confidence: confidence(nest.score),
    },
    {
      stack: 'Angular',
      root: '.',
      score: angular.score,
      reasons: angular.reasons,
      confidence: confidence(angular.score),
    },
    {
      stack: 'Vue',
      root: '.',
      score: vue.score,
      reasons: vue.reasons,
      confidence: confidence(vue.score),
    },
    {
      stack: 'Node.js',
      root: '.',
      score: node.score,
      reasons: node.reasons,
      confidence: confidence(node.score),
    },
    {
      stack: 'Flutter',
      root: '.',
      score: flutter.score,
      reasons: flutter.reasons,
      confidence: confidence(flutter.score),
    },
    {
      stack: 'Django',
      root: '.',
      score: django.score,
      reasons: django.reasons,
      confidence: confidence(django.score),
    },
    {
      stack: 'Flask',
      root: '.',
      score: flask.score,
      reasons: flask.reasons,
      confidence: confidence(flask.score),
    },
    {
      stack: 'ASP.NET',
      root: '.',
      score: aspnet.score,
      reasons: aspnet.reasons,
      confidence: confidence(aspnet.score),
    },
  ];

  const filtered = raw.filter((h) => h.score >= 3);

  const tieBroken = filtered.filter((h) => {
    if (
      h.stack === 'React' &&
      filtered.some((x) => x.stack === 'Next.js' && x.score >= 3)
    )
      return false;
    if (
      h.stack === 'Node.js' &&
      filtered.some((x) => x.stack === 'NestJS' && x.score >= 3)
    )
      return false;
    if (
      h.stack === 'Flask' &&
      filtered.some((x) => x.stack === 'Django' && x.score >= 3)
    )
      return false;
    return true;
  });

  tieBroken.sort((a, b) => b.score - a.score || a.stack.localeCompare(b.stack));
  return { hits: tieBroken };
};
