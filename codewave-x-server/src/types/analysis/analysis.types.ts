export type DepType = 'prod' | 'dev' | 'peer' | 'optional';

export interface DependencyItem {
  name: string;
  version: string;
  type?: DepType;
}

export interface DepManagerBlock {
  name: string;
  lock?: string;
  dependencies: DependencyItem[];
}

export interface DepsArtifact {
  managers?: DepManagerBlock[];
  dependencies?: Record<string, string> | DependencyItem[];
  byManager?: Record<string, string[] | DependencyItem[]>;
  generatedAt?: string;
}
