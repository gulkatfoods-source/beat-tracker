/**
 * Syncs outlets from Google Sheets → Firestore.
 * Runs as a GitHub Action daily, or can be triggered manually.
 *
 * Sources:
 *   Customer_Master  → type: 'customer'
 *   Prospect_Customer → type: 'prospect' (converts to customer if Converted_To_Customer = Yes)
 *
 * Logic:
 *   - Match by (name.toLowerCase() + beat.toLowerCase()) as a composite key
 *   - Add new entries not yet in Firestore
 *   - Update prospects → customer when converted
 *   - Update lastVisited from First_Purchase_Date / First Visit Date
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

// ── Firebase init ────────────────────────────────────────────────────────────
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  }),
});
const db = admin.firestore();

const SHEET_ID = process.env.SHEET_ID || '1CuwbzyHtMJR7O6Fitj-xay4qksrxOIkwi1eqgWiLVyA';
const now = new Date().toISOString();

// ── Helpers ──────────────────────────────────────────────────────────────────
async function fetchCSV(sheetNameOrGid) {
  const param = /^\d+$/.test(sheetNameOrGid)
    ? `gid=${sheetNameOrGid}`
    : `sheet=${encodeURIComponent(sheetNameOrGid)}`;
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&${param}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Failed to fetch ${sheetNameOrGid}: HTTP ${res.status}`);
  return res.text();
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (values[i] ?? '').trim()]));
  }).filter(row => Object.values(row).some(v => v));
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// "18/04/2026" → "2026-04-18"
function parseDate(str) {
  if (!str) return undefined;
  const parts = str.split('/');
  if (parts.length !== 3) return undefined;
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function normalizePhone(raw) {
  if (!raw) return undefined;
  // Strip non-digits, take last 10 digits
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : undefined;
}

function normalizeBeat(beat) {
  if (!beat) return beat;
  // Normalize casing
  const map = { 'kolua': 'Kolua', 'guna': 'Guna', 'bhanpur': 'Bhanpur' };
  return map[beat.toLowerCase()] ?? beat;
}

function norm(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function key(name, beat) {
  return `${norm(beat)}||${norm(name)}`;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('Fetching sheets...');
  const [customerCSV, prospectCSV] = await Promise.all([
    fetchCSV('Customer_Master'),
    fetchCSV('1185495958'), // Prospect Customer tab gid
  ]);

  const customers = parseCSV(customerCSV);
  const prospects = parseCSV(prospectCSV);
  console.log(`Sheet: ${customers.length} customers, ${prospects.length} prospects`);

  // Load all existing outlets
  const snapshot = await db.collection('outlets').get();
  const existingByKey = new Map();
  for (const doc of snapshot.docs) {
    const d = doc.data();
    existingByKey.set(key(d.name, d.beat), { id: doc.id, ...d });
  }
  console.log(`Firestore: ${existingByKey.size} existing outlets`);

  const batch = db.batch();
  let added = 0, updated = 0;

  // ── Sync customers ───────────────────────────────────────────────────────
  for (const row of customers) {
    const name = row['Retailer_Name'] || row['Name'];
    const beat = normalizeBeat(row['Beat']);
    if (!name || !beat) continue;

    const lastVisited = parseDate(row['First_Purchase_Date']);
    const phone = normalizePhone(row['phno'] || row['MobileNumber']);
    const area = row['Address'];
    const k = key(name, beat);
    const existing = existingByKey.get(k);

    if (!existing) {
      const ref = db.collection('outlets').doc();
      const doc = { id: ref.id, name, beat, type: 'customer', createdAt: now, updatedAt: now };
      if (area) doc.area = area;
      if (phone) doc.phone = phone;
      if (lastVisited) doc.lastVisited = lastVisited;
      batch.set(ref, doc);
      existingByKey.set(k, doc);
      added++;
      console.log(`  + Customer: ${name} (${beat})`);
    } else if (existing.type !== 'customer') {
      // Prospect that is now a customer
      batch.update(db.collection('outlets').doc(existing.id), {
        type: 'customer',
        updatedAt: now,
        ...(lastVisited && { lastVisited }),
        ...(phone && !existing.phone && { phone }),
      });
      updated++;
      console.log(`  ↑ Converted to customer: ${name} (${beat})`);
    } else {
      // Update phone/lastVisited if missing
      const updates = {};
      if (!existing.phone && phone) updates.phone = phone;
      if (lastVisited && (!existing.lastVisited || lastVisited > existing.lastVisited)) {
        updates.lastVisited = lastVisited;
      }
      if (Object.keys(updates).length) {
        batch.update(db.collection('outlets').doc(existing.id), { ...updates, updatedAt: now });
        updated++;
      }
    }
  }

  // ── Sync prospects ───────────────────────────────────────────────────────
  for (const row of prospects) {
    const name = row['Retailer_Name'] || row['Name'];
    const beat = normalizeBeat(row['Beat']);
    if (!name || !beat) continue;

    const isConverted = (row['Converted_To_Customer'] || '').toLowerCase() === 'yes';
    const lastVisited = parseDate(row['First Visit Date'] || row['First_Visit_Date']);
    const area = row['Address'];
    const k = key(name, beat);
    const existing = existingByKey.get(k);

    if (isConverted) {
      // Already handled by customer sync above
      continue;
    }

    if (!existing) {
      const ref = db.collection('outlets').doc();
      const doc = { id: ref.id, name, beat, type: 'prospect', createdAt: now, updatedAt: now };
      if (area) doc.area = area;
      if (lastVisited) doc.lastVisited = lastVisited;
      batch.set(ref, doc);
      existingByKey.set(k, doc);
      added++;
      console.log(`  + Prospect: ${name} (${beat})`);
    } else if (lastVisited && (!existing.lastVisited || lastVisited > existing.lastVisited)) {
      batch.update(db.collection('outlets').doc(existing.id), { lastVisited, updatedAt: now });
      updated++;
    }
  }

  if (added + updated > 0) {
    await batch.commit();
    console.log(`\nDone: ${added} added, ${updated} updated.`);
  } else {
    console.log('\nNothing new to sync — all up to date.');
  }
}

run().catch(e => { console.error(e); process.exit(1); });
