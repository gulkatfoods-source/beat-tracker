'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Building2, Phone, MapPin, Plus, X, Check, Pencil, Trash2, CalendarPlus, ChevronDown, RefreshCw} from 'lucide-react';
import type {Outlet} from '@/lib/types';

type Tab = 'all' | 'customer' | 'prospect';

const EMPTY_FORM = {
  name: '',
  ownerName: '',
  phone: '',
  address: '',
  area: '',
  beat: '',
  type: 'prospect' as 'customer' | 'prospect',
  notes: '',
};

function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'});
}

export function OutletManager({
  initialOutlets,
  initialBeats,
}: {
  initialOutlets: Outlet[];
  initialBeats: string[];
}) {
  const router = useRouter();
  const [outlets, setOutlets] = useState<Outlet[]>(initialOutlets);
  const [beats, setBeats] = useState<string[]>(initialBeats);
  const [tab, setTab] = useState<Tab>('all');
  const [beatFilter, setBeatFilter] = useState('');
  const [search, setSearch] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({...EMPTY_FORM});
  const [newBeat, setNewBeat] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({...EMPTY_FORM});

  const [visitingId, setVisitingId] = useState<string | null>(null);
  const [visitForm, setVisitForm] = useState({date: getTodayKey(), notes: '', salesperson: ''});
  const [visitSaving, setVisitSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/outlets/sync', {method: 'POST'});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');
      const fresh: Outlet[] = data.outlets ?? [];
      setOutlets(fresh);
      setBeats([...new Set(fresh.map((o) => o.beat))].sort());
      if (data.removed > 0) {
        alert(`Synced with Google Sheet. Removed ${data.removed} outlet${data.removed !== 1 ? 's' : ''} no longer in the sheet.`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setRefreshing(false);
    }
  }

  const effectiveBeatList = [...new Set([...beats, newBeat].filter(Boolean))].sort();

  const filtered = outlets.filter((o) => {
    if (tab !== 'all' && o.type !== tab) return false;
    if (beatFilter && o.beat !== beatFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !o.name.toLowerCase().includes(q) &&
        !(o.ownerName ?? '').toLowerCase().includes(q) &&
        !(o.phone ?? '').includes(q) &&
        !(o.beat ?? '').toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  async function handleCreate() {
    if (!form.name.trim() || !form.beat.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/outlets', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setOutlets((prev) => [data.outlet, ...prev]);
      if (!beats.includes(form.beat)) setBeats((prev) => [...prev, form.beat].sort());
      setForm({...EMPTY_FORM});
      setNewBeat('');
      setShowAddForm(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create outlet');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(outlet: Outlet) {
    setEditingId(outlet.id);
    setEditForm({
      name: outlet.name,
      ownerName: outlet.ownerName ?? '',
      phone: outlet.phone ?? '',
      address: outlet.address ?? '',
      area: outlet.area ?? '',
      beat: outlet.beat,
      type: outlet.type,
      notes: outlet.notes ?? '',
    });
  }

  async function handleEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/outlets/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error('Failed to update');
      setOutlets((prev) =>
        prev.map((o) => (o.id === id ? {...o, ...editForm} : o)),
      );
      setEditingId(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update outlet');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this outlet? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/admin/outlets/${id}`, {method: 'DELETE'});
      setOutlets((prev) => prev.filter((o) => o.id !== id));
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleVisit(id: string) {
    setVisitSaving(true);
    try {
      const res = await fetch(`/api/admin/outlets/${id}/visit`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(visitForm),
      });
      if (!res.ok) throw new Error('Failed to record visit');
      setOutlets((prev) =>
        prev.map((o) =>
          o.id === id
            ? {
                ...o,
                lastVisited: visitForm.date,
                visitLog: [...(o.visitLog ?? []), visitForm],
              }
            : o,
        ),
      );
      setVisitingId(null);
      setVisitForm({date: getTodayKey(), notes: '', salesperson: ''});
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to record visit');
    } finally {
      setVisitSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search name, owner, phone, beat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>
        <div className="relative">
          <select
            value={beatFilter}
            onChange={(e) => setBeatFilter(e.target.value)}
            className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm focus:border-gray-900 focus:outline-none"
          >
            <option value="">All Beats</option>
            {beats.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh list from database"
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
        <button
          onClick={() => {setShowAddForm((v) => !v); setEditingId(null);}}
          className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
        >
          <Plus className="h-4 w-4" /> Add Outlet
        </button>
      </div>

      {/* Tab filter */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['all', 'customer', 'prospect'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'all' ? 'All' : t === 'customer' ? 'Customers' : 'Prospects'}
            <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs">
              {t === 'all' ? outlets.length : outlets.filter((o) => o.type === t).length}
            </span>
          </button>
        ))}
      </div>

      {/* Add outlet form */}
      {showAddForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-3 font-semibold text-blue-900">New Outlet</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Outlet Name *" value={form.name} onChange={(v) => setForm((f) => ({...f, name: v}))} placeholder="Sharma General Store" />
            <Field label="Owner Name" value={form.ownerName} onChange={(v) => setForm((f) => ({...f, ownerName: v}))} placeholder="Ramesh Sharma" />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({...f, phone: v}))} placeholder="9876543210" type="tel" />
            <Field label="Area / Locality" value={form.area} onChange={(v) => setForm((f) => ({...f, area: v}))} placeholder="Sector 5" />
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Beat *</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={form.beat}
                    onChange={(e) => {setForm((f) => ({...f, beat: e.target.value})); setNewBeat('');}}
                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm focus:border-gray-900 focus:outline-none"
                  >
                    <option value="">Select beat</option>
                    {effectiveBeatList.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                    <option value="__new">+ New beat…</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
                {form.beat === '__new' && (
                  <input
                    type="text"
                    placeholder="Beat name"
                    value={newBeat}
                    onChange={(e) => {setNewBeat(e.target.value); setForm((f) => ({...f, beat: e.target.value}));}}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                    autoFocus
                  />
                )}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Type *</label>
              <div className="flex gap-2">
                {(['prospect', 'customer'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((f) => ({...f, type: t}))}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${
                      form.type === t
                        ? t === 'customer'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-300 bg-white text-gray-500'
                    }`}
                  >
                    {t === 'customer' ? 'Customer' : 'Prospect'}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Field label="Notes" value={form.notes} onChange={(v) => setForm((f) => ({...f, notes: v}))} placeholder="Optional notes" />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !form.name.trim() || !form.beat.trim() || form.beat === '__new'}
              className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save Outlet'}
            </button>
            <button
              onClick={() => {setShowAddForm(false); setForm({...EMPTY_FORM}); setNewBeat('');}}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Outlets table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="font-semibold text-gray-600">No outlets found</p>
          <p className="mt-1 text-sm text-gray-400">Add an outlet using the button above.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Outlet</th>
                <th className="px-4 py-3 text-left">Beat</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Last Visit</th>
                <th className="px-4 py-3 text-left">Visits</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((outlet) => (
                editingId === outlet.id ? (
                  <EditRow
                    key={outlet.id}
                    form={editForm}
                    beats={effectiveBeatList}
                    onChange={setEditForm}
                    onSave={() => handleEdit(outlet.id)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                ) : visitingId === outlet.id ? (
                  <VisitRow
                    key={outlet.id}
                    outlet={outlet}
                    form={visitForm}
                    onChange={setVisitForm}
                    onSave={() => handleVisit(outlet.id)}
                    onCancel={() => setVisitingId(null)}
                    saving={visitSaving}
                  />
                ) : (
                  <tr key={outlet.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{outlet.name}</p>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-400">
                        {outlet.ownerName && (
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{outlet.ownerName}</span>
                        )}
                        {outlet.phone && <span>{outlet.phone}</span>}
                        {outlet.area && (
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{outlet.area}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{outlet.beat}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        outlet.type === 'customer' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {outlet.type === 'customer' ? 'Customer' : 'Prospect'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(outlet.lastVisited)}</td>
                    <td className="px-4 py-3 text-gray-500">{outlet.visitLog?.length ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <IconBtn
                          title="Log visit"
                          onClick={() => {setVisitingId(outlet.id); setEditingId(null); setVisitForm({date: getTodayKey(), notes: '', salesperson: ''});}}
                          icon={<CalendarPlus className="h-4 w-4" />}
                          color="blue"
                        />
                        <IconBtn
                          title="Edit"
                          onClick={() => {startEdit(outlet); setVisitingId(null);}}
                          icon={<Pencil className="h-4 w-4" />}
                          color="gray"
                        />
                        <IconBtn
                          title="Delete"
                          onClick={() => handleDelete(outlet.id)}
                          icon={<Trash2 className="h-4 w-4" />}
                          color="red"
                          disabled={deletingId === outlet.id}
                        />
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({label, value, onChange, placeholder, type = 'text'}: {label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
      />
    </div>
  );
}

function IconBtn({title, onClick, icon, color, disabled}: {title: string; onClick: () => void; icon: React.ReactNode; color: 'gray' | 'blue' | 'red'; disabled?: boolean}) {
  const colors = {
    gray: 'text-gray-400 hover:bg-gray-100 hover:text-gray-700',
    blue: 'text-blue-400 hover:bg-blue-50 hover:text-blue-700',
    red: 'text-red-400 hover:bg-red-50 hover:text-red-600',
  };
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md p-1.5 transition disabled:opacity-50 ${colors[color]}`}
    >
      {icon}
    </button>
  );
}

function EditRow({form, beats, onChange, onSave, onCancel, saving}: {
  form: typeof EMPTY_FORM;
  beats: string[];
  onChange: (f: typeof EMPTY_FORM) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <tr className="bg-yellow-50">
      <td colSpan={6} className="px-4 py-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input value={form.name} onChange={(e) => onChange({...form, name: e.target.value})} placeholder="Name *" className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
          <input value={form.ownerName} onChange={(e) => onChange({...form, ownerName: e.target.value})} placeholder="Owner" className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
          <input value={form.phone} onChange={(e) => onChange({...form, phone: e.target.value})} placeholder="Phone" className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
          <input value={form.area} onChange={(e) => onChange({...form, area: e.target.value})} placeholder="Area" className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
          <select value={form.beat} onChange={(e) => onChange({...form, beat: e.target.value})} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
            {beats.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={form.type} onChange={(e) => onChange({...form, type: e.target.value as 'customer' | 'prospect'})} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
            <option value="prospect">Prospect</option>
            <option value="customer">Customer</option>
          </select>
          <input value={form.notes} onChange={(e) => onChange({...form, notes: e.target.value})} placeholder="Notes" className="col-span-2 rounded border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div className="mt-2 flex gap-2">
          <button onClick={onSave} disabled={saving} className="flex items-center gap-1 rounded bg-gray-900 px-3 py-1.5 text-xs text-white disabled:opacity-50">
            <Check className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onCancel} className="flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600">
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

function VisitRow({outlet, form, onChange, onSave, onCancel, saving}: {
  outlet: Outlet;
  form: {date: string; notes: string; salesperson: string};
  onChange: (f: {date: string; notes: string; salesperson: string}) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <tr className="bg-blue-50">
      <td colSpan={6} className="px-4 py-3">
        <p className="mb-2 text-sm font-medium text-blue-800">Log visit for <span className="font-bold">{outlet.name}</span></p>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={form.date} onChange={(e) => onChange({...form, date: e.target.value})} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
          <input value={form.salesperson} onChange={(e) => onChange({...form, salesperson: e.target.value})} placeholder="Salesperson name" className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
          <input value={form.notes} onChange={(e) => onChange({...form, notes: e.target.value})} placeholder="Notes (optional)" className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div className="mt-2 flex gap-2">
          <button onClick={onSave} disabled={saving} className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs text-white disabled:opacity-50">
            <Check className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Log Visit'}
          </button>
          <button onClick={onCancel} className="flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600">
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}
