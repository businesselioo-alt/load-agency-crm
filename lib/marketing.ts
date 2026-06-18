export type SFSStatus = 'fait' | 'prévu' | 'annulé';
export type SFSPlatform = 'MYM' | 'OF';

export interface SFSEntry {
  id: string;
  modelId: string;
  modelName: string;
  platform: SFSPlatform;
  partnerAgency: string;
  date: string;
  status: SFSStatus;
  estimatedReturn: number | null;
  note: string;
}

export const SFS_DATA: SFSEntry[] = [
  // ─── MYM ────────────────────────────────────────────────────
  {
    id: 'sfs1',
    modelId: 'm6',
    modelName: 'Jazz',
    platform: 'MYM',
    partnerAgency: 'Nova Talent',
    date: '2026-05-03',
    status: 'fait',
    estimatedReturn: 340,
    note: 'Très bon retour, audience qualifiée',
  },
  {
    id: 'sfs2',
    modelId: 'm6',
    modelName: 'Jazz',
    platform: 'MYM',
    partnerAgency: 'Stellar Agency',
    date: '2026-05-20',
    status: 'fait',
    estimatedReturn: 210,
    note: '',
  },
  {
    id: 'sfs3',
    modelId: 'm6',
    modelName: 'Jazz',
    platform: 'MYM',
    partnerAgency: 'Pulse Models',
    date: '2026-06-18',
    status: 'prévu',
    estimatedReturn: 280,
    note: 'Profil similaire, bon potentiel',
  },
  {
    id: 'sfs4',
    modelId: 'm7',
    modelName: 'Georgia',
    platform: 'MYM',
    partnerAgency: 'Aura Creative',
    date: '2026-05-08',
    status: 'fait',
    estimatedReturn: 190,
    note: 'Résultats en deçà des attentes',
  },
  {
    id: 'sfs5',
    modelId: 'm7',
    modelName: 'Georgia',
    platform: 'MYM',
    partnerAgency: 'Nova Talent',
    date: '2026-05-25',
    status: 'annulé',
    estimatedReturn: null,
    note: 'Annulé — indisponibilité partenaire',
  },
  {
    id: 'sfs6',
    modelId: 'm7',
    modelName: 'Georgia',
    platform: 'MYM',
    partnerAgency: 'Lumière Mgmt',
    date: '2026-06-22',
    status: 'prévu',
    estimatedReturn: 300,
    note: '',
  },
  {
    id: 'sfs7',
    modelId: 'm1',
    modelName: 'Charlotte Grace',
    platform: 'MYM',
    partnerAgency: 'Stellar Agency',
    date: '2026-04-15',
    status: 'fait',
    estimatedReturn: 520,
    note: 'Excellent résultat, à renouveler',
  },
  {
    id: 'sfs8',
    modelId: 'm1',
    modelName: 'Charlotte Grace',
    platform: 'MYM',
    partnerAgency: 'Pulse Models',
    date: '2026-05-12',
    status: 'fait',
    estimatedReturn: 410,
    note: '',
  },
  {
    id: 'sfs9',
    modelId: 'm1',
    modelName: 'Charlotte Grace',
    platform: 'MYM',
    partnerAgency: 'Apex Creator',
    date: '2026-06-05',
    status: 'fait',
    estimatedReturn: 390,
    note: 'Audience très engagée',
  },
  {
    id: 'sfs10',
    modelId: 'm3',
    modelName: 'Katy Blackham',
    platform: 'MYM',
    partnerAgency: 'Nova Talent',
    date: '2026-05-10',
    status: 'fait',
    estimatedReturn: 260,
    note: '',
  },
  {
    id: 'sfs11',
    modelId: 'm3',
    modelName: 'Katy Blackham',
    platform: 'MYM',
    partnerAgency: 'Lumière Mgmt',
    date: '2026-05-28',
    status: 'annulé',
    estimatedReturn: null,
    note: 'Annulé — contenu non conforme',
  },
  {
    id: 'sfs12',
    modelId: 'm3',
    modelName: 'Katy Blackham',
    platform: 'MYM',
    partnerAgency: 'Aura Creative',
    date: '2026-06-14',
    status: 'prévu',
    estimatedReturn: 220,
    note: '',
  },
  {
    id: 'sfs13',
    modelId: 'm2',
    modelName: 'Maisie H. Ward',
    platform: 'MYM',
    partnerAgency: 'Apex Creator',
    date: '2026-04-28',
    status: 'fait',
    estimatedReturn: 310,
    note: 'Bon ciblage audience',
  },
  {
    id: 'sfs14',
    modelId: 'm2',
    modelName: 'Maisie H. Ward',
    platform: 'MYM',
    partnerAgency: 'Stellar Agency',
    date: '2026-05-16',
    status: 'fait',
    estimatedReturn: 275,
    note: '',
  },
  {
    id: 'sfs15',
    modelId: 'm2',
    modelName: 'Maisie H. Ward',
    platform: 'MYM',
    partnerAgency: 'Pulse Models',
    date: '2026-06-25',
    status: 'prévu',
    estimatedReturn: 300,
    note: 'Collaboration croisée prévue',
  },

  // ─── OF ─────────────────────────────────────────────────────
  {
    id: 'sfs16',
    modelId: 'm1',
    modelName: 'Charlotte Grace',
    platform: 'OF',
    partnerAgency: 'OF Stars Agency',
    date: '2026-04-20',
    status: 'fait',
    estimatedReturn: 480,
    note: 'Top collaboration, très rentable',
  },
  {
    id: 'sfs17',
    modelId: 'm1',
    modelName: 'Charlotte Grace',
    platform: 'OF',
    partnerAgency: 'Elite Content',
    date: '2026-05-05',
    status: 'fait',
    estimatedReturn: 350,
    note: '',
  },
  {
    id: 'sfs18',
    modelId: 'm1',
    modelName: 'Charlotte Grace',
    platform: 'OF',
    partnerAgency: 'Creator Hub',
    date: '2026-05-22',
    status: 'fait',
    estimatedReturn: 290,
    note: 'Audience francophone ciblée',
  },
  {
    id: 'sfs19',
    modelId: 'm1',
    modelName: 'Charlotte Grace',
    platform: 'OF',
    partnerAgency: 'OF Stars Agency',
    date: '2026-06-10',
    status: 'prévu',
    estimatedReturn: 420,
    note: 'Renouvellement partenariat',
  },
  {
    id: 'sfs20',
    modelId: 'm5',
    modelName: 'Kiara Sanders',
    platform: 'OF',
    partnerAgency: 'Elite Content',
    date: '2026-05-07',
    status: 'fait',
    estimatedReturn: 390,
    note: '',
  },
  {
    id: 'sfs21',
    modelId: 'm5',
    modelName: 'Kiara Sanders',
    platform: 'OF',
    partnerAgency: 'Creator Hub',
    date: '2026-05-30',
    status: 'annulé',
    estimatedReturn: null,
    note: 'Annulé — planning incompatible',
  },
  {
    id: 'sfs22',
    modelId: 'm5',
    modelName: 'Kiara Sanders',
    platform: 'OF',
    partnerAgency: 'OF Stars Agency',
    date: '2026-06-20',
    status: 'prévu',
    estimatedReturn: 360,
    note: 'Format story + post',
  },
];

export function parseCSV(text: string, platform: SFSPlatform): Omit<SFSEntry, 'id'>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, ''));
  const col = (name: string) => header.indexOf(name);

  return lines.slice(1).flatMap((line) => {
    const parts = splitCSVLine(line);
    const get = (idx: number) => (idx >= 0 ? (parts[idx] ?? '').trim().replace(/^"|"$/g, '') : '');

    const modelName = get(col('model')) || get(col('modelname')) || get(col('nom'));
    const partnerAgency = get(col('agence_partenaire')) || get(col('agence')) || get(col('partner'));
    const date = get(col('date'));
    const rawStatus = (get(col('statut')) || get(col('status'))).toLowerCase();
    const status: SFSStatus =
      rawStatus === 'fait' ? 'fait' :
      rawStatus === 'annulé' || rawStatus === 'annule' ? 'annulé' : 'prévu';
    const retour = get(col('retour_estime')) || get(col('retour')) || get(col('return'));
    const note = get(col('note')) || get(col('notes'));

    if (!modelName || !date) return [];
    return [{
      modelId: '',
      modelName,
      platform,
      partnerAgency,
      date,
      status,
      estimatedReturn: retour ? parseInt(retour, 10) || null : null,
      note,
    }];
  });
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += char; }
  }
  result.push(current);
  return result;
}

export const CSV_TEMPLATE = `model,agence_partenaire,date,statut,retour_estime,note
Jazz,Nova Talent,2026-07-01,prévu,250,Collaboration été
Charlotte Grace,Stellar Agency,2026-07-05,prévu,400,
`;
