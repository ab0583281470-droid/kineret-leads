#!/usr/bin/env node
// Restore a backup file made by backup.mjs back into the database.
//
//   node scripts/restore.mjs ../backups/leads-2026-11-12.json.gz
//
// Every document in the file is written back (overwriting the same id). Documents that exist in the
// database but are not in the file are left alone. Needs .env.local (see backup.mjs).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2];
if (!file) { console.error('usage: node scripts/restore.mjs <backup file .json.gz>'); process.exit(1); }

for (const line of readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) { console.error('SUPABASE_URL or SUPABASE_SECRET_KEY missing in .env.local'); process.exit(1); }

const raw = readFileSync(path.resolve(file));
const data = JSON.parse((file.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8'));
const docs = data.tables.docs.map((d) => ({ kind: d.kind, id: d.id, data: d.data, deleted: d.deleted, updated_by: 'שחזור מגיבוי' }));
console.log(`restoring ${docs.length} documents from ${data.takenAt}`);

for (let i = 0; i < docs.length; i += 200) {
  const res = await fetch(`${url}/rest/v1/docs?on_conflict=kind,id`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(docs.slice(i, i + 200)),
  });
  if (!res.ok) { console.error(`failed at ${i}: ${res.status} ${await res.text()}`); process.exit(1); }
}
console.log('done. Open the app on each device so it picks up the restored data.');
