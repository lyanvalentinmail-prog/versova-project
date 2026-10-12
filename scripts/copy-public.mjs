import { cpSync } from 'node:fs';
cpSync('src/web/public', 'dist/src/web/public', { recursive: true });
