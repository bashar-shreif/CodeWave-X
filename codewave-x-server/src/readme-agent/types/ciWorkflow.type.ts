export type CIWorkflow = {
  provider:
    | 'GitHub Actions'
    | 'GitLab CI'
    | 'CircleCI'
    | 'Travis CI'
    | 'Azure Pipelines'
    | 'Jenkins';
  path: string;
  name?: string;
  triggers: string[];
  jobs?: number;
  steps?: string[];
  matrix?: string[];
};
