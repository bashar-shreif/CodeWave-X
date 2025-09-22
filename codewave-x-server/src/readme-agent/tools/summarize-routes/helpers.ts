import * as fsp from "node:fs/promises";
import type { RouteEntry } from "../../types/tools/routeEntry.type";

export const toPosix = (p: string) => p.replace(/\\/g, "/");

export const readFileUtf8 = async (abs: string): Promise<string | null> => {
  try { return await fsp.readFile(abs, "utf8"); } catch { return null; }
};

export const iterLines = function* (src: string) {
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) yield { i: i + 1, t: lines[i] };
};

export const parseLaravelRoutes = (rel: string, src: string): RouteEntry[] => {
  const out: RouteEntry[] = [];
  const rx = /\bRoute::(get|post|put|patch|delete|options|any|match)\s*\(\s*(['"`])([^'"`]+)\2\s*(?:,|,?\s*\[)/g;
  for (const { i, t } of iterLines(src)) {
    let m: RegExpExecArray | null;
    while ((m = rx.exec(t))) {
      const verb = m[1].toUpperCase();
      out.push({ framework: "laravel", method: verb === "MATCH" ? "ANY" : verb, path: m[3].startsWith("/") ? m[3] : `/${m[3]}`, file: rel, line: i });
    }
  }
  return out;
};

export const parseExpressRoutes = (rel: string, src: string): RouteEntry[] => {
  const out: RouteEntry[] = [];
  const rx = /\b(app|router)\.(get|post|put|patch|delete|options|head|all)\s*\(\s*(['"`])([^'"`]+)\3/g;
  for (const { i, t } of iterLines(src)) {
    let m: RegExpExecArray | null;
    while ((m = rx.exec(t))) {
      out.push({ framework: "express", method: m[2].toUpperCase() === "ALL" ? "ANY" : m[2].toUpperCase(), path: m[4], file: rel, line: i });
    }
  }
  return out;
};

export const parseNestRoutes = (rel: string, src: string): RouteEntry[] => {
  const out: RouteEntry[] = [];
  let prefix = "";
  const ctrl = src.match(/@Controller\s*\(\s*(['"`])([^'"`]+)\1/);
  if (ctrl) prefix = ctrl[2].startsWith("/") ? ctrl[2] : `/${ctrl[2]}`;
  const rx = /@(Get|Post|Put|Patch|Delete|Options|Head|All)\s*\(\s*(?:(['"`])([^'"`]+)\2)?/g;
  for (const { i, t } of iterLines(src)) {
    let m: RegExpExecArray | null;
    while ((m = rx.exec(t))) {
      const verb = m[1].toUpperCase();
      const seg = m[3] ? (m[3].startsWith("/") ? m[3] : `/${m[3]}`) : "";
      const full = (prefix + seg) || prefix || seg || "/";
      out.push({ framework: "nest", method: verb === "ALL" ? "ANY" : verb, path: full, file: rel, line: i });
    }
  }
  return out;
};

export const parseDjangoRoutes = (rel: string, src: string): RouteEntry[] => {
  const out: RouteEntry[] = [];
  const rx = /\b(path|re_path|url)\s*\(\s*(['"`])([^'"`]+)\2\s*,/g;
  for (const { i, t } of iterLines(src)) {
    let m: RegExpExecArray | null;
    while ((m = rx.exec(t))) {
      const p = m[3].startsWith("/") ? m[3] : `/${m[3]}`;
      out.push({ framework: "django", method: "ANY", path: p.replace(/\$$/, ""), file: rel, line: i });
    }
  }
  return out;
};

export const parseFlaskRoutes = (rel: string, src: string): RouteEntry[] => {
  const out: RouteEntry[] = [];
  const deco = /@(?:[A-Za-z_][A-Za-z0-9_]*\.)?route\(\s*(['"`])([^'"`]+)\1([^)]*)\)/g;
  for (const { i, t } of iterLines(src)) {
    let m: RegExpExecArray | null;
    while ((m = deco.exec(t))) {
      const routePath = m[2].startsWith("/") ? m[2] : `/${m[2]}`;
      let methods: string[] = [];
      const methodsMatch = m[3]?.match(/methods\s*=\s*\[([^\]]+)\]/);
      if (methodsMatch) {
        methods = methodsMatch[1].split(",").map(s => s.replace(/['"\s]/g, "")).filter(Boolean).map(s => s.toUpperCase());
      }
      if (methods.length === 0) methods = ["GET"];
      for (const verb of methods) out.push({ framework: "flask", method: verb, path: routePath, file: rel, line: i });
    }
  }
  return out;
};