/**
 * Fresh sync: delete ALL outlets from Firestore, then re-import
 * from Customer_Master + Prospect Customer sheets.
 * Single source of truth = the Google Sheet.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const pk = [
  '-----BEGIN PRIVATE KEY-----',
  'MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQClVgXU10CfGWUo',
  'fB/3OqKXozG3OGjXA1cj5bh9A0EzqUfD6bNBoWvUtQbg20uqS1NFvCEv4+7kQ385',
  'IfFJftu0ygNjjE0dx3hzu4HO8gktF87morbAfssRgUAymdnqj5OKcDnYmBXEm7pA',
  'NL6Xa9E2mLKm2LzTz6tC+EmN4gUbaBKBjOULg30nYQ4TeF3Q/ECTj4UWolP9CAJR',
  'MthoE5dZOmJVDib73EDNh3FsfFKwRFAg/vl3P9jJddE3o0tL3hAZtqew6EdbZcT1',
  'bKW9zEmX93rFaBS0vrCyUUYjQW3JCbdhNei+J6wFZaWZY7A+xDIt6YrpdYlhhUA/',
  'G6n+gmevAgMBAAECggEAC+8eI6NX6EQCf74Z5pQGaXCfpYx+UMrObupleyyRd8On',
  'yPXk+P9IU8WvVequVv/x5k4yjQzkUPioRbzz+Cyeejm8reJSLKyZvqzRrVjeHbGi',
  'vxYOn+1nBf/w3NYrGxm6+hqoqkAsDhF5i6ni+fYP12OFPbLWSmmqgH6AfKvMV5J5',
  'U0B7JTSnQC4vZyxQWYpd1XJ96SuIsy+iU0ogiU3zCyYAVHshtezM/EMdocgf0EdK',
  'J+PWw7HEscGx0ZZkYLnBWwp9yf0zBQmO3wF2yp+wlma3tzlJaAQsll2JZJZ0HOgd',
  'VwSIcM+lNlAobdX6Z9g3yLHZTuAPdzebmDdZ5eaRfQKBgQDRCABaszKnkWg0eOdv',
  '4vmgEct2t/NKfyao/0IJ/L/2pw+j+KtNPkvC/k5+o8yRu9JtPCWg8QNQg38f5DYA',
  'cPYO/mayYVCIbHBviAOdjS0QgQ3yd2rDOei2dKLfD442H9nX20cxABSEHkt0/jpq',
  'fBt2YKSyJODDQKx7r9ekWo2M2wKBgQDKfJAeIM1+tcvY6G25ojU0vkA8K8ovCXTs',
  '0eAl0l2zoa+aDKWe1MerIQPB1zrpAbKq9FOkQlhTzjxrER9P09Y492MSGicnt88a',
  '5YEt2b0Av7ahEPj7XQpGn/NqLpPRmp4DxjrxkyfM2nIrvGTeg9Kc9b2+Zp1AeLqG',
  '0l+kfKtevQKBgHy7fJKi6fAqCXd+SgRu+aw10iamf+wNUcF4iCyzgM0rRV8ALSAr',
  's0PJQoe5MIIqBNggEwglqWeq//nE0SCUR5AM6LU68rZllvZGwHmMW77Ec9Eixzd1',
  '39K4aNQYUTEk8nYnKCUqOhPYjAhlB/Cw3CZYZw7SiLiaaBJqjJBLZLoPAoGBAMdz',
  'Dto+YWwQUmyj9YDGoDYFuGwMjijq3btvt6RJpHaOKtRI5NKgsNSFvpevE530SDNQ',
  'WxsPJsXV/XlQ8lDFTtvqAjIQhMUArwXFTwsE0MDuFkxs1XNzX+3VHAVZP81UyZTa',
  'K7FMzAVintcpyQnNOyXUgUQM+5RH1yN6ES+KhZrZAoGBAJ4tjfDuSgEHdtQdj+Az',
  'XqA399nYqWiaSu9bNLxAnOcuL0bjW6Tfdpy1RsHQf47NQ1VQVVdpjNXsa4SgtL/e',
  '44pTH0Lxnn8QijNHMgqlXmJew0xe8S8dwDUO0mFxMtrgDkcoLg+0dB8DMnQpEu7i',
  'THTBiq4NWt8MEKByBEgkesOM',
  '-----END PRIVATE KEY-----',
].join('\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: 'devrat-39450',
    clientEmail: 'firebase-adminsdk-fbsvc@devrat-39450.iam.gserviceaccount.com',
    privateKey: pk,
  }),
});
const db = admin.firestore();

const SHEET_ID = '1CuwbzyHtMJR7O6Fitj-xay4qksrxOIkwi1eqgWiLVyA';
const now = new Date().toISOString();

// ── CSV helpers ──────────────────────────────────────────────────────────────
async function fetchCSV(param) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&${param}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (vals[i] ?? '').trim()]));
  }).filter(row => Object.values(row).some(v => v));
}

function parseDate(str) {
  if (!str) return undefined;
  const parts = str.split('/');
  if (parts.length !== 3) return undefined;
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function normalizePhone(raw) {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : undefined;
}

function normalizeBeat(beat) {
  const map = { 'kolua': 'Kolua', 'guna': 'Guna', 'bhanpur': 'Bhanpur' };
  return map[beat?.toLowerCase()] ?? beat;
}

function normKey(name, beat) {
  const n = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const b = (beat || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${b}||${n}`;
}

// ── Delete all existing outlets ──────────────────────────────────────────────
async function deleteAll() {
  const snap = await db.collection('outlets').get();
  if (snap.empty) { console.log('Collection already empty.'); return 0; }

  const BATCH_LIMIT = 490;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_LIMIT).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return docs.length;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  // 1. Fetch both sheets
  console.log('Fetching sheets...');
  const [customerCSV, prospectCSV] = await Promise.all([
    fetchCSV('sheet=Customer_Master'),
    fetchCSV('gid=1185495958'),
  ]);
  const customers = parseCSV(customerCSV);
  const prospects = parseCSV(prospectCSV);
  console.log(`Sheet data: ${customers.length} customers, ${prospects.length} prospects`);

  // 2. Build deduped outlet map (sheet = single source of truth)
  const outletMap = new Map();

  // Customers first
  for (const row of customers) {
    const name = row['Retailer_Name'] || row['Name'];
    const beat = normalizeBeat(row['Beat']);
    if (!name || !beat) continue;
    const k = normKey(name, beat);

    const doc = {
      name, beat, type: 'customer',
      area: row['Address'] || undefined,
      phone: normalizePhone(row['phno'] || row['MobileNumber']),
      lastVisited: parseDate(row['First_Purchase_Date']),
    };

    if (!outletMap.has(k)) {
      outletMap.set(k, doc);
    } else {
      // Merge: keep existing, fill gaps
      const existing = outletMap.get(k);
      if (!existing.phone && doc.phone) existing.phone = doc.phone;
      if (!existing.area && doc.area) existing.area = doc.area;
      if (!existing.lastVisited && doc.lastVisited) existing.lastVisited = doc.lastVisited;
    }
  }

  // Prospects (skip converted ones — they're already in customers)
  for (const row of prospects) {
    const name = row['Retailer_Name'] || row['Name'];
    const beat = normalizeBeat(row['Beat']);
    if (!name || !beat) continue;

    const isConverted = (row['Converted_To_Customer'] || '').toLowerCase() === 'yes';
    if (isConverted) continue; // already in customer list

    const k = normKey(name, beat);
    if (outletMap.has(k)) continue; // already added as customer

    outletMap.set(k, {
      name, beat, type: 'prospect',
      area: row['Address'] || undefined,
      lastVisited: parseDate(row['First Visit Date'] || row['First_Visit_Date']),
    });
  }

  console.log(`Deduped outlets: ${outletMap.size}`);

  // 3. Delete all existing
  console.log('Deleting existing outlets...');
  const deleted = await deleteAll();
  console.log(`Deleted ${deleted} existing documents.`);

  // 4. Write fresh
  console.log('Writing fresh data...');
  const entries = [...outletMap.values()];
  const BATCH_LIMIT = 490;
  for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const o of entries.slice(i, i + BATCH_LIMIT)) {
      const ref = db.collection('outlets').doc();
      const doc = { id: ref.id, name: o.name, beat: o.beat, type: o.type, createdAt: now, updatedAt: now };
      if (o.area) doc.area = o.area;
      if (o.phone) doc.phone = o.phone;
      if (o.lastVisited) doc.lastVisited = o.lastVisited;
      batch.set(ref, doc);
    }
    await batch.commit();
  }

  // 5. Summary
  const byBeat = {};
  for (const o of entries) {
    const key = `${o.beat}`;
    if (!byBeat[key]) byBeat[key] = { customers: 0, prospects: 0 };
    byBeat[key][o.type === 'customer' ? 'customers' : 'prospects']++;
  }

  console.log(`\nDone! ${entries.length} outlets written:\n`);
  const totalC = entries.filter(o => o.type === 'customer').length;
  const totalP = entries.filter(o => o.type === 'prospect').length;
  for (const beat of Object.keys(byBeat).sort()) {
    const b = byBeat[beat];
    console.log(`  ${beat}: ${b.customers} customers, ${b.prospects} prospects`);
  }
  console.log(`\n  TOTAL: ${totalC} customers, ${totalP} prospects`);
}

run().catch(e => { console.error(e); process.exit(1); });
