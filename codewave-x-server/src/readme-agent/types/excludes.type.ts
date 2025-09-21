export const DEFAULT_EXCLUDES = [
  // VCS
  '**/.git/**',
  '**/.git',

  // Package managers
  '**/node_modules/**',
  '**/vendor/**',

  // Build & dist
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/bin/**',
  '**/obj/**',

  // Framework caches
  '**/.next/**',
  '**/.nuxt/**',
  '**/.gatsby/**',
  '**/.expo/**',
  '**/.turbo/**',
  '**/.parcel-cache/**',

  // Language-specific caches
  '**/__pycache__/**',
  '**/.mypy_cache/**',
  '**/.pytest_cache/**',
  '**/.tox/**',
  '**/.nox/**',
  '**/.ruff_cache/**',
  '**/.ccls-cache/**',

  // Laravel / PHP specifics
  '**/bootstrap/cache/**',
  '**/storage/**',           // logs, sessions, compiled views
  '**/.env',                 // sensitive
  '**/.env.*',

  // IDE/project configs
  '**/.idea/**',
  '**/.vscode/**',
  '**/*.iml',

  // Coverage / reports
  '**/coverage/**',
  '**/logs/**',
  '**/log/**',

  // Temp
  '**/tmp/**',
  '**/temp/**',

  // Binary/artifact files
  '**/*.exe',
  '**/*.dll',
  '**/*.so',
  '**/*.dylib',
  '**/*.lib',
  '**/*.a',
  '**/*.o',
  '**/*.class',
  '**/*.jar',
  '**/*.war',
  '**/*.ear',

  // System junk
  '**/.DS_Store',
  '**/Thumbs.db',
  '**/desktop.ini',

  // Lock & minified
  '**/*.lock',
  '**/*.min.*',

  // Logs & temp files
  '**/*.log',
  '**/*.tmp',
  '**/*.temp',
  '**/*.bak',

  // Debug logs
  '**/npm-debug.log*',
  '**/yarn-debug.log*',
  '**/yarn-error.log*',
  '**/pnpm-debug.log*',
  '**/lerna-debug.log*',

  // Swap files
  '**/*.swp',
];
