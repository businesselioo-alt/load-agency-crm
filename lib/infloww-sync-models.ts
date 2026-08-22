import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreatorRef } from './infloww';
import { INFLOWW_OF_LEGACY } from './infloww-mapping';

/**
 * Création automatique des fiches créatrices depuis Infloww.
 *
 * L'identité est l'username OnlyFans, jamais le nom : il est unique, stable, et
 * c'est le seul point commun fiable entre les deux systèmes. Une créatrice dont
 * l'username est déjà présent dans une fiche — ou dans le mapping historique —
 * n'est jamais recréée, quel que soit le nom sous lequel elle apparaît.
 *
 * C'est ce qui rend le doublon structurellement impossible : le dashboard
 * additionne le chiffre d'affaires par fiche, et deux fiches pour une même
 * personne doubleraient son CA sans que rien ne le signale.
 */

type Row = Record<string, unknown>;

export interface SyncModelsResult {
  created: { id: string; name: string; userName: string }[];
  /** Usernames déjà rattachés à une fiche : rien à faire. */
  alreadyKnown: number;
  errors: string[];
}

/**
 * Le nom lisible d'une créatrice Infloww.
 *
 * Infloww préfixe ses comptes par le pôle (« FR Lou ») et laisse des emojis
 * dans les surnoms (« Lou 💕 »). On nettoie pour obtenir un nom utilisable tel
 * quel dans le CRM — et, accessoirement, qui retombe sur les noms historiques
 * déjà utilisés par le dashboard.
 */
export function displayNameOf(raw: Row): string {
  const candidate = String(raw.nickName ?? raw.name ?? raw.userName ?? '').trim();

  const cleaned = candidate
    // Emojis et symboles décoratifs
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, '')
    // Préfixe pays / pôle en tête : « FR Lou », « UK Emma »
    .replace(/^(FR|UK|US|AU|EU|CA)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || String(raw.userName ?? '').trim();
}

function nextId(existing: string[]): string {
  const max = existing.reduce((acc, id) => {
    const n = Number(/^m(\d+)$/.exec(id)?.[1] ?? 0);
    return n > acc ? n : acc;
  }, 0);
  return `m${max + 1}`;
}

/**
 * Crée une fiche pour chaque créatrice Infloww qu'aucune fiche ne réclame.
 *
 * La fiche produite est volontairement minimale : nom, plateforme OF, username.
 * Infloww ne connaît ni l'adresse, ni la date de naissance, ni le taux — les
 * inventer serait pire que les laisser vides, puisque la facturation refusera
 * d'émettre tant qu'ils manquent, ce qui est exactement le comportement voulu.
 */
export async function ensureModelsFromInfloww(
  supabase: SupabaseClient,
  creators: Map<string, CreatorRef>,
  rawByUserName: Map<string, Row>,
): Promise<SyncModelsResult> {
  const result: SyncModelsResult = { created: [], alreadyKnown: 0, errors: [] };
  if (creators.size === 0) return result;

  try {
    const [{ data: models }, { data: billing }] = await Promise.all([
      supabase.from('crm_models').select('id, name'),
      supabase.from('crm_model_billing').select('model_id, usernames'),
    ]);

    // Tout username OF déjà rattaché quelque part, y compris le mapping
    // historique dont les sept créatrices n'ont pas encore de fiche.
    const known = new Set<string>(
      Object.values(INFLOWW_OF_LEGACY).map((u) => u.toLowerCase()),
    );
    (billing ?? []).forEach((b: Row) => {
      const u = b.usernames as Record<string, string> | null;
      const of = (u?.OF ?? '').trim().toLowerCase();
      if (of) known.add(of);
    });

    const ids = (models ?? []).map((m: Row) => m.id as string);
    const usedNames = new Set((models ?? []).map((m: Row) => String(m.name ?? '').toLowerCase()));

    for (const [userName] of creators) {
      if (known.has(userName.toLowerCase())) {
        result.alreadyKnown += 1;
        continue;
      }

      const raw = rawByUserName.get(userName) ?? { userName };
      let name = displayNameOf(raw);
      // Deux créatrices peuvent porter le même prénom de scène : on désambiguïse
      // avec l'username plutôt que d'écraser une fiche existante.
      if (usedNames.has(name.toLowerCase())) name = `${name} (${userName})`;

      const id = nextId(ids);

      const { error: mErr } = await supabase.from('crm_models').insert({
        id,
        name,
        pseudo: '',
        platforms: ['OF'],
        username: userName,
        manager: '',
        commission: 20,
        status: 'active',
        sort_order: ids.length,
      });
      if (mErr) {
        result.errors.push(`${userName} : ${mErr.message}`);
        continue;
      }

      const { error: bErr } = await supabase.from('crm_model_billing').insert({
        model_id: id,
        usernames: { OF: userName },
        first_name: name.split(/\s+/)[0] ?? name,
        last_name: name.split(/\s+/).slice(1).join(' '),
      });
      if (bErr) {
        result.errors.push(`${userName} (facturation) : ${bErr.message}`);
      }

      ids.push(id);
      usedNames.add(name.toLowerCase());
      known.add(userName.toLowerCase());
      result.created.push({ id, name, userName });
    }
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : String(e));
  }

  return result;
}
