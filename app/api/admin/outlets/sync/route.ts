import {NextResponse} from 'next/server';
import {getDb} from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const SHEET_ID = '1CuwbzyHtMJR7O6Fitj-xay4qksrxOIkwi1eqgWiLVyA';

async function fetchCSV(param: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&${param}`;
  const res = await fetch(url, {redirect: 'follow'});
  if (!res.ok) throw new Error(`Sheet fetch failed: HTTP ${res.status}`);
  return res.text();
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1)
    .map(line => {
      const vals = parseCSVLine(line);
      return Object.fromEntries(headers.map((h, i) => [h.trim(), (vals[i] ?? '').trim()]));
    })
    .filter(row => Object.values(row).some(v => v));
}

function normKey(name: string, beat: string): string {
  const n = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const b = (beat || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${b}||${n}`;
}

export async function POST() {
  try {
    // 1. Fetch both sheets in parallel
    const [customerCSV, prospectCSV] = await Promise.all([
      fetchCSV('sheet=Customer_Master'),
      fetchCSV('gid=1185495958'),
    ]);

    const customers = parseCSV(customerCSV);
    const prospects = parseCSV(prospectCSV);

    // 2. Build set of valid norm keys from sheets
    const sheetKeys = new Set<string>();

    for (const row of customers) {
      const name = row['Retailer_Name'] || row['Name'];
      const beat = row['Beat'];
      if (name && beat) sheetKeys.add(normKey(name, beat));
    }

    for (const row of prospects) {
      const name = row['Retailer_Name'] || row['Name'];
      const beat = row['Beat'];
      if (!name || !beat) continue;
      const converted = (row['Converted_To_Customer'] || '').toLowerCase() === 'yes';
      if (!converted) sheetKeys.add(normKey(name, beat));
    }

    // 3. Get all Firestore outlets
    const db = getDb();
    const snap = await db.collection('outlets').get();
    const allOutlets = snap.docs.map(d => ({id: d.id, ...d.data()})) as Array<{id: string; name: string; beat: string; manuallyAdded?: boolean; [key: string]: unknown}>;

    // 4. Find outlets to delete: not in sheet AND not manually added via admin
    const toDelete = allOutlets.filter(o => {
      if (o.manuallyAdded) return false; // keep manual entries
      return !sheetKeys.has(normKey(o.name, o.beat));
    });

    // 5. Delete them in batches
    if (toDelete.length > 0) {
      const BATCH_LIMIT = 490;
      for (let i = 0; i < toDelete.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        toDelete.slice(i, i + BATCH_LIMIT).forEach(o => batch.delete(db.collection('outlets').doc(o.id)));
        await batch.commit();
      }
    }

    // 6. Return remaining outlets
    const remaining = allOutlets
      .filter(o => !toDelete.some(d => d.id === o.id))
      .sort((a, b) => ((b.createdAt as string) ?? '').localeCompare((a.createdAt as string) ?? ''));

    return NextResponse.json({
      outlets: remaining,
      removed: toDelete.length,
      scanned: allOutlets.length,
    });
  } catch (err) {
    console.error('Sync error:', err);
    return NextResponse.json({error: err instanceof Error ? err.message : 'Sync failed'}, {status: 500});
  }
}
