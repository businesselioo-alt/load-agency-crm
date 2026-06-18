'use client';

import { useState } from 'react';
import { Plus, TrendingUp, Euro, DollarSign } from 'lucide-react';
import { MODELS, INVOICES, Invoice, Platform, Currency } from '@/lib/data';

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '€',
  GBP: '£',
  USD: '$',
};

const PLATFORM_COLORS: Record<Platform, string> = {
  MYM: 'bg-purple-100 text-purple-700',
  OF: 'bg-blue-100 text-blue-700',
  Reveal: 'bg-emerald-100 text-emerald-700',
};

export default function InvoicesTab() {
  const [invoices, setInvoices] = useState<Invoice[]>(INVOICES);
  const [showForm, setShowForm] = useState(false);
  const [filterModel, setFilterModel] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<Platform | ''>('');
  const [form, setForm] = useState({
    modelId: '',
    amount: '',
    platform: 'MYM' as Platform,
    currency: 'EUR' as Currency,
    date: new Date().toISOString().split('T')[0],
    period: '',
    notes: '',
  });

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.modelId || !form.amount) return;
    const newInvoice: Invoice = {
      id: `inv${Date.now()}`,
      modelId: form.modelId,
      amount: parseFloat(form.amount),
      platform: form.platform,
      currency: form.currency,
      date: form.date,
      period: form.period || form.date.substring(0, 7),
      notes: form.notes || undefined,
    };
    setInvoices((prev) => [newInvoice, ...prev]);
    setForm({ modelId: '', amount: '', platform: 'MYM', currency: 'EUR', date: new Date().toISOString().split('T')[0], period: '', notes: '' });
    setShowForm(false);
  };

  const filtered = invoices.filter((inv) => {
    const matchModel = !filterModel || inv.modelId === filterModel;
    const matchPlat = !filterPlatform || inv.platform === filterPlatform;
    return matchModel && matchPlat;
  });

  const totalEUR = filtered.filter((i) => i.currency === 'EUR').reduce((s, i) => s + i.amount, 0);
  const totalGBP = filtered.filter((i) => i.currency === 'GBP').reduce((s, i) => s + i.amount, 0);
  const totalUSD = filtered.filter((i) => i.currency === 'USD').reduce((s, i) => s + i.amount, 0);

  const getModelName = (id: string) => MODELS.find((m) => m.id === id)?.name ?? id;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total EUR', value: totalEUR, symbol: '€', color: 'text-[#a855f7]', bg: 'bg-[#a855f7]/5', border: 'border-[#a855f7]/10' },
          { label: 'Total GBP', value: totalGBP, symbol: '£', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Total USD', value: totalUSD, symbol: '$', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-4`}>
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>
              {s.symbol}{s.value.toLocaleString('fr-FR')}
            </p>
          </div>
        ))}
      </div>

      {/* Filters + Add */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterModel}
          onChange={(e) => setFilterModel(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7] cursor-pointer"
        >
          <option value="">Toutes les models</option>
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value as Platform | '')}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7] cursor-pointer"
        >
          <option value="">Toutes les plateformes</option>
          {(['MYM', 'OF', 'Reveal'] as Platform[]).map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button
          onClick={() => setShowForm(!showForm)}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-[#a855f7] text-white rounded-xl text-sm font-medium hover:bg-[#9333ea] transition"
        >
          <Plus size={16} />
          Saisir un paiement
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Nouveau paiement</h3>
          <form onSubmit={submitForm} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Model *</label>
              <select
                required
                value={form.modelId}
                onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/10"
              >
                <option value="">Sélectionner une model</option>
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Plateforme *</label>
              <select
                value={form.platform}
                onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value as Platform }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/10"
              >
                {(['MYM', 'OF', 'Reveal'] as Platform[]).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Montant *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Devise *</label>
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value as Currency }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/10"
              >
                {(['EUR', 'GBP', 'USD'] as Currency[]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Période</label>
              <input
                type="text"
                placeholder="ex: Mai 2026"
                value={form.period}
                onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/10"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes</label>
              <textarea
                rows={2}
                placeholder="Notes optionnelles..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/10 resize-none"
              />
            </div>
            <div className="col-span-2 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 text-gray-600 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#a855f7] text-white rounded-xl text-sm font-medium hover:bg-[#9333ea] transition"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Model</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plateforme</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Montant</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Commission</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Période</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((inv) => {
                const model = MODELS.find((m) => m.id === inv.modelId);
                const commission = model ? (inv.amount * model.commission) / 100 : 0;
                const sym = CURRENCY_SYMBOLS[inv.currency];
                return (
                  <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="text-sm font-medium text-gray-900">{getModelName(inv.modelId)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PLATFORM_COLORS[inv.platform]}`}>
                        {inv.platform}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-semibold text-gray-900">
                        {sym}{inv.amount.toLocaleString('fr-FR')} {inv.currency}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-medium text-[#a855f7]">
                        {sym}{commission.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-600">{inv.period}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-500">
                        {new Date(inv.date).toLocaleDateString('fr-FR')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">Aucune facture trouvée</div>
        )}
      </div>
    </div>
  );
}
