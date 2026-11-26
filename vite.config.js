import { defineConfig } from 'vite';
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Gera dist/sw.js depois do build, com a lista exata de arquivos para
 * precache (o app abre offline) e uma versão baseada no conteúdo.
 */
function serviceWorker() {
  return {
    name: 'fingmusic-sw',
    apply: 'build',
    closeBundle() {
      const dist = 'dist', files = [];
      const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else files.push('/' + relative(dist, p).split('\\').join('/')); } };
      walk(dist);
      const precache = files.filter((f) => !/splash-|\.map$|^\/sw\.js$|_headers|_redirects/.test(f)).map((f) => (f === '/index.html' ? '/' : f));
      const hash = createHash('sha1'); for (const f of files) if (!f.endsWith('sw.js')) hash.update(f + statSync(join(dist, f)).size);
      const tpl = readFileSync('src/sw-template.js', 'utf8');
      writeFileSync(join(dist, 'sw.js'), tpl.replace('__VERSION__', hash.digest('hex').slice(0, 10)).replace('__PRECACHE__', JSON.stringify(precache)));
    },
  };
}

export default defineConfig({
  build: { target: 'es2022', sourcemap: false, assetsInlineLimit: 0 },
  plugins: [serviceWorker()],
  server: { host: true },
});
