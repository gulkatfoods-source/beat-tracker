import {Map} from 'lucide-react';
import {repos} from '@/lib/repos';
import {OutletManager} from '@/components/admin/OutletManager';
import {SeedOutletsButton} from '@/components/admin/SeedOutletsButton';

export const dynamic = 'force-dynamic';

export default async function AdminBeatsPage() {
  const [outlets, beats] = await Promise.all([
    repos.outlets.list(),
    repos.outlets.listBeats(),
  ]);

  outlets.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gray-900 p-2 text-white">
            <Map className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Beats & Outlets</h2>
            <p className="text-sm text-gray-500">
              {outlets.length} outlet{outlets.length !== 1 ? 's' : ''} across {beats.length} beat{beats.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {outlets.length === 0 && <SeedOutletsButton />}
          <a
            href="/beats"
            target="_blank"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            View Dashboard ↗
          </a>
        </div>
      </div>

      <OutletManager initialOutlets={outlets} initialBeats={beats} />
    </div>
  );
}
