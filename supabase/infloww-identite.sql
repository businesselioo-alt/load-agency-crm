-- Identité durable des créatrices côté Infloww.
--
-- Le lien CRM ↔ Infloww reposait sur le pseudo OnlyFans. Ce pseudo change, et
-- Infloww ne rafraîchit pas celui qu'il a enregistré à la connexion : une
-- créatrice qui change de handle disparaît du dashboard sans erreur.
--
-- platform_pid est l'identifiant interne du compte OnlyFans. Il ne change
-- jamais. La table se remplit toute seule au premier passage réussi.
--
-- model_name est la clé : c'est le nom sous lequel vg_daily_entries conserve
-- des mois de chiffre d'affaires, et c'est cette continuité-là qu'on protège.

create table if not exists crm_infloww_identity (
  model_name   text primary key,
  platform_pid text not null,
  user_name    text not null default '',
  updated_at   timestamptz not null default now()
);

-- Deux fiches ne peuvent pas revendiquer le même compte OnlyFans : ce serait
-- compter son chiffre d'affaires deux fois dans le dashboard.
create unique index if not exists crm_infloww_identity_pid_uniq
  on crm_infloww_identity (platform_pid);

alter table crm_infloww_identity enable row level security;

drop policy if exists temp_anon_all on crm_infloww_identity;
create policy temp_anon_all on crm_infloww_identity
  for all to anon using (true) with check (true);
