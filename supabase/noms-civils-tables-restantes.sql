-- Suite du renommage : les tables oubliées au premier passage.
--
-- vg_daily_entries a bien été renommée, mais quatre autres tables désignent les
-- mêmes créatrices par leur nom, et sont restées aux surnoms. Résultat : les
-- abonnés, le planning de chatting et les récaps pointaient vers des noms que
-- plus rien d'autre n'utilisait.
--
-- Rejouable sans risque : une ligne déjà renommée n'est plus touchée.

do $$
declare
  p record;
  n integer;
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
    -- Abonnés et abonnements des 30 derniers jours.
    update vg_model_stats s
       set model_name = p.nouveau
     where s.model_name = p.ancien
       and not exists (
         select 1 from vg_model_stats c
          where c.model_name = p.nouveau and c.platform = s.platform
       );
    get diagnostics n = row_count;
    raise notice 'vg_model_stats  % → % : %', p.ancien, p.nouveau, n;

    -- Planning des shifts.
    update chat_shift_plans v
       set model_name = p.nouveau
     where v.model_name = p.ancien
       and not exists (
         select 1 from chat_shift_plans c
          where c.model_name = p.nouveau
            and c.platform = v.platform
            and c.date     = v.date
            and c.shift    = v.shift
       );
    get diagnostics n = row_count;
    raise notice 'chat_shift_plans % → % : %', p.ancien, p.nouveau, n;

    -- Récaps de shift.
    update chat_recaps set model_name = p.nouveau where model_name = p.ancien;
    get diagnostics n = row_count;
    raise notice 'chat_recaps     % → % : %', p.ancien, p.nouveau, n;

    -- Créatrices retenues dans le planning.
    update chat_plan_models v
       set model_name = p.nouveau
     where v.model_name = p.ancien
       and not exists (
         select 1 from chat_plan_models c
          where c.model_name = p.nouveau and c.platform = v.platform
       );
    get diagnostics n = row_count;
    raise notice 'chat_plan_models % → % : %', p.ancien, p.nouveau, n;
  end loop;
end $$;

-- Contrôle : plus aucun surnom nulle part.
select 'vg_model_stats'  as source, model_name from vg_model_stats
 where model_name in ('Lou','Margot','Jeanne','Élodie','Lilou','Lucie','Lorie')
union all
select 'chat_shift_plans', model_name from chat_shift_plans
 where model_name in ('Lou','Margot','Jeanne','Élodie','Lilou','Lucie','Lorie')
union all
select 'chat_recaps', model_name from chat_recaps
 where model_name in ('Lou','Margot','Jeanne','Élodie','Lilou','Lucie','Lorie')
union all
select 'chat_plan_models', model_name from chat_plan_models
 where model_name in ('Lou','Margot','Jeanne','Élodie','Lilou','Lucie','Lorie');
