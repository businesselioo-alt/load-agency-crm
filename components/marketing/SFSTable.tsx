'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Check, Clock, Minus, Download, Upload, Plus,
  ChevronUp, ChevronDown, Edit2, X, Save,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  SFSRow, SFSSlot, SFSStatus,
  rowsToExcelData, parseExcelRows, EXCEL_TEMPLATE_HEADERS,
} from '@/lib/marketing-sfs';

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<SFSStatus, string> = {
  fait: 'bg-green-50 border-green-200 text-green-700',
  prévu: 'bg-orange-50 border-orange-200 text-orange-600',
  non_planifié: 'bg-gray-50 border-gray-200 text-gray-400',
};

const STATUS_ICON: Record<SFSStatus, React.ReactNode> = {
  fait: <Check size={10} strokeWidth={3} />,
  prévu: <Clock size={10} />,
  non_planifié: <Minus size={10} />,
};

function SFSCell({ slot }: { slot: SFSSlot | null }) {
  if (!slot) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-gray-200 text-gray-300 text-xs">
        <Minus size={10} />
        —
      </span>
    );
  }
  return (
    <div className={`inline-flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg border text-xs min-w-24 ${STATUS_STYLE[slot.status]}`}>
      <div className="flex items-center gap-1 font-semibold">
        {STATUS_ICON[slot.status]}
        {slot.date}
      </div>
      {slot.chatter && (
        <span className="opacity-70 text-[11px]">{slot.chatter}</span>
      )}
      {slot.target && (
        <span className="font-medium text-[11px]">↳ {slot.target}</span>
      )}
    </div>
  );
}

// ─── Editable SFS slot ─────────────────────────────────────────────────────────

function SFSSlotEditor({
  slot,
  onChange,
}: {
  slot: SFSSlot | null;
  onChange: (s: SFSSlot | null) => void;
}) {
  const v = slot ?? { date: '', chatter: '', target: '', status: 'prévu' as SFSStatus };
  return (
    <div className="flex flex-col gap-1 min-w-28">
      <input
        className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs focus:border-[#a855f7] outline-none"
        placeholder="Date"
        value={v.date}
        onChange={(e) => onChange(e.target.value ? { ...v, date: e.target.value } : null)}
      />
      <input
        className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs focus:border-[#a855f7] outline-none"
        placeholder="Chatter"
        value={v.chatter ?? ''}
        onChange={(e) => onChange({ ...v, chatter: e.target.value || undefined })}
      />
      <input
        className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs focus:border-[#a855f7] outline-none"
        placeholder="Cible"
        value={v.target ?? ''}
        onChange={(e) => onChange({ ...v, target: e.target.value || undefined })}
      />
      <select
        className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs focus:border-[#a855f7] outline-none cursor-pointer"
        value={v.status}
        onChange={(e) => onChange({ ...v, status: e.target.value as SFSStatus })}
      >
        <option value="fait">✅ Fait</option>
        <option value="prévu">🕐 Prévu</option>
        <option value="non_planifié">— Non planifié</option>
      </select>
    </div>
  );
}

// ─── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ rows }: { rows: SFSRow[] }) {
  const totalSubs = rows.reduce((s, r) => s + r.subscribers, 0);
  const nudgeCount = rows.filter((r) => r.nudgeActive).length;
  const faitCount = rows.filter(
    (r) => r.sfs1?.status === 'fait' || r.sfs2?.status === 'fait' || r.sfs3?.status === 'fait'
  ).length;
  const prevuCount = rows.filter(
    (r) => r.sfs1?.status === 'prévu' || r.sfs2?.status === 'prévu' || r.sfs3?.status === 'prévu'
  ).length;

  return (
    <div className="grid grid-cols-4 gap-3 mb-4">
      {[
        { label: 'Total abonnés', value: totalSubs.toLocaleString('fr-FR'), color: 'text-[#a855f7]', bg: 'bg-[#a855f7]/5', border: 'border-[#a855f7]/10' },
        { label: 'SFS réalisés', value: faitCount, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
        { label: 'SFS prévus', value: prevuCount, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' },
        { label: 'Nudge actif', value: nudgeCount, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
      ].map((s) => (
        <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl px-4 py-3`}>
          <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main table ────────────────────────────────────────────────────────────────

type SortKey = 'subscribers' | 'firstName' | 'pseudo' | 'lastSFS';

interface SFSTableProps {
  initialRows: SFSRow[];
  platform: 'MYM' | 'OF';
}

export default function SFSTable({ initialRows, platform }: SFSTableProps) {
  const [rows, setRows] = useState<SFSRow[]>(initialRows);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SFSRow | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('subscribers');
  const [sortAsc, setSortAsc] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Sorting ──
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = [...rows]
    .filter((r) => {
      const q = search.toLowerCase();
      return !q || r.pseudo.toLowerCase().includes(q) || r.firstName.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let va: string | number, vb: string | number;
      if (sortKey === 'subscribers') { va = a.subscribers; vb = b.subscribers; }
      else if (sortKey === 'firstName') { va = a.firstName; vb = b.firstName; }
      else if (sortKey === 'pseudo') { va = a.pseudo; vb = b.pseudo; }
      else { va = a.lastSFS; vb = b.lastSFS; }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

  // ── Edit helpers ──
  const startEdit = (row: SFSRow) => { setEditingId(row.id); setEditForm({ ...row }); };
  const cancelEdit = () => { setEditingId(null); setEditForm(null); };
  const saveEdit = () => {
    if (!editForm) return;
    setRows((prev) => prev.map((r) => (r.id === editForm.id ? editForm : r)));
    setEditingId(null);
    setEditForm(null);
  };

  // ── Add row ──
  const [newRow, setNewRow] = useState<Partial<SFSRow>>({});
  const addRow = () => {
    if (!newRow.pseudo) return;
    setRows((prev) => [
      ...prev,
      {
        id: `${platform.toLowerCase()}_${Date.now()}`,
        pseudo: newRow.pseudo ?? '',
        firstName: newRow.firstName ?? '',
        subscribers: newRow.subscribers ?? 0,
        formerSubscribers: newRow.formerSubscribers ?? 0,
        interested: newRow.interested ?? null,
        lastSFS: newRow.lastSFS ?? '',
        sfs1: null, sfs2: null, sfs3: null,
        nudgeActive: false,
      },
    ]);
    setNewRow({});
    setShowAddForm(false);
  };

  // ── Excel import ──
  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
        const imported = parseExcelRows(json);
        if (imported.length > 0) {
          setRows((prev) => {
            const existing = new Set(prev.map((r) => r.pseudo.toLowerCase()));
            const newOnes = imported.filter((r) => !existing.has(r.pseudo.toLowerCase()));
            const updated = prev.map((r) => {
              const match = imported.find((i) => i.pseudo.toLowerCase() === r.pseudo.toLowerCase());
              return match ? { ...r, ...match, id: r.id } : r;
            });
            return [...updated, ...newOnes];
          });
        }
      } catch {
        alert('Erreur lors de la lecture du fichier. Vérifiez le format.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }, []);

  // ── Excel export ──
  const exportExcel = () => {
    const data = rowsToExcelData(rows);
    const ws = XLSX.utils.json_to_sheet(data, { header: EXCEL_TEMPLATE_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `SFS ${platform}`);
    XLSX.writeFile(wb, `SFS_${platform}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ── Download template ──
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      EXCEL_TEMPLATE_HEADERS,
      ['lenajns', 'Jazz', 16165, 15131, 21083, '08/06', '11/06', 'Abzerty', 'Lou 16k4', 'prévu', '13/06', '', 'Lou', 'prévu', '15/06', '', 'Lou', 'prévu', 'oui'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `Template_SFS_${platform}.xlsx`);
  };

  // ── Sort icon ──
  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortAsc ? <ChevronUp size={13} className="text-[#a855f7]" /> : <ChevronDown size={13} className="text-[#a855f7]" />
    ) : (
      <ChevronDown size={13} className="text-gray-300" />
    );

  return (
    <div className="space-y-4">
      <StatsBar rows={rows} />

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Rechercher pseudo ou prénom…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-40 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/10 transition"
        />
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-[#a855f7] hover:text-[#a855f7] transition"
        >
          <Plus size={15} />
          Ajouter
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#a855f7] text-white rounded-xl text-sm font-medium hover:bg-[#9333ea] transition"
        >
          <Upload size={15} />
          Import Excel
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileImport} />
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-500 hover:text-gray-800 transition"
          title="Télécharger le modèle Excel"
        >
          <Download size={15} />
          Modèle
        </button>
        <button
          onClick={exportExcel}
          className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-500 hover:text-gray-800 transition"
          title="Exporter en Excel"
        >
          <Download size={15} />
          Exporter
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">Nouvelle ligne</p>
          <div className="grid grid-cols-6 gap-3">
            {[
              { k: 'pseudo', placeholder: 'Pseudo *', type: 'text' },
              { k: 'firstName', placeholder: 'Prénom', type: 'text' },
              { k: 'subscribers', placeholder: 'Abonnés', type: 'number' },
              { k: 'formerSubscribers', placeholder: 'Anciens', type: 'number' },
              { k: 'interested', placeholder: 'Intéressés', type: 'number' },
              { k: 'lastSFS', placeholder: 'Dernier SFS', type: 'text' },
            ].map(({ k, placeholder, type }) => (
              <input
                key={k}
                type={type}
                placeholder={placeholder}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7]"
                value={(newRow[k as keyof SFSRow] as string | number) ?? ''}
                onChange={(e) => setNewRow((n) => ({
                  ...n,
                  [k]: type === 'number' ? parseInt(e.target.value) || 0 : e.target.value,
                }))}
              />
            ))}
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Annuler</button>
            <button onClick={addRow} className="px-4 py-2 text-sm bg-[#a855f7] text-white rounded-xl hover:bg-[#9333ea] transition font-medium">Ajouter</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {/* Sticky pseudo + prénom */}
                <th
                  className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                  onClick={() => toggleSort('pseudo')}
                >
                  <span className="flex items-center gap-1">Pseudo <SortIcon k="pseudo" /></span>
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                  onClick={() => toggleSort('firstName')}
                >
                  <span className="flex items-center gap-1">Prénom <SortIcon k="firstName" /></span>
                </th>
                <th
                  className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                  onClick={() => toggleSort('subscribers')}
                >
                  <span className="flex items-center justify-end gap-1">Abonnés <SortIcon k="subscribers" /></span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Anciens</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Intéressés</th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                  onClick={() => toggleSort('lastSFS')}
                >
                  <span className="flex items-center gap-1">Dernier SFS <SortIcon k="lastSFS" /></span>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">SFS 1</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">SFS 2</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">SFS 3</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Nudge</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((row) => {
                const isEditing = editingId === row.id;
                const ef = editForm;

                if (isEditing && ef) {
                  return (
                    <tr key={row.id} className="bg-[#a855f7]/3 border-l-2 border-[#a855f7]">
                      <td className="px-4 py-3">
                        <input className="w-28 px-2 py-1 border border-[#a855f7] rounded-lg text-xs" value={ef.pseudo} onChange={(e) => setEditForm({ ...ef, pseudo: e.target.value })} />
                      </td>
                      <td className="px-4 py-3">
                        <input className="w-28 px-2 py-1 border border-[#a855f7] rounded-lg text-xs" value={ef.firstName} onChange={(e) => setEditForm({ ...ef, firstName: e.target.value })} />
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" className="w-20 px-2 py-1 border border-[#a855f7] rounded-lg text-xs text-right" value={ef.subscribers} onChange={(e) => setEditForm({ ...ef, subscribers: parseInt(e.target.value) || 0 })} />
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" className="w-20 px-2 py-1 border border-[#a855f7] rounded-lg text-xs text-right" value={ef.formerSubscribers} onChange={(e) => setEditForm({ ...ef, formerSubscribers: parseInt(e.target.value) || 0 })} />
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" className="w-20 px-2 py-1 border border-[#a855f7] rounded-lg text-xs text-right" value={ef.interested ?? ''} onChange={(e) => setEditForm({ ...ef, interested: parseInt(e.target.value) || null })} />
                      </td>
                      <td className="px-4 py-3">
                        <input className="w-20 px-2 py-1 border border-[#a855f7] rounded-lg text-xs" value={ef.lastSFS} onChange={(e) => setEditForm({ ...ef, lastSFS: e.target.value })} />
                      </td>
                      <td className="px-4 py-3">
                        <SFSSlotEditor slot={ef.sfs1} onChange={(s) => setEditForm({ ...ef, sfs1: s })} />
                      </td>
                      <td className="px-4 py-3">
                        <SFSSlotEditor slot={ef.sfs2} onChange={(s) => setEditForm({ ...ef, sfs2: s })} />
                      </td>
                      <td className="px-4 py-3">
                        <SFSSlotEditor slot={ef.sfs3} onChange={(s) => setEditForm({ ...ef, sfs3: s })} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setEditForm({ ...ef, nudgeActive: !ef.nudgeActive })}
                          className={`w-8 h-4 rounded-full transition-colors relative ${ef.nudgeActive ? 'bg-green-500' : 'bg-gray-200'}`}
                        >
                          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${ef.nudgeActive ? 'left-4' : 'left-0.5'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-center">
                          <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition"><Save size={14} /></button>
                          <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition"><X size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-700 text-xs whitespace-nowrap">{row.pseudo}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{row.firstName}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-gray-900">{row.subscribers.toLocaleString('fr-FR')}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">{row.formerSubscribers.toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">
                      {row.interested != null ? row.interested.toLocaleString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {row.lastSFS ? (
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">{row.lastSFS}</span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><SFSCell slot={row.sfs1} /></td>
                    <td className="px-4 py-3"><SFSCell slot={row.sfs2} /></td>
                    <td className="px-4 py-3"><SFSCell slot={row.sfs3} /></td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${row.nudgeActive ? 'bg-green-500 shadow-sm shadow-green-200' : 'bg-gray-300'}`} title={row.nudgeActive ? 'Nudge actif' : 'Nudge inactif'} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => startEdit(row)}
                        className="p-1.5 text-gray-400 hover:text-[#a855f7] hover:bg-[#a855f7]/5 rounded-lg transition"
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {sorted.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">Aucune ligne trouvée</div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-400">{sorted.length} ligne{sorted.length > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" />Fait
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-400" />Prévu
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-300" />Non planifié
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
