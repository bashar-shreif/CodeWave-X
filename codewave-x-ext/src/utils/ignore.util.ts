import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';


export type IgnoreFn = (relPath: string, isDir: boolean) => boolean;


const readIfExists = (p: string): string => {
try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
};


export const buildIgnore = (root: string): IgnoreFn => {
const ig = ignore();
const cw = readIfExists(path.join(root, '.codewaveignore'));
const ig2 = readIfExists(path.join(root, '.ignore'));
const gi = readIfExists(path.join(root, '.gitignore'));
ig.add(cw).add(ig2).add(gi);


ig.add([
'node_modules/',
'.git/',
'dist/',
'build/',
'.next/',
'.cache/',
'*.lock',
'*.min.*',
'*.png', '*.jpg', '*.jpeg', '*.gif', '*.webp', '*.zip', '*.tar', '*.gz', '*.rar'
]);


return (relPath: string, isDir: boolean) => {
const p = relPath.replace(/\\/g, '/');
if (!p || p === '.') return false;
const testPath = isDir ? p + '/' : p;
return ig.ignores(testPath);
};
};