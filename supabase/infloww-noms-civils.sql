-- Réunification des noms : le dashboard et les fiches parlaient deux langues.
--
-- Le chiffre d'affaires quotidien était enregistré sous sept surnoms (« Lou »,
-- « Lorie »…) qui ne correspondaient à aucune fiche du CRM. Chaque surnom
-- désigne pourtant une créatrice qui a bien sa fiche, sous son nom civil. Tant
-- que les deux vocabulaires coexistent, une même personne apparaît deux fois
-- selon l'écran, et les coordonnées bancaires saisies sur sa fiche ne servent
-- jamais au dashboard.
--
-- Ce script déplace l'historique vers les noms civils. Il ne supprime rien et
-- peut être relancé sans risque : une ligne déjà renommée n'est plus touchée.

do $$
declare
  p record;
  deplacees integer;
begin
  for p in
    select * from (values
      ('Lou',    'Charlotte Grace Mcknight'),
      ('Margot', 'Emily Georgia Bourne'),
      ('Jeanne', 'Isabelle Marie Martin'),
      ('Élodie', 'Kenzi Rex'),
      ('Lilou',  'Lucy Bennett'),
      ('Lucie',  'Kazia Simpson'),
      ('Lorie',  'Imogen Grace Margaret Bushby')
    ) as t(ancien, nouveau)
  loop
    -- La condition NOT EXISTS protège contre la seule vraie erreur possible :
    -- écraser une ligne déjà présente sous le nom civil pour la même journée.
    -- Aucune n'existe aujourd'hui, mais un script de migration doit rester sûr
    -- même relancé après plusieurs synchronisations.
    update vg_daily_entries v
       set model_name = p.nouveau,
           id         = v.platform || '_' || p.nouveau || '_' || v.date
     where v.model_name = p.ancien
       and not exists (
         select 1 from vg_daily_entries c
          where c.model_name = p.nouveau
            and c.platform   = v.platform
            and c.date       = v.date
       );

    get diagnostics deplacees = row_count;
    raise notice '% → % : % lignes', p.ancien, p.nouveau, deplacees;

    -- L'identité Infloww suit le même nom : c'est sa clé.
    update crm_infloww_identity i
       set model_name = p.nouveau
     where i.model_name = p.ancien
       and not exists (
         select 1 from crm_infloww_identity x where x.model_name = p.nouveau
       );
  end loop;
end $$;

-- Contrôle : plus aucun surnom ne doit rester porteur de données.
select model_name, platform, count(*) as jours
  from vg_daily_entries
 where model_name in ('Lou','Margot','Jeanne','Élodie','Lilou','Lucie','Lorie')
 group by model_name, platform;
