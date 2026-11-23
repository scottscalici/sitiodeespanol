#!/usr/bin/env node
// Reusable Firestore writer: reads a JSON array of documents, previews what
// would happen, waits for an explicit "yes", backs up the affected
// collection, then merge-writes each item. See CLAUDE.md's "Firestore
// collection schemas" section for what each collection expects before
// generating a JSON file to feed this.
//
// Usage:
//   node scripts/firestore-write.js <file.json> <collectionName> [--dry-run] [--test]
//
// --dry-run   Validate and preview only. Nothing is read for backup and
//             nothing is written. No confirmation prompt.
// --test      Writes to `<collectionName>_test` instead of the real
//             collection, so new content can be checked safely first.
//
// Every item in the JSON array must have a non-empty string `id` field —
// that becomes the Firestore document id, and (matching this repo's own
// uploaders, e.g. CalentamientoUploader.jsx) the item is written verbatim,
// `id` included, as the document body. Writes use `{ merge: true }`, so an
// existing document's fields not present in the new item are left alone.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { createInterface } from 'readline/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SERVICE_ACCOUNT_PATH = join(REPO_ROOT, 'serviceAccountKey.json');
const BACKUPS_DIR = join(REPO_ROOT, 'backups');
const PREVIEW_COUNT = 3;

const fail = (message) => {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
};

const parseArgs = (argv) => {
  const flags = new Set();
  const positional = [];
  for (const arg of argv) {
    if (arg.startsWith('--')) flags.add(arg.slice(2));
    else positional.push(arg);
  }
  const [filePath, collectionName] = positional;
  return { filePath, collectionName, dryRun: flags.has('dry-run'), test: flags.has('test') };
};

const loadItems = (filePath) => {
  if (!filePath) fail('Usage: node scripts/firestore-write.js <file.json> <collectionName> [--dry-run] [--test]');
  if (!existsSync(filePath)) fail(`File not found: ${filePath}`);

  let raw;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (err) {
    fail(`Could not read ${filePath}: ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(`${filePath} is not valid JSON: ${err.message}`);
  }

  if (!Array.isArray(parsed)) fail(`${filePath} must be a JSON array of documents — got ${typeof parsed}.`);
  if (parsed.length === 0) fail(`${filePath} is an empty array — nothing to write.`);
  return parsed;
};

const validateItems = (items) => {
  const errors = [];
  const seenIds = new Set();
  items.forEach((item, idx) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`Item ${idx}: not a plain object (got ${Array.isArray(item) ? 'array' : typeof item}).`);
      return;
    }
    if (typeof item.id !== 'string' || item.id.trim() === '') {
      errors.push(`Item ${idx}: missing or empty "id" field — every item needs one, it becomes the document id.`);
      return;
    }
    if (seenIds.has(item.id)) {
      errors.push(`Item ${idx}: duplicate id "${item.id}" also appears earlier in this file.`);
    }
    seenIds.add(item.id);
  });
  if (errors.length > 0) {
    fail(`Validation failed on ${errors.length} item(s):\n` + errors.map((e) => `  - ${e}`).join('\n'));
  }
};

const truncate = (str, max = 600) => (str.length > max ? `${str.slice(0, max)}\n  ...(truncated)` : str);

const initFirestore = () => {
  if (!existsSync(SERVICE_ACCOUNT_PATH)) {
    fail(
      `Service account key not found at ${SERVICE_ACCOUNT_PATH}.\n` +
      `Place your Firebase Admin SDK service account JSON there (it's gitignored) before running this script.`
    );
  }
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
  } catch (err) {
    fail(`Could not parse serviceAccountKey.json: ${err.message}`);
  }
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin.firestore();
};

// Reads which of the incoming ids already exist in the target collection,
// so the preview and the final summary can say "N will be created / M will
// be updated" instead of just "N items".
const classifyExisting = async (db, collectionName, items) => {
  const existing = new Set();
  await Promise.all(
    items.map(async (item) => {
      const snap = await db.collection(collectionName).doc(item.id).get();
      if (snap.exists) existing.add(item.id);
    })
  );
  return existing;
};

const backupCollection = async (db, collectionName) => {
  if (!existsSync(BACKUPS_DIR)) mkdirSync(BACKUPS_DIR, { recursive: true });
  const snap = await db.collection(collectionName).get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUPS_DIR, `${collectionName}_${timestamp}.json`);
  writeFileSync(backupPath, JSON.stringify(docs, null, 2), 'utf-8');
  return { backupPath, count: docs.length };
};

const writeItems = async (db, collectionName, items) => {
  // Batched (max 500 ops/batch in Firestore; 400 keeps headroom) rather than
  // one write per item, so a large JSON file doesn't fire hundreds of
  // sequential round-trips.
  const BATCH_SIZE = 400;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach((item) => {
      batch.set(db.collection(collectionName).doc(item.id), item, { merge: true });
    });
    await batch.commit();
  }
};

const askYesNo = async (question) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim() === 'yes';
};

const main = async () => {
  const { filePath, collectionName, dryRun, test } = parseArgs(process.argv.slice(2));
  if (!collectionName) fail('Usage: node scripts/firestore-write.js <file.json> <collectionName> [--dry-run] [--test]');

  const items = loadItems(filePath);
  validateItems(items);

  const targetCollection = test ? `${collectionName}_test` : collectionName;

  console.log('\n--- Preview ---');
  if (test) console.log(`🧪 --test mode: writing to "${targetCollection}", not "${collectionName}".`);
  if (dryRun) console.log('🔍 --dry-run mode: validating and previewing only. Nothing will be read or written beyond this preview.');
  console.log(`Collection: ${targetCollection}`);
  console.log(`Documents: ${items.length}`);
  console.log(`First ${Math.min(PREVIEW_COUNT, items.length)} item(s):`);
  items.slice(0, PREVIEW_COUNT).forEach((item, idx) => {
    console.log(`\n[${idx}] id="${item.id}"`);
    console.log(truncate(JSON.stringify(item, null, 2)));
  });

  if (dryRun) {
    // Deliberately does NOT touch Firestore at all — no service account key
    // needed, no network call — so a JSON file can be sanity-checked before
    // credentials are even in place.
    console.log('\n✅ Dry run complete — no Firestore connection made, no backup taken, nothing written.\n');
    process.exit(0);
  }

  const db = initFirestore();
  const existingIds = await classifyExisting(db, targetCollection, items);
  const createCount = items.length - existingIds.size;
  const updateCount = existingIds.size;
  console.log(`\nWill create: ${createCount}  |  Will update (merge): ${updateCount}`);

  const confirmed = await askYesNo(`\nType "yes" to write ${items.length} document(s) to "${targetCollection}": `);
  if (!confirmed) {
    console.log('\nAborted — no changes made.\n');
    process.exit(0);
  }

  console.log(`\nBacking up current "${targetCollection}" before writing...`);
  const { backupPath, count } = await backupCollection(db, targetCollection);
  console.log(`✅ Backed up ${count} existing document(s) to ${backupPath}`);

  console.log(`\nWriting ${items.length} document(s) to "${targetCollection}"...`);
  await writeItems(db, targetCollection, items);

  console.log(`\n✅ Done. Created: ${createCount}  |  Updated: ${updateCount}  |  Total written: ${items.length}`);
  console.log(`Backup of the pre-write state: ${backupPath}\n`);
  process.exit(0);
};

main().catch((err) => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
