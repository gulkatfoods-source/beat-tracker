'use client';

import Image from 'next/image';
import {useCallback, useEffect, useRef, useState} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import {Building2, Phone, MapPin, RefreshCw, Users, UserSearch, Star, Calendar, TrendingUp, CheckSquare, Square} from 'lucide-react';
import type {Outlet} from '@/lib/types';

type TypeFilter = 'all' | 'customer' | 'prospect';

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'});
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function parseBeats(param: string | null): string[] {
  if (!param) return [];
  return param.split(',').map((b) => b.trim()).filter(Boolean);
}

export function BeatDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [allBeats, setAllBeats] = useState<string[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(false);
  const [beatsLoading, setBeatsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const selectedBeats = parseBeats(searchParams.get('beats') ?? searchParams.get('beat'));
  const typeFilter = (searchParams.get('type') ?? 'all') as TypeFilter;
  const today = getTodayKey();

  // Load beats list once on mount
  useEffect(() => {
    setBeatsLoading(true);
    fetch('/api/beats')
      .then((r) => r.json())
      .then((data) => setAllBeats(data.beats ?? []))
      .catch(() => setAllBeats([]))
      .finally(() => setBeatsLoading(false));
  }, []);

  const fetchOutlets = useCallback(async (beats: string[], type: TypeFilter) => {
    if (beats.length === 0) {
      setOutlets([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({beats: beats.join(',')});
      if (type !== 'all') params.set('type', type);
      const res = await fetch(`/api/beats/outlets?${params}`);
      const data = await res.json();
      setOutlets(data.outlets ?? []);
      setLastRefreshed(new Date());
    } catch {
      setOutlets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOutlets(selectedBeats, typeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('beats'), searchParams.get('beat'), searchParams.get('type'), fetchOutlets]);

  // Auto-refresh every 60 seconds
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (selectedBeats.length === 0) return;
    intervalRef.current = setInterval(() => {
      fetchOutlets(selectedBeats, typeFilter);
    }, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('beats'), searchParams.get('beat'), searchParams.get('type'), fetchOutlets]);

  function navigate(beats: string[], type: TypeFilter) {
    const params = new URLSearchParams();
    if (beats.length > 0) params.set('beats', beats.join(','));
    if (type !== 'all') params.set('type', type);
    router.push(`/beats${params.size ? `?${params}` : ''}`);
  }

  function toggleBeat(beat: string) {
    const next = selectedBeats.includes(beat)
      ? selectedBeats.filter((b) => b !== beat)
      : [...selectedBeats, beat];
    navigate(next, typeFilter);
  }

  function toggleAll() {
    const allSelected = allBeats.every((b) => selectedBeats.includes(b));
    navigate(allSelected ? [] : [...allBeats], typeFilter);
  }

  const allSelected = allBeats.length > 0 && allBeats.every((b) => selectedBeats.includes(b));
  const someSelected = selectedBeats.length > 0;

  const todayOutlets = outlets.filter((o) => o.lastVisited === today);
  const customerCount = outlets.filter((o) => o.type === 'customer').length;
  const prospectCount = outlets.filter((o) => o.type === 'prospect').length;
  const showBeatTag = selectedBeats.length > 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 px-4 py-3 text-white shadow-lg">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-4">
            {/* Logo + title */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Image
                  src="/images/devrat-logo-transparent.png"
                  alt="Devrat"
                  width={36}
                  height={36}
                  className="h-8 w-auto object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold tracking-wide">Beat Tracker</h1>
                  <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                    Live
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">Devrat Namkeen · {formatDate(today)}</p>
              </div>
            </div>
            <button
              onClick={() => fetchOutlets(selectedBeats, typeFilter)}
              disabled={!someSelected || loading}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-white/20 disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        {/* Beat multi-select */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Select Beats
            </label>
            {allBeats.length > 1 && (
              <button
                onClick={toggleAll}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
              >
                {allSelected
                  ? <><CheckSquare className="h-3.5 w-3.5" /> Deselect All</>
                  : <><Square className="h-3.5 w-3.5" /> Select All</>
                }
              </button>
            )}
          </div>

          {beatsLoading ? (
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-gray-200" />)}
            </div>
          ) : allBeats.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
              No beats found. Add outlets from the admin panel to get started.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allBeats.map((beat) => {
                const active = selectedBeats.includes(beat);
                return (
                  <button
                    key={beat}
                    onClick={() => toggleBeat(beat)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                      active
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {beat}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {someSelected && (
          <>
            {/* Type filter */}
            <div className="flex gap-2">
              {(['all', 'customer', 'prospect'] as TypeFilter[]).map((t) => (
                <button
                  key={t}
                  onClick={() => navigate(selectedBeats, t)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    typeFilter === t
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {t === 'all' ? 'All' : t === 'customer' ? 'Customers' : 'Prospects'}
                </button>
              ))}
            </div>

            {/* Stats */}
            {!loading && outlets.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                <StatCard icon={<Building2 className="h-4 w-4" />} label="Total" value={outlets.length} color="gray" />
                <StatCard icon={<Users className="h-4 w-4" />} label="Customers" value={customerCount} color="green" />
                <StatCard icon={<UserSearch className="h-4 w-4" />} label="Prospects" value={prospectCount} color="amber" />
                <StatCard icon={<Star className="h-4 w-4" />} label="Today" value={todayOutlets.length} color="blue" highlight={todayOutlets.length > 0} />
              </div>
            )}

            {/* Outlet list */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />
                ))}
              </div>
            ) : outlets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
                <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="font-semibold text-gray-600">No outlets found</p>
                <p className="mt-1 text-sm text-gray-400">
                  {typeFilter !== 'all' ? `No ${typeFilter}s in the selected beat${selectedBeats.length > 1 ? 's' : ''} yet.` : 'No outlets in the selected beat yet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayOutlets.length > 0 && typeFilter === 'all' && (
                  <SectionLabel icon={<TrendingUp className="h-3.5 w-3.5" />} label={`Visited Today (${todayOutlets.length})`} accent />
                )}
                {outlets.map((outlet) => (
                  <OutletCard key={outlet.id} outlet={outlet} today={today} showBeatTag={showBeatTag} />
                ))}
              </div>
            )}

            {lastRefreshed && !loading && (
              <p className="text-center text-xs text-gray-400">
                Updated {lastRefreshed.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})}
                {' · '}auto-refreshes every minute
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({icon, label, value, color, highlight}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'gray' | 'green' | 'amber' | 'blue';
  highlight?: boolean;
}) {
  const colors = {
    gray: 'bg-white text-gray-600',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: highlight ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700',
  };
  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl p-3 shadow-sm ring-1 ring-gray-100 ${colors[color]}`}>
      {icon}
      <span className="text-xl font-bold leading-none">{value}</span>
      <span className="text-xs opacity-75">{label}</span>
    </div>
  );
}

function SectionLabel({icon, label, accent}: {icon: React.ReactNode; label: string; accent?: boolean}) {
  return (
    <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${accent ? 'text-blue-600' : 'text-gray-400'}`}>
      {icon}
      {label}
    </div>
  );
}

function OutletCard({outlet, today, showBeatTag}: {outlet: Outlet; today: string; showBeatTag: boolean}) {
  const isToday = outlet.lastVisited === today;
  const isCustomer = outlet.type === 'customer';
  const visitCount = outlet.visitLog?.length ?? 0;

  return (
    <div className={`rounded-xl bg-white p-4 shadow-sm ring-1 ${isToday ? 'ring-blue-300' : 'ring-gray-100'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-gray-900">{outlet.name}</h3>
            {isToday && (
              <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                Today
              </span>
            )}
            {showBeatTag && (
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {outlet.beat}
              </span>
            )}
          </div>
          {outlet.ownerName && (
            <p className="mt-0.5 text-sm text-gray-500">{outlet.ownerName}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${isCustomer ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {isCustomer ? 'Customer' : 'Prospect'}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        {outlet.phone && (
          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{outlet.phone}</span>
        )}
        {outlet.area && (
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{outlet.area}</span>
        )}
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Last: {formatDate(outlet.lastVisited)}
        </span>
        {visitCount > 0 && (
          <span className="text-gray-400">{visitCount} visit{visitCount !== 1 ? 's' : ''}</span>
        )}
      </div>

      {outlet.notes && (
        <p className="mt-2 text-xs text-gray-400 italic">{outlet.notes}</p>
      )}
    </div>
  );
}
