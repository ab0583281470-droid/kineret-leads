// Builds the static site into ./dist  (run: npm run build)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (...p) => path.join(root, 'src', ...p);
const dist = (...p) => path.join(root, 'dist', ...p);
const cfg = JSON.parse(fs.readFileSync(src('config.json'), 'utf8'));
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(src('assets', f)).toString('base64');
const build = Date.now().toString(36);

fs.rmSync(dist(), { recursive: true, force: true });
fs.mkdirSync(dist('icons'), { recursive: true });
fs.mkdirSync(dist('vendor'), { recursive: true });

let html = fs.readFileSync(src('app.template.html'), 'utf8');
html = html
  .split('__LOGO_K__').join(b64('logo-kineret.png'))
  .split('__LOGO_S__').join(b64('logo-shefer.png'))
  .split('__SUPA_URL__').join(cfg.url)
  .split('__SUPA_KEY__').join(cfg.key);
if (/__[A-Z_]+__/.test(html)) throw new Error('unreplaced placeholder in template: ' + html.match(/__[A-Z_]+__/)[0]);
fs.writeFileSync(dist('index.html'), html);

fs.writeFileSync(dist('sw.js'), fs.readFileSync(src('sw.template.js'), 'utf8').split('__BUILD__').join(build));
fs.copyFileSync(src('manifest.webmanifest'), dist('manifest.webmanifest'));
for (const f of fs.readdirSync(src('assets', 'icons'))) fs.copyFileSync(src('assets', 'icons', f), dist('icons', f));
fs.copyFileSync(path.join(root, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js'), dist('vendor', 'supabase.js'));
fs.writeFileSync(dist('.nojekyll'), '');
console.log('built dist/ build=' + build + ' index=' + (html.length / 1024).toFixed(0) + 'KB');
