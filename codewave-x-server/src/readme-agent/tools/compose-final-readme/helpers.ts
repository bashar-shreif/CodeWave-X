import fs from 'fs/promises';
import path from 'path';

const DEFAULT_ORDER = [
  "Overview",
  "Tech Stack",
  "Dependencies",
  "Architecture",
  "Diagrams",
  "Getting Started",
  "Routes",
  "Configuration",
  "Scripts",
  "Testing",
  "CI",
  "Documentation",
  "Security",
  "Contributing",
  "License",
] as const;

export const exists = async (p: string) => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};

export const readJson = async <T = any>(p: string): Promise<T | null> => {
  try {
    const txt = await fs.readFile(p, "utf8");
    return JSON.parse(txt);
  } catch {
    return null;
  }
};

export const readText = async (p: string) => {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
};

export const inferTitle = async (repoRoot: string) => {
  const pkg = await readJson<{ name?: string; description?: string }>(path.join(repoRoot, "package.json"));
  if (pkg?.name) return { title: pkg.name, desc: pkg.description || null };

  const comp = await readJson<{ name?: string; description?: string }>(path.join(repoRoot, "composer.json"));
  if (comp?.name) return { title: comp.name, desc: comp.description || null };

  const pyproj = await readText(path.join(repoRoot, "pyproject.toml"));
  if (pyproj) {
    const m = pyproj.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
    if (m) return { title: m[1], desc: null };
  }

  return { title: null as string | null, desc: null as string | null };
};

export const pickLicense = async (repoRoot: string) => {
  const candidates = ["LICENSE", "LICENSE.md", "LICENSE.txt", "license", "license.md"];
  for (const f of candidates) {
    if (await exists(path.join(repoRoot, f))) return f;
  }
  return null;
};

export const renderTOC = (sections: Record<string, string>) => {
  const keys = Object.keys(sections).filter((k) => sections[k]?.trim());
  if (!keys.length) return "";
  const links = keys.map((k) => `- [${k}](#${k.toLowerCase().replace(/\s+/g, "-")})`).join("\n");
  return `## Table of Contents\n\n${links}\n`;
};

export const renderSections = (sections: Record<string, string>) => {
  const known = DEFAULT_ORDER.filter((k) => sections[k]);
  const extras = Object.keys(sections).filter((k) => !DEFAULT_ORDER.includes(k as any) && sections[k]);
  const order = [...known, ...extras];
  const md: string[] = [];
  for (const key of order) {
    const body = (sections[key] || "").trim();
    if (!body) continue;
    md.push(`# ${key}\n${body}\n`);
  }
  return { md: md.join("\n"), order };
};