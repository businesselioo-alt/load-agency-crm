'use client';

import { useState } from 'react';
import { ExternalLink, Plus, X, Check, Link2, Loader2, HardDrive } from 'lucide-react';
import { Model } from '@/lib/data';
import {
  CategoryStat, ContentCategory, ContentEntry, FolderDef,
  formatDay, statsFor,
} from '@/lib/contenu';
import { NumberInput } from '@/components/compta/ui';

/**
 * Une carte par modèle : ses dossiers Drive, le nombre déposé sur le mois
 * affiché, et le bouton d'ajout.
 *
 * La même carte sert à l'agence et à la créatrice. Côté créatrice, les
 * nouveautés ne sont pas mises en évidence (elles le sont pour celui qui doit
 * les découvrir) et le lien Drive n'est pas modifiable.
 */
export default function ContentCard({
  model,
  entries,
  folders,
  month,
  mode,
  busy,
  onAdd,
  onDelete,
  onMarkSeen,
  onSaveDrive,
}: {
  model: Model;
  entries: ContentEntry[];
  folders: FolderDef[];
  month: string;
  mode: 'agence' | 'modele';
  busy: boolean;
  onAdd: (category: ContentCategory, count: number) => void;
  onDelete: (entry: ContentEntry) => void;
  onMarkSeen: (ids: string[]) => void;
  onSaveDrive: (url: string) => void;
}) {
  const [counts, setCounts] = useState<Partial<Record<ContentCategory, number>>>({});
  const [editingDrive, setEditingDrive] = useState(false);
  const [driveDraft, setDriveDraft] = useState(model.driveLink ?? '');

  const stats = statsFor(entries, month, folders);
  const isAgency = mode === 'agence';
  const unseenIds = isAgency
    ? entries.filter((e) => !e.seen && e.addedAt.slice(0, 7) === month).map((e) => e.id)
    : [];
  const monthTotal = stats.reduce((s, c) => s + c.entriesInMonth.length, 0);

  const countFor = (k: ContentCategory) => counts[k] ?? 1;

  return (
    <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-[#1a1a1a]">
        <div className="flex-1 min-w-40">
          <p className="text-sm font-semibold text-white">{model.name}</p>
          <p className="text-[11px] text-[#555]">
            {monthTotal === 0
              ? 'Rien déposé sur ce mois'
              : `${monthTotal} dépôt${monthTotal > 1 ? 's' : ''} ce mois`}
          </p>
        </div>

        {unseenIds.length > 0 && (
          <>
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30">
              {unseenIds.length} nouveauté{unseenIds.length > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => onMarkSeen(unseenIds)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] text-[#666] border border-[#2a2a2a] hover:text-white hover:border-[#3a3a3a] transition disabled:opacity-40"
            >
              <Check size={12} />
              Tout marquer vu
            </button>
          </>
        )}

        {editingDrive ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={driveDraft}
              onChange={(e) => setDriveDraft(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-72 px-3 py-1.5 bg-[#0f0f0f] border border-[#222] rounded-lg text-xs text-white placeholder:text-[#444] outline-none focus:border-[#C9A84C]/60"
            />
            <button
              onClick={() => {
                onSaveDrive(driveDraft);
                setEditingDrive(false);
              }}
              className="px-2.5 py-1.5 rounded-lg text-[11px] bg-[#C9A84C] text-black font-semibold hover:bg-[#d9b95c] transition"
            >
              Enregistrer
            </button>
            <button
              onClick={() => {
                setDriveDraft(model.driveLink ?? '');
                setEditingDrive(false);
              }}
              className="px-2 py-1.5 text-[11px] text-[#666] hover:text-white transition"
            >
              Annuler
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {model.driveLink && (
              <a
                href={model.driveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-[#C9A84C] border border-[#C9A84C]/30 hover:bg-[#C9A84C]/10 transition"
              >
                <ExternalLink size={12} />
                Drive
              </a>
            )}
            {isAgency && (
              <button
                onClick={() => setEditingDrive(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-[#555] border border-[#222] hover:text-[#999] transition"
              >
                <Link2 size={12} />
                {model.driveLink ? 'Modifier' : 'Ajouter le lien Drive'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="divide-y divide-[#161616]">
        {stats.map((s) => (
          <CategoryRow
            key={s.category.key}
            stat={s}
            isAgency={isAgency}
            busy={busy}
            count={countFor(s.category.key)}
            onCountChange={(n) => setCounts((c) => ({ ...c, [s.category.key]: n }))}
            onAdd={() => {
              onAdd(s.category.key, Math.min(Math.max(countFor(s.category.key), 1), 50));
              setCounts((c) => ({ ...c, [s.category.key]: 1 }));
            }}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryRow({
  stat,
  isAgency,
  busy,
  count,
  onCountChange,
  onAdd,
  onDelete,
}: {
  stat: CategoryStat;
  isAgency: boolean;
  busy: boolean;
  count: number;
  onCountChange: (n: number) => void;
  onAdd: () => void;
  onDelete: (entry: ContentEntry) => void;
}) {
  const { category, entriesInMonth, total, lastAddedAt, unseen } = stat;
  const [expanded, setExpanded] = useState(false);

  // Une créatrice active dépose des dizaines de fichiers par mois : tout
  // afficher transforme la ligne en pavé et oblige à scroller pour atteindre la
  // catégorie suivante. On montre les derniers, le reste au clic.
  const MAX_VISIBLE = 12;
  const overflow = entriesInMonth.length - MAX_VISIBLE;
  const shown = expanded ? entriesInMonth : entriesInMonth.slice(-MAX_VISIBLE);

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-[#141414] transition">
      <div className="w-44 flex-shrink-0">
        <p className="text-sm text-white">{category.label}</p>
        <p className="text-[10px] text-[#555]">
          {total === 0 ? 'aucun numéro' : `jusqu'à ${category.unit} ${total}`}
        </p>
      </div>

      <div className="w-20 flex-shrink-0">
        <span
          className={`text-sm font-semibold ${
            entriesInMonth.length > 0 ? 'text-[#C9A84C]' : 'text-[#333]'
          }`}
        >
          {entriesInMonth.length}
        </span>
        {isAgency && unseen > 0 && (
          <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[#C9A84C] align-middle" />
        )}
      </div>

      <div className="flex-1 min-w-48 flex flex-wrap gap-1.5">
        {entriesInMonth.length === 0 ? (
          <span className="text-[11px] text-[#333]">—</span>
        ) : (
          shown.map((e) => (
            <span
              key={e.id}
              title={[
                `${category.unit} ${e.seq}`,
                e.label,
                `ajouté le ${formatDay(e.addedAt)}`,
                e.source === 'drive' ? 'détecté sur le Drive' : e.addedBy ? `par ${e.addedBy}` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
              className={`group inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border ${
                isAgency && !e.seen
                  ? 'bg-[#C9A84C]/15 border-[#C9A84C]/30 text-[#C9A84C]'
                  : 'bg-[#161616] border-[#222] text-[#777]'
              }`}
            >
              {e.source === 'drive' && <HardDrive size={9} className="opacity-70" />}
              #{e.seq}
              <button
                onClick={() => onDelete(e)}
                disabled={busy}
                title="Supprimer ce dépôt"
                className="opacity-0 group-hover:opacity-100 transition text-[#666] hover:text-red-400 disabled:opacity-30"
              >
                <X size={11} />
              </button>
            </span>
          ))
        )}
        {!expanded && overflow > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="px-2 py-0.5 rounded-md text-[11px] border border-[#222] text-[#666] hover:text-white hover:border-[#333] transition"
          >
            +{overflow} autres
          </button>
        )}
        {expanded && overflow > 0 && (
          <button
            onClick={() => setExpanded(false)}
            className="px-2 py-0.5 rounded-md text-[11px] border border-[#222] text-[#666] hover:text-white hover:border-[#333] transition"
          >
            Replier
          </button>
        )}
      </div>

      <div className="w-20 flex-shrink-0 text-[10px] text-[#555]">{formatDay(lastAddedAt)}</div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <NumberInput
          min={1}
          max={50}
          value={count}
          onValueChange={onCountChange}
          className="!w-14 !py-1.5 !px-2 text-center !text-xs"
        />
        <button
          onClick={onAdd}
          disabled={busy}
          title={`Ajouter ${count} ${category.unit}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#C9A84C] text-black hover:bg-[#d9b95c] transition disabled:opacity-40"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Ajouter
        </button>
      </div>
    </div>
  );
}
