import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Correspondance entre une créatrice du CRM et son compte Infloww.
 *
 * Elle était écrite en dur ici : sept surnoms — « Lou », « Lorie »… — associés
 * à un username OnlyFans. Deux effets, tous deux invisibles depuis l'écran.
 *
 * D'abord, toute créatrice absente de cette liste restait hors du dashboard
 * tant que personne ne modifiait le code. Ensuite, et c'est le plus sournois :
 * ces sept surnoms ne correspondaient à aucune fiche du CRM, alors que chacune
 * de ces créatrices en avait une, sous son nom civil. La déduplication par
 * username écartait donc systématiquement la vraie fiche au profit du surnom.
 * Une même personne existait deux fois selon l'écran consulté, et l'adresse et
 * les coordonnées bancaires saisies sur sa fiche ne servaient jamais.
 *
 * L'historique a été renommé vers les noms civils (voir
 * supabase/infloww-noms-civils.sql) et la liste en dur n'a plus d'objet : les
 * fiches sont désormais la seule source de vérité. On garde la constante vide
 * plutôt que de la supprimer, pour ne pas casser les imports existants.
 */
export const INFLOWW_OF_LEGACY: Record<string, string> = {};

/** Conservé pour les imports existants. */
export const INFLOWW_OF_MAPPING = INFLOWW_OF_LEGACY;

export interface MappingResult {
  /** Nom utilisé comme clé dans vg_daily_entries → username Infloww. */
  mapping: Record<string, string>;
  /** Créatrices du CRM sur OF sans username : invisibles du dashboard. */
  missingUsername: string[];
  /** Entrées ajoutées depuis la base, pour vérification. */
  fromDatabase: Record<string, string>;
}

type Row = Record<string, unknown>;

/**
 * Le mapping complet : les sept historiques, plus toute créatrice active du CRM
 * marquée sur OF dont l'username est renseigné et pas déjà couvert.
 *
 * La déduplication se fait sur l'username, jamais sur le nom : une créatrice
 * déjà présente sous son nom de scène ne doit pas être synchronisée une seconde
 * fois sous son nom civil, ce qui doublerait son chiffre d'affaires dans le
 * dashboard.
 */
export async function buildInflowwMapping(
  supabase: SupabaseClient,
): Promise<MappingResult> {
  const mapping: Record<string, string> = { ...INFLOWW_OF_LEGACY };
  const fromDatabase: Record<string, string> = {};
  const missingUsername: string[] = [];

  const taken = new Set(Object.values(mapping).map((u) => u.toLowerCase()));

  try {
    const [{ data: models }, { data: billing }] = await Promise.all([
      supabase.from('crm_models').select('id, name, platforms, status'),
      supabase.from('crm_model_billing').select('model_id, usernames'),
    ]);

    const usernamesByModel = new Map<string, Record<string, string>>();
    (billing ?? []).forEach((b: Row) => {
      const u = b.usernames;
      if (u && typeof u === 'object') {
        usernamesByModel.set(b.model_id as string, u as Record<string, string>);
      }
    });

    (models ?? []).forEach((m: Row) => {
      const platforms = Array.isArray(m.platforms) ? (m.platforms as string[]) : [];
      if (!platforms.includes('OF')) return;
      if (m.status === 'inactive') return;

      const name = ((m.name as string) ?? '').trim();
      if (!name) return;

      const username = (usernamesByModel.get(m.id as string)?.OF ?? '').trim();
      if (!username) {
        missingUsername.push(name);
        return;
      }
      if (taken.has(username.toLowerCase())) return;

      taken.add(username.toLowerCase());
      mapping[name] = username;
      fromDatabase[name] = username;
    });
  } catch {
    // Une base injoignable ne doit pas priver le dashboard des sept historiques.
    return { mapping, missingUsername, fromDatabase };
  }

  return { mapping, missingUsername, fromDatabase };
}
