import { supabase } from './supabase';

export type SFSStatus = 'fait' | 'prévu' | 'non_planifié';

export interface SFSSlot {
  date: string;
  chatter?: string;
  target?: string;
  status: SFSStatus;
}

export interface SFSRow {
  id: string;
  pseudo: string;
  firstName: string;
  subscribers: number;
  formerSubscribers: number;
  interested: number | null;
  lastSFS: string;
  sfs1: SFSSlot | null;
  sfs2: SFSSlot | null;
  sfs3: SFSSlot | null;
  nudgeActive: boolean;
}

// ─── MYM ──────────────────────────────────────────────────────────────────────

export const SFS_MYM: SFSRow[] = [
  {
    id: 'mym1',
    pseudo: 'lenajns',
    firstName: 'Jazz',
    subscribers: 16165,
    formerSubscribers: 15131,
    interested: 21083,
    lastSFS: '08/06',
    sfs1: { date: '11/06', chatter: 'Abzerty', target: 'Lou 16k4', status: 'prévu' },
    sfs2: { date: '13/06', target: 'Lou', status: 'prévu' },
    sfs3: { date: '15/06', target: 'Lou', status: 'prévu' },
    nudgeActive: true,
  },
  {
    id: 'mym2',
    pseudo: 'manonvpa',
    firstName: 'Georgia',
    subscribers: 8278,
    formerSubscribers: 3060,
    interested: 3544,
    lastSFS: '11/06',
    sfs1: { date: '11/06', chatter: 'Eud', target: 'Léna 8k9', status: 'fait' },
    sfs2: { date: '13/06', target: 'Léna', status: 'prévu' },
    sfs3: { date: '15/06', target: 'Léna', status: 'fait' },
    nudgeActive: true,
  },
  {
    id: 'mym3',
    pseudo: 'paulineqrt',
    firstName: 'Hatty',
    subscribers: 8501,
    formerSubscribers: 3080,
    interested: 3483,
    lastSFS: '08/06',
    sfs1: { date: '11/06', chatter: 'Lucas', target: 'Julie 10k', status: 'prévu' },
    sfs2: { date: '13/06', target: 'Julie', status: 'prévu' },
    sfs3: { date: '15/06', target: 'Julie', status: 'prévu' },
    nudgeActive: true,
  },
  {
    id: 'mym4',
    pseudo: 'julievivi',
    firstName: 'Brianna Smith',
    subscribers: 9751,
    formerSubscribers: 2324,
    interested: 1543,
    lastSFS: '29/05',
    sfs1: { date: '29/05', target: 'Violette 6k3', status: 'fait' },
    sfs2: null,
    sfs3: null,
    nudgeActive: true,
  },
  {
    id: 'mym5',
    pseudo: 'aliceqsd',
    firstName: 'Jessica',
    subscribers: 6877,
    formerSubscribers: 1647,
    interested: 1357,
    lastSFS: '08/06',
    sfs1: { date: '12/06', chatter: 'Le R', target: 'ChloéLpm 8k4', status: 'prévu' },
    sfs2: { date: '14/06', status: 'prévu' },
    sfs3: { date: '16/06', status: 'prévu' },
    nudgeActive: false,
  },
  {
    id: 'mym6',
    pseudo: 'sarahjea',
    firstName: 'Tiahne',
    subscribers: 6397,
    formerSubscribers: 1378,
    interested: 908,
    lastSFS: '09/06',
    sfs1: { date: '12/06', chatter: 'François', status: 'prévu' },
    sfs2: { date: '14/06', status: 'prévu' },
    sfs3: { date: '16/06', status: 'prévu' },
    nudgeActive: false,
  },
  {
    id: 'mym7',
    pseudo: 'eloisetms',
    firstName: 'Katy',
    subscribers: 5756,
    formerSubscribers: 1215,
    interested: 591,
    lastSFS: '09/06',
    sfs1: { date: '12/06', chatter: 'François', target: 'Lou', status: 'prévu' },
    sfs2: { date: '14/06', target: 'Lou', status: 'prévu' },
    sfs3: { date: '16/06', target: 'Lou', status: 'prévu' },
    nudgeActive: false,
  },
  {
    id: 'mym8',
    pseudo: 'chloebleue',
    firstName: 'Kiara',
    subscribers: 3719,
    formerSubscribers: 722,
    interested: 331,
    lastSFS: '09/06',
    sfs1: { date: '12/06', chatter: 'Le R', target: 'Léna', status: 'prévu' },
    sfs2: { date: '14/06', target: 'Léna', status: 'prévu' },
    sfs3: { date: '16/06', target: 'Léna', status: 'prévu' },
    nudgeActive: false,
  },
  {
    id: 'mym9',
    pseudo: 'eliseroee',
    firstName: 'Millie',
    subscribers: 3840,
    formerSubscribers: 624,
    interested: 417,
    lastSFS: '09/06',
    sfs1: { date: '12/06', chatter: 'François', target: 'Julie', status: 'prévu' },
    sfs2: { date: '14/06', target: 'Julie', status: 'prévu' },
    sfs3: { date: '16/06', target: 'Julie', status: 'prévu' },
    nudgeActive: false,
  },
  {
    id: 'mym10',
    pseudo: 'loujtf',
    firstName: 'Charlotte',
    subscribers: 7701,
    formerSubscribers: 1458,
    interested: 916,
    lastSFS: '28/05',
    sfs1: { date: '28/05', target: 'Violette', status: 'fait' },
    sfs2: null,
    sfs3: null,
    nudgeActive: true,
  },
  {
    id: 'mym11',
    pseudo: 'milavpy',
    firstName: 'Emily',
    subscribers: 3461,
    formerSubscribers: 625,
    interested: 539,
    lastSFS: '07/06',
    sfs1: { date: '12/06', chatter: 'Matteo', target: 'ChloéLpm', status: 'prévu' },
    sfs2: { date: '14/06', status: 'prévu' },
    sfs3: { date: '16/06', status: 'prévu' },
    nudgeActive: false,
  },
  {
    id: 'mym12',
    pseudo: 'emmacuty',
    firstName: 'Grace',
    subscribers: 2434,
    formerSubscribers: 261,
    interested: 143,
    lastSFS: '10/06',
    sfs1: { date: '12/06', chatter: 'Lucas', status: 'prévu' },
    sfs2: { date: '14/06', status: 'prévu' },
    sfs3: { date: '16/06', status: 'prévu' },
    nudgeActive: false,
  },
  {
    id: 'mym13',
    pseudo: 'lorienmp',
    firstName: 'Immy Grace',
    subscribers: 3456,
    formerSubscribers: 390,
    interested: 228,
    lastSFS: '07/06',
    sfs1: { date: '12/06', chatter: 'François', status: 'prévu' },
    sfs2: { date: '14/06', status: 'prévu' },
    sfs3: { date: '16/06', status: 'prévu' },
    nudgeActive: false,
  },
  {
    id: 'mym14',
    pseudo: 'edenlou',
    firstName: 'Holly',
    subscribers: 1814,
    formerSubscribers: 221,
    interested: 92,
    lastSFS: '07/06',
    sfs1: { date: '12/06', chatter: 'François', status: 'prévu' },
    sfs2: { date: '14/06', status: 'prévu' },
    sfs3: { date: '16/06', status: 'prévu' },
    nudgeActive: false,
  },
  {
    id: 'mym15',
    pseudo: 'elodie',
    firstName: 'Kenzi',
    subscribers: 1334,
    formerSubscribers: 130,
    interested: 61,
    lastSFS: '07/06',
    sfs1: { date: '11/06', chatter: 'Lucas', status: 'prévu' },
    sfs2: { date: '13/06', status: 'prévu' },
    sfs3: { date: '15/06', status: 'prévu' },
    nudgeActive: false,
  },
  {
    id: 'mym16',
    pseudo: 'chloelpm',
    firstName: 'Brianna Taylor',
    subscribers: 2165,
    formerSubscribers: 152,
    interested: 235,
    lastSFS: '07/06',
    sfs1: { date: '11/06', chatter: 'François', status: 'prévu' },
    sfs2: { date: '13/06', status: 'prévu' },
    sfs3: { date: '15/06', status: 'prévu' },
    nudgeActive: false,
  },
  {
    id: 'mym17',
    pseudo: 'jeannebourgot',
    firstName: 'Lylah',
    subscribers: 3226,
    formerSubscribers: 265,
    interested: 206,
    lastSFS: '07/06',
    sfs1: { date: '07/06', status: 'fait' },
    sfs2: null,
    sfs3: null,
    nudgeActive: true,
  },
  {
    id: 'mym18',
    pseudo: 'ineshrg',
    firstName: 'Skye',
    subscribers: 1153,
    formerSubscribers: 100,
    interested: 123,
    lastSFS: '07/06',
    sfs1: { date: '11/06', chatter: 'HMSS', status: 'prévu' },
    sfs2: { date: '13/06', status: 'prévu' },
    sfs3: { date: '15/06', status: 'prévu' },
    nudgeActive: false,
  },
  {
    id: 'mym19',
    pseudo: 'violettehns',
    firstName: 'Angel',
    subscribers: 2086,
    formerSubscribers: 169,
    interested: 352,
    lastSFS: '07/06',
    sfs1: { date: '07/06', status: 'fait' },
    sfs2: null,
    sfs3: null,
    nudgeActive: false,
  },
  {
    id: 'mym20',
    pseudo: 'lounarvp',
    firstName: 'Luize',
    subscribers: 1675,
    formerSubscribers: 61,
    interested: 43,
    lastSFS: '',
    sfs1: null,
    sfs2: null,
    sfs3: null,
    nudgeActive: false,
  },
];

// ─── OF ───────────────────────────────────────────────────────────────────────

export const SFS_OF: SFSRow[] = [
  {
    id: 'of1',
    pseudo: 'loujtf',
    firstName: 'Charlotte Grace',
    subscribers: 4820,
    formerSubscribers: 890,
    interested: 610,
    lastSFS: '05/06',
    sfs1: { date: '12/06', chatter: 'Le R', target: 'Kiara OF', status: 'prévu' },
    sfs2: { date: '16/06', target: 'Kiara OF', status: 'prévu' },
    sfs3: null,
    nudgeActive: true,
  },
  {
    id: 'of2',
    pseudo: 'chloebleue',
    firstName: 'Kiara Sanders',
    subscribers: 2180,
    formerSubscribers: 340,
    interested: 218,
    lastSFS: '05/06',
    sfs1: { date: '12/06', chatter: 'Le R', target: 'Charlotte OF', status: 'prévu' },
    sfs2: { date: '16/06', target: 'Charlotte OF', status: 'prévu' },
    sfs3: null,
    nudgeActive: false,
  },
];

export const EXCEL_TEMPLATE_HEADERS = [
  'Pseudo', 'Prénom', 'Abonnés', 'Anciens abonnés', 'Intéressés', 'Dernier SFS',
  'SFS1 Date', 'SFS1 Chatter', 'SFS1 Cible', 'SFS1 Statut',
  'SFS2 Date', 'SFS2 Chatter', 'SFS2 Cible', 'SFS2 Statut',
  'SFS3 Date', 'SFS3 Chatter', 'SFS3 Cible', 'SFS3 Statut',
  'Nudge actif',
];

export function rowsToExcelData(rows: SFSRow[]) {
  return rows.map((r) => ({
    'Pseudo': r.pseudo,
    'Prénom': r.firstName,
    'Abonnés': r.subscribers,
    'Anciens abonnés': r.formerSubscribers,
    'Intéressés': r.interested ?? '',
    'Dernier SFS': r.lastSFS,
    'SFS1 Date': r.sfs1?.date ?? '',
    'SFS1 Chatter': r.sfs1?.chatter ?? '',
    'SFS1 Cible': r.sfs1?.target ?? '',
    'SFS1 Statut': r.sfs1?.status ?? 'non_planifié',
    'SFS2 Date': r.sfs2?.date ?? '',
    'SFS2 Chatter': r.sfs2?.chatter ?? '',
    'SFS2 Cible': r.sfs2?.target ?? '',
    'SFS2 Statut': r.sfs2?.status ?? 'non_planifié',
    'SFS3 Date': r.sfs3?.date ?? '',
    'SFS3 Chatter': r.sfs3?.chatter ?? '',
    'SFS3 Cible': r.sfs3?.target ?? '',
    'SFS3 Statut': r.sfs3?.status ?? 'non_planifié',
    'Nudge actif': r.nudgeActive ? 'oui' : 'non',
  }));
}

function parseSlot(date: string, chatter: string, target: string, status: string): SFSSlot | null {
  if (!date) return null;
  const s = status.toLowerCase().trim();
  return {
    date,
    chatter: chatter || undefined,
    target: target || undefined,
    status: s === 'fait' ? 'fait' : s === 'annulé' || s === 'annule' ? 'non_planifié' : 'prévu',
  };
}

export function parseExcelRows(sheetData: Record<string, string>[]): SFSRow[] {
  return sheetData
    .filter((row) => row['Pseudo'])
    .map((row, i) => {
      const get = (k: string) => (row[k] ?? '').toString().trim();
      return {
        id: `import_${Date.now()}_${i}`,
        pseudo: get('Pseudo'),
        firstName: get('Prénom'),
        subscribers: parseInt(get('Abonnés')) || 0,
        formerSubscribers: parseInt(get('Anciens abonnés')) || 0,
        interested: get('Intéressés') ? parseInt(get('Intéressés')) || null : null,
        lastSFS: get('Dernier SFS'),
        sfs1: parseSlot(get('SFS1 Date'), get('SFS1 Chatter'), get('SFS1 Cible'), get('SFS1 Statut') || 'prévu'),
        sfs2: parseSlot(get('SFS2 Date'), get('SFS2 Chatter'), get('SFS2 Cible'), get('SFS2 Statut') || 'prévu'),
        sfs3: parseSlot(get('SFS3 Date'), get('SFS3 Chatter'), get('SFS3 Cible'), get('SFS3 Statut') || 'prévu'),
        nudgeActive: get('Nudge actif').toLowerCase() === 'oui',
      };
    });
}

// ─── Supabase persistence ─────────────────────────────────────────────────────

export async function loadSFSRows(platform: 'of' | 'mym'): Promise<SFSRow[]> {
  const { data } = await supabase
    .from('sfs_rows')
    .select('*')
    .eq('platform', platform)
    .order('sort_order');
  if (!data || data.length === 0) {
    return platform === 'mym' ? SFS_MYM : SFS_OF;
  }
  return data.map((row) => ({
    id:                row.id as string,
    pseudo:            row.pseudo as string,
    firstName:         row.first_name as string,
    subscribers:       row.subscribers as number,
    formerSubscribers: row.former_subscribers as number,
    interested:        row.interested as number | null,
    lastSFS:           row.last_sfs as string,
    sfs1:              row.sfs1 as SFSSlot | null,
    sfs2:              row.sfs2 as SFSSlot | null,
    sfs3:              row.sfs3 as SFSSlot | null,
    nudgeActive:       row.nudge_active as boolean,
  }));
}

export async function saveSFSRows(platform: 'of' | 'mym', rows: SFSRow[]): Promise<void> {
  await supabase.from('sfs_rows').delete().eq('platform', platform);
  if (rows.length > 0) {
    await supabase.from('sfs_rows').insert(rows.map((r, i) => ({
      id:                 r.id,
      platform,
      pseudo:             r.pseudo,
      first_name:         r.firstName,
      subscribers:        r.subscribers,
      former_subscribers: r.formerSubscribers,
      interested:         r.interested,
      last_sfs:           r.lastSFS,
      sfs1:               r.sfs1,
      sfs2:               r.sfs2,
      sfs3:               r.sfs3,
      nudge_active:       r.nudgeActive,
      sort_order:         i,
    })));
  }
}
