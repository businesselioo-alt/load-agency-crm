'use client';

import { useState } from 'react';
import { CalendarDays, BarChart3, Menu, X } from 'lucide-react';
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
  const [active, setActive]         = useState<Section>('vue-globale');
  const [navOpen, setNavOpen]       = useState(false);

  const groups     = [...new Set(SIDEBAR.map((s) => s.group))];
  const activeItem = SIDEBAR.find((s) => s.id === active);

  function selectSection(id: Section) {
    setActive(id);
    setNavOpen(false);
  }

  return (
    <div className="flex h-full min-h-screen relative">

      {/* Mobile overlay */}
      {navOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sub-sidebar ── */}
      {/* Mobile: fixed slide-in overlay; Desktop: always-visible static flex child */}
      <aside
        className={[
          'flex-shrink-0 border-r border-[#1a1a1a] bg-[#0a0a0a] flex flex-col',
          'w-52',
          'fixed top-0 left-0 h-screen md:static md:h-full z-40 md:z-auto',
          'transition-transform duration-200 ease-in-out',
          navOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <div className="flex items-center justify-between px-4 py-5 border-b border-[#1a1a1a]">
          <p className="text-[10px] font-semibold text-[#555] uppercase tracking-widest">Marketing</p>
          <button
            onClick={() => setNavOpen(false)}
            className="md:hidden p-1.5 text-[#555] hover:text-white transition rounded-lg hover:bg-[#1a1a1a]"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {groups.map((group) => (
            <div key={group}>
              <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider px-2 pb-2">{group}</p>
              <div className="space-y-1">
                {SIDEBAR.filter((s) => s.group === group).map((s) => {
                  const Icon     = s.icon;
                  const isActive = active === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => selectSection(s.id)}
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
        {/* Mobile top strip — shows current section name + hamburger to open nav */}
        <div className="md:hidden sticky top-0 z-20 flex items-center gap-2.5 px-4 h-12 bg-[#0a0a0a] border-b border-[#1a1a1a]">
          <button
            onClick={() => setNavOpen(true)}
            className="p-1.5 -ml-1 text-[#888] hover:text-white transition rounded-lg hover:bg-[#1a1a1a]"
            aria-label="Ouvrir la navigation"
          >
            <Menu size={18} />
          </button>
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: activeItem?.color ?? '#555' }}
          />
          <span className="text-sm font-semibold text-white truncate">{activeItem?.label ?? 'Marketing'}</span>
        </div>

        {active === 'sfs-of'      && <PlanningCalendar key="of"  config={OF_CONFIG} />}
        {active === 'sfs-mym'     && <PlanningCalendar key="mym" config={MYM_CONFIG} />}
        {active === 'vue-globale' && <VueGlobale />}
      </main>
    </div>
  );
}
