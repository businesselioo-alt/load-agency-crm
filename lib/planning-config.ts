import { CustomModel, DEFAULT_MODELS } from './planning-sfs';

export interface PlanningConfig {
  platform: 'of' | 'mym';
  title: string;
  slotsKey: string;
  modelsKey: string;
  defaultModels: CustomModel[];
  initialModel: string;
}

// Colors cycle through 10-color palette for 22 models
const MYM_DEFAULT_MODELS: CustomModel[] = [
  { name: '1. Lenajns',        color: '#a855f7' },
  { name: '2. Manonvpa',       color: '#ec4899' },
  { name: '3. Paulineqrt',     color: '#3b82f6' },
  { name: '4. Julievivi',      color: '#10b981' },
  { name: '5. Aliceqsd',       color: '#f97316' },
  { name: '6. Sarahjea',       color: '#f43f5e' },
  { name: '7. Eloisetms',      color: '#6366f1' },
  { name: '8. Chloebleue',     color: '#f59e0b' },
  { name: '9. Eliseroee',      color: '#14b8a6' },
  { name: '10. Loujtf',        color: '#84cc16' },
  { name: '11. Milavpy',       color: '#a855f7' },
  { name: '12. Emmacuty',      color: '#ec4899' },
  { name: '13. Lorienmp',      color: '#3b82f6' },
  { name: '14. Edenlou',       color: '#10b981' },
  { name: '15. Elodie',        color: '#f97316' },
  { name: '16. Chloelpm',      color: '#f43f5e' },
  { name: '17. Jeannebourgot', color: '#6366f1' },
  { name: '18. Ineshrg',       color: '#f59e0b' },
  { name: '19. Violettehns',   color: '#14b8a6' },
  { name: '20. Lounarvp',      color: '#84cc16' },
  { name: '21. Naiakds',       color: '#a855f7' },
  { name: '22. Coletteflm',    color: '#ec4899' },
];

export const OF_CONFIG: PlanningConfig = {
  platform: 'of',
  title: 'SFS OnlyFans',
  slotsKey: 'crm_planning_sfs_v2',
  modelsKey: 'crm_planning_models_v1',
  defaultModels: DEFAULT_MODELS,
  initialModel: 'Lou',
};

export const MYM_CONFIG: PlanningConfig = {
  platform: 'mym',
  title: 'SFS MYM',
  slotsKey:   'crm_planning_mym_v2',       // bumped → clears old slots
  modelsKey:  'crm_planning_mym_models_v2', // bumped → clears old models
  defaultModels: MYM_DEFAULT_MODELS,
  initialModel: '1. Lenajns',
};
