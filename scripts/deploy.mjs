#!/usr/bin/env node
// Builds the site and publishes ./dist to the `gh-pages` branch (GitHub Pages serves that branch).
//
//   npm run deploy
//
// Uses the same git credentials as a normal `git push`. The branch only ever contains the built
// site (public key + logos, no personal data). Takes ~1 minute for GitHub to show the new version.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();

run(process.execPath, ['scripts/build.mjs']);
const remote = run('git', ['remote', 'get-url', 'origin']);
const name = run('git', ['config', 'user.name']);
const email = run('git', ['config', 'user.email']);
const head = run('git', ['rev-parse', '--short', 'HEAD']);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'leads-pages-'));
try {
  fs.cpSync(path.join(root, 'dist'), tmp, { recursive: true });
  const git = (...a) => run('git', ['-c', `user.name=${name}`, '-c', `user.email=${email}`, ...a], tmp);
  git('init', '-q', '-b', 'gh-pages');
  git('add', '-A');
  git('commit', '-q', '-m', `deploy ${head}`);
  git('push', '-q', '--force', remote, 'gh-pages');
  console.log(`deployed ${head} -> gh-pages (give GitHub about a minute to publish)`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
