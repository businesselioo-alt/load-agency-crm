'use client';

import { useState } from 'react';
import { Plus, Loader2, CalendarClock } from 'lucide-react';
import {
  CATEGORY_BY_KEY, ContentEntry, ContentRequest,
  REQUEST_STATUS_LABELS, REQUEST_STATUS_STYLES,
  formatDay, isActionable, progressOf,
} from '@/lib/contenu';
import { NumberInput } from '@/components/compta/ui';

/**
 * Ce que l'agence attend de la créatrice, affiché avant le tableau libre.
 *
 * Livrer depuis cette carte rattache le dépôt à la demande : c'est ce qui fait
 * avancer la barre de progression côté agence, sans qu'elle ait à cocher quoi
 * que ce soit.
 */
export default function ModelRequests({
  requests,
  entries,
  busy,
  onDeliver,
}: {
  requests: ContentRequest[];
  entries: ContentEntry[];
  busy: boolean;
  onDeliver: (request: ContentRequest, count: number) => void;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const open = requests
    .map((r) => progressOf(r, entries))
    .filter(isActionable)
    .sort((a, b) => {
      if (a.request.priority !== b.request.priority) {
        return a.request.priority === 'urgente' ? -1 : 1;
      }
      if (!a.request.dueAt) return 1;
      if (!b.request.dueAt) return -1;
      return a.request.dueAt.localeCompare(b.request.dueAt);
    });

  if (open.length === 0) return null;

  return (
    <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1a1a1a]">
        <p className="text-sm font-semibold text-white">
          Demandes de l&apos;agence ({open.length})
        </p>
        <p className="text-[11px] text-[#555]">
          Dépose le contenu sur ton Drive, puis clique « Livrer » sur la demande correspondante.
        </p>
      </div>

      <div className="divide-y divide-[#161616]">
        {open.map((p) => {
          const r = p.request;
          const cat = CATEGORY_BY_KEY[r.category];
          const st = REQUEST_STATUS_STYLES[p.effective];
          const count = counts[r.id] ?? 1;

          return (
            <div key={r.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-48">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-sm text-white">{cat?.label ?? r.category}</span>
                    {r.priority === 'urgente' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/15 text-red-300 border border-red-500/25">
                        URGENT
                      </span>
                    )}
                    <span
                      className="px-2 py-0.5 rounded-lg text-[10px] font-medium border"
                      style={{ color: st.text, backgroundColor: st.bg, borderColor: st.border }}
                    >
                      {REQUEST_STATUS_LABELS[p.effective]}
                    </span>
                    {r.dueAt && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#666]">
                        <CalendarClock size={12} />
                        {formatDay(r.dueAt)}
                        {p.daysLeft !== null &&
                          (p.daysLeft < 0
                            ? ` · ${-p.daysLeft} j de retard`
                            : p.daysLeft === 0
                              ? " · aujourd'hui"
                              : ` · dans ${p.daysLeft} j`)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-1.5 w-40 bg-[#1a1a1a] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${p.percent}%`, backgroundColor: st.text }}
                      />
                    </div>
                    <span className="text-[11px] text-[#777]">
                      {p.delivered} / {r.quantity} — il en reste {p.remaining}
                    </span>
                  </div>

                  {r.brief && (
                    <p className="mt-2 px-3 py-2 rounded-xl bg-[#0f0f0f] border border-[#1f1f1f] text-[12px] text-[#999] whitespace-pre-wrap leading-relaxed">
                      {r.brief}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <NumberInput
                    min={1}
                    max={50}
                    value={count}
                    onValueChange={(n) => setCounts((c) => ({ ...c, [r.id]: n }))}
                    className="!w-14 !py-1.5 !px-2 text-center !text-xs"
                  />
                  <button
                    onClick={() => {
                      onDeliver(r, Math.min(Math.max(count, 1), 50));
                      setCounts((c) => ({ ...c, [r.id]: 1 }));
                    }}
                    disabled={busy}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#C9A84C] text-black hover:bg-[#d9b95c] transition disabled:opacity-40"
                  >
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    Livrer
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
