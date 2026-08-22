import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreatorRef } from './infloww';

/**
 * L'identité durable d'une créatrice côté Infloww.
 *
 * Le CRM la cherchait par son pseudo OnlyFans. Ce pseudo est mutable des deux
 * côtés : la créatrice peut le changer sur OnlyFans, et Infloww ne rafraîchit
 * pas celui qu'il a enregistré au moment de la connexion. Un pseudo modifié
 * suffisait donc à faire disparaître une créatrice du dashboard, silencieusement
 * — l'API répond 200, la liste est simplement plus courte.
 *
 * `platformPid` est l'identifiant interne du compte OnlyFans. Il ne change
 * jamais. Une fois qu'on l'a vu une fois pour une créatrice, on le garde, et
 * plus aucun renommage ne peut couper le lien.
 *
 * La clé est le nom sous lequel le chiffre d'affaires est stocké dans
 * `vg_daily_entries` — c'est lui qui doit rester continu.
 */

export interface Identity {
  modelName: string;
  platformPid: string;
  userName: string;
}

type Row = Record<string, unknown>;

export async function loadIdentities(
  supabase: SupabaseClient,
): Promise<Map<string, Identity>> {
  const out = new Map<string, Identity>();
  try {
    const { data } = await supabase
      .from('crm_infloww_identity')
      .select('model_name, platform_pid, user_name');
    (data ?? []).forEach((r: Row) => {
      const modelName = String(r.model_name ?? '');
      const platformPid = String(r.platform_pid ?? '');
      if (modelName && platformPid) {
        out.set(modelName, { modelName, platformPid, userName: String(r.user_name ?? '') });
      }
    });
  } catch {
    // Table absente : on retombe sur la résolution par pseudo, qui marche tant
    // que personne n'a changé de pseudo. Le sync ne doit pas s'arrêter pour ça.
  }
  return out;
}

/**
 * Retrouve une créatrice, d'abord par son identifiant stable, puis par pseudo.
 *
 * L'ordre compte : l'identifiant stable est vrai même quand le pseudo enregistré
 * dans le CRM est périmé. Le pseudo ne sert qu'à la toute première rencontre,
 * celle où l'on apprend justement l'identifiant.
 */
export function resolveCreator(
  modelName: string,
  userName: string,
  identities: Map<string, Identity>,
  byUserName: Map<string, CreatorRef>,
  byPid: Map<string, CreatorRef>,
): { ref: CreatorRef | null; matchedBy: 'platformPid' | 'userName' | 'none' } {
  const known = identities.get(modelName);
  if (known) {
    const ref = byPid.get(known.platformPid);
    if (ref) return { ref, matchedBy: 'platformPid' };
  }
  const ref = byUserName.get(userName);
  if (ref) return { ref, matchedBy: 'userName' };
  return { ref: null, matchedBy: 'none' };
}

/**
 * Mémorise ce qu'on vient d'apprendre.
 *
 * Écrit à chaque passage réussi, y compris quand la ligne existe déjà : c'est
 * ainsi que le pseudo enregistré se met à jour tout seul après un changement de
 * handle, sans que personne n'ait à toucher au code ni à la fiche.
 */
export async function rememberIdentity(
  supabase: SupabaseClient,
  modelName: string,
  ref: CreatorRef,
): Promise<string | null> {
  if (!ref.platformPid) return null;
  try {
    const { error } = await supabase.from('crm_infloww_identity').upsert(
      {
        model_name: modelName,
        platform_pid: ref.platformPid,
        user_name: ref.userName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'model_name' },
    );
    return error?.message ?? null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
