'use client';

import { useState, useEffect } from 'react';
import { Check, X, Edit2, Eye, EyeOff } from 'lucide-react';
import { MODELS } from '@/lib/data';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnnexData {
  dateAdded:              string;
  launched:               boolean;
  fullName:               string;
  placeOfBirth:           string;
  dateOfBirth:            string;
  fullAddress:            string;
  phoneNumber:            string;
  mainContact:            string;
  emailAddress:           string;
  instagramLink:          string;
  platformAccount:        string;
  username:               string;
  mymEmail:               string;
  mymPassword:            string;
  ofEmail:                string;
  ofPassword:             string;
  companyName:            string;
  companyType:            string;
  companyCountry:         string;
  headOfficeAddress:      string;
  companyRegNumber:       string;
  recruitedBy:            string;
  managedBy:              string;
  affiliationOwner:       string;
  comments:               string;
}

const EMPTY: AnnexData = {
  dateAdded: '', launched: false, fullName: '', placeOfBirth: '', dateOfBirth: '',
  fullAddress: '', phoneNumber: '', mainContact: '', emailAddress: '', instagramLink: '',
  platformAccount: '', username: '', mymEmail: '', mymPassword: '', ofEmail: '', ofPassword: '',
  companyName: '', companyType: '', companyCountry: '', headOfficeAddress: '', companyRegNumber: '',
  recruitedBy: '', managedBy: '', affiliationOwner: '', comments: '',
};

const LS_KEY = 'crm_model_annex_v1';

function loadAnnex(): Record<string, AnnexData> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}
function saveAnnex(data: Record<string, AnnexData>) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

// ─── Field groups ─────────────────────────────────────────────────────────────

interface Field {
  key: keyof AnnexData;
  label: string;
  type?: 'text' | 'date' | 'boolean' | 'password' | 'textarea' | 'url';
}

const FIELD_GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: 'Informations générales',
    fields: [
      { key: 'dateAdded',    label: 'Date Added',    type: 'date' },
      { key: 'launched',     label: 'Launched ?',    type: 'boolean' },
      { key: 'fullName',     label: 'Full Name' },
      { key: 'dateOfBirth',  label: 'Date of Birth', type: 'date' },
      { key: 'placeOfBirth', label: 'Place of Birth' },
      { key: 'fullAddress',  label: 'Full Address',  type: 'textarea' },
      { key: 'phoneNumber',  label: 'Phone Number' },
      { key: 'mainContact',  label: 'Main Contact' },
      { key: 'emailAddress', label: 'Email Address', type: 'url' },
    ],
  },
  {
    title: 'Réseaux & Plateformes',
    fields: [
      { key: 'instagramLink',   label: 'Instagram Link',    type: 'url' },
      { key: 'platformAccount', label: 'Platform Account' },
      { key: 'username',        label: 'Username' },
    ],
  },
  {
    title: 'Identifiants plateformes',
    fields: [
      { key: 'mymEmail',    label: 'MYM Email' },
      { key: 'mymPassword', label: 'MYM Password', type: 'password' },
      { key: 'ofEmail',     label: 'OF Email' },
      { key: 'ofPassword',  label: 'OF Password',  type: 'password' },
    ],
  },
  {
    title: 'Société',
    fields: [
      { key: 'companyName',        label: 'Company Name' },
      { key: 'companyType',        label: 'Type of Company' },
      { key: 'companyCountry',     label: 'Country of Company' },
      { key: 'headOfficeAddress',  label: 'Head Office Address', type: 'textarea' },
      { key: 'companyRegNumber',   label: 'Company Registration Number' },
    ],
  },
  {
    title: 'Agence',
    fields: [
      { key: 'recruitedBy',      label: 'Recruited By' },
      { key: 'managedBy',        label: 'Managed By' },
      { key: 'affiliationOwner', label: 'Affiliation Owner' },
    ],
  },
  {
    title: 'Commentaires',
    fields: [
      { key: 'comments', label: 'Comments', type: 'textarea' },
    ],
  },
];

// ─── Field row ─────────────────────────────────────────────────────────────────

function FieldRow({
  field,
  value,
  editing,
  onChange,
}: {
  field: Field;
  value: string | boolean;
  editing: boolean;
  onChange: (val: string | boolean) => void;
}) {
  const [showPass, setShowPass] = useState(false);

  const displayValue = () => {
    if (field.type === 'boolean') {
      return (value as boolean)
        ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium">✓ Oui</span>
        : <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded-lg text-xs font-medium">— Non</span>;
    }
    if (field.type === 'password' && value) {
      return <span className="font-mono text-gray-400 text-sm">{'•'.repeat(8)}</span>;
    }
    if (field.type === 'url' && value) {
      return (
        <a href={value as string} target="_blank" rel="noopener noreferrer"
          className="text-[#a855f7] hover:underline text-sm truncate max-w-xs inline-block">
          {value as string}
        </a>
      );
    }
    return value ? (
      <span className={`text-sm text-gray-900 ${field.type === 'textarea' ? 'whitespace-pre-wrap' : ''}`}>{value as string}</span>
    ) : (
      <span className="text-gray-300 text-sm">—</span>
    );
  };

  const editInput = () => {
    if (field.type === 'boolean') {
      return (
        <button
          type="button"
          onClick={() => onChange(!(value as boolean))}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
            value
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
              : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${value ? 'bg-emerald-500' : 'bg-gray-300'}`} />
          {value ? 'Oui' : 'Non'}
        </button>
      );
    }
    if (field.type === 'textarea') {
      return (
        <textarea
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-[#a855f7] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#a855f7]/10 resize-none"
        />
      );
    }
    if (field.type === 'password') {
      return (
        <div className="relative w-64">
          <input
            type={showPass ? 'text' : 'password'}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 pr-9 border border-[#a855f7] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#a855f7]/10 font-mono"
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      );
    }
    if (field.type === 'date') {
      return (
        <input
          type="date"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          className="px-3 py-2 border border-[#a855f7] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#a855f7]/10"
        />
      );
    }
    return (
      <input
        type="text"
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-xs px-3 py-2 border border-[#a855f7] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#a855f7]/10"
      />
    );
  };

  return (
    <div className="flex items-start gap-4 py-3 border-b border-gray-50 last:border-0">
      <div className="w-48 flex-shrink-0 pt-0.5">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{field.label}</span>
      </div>
      <div className="flex-1 min-w-0">
        {editing ? editInput() : displayValue()}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnnexTab() {
  const [annexMap, setAnnexMap] = useState<Record<string, AnnexData>>({});
  const [selectedId, setSelectedId] = useState<string>(MODELS[0]?.id ?? '');
  const [editing, setEditing] = useState(false);
  const [draftData, setDraftData] = useState<AnnexData>(EMPTY);

  useEffect(() => {
    setAnnexMap(loadAnnex());
  }, []);

  const currentData = annexMap[selectedId] ?? EMPTY;

  const startEdit = () => {
    setDraftData({ ...currentData });
    setEditing(true);
  };

  const saveEdit = () => {
    const updated = { ...annexMap, [selectedId]: draftData };
    setAnnexMap(updated);
    saveAnnex(updated);
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  const handleFieldChange = (key: keyof AnnexData, val: string | boolean) => {
    setDraftData((d) => ({ ...d, [key]: val }));
  };

  const selectedModel = MODELS.find((m) => m.id === selectedId);
  const activeData = editing ? draftData : currentData;

  const filledCount = Object.values(currentData).filter((v) => v !== '' && v !== false).length;

  return (
    <div className="flex gap-5 min-h-[60vh]">
      {/* ── Model list ── */}
      <aside className="w-48 flex-shrink-0">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Models</p>
          </div>
          <div className="divide-y divide-gray-50">
            {MODELS.map((model) => {
              const isSelected = selectedId === model.id;
              const hasData = Object.values(annexMap[model.id] ?? {}).some((v) => v !== '' && v !== false);
              return (
                <button
                  key={model.id}
                  onClick={() => { setSelectedId(model.id); setEditing(false); }}
                  className={`flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-[#a855f7]/5 text-[#a855f7] font-semibold'
                      : 'text-gray-600 hover:bg-gray-50 font-medium'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hasData ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                  <span className="truncate">{model.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── Annex form ── */}
      <div className="flex-1 min-w-0">
        {selectedModel ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#a855f7]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#a855f7] text-sm font-bold">{selectedModel.name.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{selectedModel.name}</p>
                  <p className="text-xs text-gray-400">{filledCount} / {Object.keys(EMPTY).length} champs remplis</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                    >
                      <X size={14} /> Annuler
                    </button>
                    <button
                      onClick={saveEdit}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#a855f7] rounded-xl hover:bg-[#9333ea] transition"
                    >
                      <Check size={14} /> Enregistrer
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startEdit}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#a855f7] rounded-xl hover:bg-[#9333ea] transition"
                  >
                    <Edit2 size={14} /> Modifier
                  </button>
                )}
              </div>
            </div>

            {/* Fields */}
            <div className="px-6 py-2 divide-y divide-gray-50">
              {FIELD_GROUPS.map((group) => (
                <div key={group.title} className="py-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{group.title}</h3>
                  <div>
                    {group.fields.map((field) => (
                      <FieldRow
                        key={field.key}
                        field={field}
                        value={activeData[field.key] as string | boolean}
                        editing={editing}
                        onChange={(val) => handleFieldChange(field.key, val)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            Sélectionnez une model
          </div>
        )}
      </div>
    </div>
  );
}
