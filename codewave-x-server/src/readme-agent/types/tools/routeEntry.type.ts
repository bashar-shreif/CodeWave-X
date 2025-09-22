export type RouteEntry = {
  framework: 'laravel' | 'express' | 'nest' | 'django' | 'flask';
  method: string; // GET|POST|... or ANY
  path: string; // "/users" etc.
  file: string; // relative path
  line: number; // 1-based
  controller?: string; // optional handler/controller hint
};
