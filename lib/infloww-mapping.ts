import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Correspondance entre une créatrice du CRM et son compte Infloww.
 *
 * Elle était écrite en dur ici, ce qui rendait toute nouvelle créatrice
 * invisible du dashboard tant que personne ne modifiait le code. Elle se
 * construit désormais à partir des usernames saisis sur la fiche modèle.
 *
 * Les sept entrées historiques restent en dur, et pour une raison précise :
 * `vg_daily_entries.model_name` conserve le nom sous lequel chaque créatrice a
 * été enregistrée depuis des mois. Basculer ces sept-là sur leur nom CRM
 * couperait leur historique en deux — le dashboard afficherait un trou pour
 * l'ancien nom et repartirait de zéro pour le nouveau. On préserve donc leur
 * clé d'origine, et on n'ajoute que ce qui manque.
 */
export const INFLOWW_OF_LEGACY: Record<string, string> = {
  'Lou':     'louvalmont',
  'Margot':  'margotguimaut',
  'Jeanne':  'jeannebourgot',
  'Lucie':   'u562177971',
  // Lorie a changé de handle sur OnlyFans ; Infloww affichait encore l'ancien
  // (« lorincampion ») jusqu'à ce que le compte soit relié. Ce pseudo n'est
  // qu'un point de départ : dès le premier passage réussi, l'identité bascule
  // sur platformPid et un futur changement de handle ne cassera plus rien.
  'Lorie':   'loriecampion',
  'Élodie':  'elodiemouvin',
  'Lilou':   'lucyscotlandd1',
};

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
