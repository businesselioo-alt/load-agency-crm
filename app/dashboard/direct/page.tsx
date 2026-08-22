'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Chatting direct — les ventes au fil de l'eau.
 *
 * Le dashboard répond à « combien ce mois-ci ». Cet écran répond à « que
 * vient-il de se passer » : la vente de la minute, la créatrice, le montant.
 *
 * Les données ne transitent pas par la base : elles viennent d'Infloww à chaque
 * chargement. Un fil de ventes dont les lignes auraient une heure d'âge ne
 * servirait à rien, et les conserver ferait double emploi avec la
 * synchronisation quotidienne.
 */

interface Sale {
  id: string;
  creator: string;
  fan: string;
  fanId: string;
  type: string;
  amount: number;
  at: string;
}

const RAFRAICHISSEMENT_MS = 60_000;

function heure(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function ilYA(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (isNaN(d)) return '';
  const min = Math.floor((Date.now() - d) / 60000);
  if (min < 1)  return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

const TYPE_COULEUR: Record<string, string> = {
  Tips:                 'text-emerald-400 bg-emerald-500/10',
  Messages:             'text-purple-400 bg-purple-500/10',
  Subscription:         'text-sky-400 bg-sky-500/10',
  RecurringSubscription:'text-[#888] bg-[#ffffff0d]',
};

export default function DirectPage() {
  const [sales, setSales]       = useState<Sale[]>([]);
  const [creators, setCreators] = useState<string[]>([]);
  const [filtre, setFiltre]     = useState<string>('');
  const [heures, setHeures]     = useState<number>(24);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur]     = useState<string>('');
  const [maj, setMaj]           = useState<Date | null>(null);

  const charger = useCallback(async (h: number) => {
    setChargement(true);
    try {
      const res  = await fetch(`/api/sales/recent?hours=${h}&limit=200`, { cache: 'no-store' });
      const json = await res.json();
      if (json.error) { setErreur(String(json.error)); return; }
      setSales(json.sales ?? []);
      setCreators(json.creators ?? []);
      setErreur((json.erreurs ?? []).join(' · '));
      setMaj(new Date());
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger(heures);
    const t = setInterval(() => charger(heures), RAFRAICHISSEMENT_MS);
    return () => clearInterval(t);
  }, [charger, heures]);

  const visibles = filtre ? sales.filter((s) => s.creator === filtre) : sales;
  const total    = visibles.reduce((s, v) => s + v.amount, 0);
  // Le nom du fan n'est pas garanti par l'API : on ne montre la colonne que si
  // au moins une vente en porte un, plutôt qu'une colonne de tirets.
  const aDesFans = visibles.some((s) => s.fan || s.fanId);

  const fmt = (n: number) => `$${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Chatting direct</h1>
          <p className="text-[#888] text-sm mt-1">
            Les dernières ventes, créatrice par créatrice
            {maj && <span className="text-[#555]"> · mis à jour à {heure(maj.toISOString())}</span>}
          </p>
        </div>
        <button
          onClick={() => charger(heures)}
          className="flex items-center gap-2 text-xs font-medium text-[#C9A84C] hover:text-[#E2C06A] transition border border-[#333] rounded-lg px-3 py-2"
        >
          <RefreshCw size={13} className={chargement ? 'animate-spin' : ''} />
          Rafraîchir
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
          className="bg-[#111] border border-[#333] rounded-lg text-sm text-white px-3 py-2"
        >
          <option value="">Toutes les créatrices</option>
          {creators.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={heures}
          onChange={(e) => setHeures(Number(e.target.value))}
          className="bg-[#111] border border-[#333] rounded-lg text-sm text-white px-3 py-2"
        >
          <option value={6}>6 dernières heures</option>
          <option value={24}>24 dernières heures</option>
          <option value={72}>3 derniers jours</option>
          <option value={168}>7 derniers jours</option>
        </select>

        <span className="ml-auto text-sm text-[#888]">
          <span className="text-white font-semibold">{visibles.length}</span> ventes ·{' '}
          <span className="text-white font-semibold">{fmt(total)}</span>
        </span>
      </div>

      {erreur && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {erreur}
        </div>
      )}

      <div className="bg-[#111] rounded-2xl border border-[#222] overflow-hidden">
        {chargement && sales.length === 0 ? (
          <p className="text-sm text-[#666] px-6 py-10 text-center">Chargement…</p>
        ) : visibles.length === 0 ? (
          <p className="text-sm text-[#666] px-6 py-10 text-center">
            Aucune vente sur cette période.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[#555] border-b border-[#222]">
                  <th className="text-left  font-semibold px-4 sm:px-6 py-2.5">Créatrice</th>
                  {aDesFans && <th className="text-left font-semibold px-3 py-2.5">Fan</th>}
                  <th className="text-left  font-semibold px-3 py-2.5">Type</th>
                  <th className="text-right font-semibold px-3 py-2.5">Montant</th>
                  <th className="text-right font-semibold px-4 sm:px-6 py-2.5">Quand</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((s) => (
                  <tr key={s.id} className="border-b border-[#1a1a1a] last:border-0 hover:bg-[#161616] transition">
                    <td className="px-4 sm:px-6 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-full bg-[#C9A84C]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[#C9A84C] text-xs font-bold">
                            {s.creator.charAt(0).toUpperCase()}
                          </span>
                        </span>
                        <span className="text-white truncate">{s.creator}</span>
                      </div>
                    </td>
                    {aDesFans && (
                      <td className="px-3 py-2.5 text-[#999] truncate max-w-[180px]">
                        {s.fan || s.fanId || '—'}
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        TYPE_COULEUR[s.type] ?? 'text-[#888] bg-[#ffffff0d]'
                      }`}>
                        {s.type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-white">
                      {fmt(s.amount)}
                    </td>
                    <td className="px-4 sm:px-6 py-2.5 text-right">
                      <span className="block text-white tabular-nums">{heure(s.at)}</span>
                      <span className="block text-[10px] text-[#666]">{ilYA(s.at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-[#555]">
        Rafraîchissement automatique toutes les minutes. Les ventes à montant nul
        (abonnements gratuits, écritures techniques) sont écartées.
      </p>
    </div>
  );
}
