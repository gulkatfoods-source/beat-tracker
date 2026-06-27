'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Download} from 'lucide-react';

export function SeedOutletsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSeed() {
    if (!confirm('Import all 118 outlets from customer master? This will populate the Beats dashboard.')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/outlets/seed', {method: 'POST'});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setDone(true);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setLoading(false);
    }
  }

  if (done) return null;

  return (
    <button
      onClick={handleSeed}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
    >
      <Download className="h-4 w-4" />
      {loading ? 'Importing…' : 'Import from Customer Master'}
    </button>
  );
}
