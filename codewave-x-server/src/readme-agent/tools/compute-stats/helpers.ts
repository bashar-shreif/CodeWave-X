import { EXT_TO_LANG } from '../../constants/languageExts.constant';
import { StatBlock } from '../../types/tools/statBlock.type';

export const langFor = (relPath: string): string | null => {
  const base = relPath.replace(/\\/g, '/').split('/').pop() || '';
  if (base.endsWith('.blade.php')) return 'php';
  const m = /\.([A-Za-z0-9]+)$/.exec(base);
  if (!m) return null;
  const ext = m[1].toLowerCase();
  return EXT_TO_LANG[ext] ?? null;
};

export const emptyBlock = (): StatBlock => {
  return {
    files: 0,
    classes: 0,
    methods: 0,
    functions: 0,
    variables: 0,
    imports: 0,
  };
};

export const add = (a: StatBlock, b: StatBlock) => {
  a.files += b.files;
  a.classes += b.classes;
  a.methods += b.methods;
  a.functions += b.functions;
  a.variables += b.variables;
  a.imports += b.imports;
};

export const count = (pattern: RegExp, text: string): number => {
  let c = 0;
  for (let m = pattern.exec(text); m; m = pattern.exec(text)) c++;
  return c;
};

export const analyzeByLang = (lang: string, src: string): StatBlock => {
  const s = emptyBlock();
  s.files = 1;

  switch (lang) {
    case 'php': {
      s.classes = count(/\bclass\s+[A-Za-z_]\w*/g, src);
      s.methods = count(
        /\b(?:public|protected|private|static)\s+function\s+[A-Za-z_]\w*\s*\(/g,
        src,
      );
      s.functions = count(/\bfunction\s+[A-Za-z_]\w*\s*\(/g, src);
      s.variables = count(/\$[A-Za-z_]\w*/g, src);
      s.imports = count(
        /\buse\s+[A-Za-z_][A-Za-z0-9_\\]+(?:\s+as\s+[A-Za-z_]\w*)?;/g,
        src,
      );
      break;
    }
    case 'typescript':
    case 'javascript': {
      s.classes = count(/\bclass\s+[A-Za-z_]\w*/g, src);
      s.methods = count(/^[ \t]*[A-Za-z_]\w*\s*\([^;{}]*\)\s*{/gm, src); // class/object methods heuristic
      s.functions =
        count(/\bfunction\s+[A-Za-z_]\w*\s*\(/g, src) +
        count(/\bconst\s+[A-Za-z_]\w*\s*=\s*\([^=]*\)\s*=>/g, src);
      s.variables = count(/\b(?:const|let|var)\s+[A-Za-z_]\w*/g, src);
      s.imports =
        count(/\bimport\s+[^;]+?from\s+['"][^'"]+['"]/g, src) +
        count(/\brequire\(['"][^'"]+['"]\)/g, src);
      break;
    }
    case 'python': {
      s.classes = count(/^\s*class\s+[A-Za-z_]\w*/gm, src);
      s.methods = count(/^\s*def\s+[A-Za-z_]\w*\s*\([^)]*\)\s*:\s*$/gm, src); // defs (counts both methods and functions)
      s.functions = s.methods;
      s.variables = count(/^[ \t]*[A-Za-z_]\w*[ \t]*=/gm, src);
      s.imports =
        count(/^\s*import\s+[A-Za-z0-9_. ,]+/gm, src) +
        count(/^\s*from\s+[A-Za-z0-9_.]+\s+import\s+[A-Za-z0-9_.*, ]+/gm, src);
      break;
    }
    case 'csharp': {
      s.classes = count(/\b(class|record|struct)\s+[A-Za-z_]\w*/g, src);
      s.methods = count(
        /\b(?:public|private|protected|internal|static|virtual|override|async)\s+[A-Za-z_<>\[\],\s]+\s+[A-Za-z_]\w*\s*\([^;{}]*\)\s*{/g,
        src,
      );
      s.functions = s.methods;
      s.variables = count(
        /\b(?:var|[A-Za-z_<>\[\]]+)\s+[A-Za-z_]\w*(\s*=\s*[^;]+)?;/g,
        src,
      );
      s.imports = count(/^\s*using\s+[A-Za-z0-9_.]+;/gm, src);
      break;
    }
    case 'java': {
      s.classes = count(/\b(class|interface|enum|record)\s+[A-Za-z_]\w*/g, src);
      s.methods = count(
        /\b(?:public|private|protected|static|final|abstract|synchronized)\s+[A-Za-z_<>\[\],\s]+\s+[A-Za-z_]\w*\s*\([^;{}]*\)\s*{/g,
        src,
      );
      s.functions = s.methods;
      s.variables = count(
        /\b(?:[A-Za-z_<>\[\]]+)\s+[A-Za-z_]\w*(\s*=\s*[^;]+)?;/g,
        src,
      );
      s.imports = count(/^\s*import\s+[A-Za-z0-9_.]+\s*;/gm, src);
      break;
    }
    default: {
      break;
    }
  }
  return s;
};
