import fs from 'fs';
import path from 'path';

const viteConfig = fs.readFileSync(path.resolve(process.cwd(), 'vite.config.ts'), 'utf-8');
const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');

if (!viteConfig.includes('SECURITY_HEADERS') || !indexHtml.includes('http-equiv="Content-Security-Policy"')) {
  console.error('[security] Security headers verification failed: CSP or SECURITY_HEADERS missing.');
  process.exit(1);
}

console.log('[security] Security headers verification passed successfully.');
