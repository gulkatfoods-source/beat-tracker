'use client';

import {useMemo} from 'react';
import {
  AlertTriangle, TrendingUp, TrendingDown, Minus, Eye, EyeOff,
  BarChart3, Target, Clock, Users, UserCheck, Zap, ShieldCheck, Info,
} from 'lucide-react';
import type {Outlet} from '@/lib/types';

// ─── Date helpers ────────────────────────────────────────────────────────────

function toDateObj(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function diffDays(a: string, b: string): number {
  return Math.round((toDateObj(a).getTime() - toDateObj(b).getTime()) / 86_400_000);
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatShortDate(s: string): string {
  const d = toDateObj(s);
  return d.toLocaleDateString('en-IN', {day: 'numeric', month: 'short'});
}

function weekdayShort(d: Date): string {
  return d.toLocaleDateString('en-IN', {weekday: 'short'}).slice(0, 2);
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

// ─── Analysis engine ─────────────────────────────────────────────────────────

interface Analytics {
  today: string;
  todayDate: Date;
  dayOfMonth: number;
  totalDaysInMonth: number;
  monthProgress: number; // 0-1

  totalOutlets: number;
  customers: number;
  prospects: number;

  visitedToday: Outlet[];
  visitedThisWeek: Set<string>;
  visitedThisMonth: Set<string>;
  visitedLastMonth: Set<string>;

  visitsToday: number;
  visitsThisWeek: number;
  visitsLastWeek: number;
  visitsThisMonth: number;
  visitsLastMonth: number;

  dailyRunRate: number;
  projectedMonthVisits: number;

  coverageThisMonth: number; // unique outlets visited / total
  coverageLastMonth: number;

  neglected14: Outlet[];
  neglected30: Outlet[];
  neverVisited: Outlet[];

  beatStats: BeatStat[];
  dailyActivity: DayBar[];
  alerts: Alert[];
  topSalespeople: {name: string; count: number}[];
  hotProspects: Outlet[];
}

interface BeatStat {
  beat: string;
  total: number;
  customers: number;
  prospects: number;
  visitedThisMonth: number;
  coverage: number;
  visitsThisMonth: number;
  visitsLastMonth: number;
  neglected: number;
}

interface DayBar {
  date: string;
  label: string;
  weekday: string;
  count: number;
  isToday: boolean;
  isWeekend: boolean;
}

interface Alert {
  type: 'success' | 'warning' | 'info' | 'danger';
  icon: React.ReactNode;
  title: string;
  body: string;
}

function analyze(outlets: Outlet[], selectedBeats: string[]): Analytics {
  const now = new Date();
  const today = dateKey(now);
  const dayOfMonth = now.getDate();
  const totalDays = daysInMonth(now.getFullYear(), now.getMonth() + 1);
  const monthProgress = dayOfMonth / totalDays;
  const thisMonthKey = monthKey(now);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = monthKey(lastMonth);
  const monday = getMonday(now);
  const mondayKey = dateKey(monday);
  const lastMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7);
  const lastMondayKey = dateKey(lastMonday);
  const lastSundayKey = dateKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 1));
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=Mon, 7=Sun

  const customers = outlets.filter(o => o.type === 'customer').length;
  const prospects = outlets.filter(o => o.type === 'prospect').length;

  // Collect all visits from visitLog
  const allVisits: {outletId: string; date: string; salesperson?: string; beat: string}[] = [];
  for (const o of outlets) {
    if (o.visitLog) {
      for (const v of o.visitLog) {
        allVisits.push({outletId: o.id, date: v.date, salesperson: v.salesperson, beat: o.beat});
      }
    }
  }

  // Today
  const visitedToday = outlets.filter(o => o.lastVisited === today);
  const visitsToday = allVisits.filter(v => v.date === today).length;

  // This week (Mon-today)
  const thisWeekVisits = allVisits.filter(v => v.date >= mondayKey && v.date <= today);
  const visitsThisWeek = thisWeekVisits.length;
  const visitedThisWeekSet = new Set(thisWeekVisits.map(v => v.outletId));

  // Last week (prev Mon - prev Sun)
  const lastWeekVisits = allVisits.filter(v => v.date >= lastMondayKey && v.date <= lastSundayKey);
  const visitsLastWeek = lastWeekVisits.length;

  // This month
  const thisMonthVisits = allVisits.filter(v => v.date.startsWith(thisMonthKey));
  const visitsThisMonth = thisMonthVisits.length;
  const visitedThisMonthSet = new Set(thisMonthVisits.map(v => v.outletId));

  // Last month
  const lastMonthVisits = allVisits.filter(v => v.date.startsWith(lastMonthKey));
  const visitsLastMonth = lastMonthVisits.length;
  const visitedLastMonthSet = new Set(lastMonthVisits.map(v => v.outletId));

  // Run rate & projection
  const dailyRunRate = dayOfMonth > 0 ? visitsThisMonth / dayOfMonth : 0;
  const projectedMonthVisits = Math.round(dailyRunRate * totalDays);

  // Coverage
  const coverageThisMonth = outlets.length > 0 ? visitedThisMonthSet.size / outlets.length : 0;
  const coverageLastMonth = outlets.length > 0 ? visitedLastMonthSet.size / outlets.length : 0;

  // Neglected outlets
  const neglected14: Outlet[] = [];
  const neglected30: Outlet[] = [];
  const neverVisited: Outlet[] = [];
  for (const o of outlets) {
    if (!o.lastVisited) {
      neverVisited.push(o);
      neglected30.push(o);
      neglected14.push(o);
    } else {
      const days = diffDays(today, o.lastVisited);
      if (days >= 30) neglected30.push(o);
      if (days >= 14) neglected14.push(o);
    }
  }
  neglected14.sort((a, b) => (a.lastVisited ?? '').localeCompare(b.lastVisited ?? ''));

  // Beat stats
  const beatMap = new Map<string, BeatStat>();
  for (const beat of selectedBeats) {
    beatMap.set(beat, {
      beat, total: 0, customers: 0, prospects: 0,
      visitedThisMonth: 0, coverage: 0,
      visitsThisMonth: 0, visitsLastMonth: 0, neglected: 0,
    });
  }
  for (const o of outlets) {
    const bs = beatMap.get(o.beat);
    if (!bs) continue;
    bs.total++;
    if (o.type === 'customer') bs.customers++;
    else bs.prospects++;
    if (visitedThisMonthSet.has(o.id)) bs.visitedThisMonth++;
    if (!o.lastVisited || diffDays(today, o.lastVisited) >= 14) bs.neglected++;
  }
  for (const v of thisMonthVisits) {
    const bs = beatMap.get(v.beat);
    if (bs) bs.visitsThisMonth++;
  }
  for (const v of lastMonthVisits) {
    const bs = beatMap.get(v.beat);
    if (bs) bs.visitsLastMonth++;
  }
  for (const bs of beatMap.values()) {
    bs.coverage = bs.total > 0 ? bs.visitedThisMonth / bs.total : 0;
  }
  const beatStats = [...beatMap.values()].sort((a, b) => b.total - a.total);

  // Daily activity (last 21 days)
  const dailyActivity: DayBar[] = [];
  for (let i = 20; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dk = dateKey(d);
    const dow = d.getDay();
    dailyActivity.push({
      date: dk,
      label: d.getDate().toString(),
      weekday: weekdayShort(d),
      count: allVisits.filter(v => v.date === dk).length,
      isToday: dk === today,
      isWeekend: dow === 0 || dow === 6,
    });
  }

  // Top salespeople
  const spMap = new Map<string, number>();
  for (const v of thisMonthVisits) {
    const sp = v.salesperson?.trim();
    if (sp) spMap.set(sp, (spMap.get(sp) ?? 0) + 1);
  }
  const topSalespeople = [...spMap.entries()]
    .map(([name, count]) => ({name, count}))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Hot prospects (visited 2+ times)
  const hotProspects = outlets
    .filter(o => o.type === 'prospect' && (o.visitLog?.length ?? 0) >= 2)
    .sort((a, b) => (b.visitLog?.length ?? 0) - (a.visitLog?.length ?? 0));

  // ─── Smart alerts ────────────────────────────────────────────────────────
  const alerts: Alert[] = [];

  // Month comparison — context-aware
  if (dayOfMonth <= 5) {
    alerts.push({
      type: 'info',
      icon: <Info className="h-4 w-4" />,
      title: 'Month just started',
      body: `Only ${dayOfMonth} day${dayOfMonth > 1 ? 's' : ''} in — too early for monthly comparison. ${visitsThisMonth} visit${visitsThisMonth !== 1 ? 's' : ''} so far.`,
    });
  } else if (visitsLastMonth === 0 && visitsThisMonth > 0) {
    alerts.push({
      type: 'success',
      icon: <TrendingUp className="h-4 w-4" />,
      title: 'First month with activity',
      body: `${visitsThisMonth} visits logged this month. No prior month data to compare against.`,
    });
  } else if (visitsLastMonth > 0) {
    const pctDiff = ((projectedMonthVisits - visitsLastMonth) / visitsLastMonth) * 100;
    if (pctDiff >= 10) {
      alerts.push({
        type: 'success',
        icon: <TrendingUp className="h-4 w-4" />,
        title: 'On track to beat last month',
        body: `At ${dailyRunRate.toFixed(1)} visits/day, this month projects to ~${projectedMonthVisits} visits vs last month's ${visitsLastMonth} (+${Math.round(pctDiff)}%). ${totalDays - dayOfMonth} days still left.`,
      });
    } else if (pctDiff <= -10) {
      alerts.push({
        type: 'warning',
        icon: <TrendingDown className="h-4 w-4" />,
        title: 'Pace is below last month',
        body: `Current rate of ${dailyRunRate.toFixed(1)}/day projects ~${projectedMonthVisits} visits vs last month's ${visitsLastMonth} (${Math.round(pctDiff)}%). ${totalDays - dayOfMonth} days left to close the gap.`,
      });
    } else {
      alerts.push({
        type: 'info',
        icon: <Minus className="h-4 w-4" />,
        title: 'On par with last month',
        body: `Projected ~${projectedMonthVisits} visits this month vs ${visitsLastMonth} last month. Pace looks steady.`,
      });
    }
  }

  // Week comparison — context-aware
  if (dayOfWeek >= 3 && visitsLastWeek > 0) {
    const weekDailyRate = visitsThisWeek / dayOfWeek;
    const projectedWeek = Math.round(weekDailyRate * 6); // Mon-Sat working days
    const weekDiff = ((projectedWeek - visitsLastWeek) / visitsLastWeek) * 100;
    if (Math.abs(weekDiff) > 15) {
      alerts.push({
        type: weekDiff > 0 ? 'success' : 'warning',
        icon: weekDiff > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />,
        title: weekDiff > 0 ? 'Strong week' : 'Slow week',
        body: `This week projects ~${projectedWeek} visits vs last week's ${visitsLastWeek} (${weekDiff > 0 ? '+' : ''}${Math.round(weekDiff)}%). ${6 - dayOfWeek} working days left.`,
      });
    }
  } else if (dayOfWeek < 3 && visitsThisWeek > 0) {
    alerts.push({
      type: 'info',
      icon: <Clock className="h-4 w-4" />,
      title: 'Week in progress',
      body: `${visitsThisWeek} visit${visitsThisWeek !== 1 ? 's' : ''} in ${dayOfWeek} day${dayOfWeek !== 1 ? 's' : ''}. Too early for weekly comparison.`,
    });
  }

  // Neglected beats
  const worstBeat = beatStats.find(b => b.neglected >= 3 && b.total >= 3);
  if (worstBeat) {
    alerts.push({
      type: 'danger',
      icon: <AlertTriangle className="h-4 w-4" />,
      title: `${worstBeat.beat} needs attention`,
      body: `${worstBeat.neglected} of ${worstBeat.total} outlets haven't been visited in 14+ days.`,
    });
  }

  // Coverage alert
  if (dayOfMonth > 7 && coverageThisMonth < 0.3 && outlets.length >= 5) {
    alerts.push({
      type: 'warning',
      icon: <EyeOff className="h-4 w-4" />,
      title: 'Low coverage',
      body: `Only ${Math.round(coverageThisMonth * 100)}% of outlets visited this month (${visitedThisMonthSet.size}/${outlets.length}). Aim for at least 50%.`,
    });
  } else if (coverageThisMonth >= 0.7) {
    alerts.push({
      type: 'success',
      icon: <ShieldCheck className="h-4 w-4" />,
      title: 'Great coverage',
      body: `${Math.round(coverageThisMonth * 100)}% of outlets visited this month. Keep it up.`,
    });
  }

  // Hot prospects
  if (hotProspects.length >= 2) {
    alerts.push({
      type: 'info',
      icon: <Zap className="h-4 w-4" />,
      title: `${hotProspects.length} warm prospect${hotProspects.length > 1 ? 's' : ''}`,
      body: `${hotProspects.slice(0, 3).map(p => p.name).join(', ')} ${hotProspects.length > 3 ? `and ${hotProspects.length - 3} more` : ''} visited 2+ times — consider converting.`,
    });
  }

  // Never visited
  if (neverVisited.length > 0) {
    alerts.push({
      type: 'warning',
      icon: <Eye className="h-4 w-4" />,
      title: `${neverVisited.length} outlet${neverVisited.length > 1 ? 's' : ''} never visited`,
      body: `${neverVisited.slice(0, 3).map(o => o.name).join(', ')}${neverVisited.length > 3 ? ` +${neverVisited.length - 3} more` : ''} have no visit records.`,
    });
  }

  return {
    today, todayDate: now, dayOfMonth, totalDaysInMonth: totalDays, monthProgress,
    totalOutlets: outlets.length, customers, prospects,
    visitedToday, visitedThisWeek: visitedThisWeekSet, visitedThisMonth: visitedThisMonthSet,
    visitedLastMonth: visitedLastMonthSet,
    visitsToday, visitsThisWeek, visitsLastWeek, visitsThisMonth, visitsLastMonth,
    dailyRunRate, projectedMonthVisits,
    coverageThisMonth, coverageLastMonth,
    neglected14, neglected30, neverVisited,
    beatStats, dailyActivity, alerts, topSalespeople, hotProspects,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function InsightsPanel({outlets, selectedBeats}: {outlets: Outlet[]; selectedBeats: string[]}) {
  const a = useMemo(() => analyze(outlets, selectedBeats), [outlets, selectedBeats]);

  if (outlets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
        <BarChart3 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p className="font-semibold text-gray-600">No data for insights</p>
        <p className="mt-1 text-sm text-gray-400">Select beats with outlet data to see analytics.</p>
      </div>
    );
  }

  const currentMonthName = a.todayDate.toLocaleDateString('en-IN', {month: 'long'});
  const lastMonthName = new Date(a.todayDate.getFullYear(), a.todayDate.getMonth() - 1, 1)
    .toLocaleDateString('en-IN', {month: 'long'});

  return (
    <div className="space-y-5">

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KPI
          icon={<Target className="h-4 w-4" />}
          label="Coverage"
          value={`${Math.round(a.coverageThisMonth * 100)}%`}
          sub={`${a.visitedThisMonth.size}/${a.totalOutlets} outlets`}
          color="blue"
        />
        <KPI
          icon={<BarChart3 className="h-4 w-4" />}
          label={currentMonthName}
          value={a.visitsThisMonth.toString()}
          sub={a.dayOfMonth > 5 ? `→ ~${a.projectedMonthVisits} projected` : `${a.dayOfMonth} day${a.dayOfMonth > 1 ? 's' : ''} in`}
          color="purple"
        />
        <KPI
          icon={<TrendingUp className="h-4 w-4" />}
          label="Daily Rate"
          value={a.dailyRunRate.toFixed(1)}
          sub="visits / day"
          color="green"
        />
        <KPI
          icon={<Clock className="h-4 w-4" />}
          label="Neglected"
          value={a.neglected14.length.toString()}
          sub="14+ days ago"
          color={a.neglected14.length > a.totalOutlets * 0.3 ? 'red' : 'gray'}
        />
      </div>

      {/* ── Alerts ────────────────────────────────────────────── */}
      {a.alerts.length > 0 && (
        <div className="space-y-2">
          <SectionHead>Smart Alerts</SectionHead>
          {a.alerts.map((al, i) => (
            <AlertCard key={i} alert={al} />
          ))}
        </div>
      )}

      {/* ── 21-Day Activity ───────────────────────────────────── */}
      <div>
        <SectionHead>Daily Activity — Last 21 Days</SectionHead>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <ActivityChart bars={a.dailyActivity} />
        </div>
      </div>

      {/* ── Beat Scoreboard ───────────────────────────────────── */}
      {a.beatStats.length > 0 && (
        <div>
          <SectionHead>Beat Scoreboard</SectionHead>
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-3 py-2.5 text-left">Beat</th>
                  <th className="px-3 py-2.5 text-center">Outlets</th>
                  <th className="px-3 py-2.5 text-center">Coverage</th>
                  <th className="px-3 py-2.5 text-center">{currentMonthName.slice(0, 3)}</th>
                  <th className="px-3 py-2.5 text-center">{lastMonthName.slice(0, 3)}</th>
                  <th className="px-3 py-2.5 text-center">Trend</th>
                  <th className="px-3 py-2.5 text-center">Neglected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {a.beatStats.map(bs => {
                  const trend = bs.visitsLastMonth > 0
                    ? ((bs.visitsThisMonth / (a.dayOfMonth / a.totalDaysInMonth) - bs.visitsLastMonth) / bs.visitsLastMonth) * 100
                    : null;
                  return (
                    <tr key={bs.beat} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-medium text-gray-900">{bs.beat}</td>
                      <td className="px-3 py-2.5 text-center text-gray-600">
                        {bs.total}
                        <span className="ml-1 text-xs text-gray-400">({bs.customers}C/{bs.prospects}P)</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <CoveragePill pct={bs.coverage} />
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-700 font-medium">{bs.visitsThisMonth}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500">{bs.visitsLastMonth}</td>
                      <td className="px-3 py-2.5 text-center">
                        {a.dayOfMonth <= 5 ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : trend !== null ? (
                          <TrendBadge pct={trend} />
                        ) : (
                          <span className="text-xs text-gray-400">new</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {bs.neglected > 0 ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            bs.neglected >= bs.total * 0.5
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>{bs.neglected}</span>
                        ) : (
                          <span className="text-xs text-green-600">✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Month Comparison ──────────────────────────────────── */}
      <div>
        <SectionHead>{currentMonthName} vs {lastMonthName}</SectionHead>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 uppercase">{lastMonthName}</p>
              <p className="text-2xl font-bold text-gray-400">{a.visitsLastMonth}</p>
              <p className="text-xs text-gray-400">visits ({a.visitedLastMonth.size} outlets)</p>
            </div>
            <div className="flex items-center justify-center">
              <div className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500">
                {a.dayOfMonth <= 5 ? 'Too early' : 'vs'}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">{currentMonthName}</p>
              <p className="text-2xl font-bold text-gray-900">{a.visitsThisMonth}</p>
              {a.dayOfMonth > 5 ? (
                <p className="text-xs text-blue-600">→ ~{a.projectedMonthVisits} projected</p>
              ) : (
                <p className="text-xs text-gray-400">{a.dayOfMonth}/{a.totalDaysInMonth} days</p>
              )}
            </div>
          </div>
          {a.dayOfMonth > 5 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Month progress</span>
                <span>{Math.round(a.monthProgress * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gray-900 transition-all"
                  style={{width: `${Math.round(a.monthProgress * 100)}%`}}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Top Salespeople ────────────────────────────────────── */}
      {a.topSalespeople.length > 0 && (
        <div>
          <SectionHead>Top Salespeople — {currentMonthName}</SectionHead>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 space-y-2">
            {a.topSalespeople.map((sp, i) => {
              const maxCount = a.topSalespeople[0].count;
              return (
                <div key={sp.name} className="flex items-center gap-3">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium text-gray-800 truncate">{sp.name}</span>
                      <span className="text-sm font-semibold text-gray-600">{sp.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${i === 0 ? 'bg-amber-500' : 'bg-gray-400'}`}
                        style={{width: `${(sp.count / maxCount) * 100}%`}}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Neglected Outlets ──────────────────────────────────── */}
      {a.neglected14.length > 0 && (
        <div>
          <SectionHead>Neglected Outlets (14+ days)</SectionHead>
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 divide-y divide-gray-50">
            {a.neglected14.slice(0, 15).map(o => {
              const days = o.lastVisited ? diffDays(a.today, o.lastVisited) : null;
              return (
                <div key={o.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{o.name}</p>
                    <p className="text-xs text-gray-400">{o.beat} · {o.type}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    days === null ? 'bg-gray-200 text-gray-600'
                      : days >= 30 ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {days === null ? 'Never' : `${days}d ago`}
                  </span>
                </div>
              );
            })}
            {a.neglected14.length > 15 && (
              <div className="px-4 py-2 text-xs text-gray-400 text-center">
                +{a.neglected14.length - 15} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Hot Prospects ─────────────────────────────────────── */}
      {a.hotProspects.length > 0 && (
        <div>
          <SectionHead>Warm Prospects — Ready to Convert?</SectionHead>
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 divide-y divide-gray-50">
            {a.hotProspects.slice(0, 10).map(o => (
              <div key={o.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{o.name}</p>
                  <p className="text-xs text-gray-400">{o.beat} · Last: {formatShortDate(o.lastVisited!)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {o.visitLog!.length} visits
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHead({children}: {children: React.ReactNode}) {
  return (
    <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
      {children}
    </h3>
  );
}

function KPI({icon, label, value, sub, color}: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  color: 'blue' | 'purple' | 'green' | 'gray' | 'red';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    green: 'bg-green-50 text-green-700',
    gray: 'bg-gray-50 text-gray-600',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <div className={`rounded-xl p-3 shadow-sm ring-1 ring-gray-100 ${colors[color]}`}>
      <div className="flex items-center gap-1.5 text-xs opacity-75 mb-1">{icon}{label}</div>
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs opacity-60">{sub}</p>
    </div>
  );
}

function AlertCard({alert}: {alert: Alert}) {
  const styles = {
    success: 'bg-green-50 ring-green-200 text-green-800',
    warning: 'bg-amber-50 ring-amber-200 text-amber-800',
    info: 'bg-blue-50 ring-blue-200 text-blue-800',
    danger: 'bg-red-50 ring-red-200 text-red-800',
  };
  return (
    <div className={`flex gap-3 rounded-lg p-3 ring-1 ${styles[alert.type]}`}>
      <div className="mt-0.5 shrink-0">{alert.icon}</div>
      <div>
        <p className="text-sm font-semibold">{alert.title}</p>
        <p className="text-xs opacity-80 mt-0.5">{alert.body}</p>
      </div>
    </div>
  );
}

function ActivityChart({bars}: {bars: DayBar[]}) {
  const max = Math.max(...bars.map(b => b.count), 1);
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{height: 100}}>
        {bars.map(bar => {
          const h = bar.count > 0 ? Math.max((bar.count / max) * 100, 6) : 2;
          return (
            <div key={bar.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              <div className="absolute -top-6 hidden group-hover:block rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-white whitespace-nowrap z-10">
                {bar.count} visit{bar.count !== 1 ? 's' : ''} · {formatShortDate(bar.date)}
              </div>
              <div
                className={`w-full rounded-t transition-all ${
                  bar.isToday ? 'bg-blue-500'
                    : bar.count === 0 ? 'bg-gray-200'
                    : bar.isWeekend ? 'bg-gray-300'
                    : 'bg-gray-700'
                }`}
                style={{height: `${h}%`}}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-[3px] mt-1">
        {bars.map(bar => (
          <div key={bar.date} className={`flex-1 text-center text-[9px] leading-tight ${
            bar.isToday ? 'font-bold text-blue-600' : bar.isWeekend ? 'text-gray-300' : 'text-gray-400'
          }`}>
            {bar.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function CoveragePill({pct}: {pct: number}) {
  const p = Math.round(pct * 100);
  const color = p >= 60 ? 'bg-green-100 text-green-700' : p >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{p}%</span>;
}

function TrendBadge({pct}: {pct: number}) {
  const r = Math.round(pct);
  if (Math.abs(r) < 5) return <span className="text-xs text-gray-400">~same</span>;
  const up = r > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-green-600' : 'text-red-600'}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{r}%
    </span>
  );
}
