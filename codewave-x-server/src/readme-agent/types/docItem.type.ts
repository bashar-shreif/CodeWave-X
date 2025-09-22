export type DocItem = {
  path: string;
  kind:
    | 'readme'
    | 'contributing'
    | 'changelog'
    | 'license'
    | 'adr'
    | 'openapi'
    | 'api'
    | 'storybook'
    | 'docsPage'
    | 'guide'
    | 'tutorial'
    | 'design'
    | 'other';
  title?: string;
  headings?: string[];
  summary?: string;
  meta?: Record<string, any>;
};
