/**
 * Finds and removes duplicate outlets in Firestore.
 * Duplicates = same beat + normalized name (lowercase, no spaces/punctuation).
 * Keeps the doc with the most data; deletes the rest.
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

// Normalize: lowercase, strip all non-alphanumeric chars
function norm(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function score(doc) {
  // Higher score = more complete record = keep this one
  let s = 0;
  if (doc.phone) s += 4;
  if (doc.lastVisited) s += 3;
  if (doc.area) s += 2;
  if (doc.type === 'customer') s += 1;
  return s;
}

async function run() {
  const snapshot = await db.collection('outlets').get();
  const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Loaded ${all.length} outlets`);

  // Group by beat + normalized name
  const groups = new Map();
  for (const doc of all) {
    const k = `${norm(doc.beat)}||${norm(doc.name)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(doc);
  }

  const dupeGroups = [...groups.values()].filter(g => g.length > 1);
  console.log(`Found ${dupeGroups.length} duplicate groups\n`);

  if (dupeGroups.length === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  // For each group, keep the best doc, merge missing fields into it, delete the rest
  const batch = db.batch();
  let deleted = 0;

  for (const group of dupeGroups) {
    group.sort((a, b) => score(b) - score(a));
    const [keep, ...remove] = group;

    // Merge any fields from duplicates that the keeper is missing
    const merged = {};
    for (const dup of remove) {
      if (!keep.phone && dup.phone) merged.phone = dup.phone;
      if (!keep.area && dup.area) merged.area = dup.area;
      if (!keep.lastVisited && dup.lastVisited) merged.lastVisited = dup.lastVisited;
      if (keep.type !== 'customer' && dup.type === 'customer') merged.type = 'customer';
    }

    console.log(`KEEP: "${keep.name}" (${keep.beat}) [score ${score(keep)}]`);
    for (const dup of remove) {
      console.log(`  DEL: "${dup.name}" (${dup.beat}) [score ${score(dup)}]`);
      batch.delete(db.collection('outlets').doc(dup.id));
      deleted++;
    }

    if (Object.keys(merged).length > 0) {
      batch.update(db.collection('outlets').doc(keep.id), { ...merged, updatedAt: new Date().toISOString() });
      console.log(`  MERGED fields into keeper: ${JSON.stringify(merged)}`);
    }
    console.log('');
  }

  await batch.commit();
  console.log(`Done: ${deleted} duplicates removed.`);
  console.log(`Remaining outlets: ${all.length - deleted}`);
}

run().catch(e => { console.error(e); process.exit(1); });
