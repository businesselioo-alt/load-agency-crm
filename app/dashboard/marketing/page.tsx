'use client';

import { useState } from 'react';
import { CalendarDays, BarChart3 } from 'lucide-react';
import PlanningCalendar from '@/components/planning/PlanningCalendar';
import VueGlobale from '@/components/marketing/VueGlobale';
import { OF_CONFIG, MYM_CONFIG } from '@/lib/planning-config';

type Section = 'sfs-of' | 'sfs-mym' | 'vue-globale';

interface SidebarItem {
  id: Section;
  label: string;
  sub?: string;
  color: string;
  icon: React.ElementType;
  group: string;
}

const SIDEBAR: SidebarItem[] = [
  { id: 'vue-globale', label: 'Vue Globale',   sub: 'OF & MYM',  color: '#10b981', icon: BarChart3,    group: 'Performance'  },
  { id: 'sfs-of',      label: 'SFS OnlyFans', sub: '7 models',  color: '#a855f7', icon: CalendarDays, group: 'Planning SFS' },
  { id: 'sfs-mym',     label: 'SFS MYM',      sub: '22 models', color: '#ec4899', icon: CalendarDays, group: 'Planning SFS' },
];

export default function MarketingPage() {
  const [active, setActive] = useState<Section>('vue-globale');

  const groups = [...new Set(SIDEBAR.map((s) => s.group))];

  return (
    <div className="flex h-full min-h-screen">
      {/* ── Sub-sidebar ── */}
      <aside className="w-52 flex-shrink-0 border-r border-[#1a1a1a] bg-[#0a0a0a] flex flex-col">
        <div className="px-4 py-5 border-b border-[#1a1a1a]">
          <p className="text-[10px] font-semibold text-[#555] uppercase tracking-widest">Marketing</p>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {groups.map((group) => (
            <div key={group}>
              <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider px-2 pb-2">{group}</p>
              <div className="space-y-1">
                {SIDEBAR.filter((s) => s.group === group).map((s) => {
                  const Icon = s.icon;
                  const isActive = active === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActive(s.id)}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-left transition-all ${
                        isActive
                          ? 'bg-[#1a1a1a] border border-[#333] font-semibold text-white'
                          : 'text-[#555] hover:bg-[#141414] hover:text-[#888] font-medium'
                      }`}
                    >
                      <Icon size={15} className="flex-shrink-0" style={{ color: isActive ? s.color : '#555' }} />
                      <div className="min-w-0">
                        <p className="truncate leading-tight">{s.label}</p>
                        {s.sub && <p className="text-[10px] text-[#555] font-normal leading-tight">{s.sub}</p>}
                      </div>
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Content ── */}
      <main className="flex-1 overflow-auto min-w-0">
        {active === 'sfs-of'      && <PlanningCalendar key="of"  config={OF_CONFIG} />}
        {active === 'sfs-mym'     && <PlanningCalendar key="mym" config={MYM_CONFIG} />}
        {active === 'vue-globale' && <VueGlobale />}
      </main>
    </div>
  );
}
