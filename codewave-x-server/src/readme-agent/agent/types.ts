export type SectionName =
  | "Overview" | "Tech Stack" | "Features" | "Architecture"
  | "Getting Started" | "Routes" | "Configuration" | "Testing"
  | "CI" | "Documentation" | "Security" | "Contributing" | "License";

export type AgentInput = {
  repoRoot: string;
  repoHash?: string;
  manifest?: any;
  langProfile?: any;
  stack?: any;
  deps?: any;
  routes?: any;
  architecture?: any;
  tests?: any;
  config?: any;
  ci?: any;
  docs?: any;
  security?: any;
  descriptionHint?: string;
  projectName?: string;
};

export type AgentDecisions = {
  preferBadges: boolean;
  addTOC: boolean;
  removedSections: SectionName[];
};

export type AgentOutput = {
  sections: Record<SectionName, string>;
  decisions: AgentDecisions;
  timings: Record<string, number>;
};
