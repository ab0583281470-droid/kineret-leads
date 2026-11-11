#!/usr/bin/env node
// Daily backup of the leads database: the whole `docs` table as one compressed file in ../backups
// (next to this repo folder, NOT inside it). Keeps the last 30 files and writes a log.
// Runs from a Windows scheduled task on the owner's computer.
//
//   node scripts/backup.mjs
//
// Needs .env.local in the repo root with:  SUPABASE_URL=...   SUPABASE_SECRET_KEY=...
// The files hold personal details of leads: they stay on this computer and out of git.

import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.resolve(root, '..', 'backups');
const KEEP = 30;
const PAGE = 1000;

for (const line of readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
mkdirSync(dir, { recursive: true });
const log = (text) => appendFileSync(path.join(dir, 'backup.log'), `${new Date().toISOString()} ${text}\n`);

async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&order=seq.asc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' },
    });
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

try {
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SECRET_KEY missing in .env.local');
  const docs = await fetchAll('docs');
  const data = { takenAt: new Date().toISOString(), tables: { docs } };

  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
  const file = path.join(dir, `leads-${day}.json.gz`);
  writeFileSync(file, gzipSync(JSON.stringify(data)));

  // only our own daily files are cleaned up; anything else in the folder stays
  const old = readdirSync(dir).filter((f) => /^leads-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(f)).sort().reverse().slice(KEEP);
  for (const f of old) unlinkSync(path.join(dir, f));

  const count = (kind) => docs.filter((d) => d.kind === kind && !d.deleted).length;
  const summary = `leads ${count('lead')}, tasks ${count('task')}, settings ${count('settings')}`;
  log(`ok ${path.basename(file)}: ${summary}`);
  console.log(`saved ${file} (${summary})`);
} catch (e) {
  log(`failed: ${e.message}`);
  console.error(e.message);
  process.exitCode = 1;
}
