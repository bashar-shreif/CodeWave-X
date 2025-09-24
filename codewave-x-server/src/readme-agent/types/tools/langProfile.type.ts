export type LangProfile = {
  totals: { files: number; loc: number };
  byLanguage: Record<string, { files: number; loc: number }>;
};