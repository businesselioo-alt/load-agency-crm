'use client';

import { useState, useMemo } from 'react';
import { CalendarDays, BarChart2, UserCheck, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ShiftPlanning    from '@/components/chatting/ShiftPlanning';
import ChatterView      from '@/components/chatting/ChatterView';
import ModelCADashboard from '@/components/chatting/ModelCADashboard';
import ChatterList      from '@/components/chatting/ChatterList';

type Section = 'plan-of' | 'plan-mym' | 'dashboard' | 'mon-planning' | 'chatters';

interface SidebarItem {
  id: Section;
  label: string;
  sub?: string;
  color: string;
  icon: React.ElementType;
  group: string;
  adminOnly?: boolean;
}

const SIDEBAR: SidebarItem[] = [
  { id: 'mon-planning', label: 'Mon Planning',   sub: 'mes shifts',    color: '#10b981', icon: UserCheck,    group: 'Mon espace' },
  { id: 'plan-of',      label: 'Planning OF',    sub: '7 models',      color: '#a855f7', icon: CalendarDays, group: 'Planning', adminOnly: true },
  { id: 'plan-mym',     label: 'Planning MYM',   sub: '22 models',     color: '#ec4899', icon: CalendarDays, group: 'Planning', adminOnly: true },
  { id: 'dashboard',    label: 'Dashboard CA',   sub: 'OF & MYM',      color: '#f97316', icon: BarChart2,    group: 'Suivi',    adminOnly: true },
  { id: 'chatters',     label: 'Chatters',       sub: 'gestion',       color: '#10b981', icon: Users,        group: 'Gestion',  adminOnly: true },
];

export default function ChatterPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  const visibleItems = useMemo(
    () => SIDEBAR.filter((s) => !s.adminOnly || isAdmin),
    [isAdmin],
  );

  const groups = [...new Set(visibleItems.map((s) => s.group))];

  const [active, setActive] = useState<Section>(isAdmin ? 'plan-of' : 'mon-planning');

  return (
    <div className="flex h-full min-h-screen">
      {/* ── Sub-sidebar ── */}
      <aside className="w-52 flex-shrink-0 border-r border-[#1a1a1a] bg-[#0a0a0a] flex flex-col">
        <div className="px-4 py-5 border-b border-[#1a1a1a]">
          <p className="text-[10px] font-semibold text-[#555] uppercase tracking-widest">Chatting</p>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {groups.map((group) => (
            <div key={group}>
              <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider px-2 pb-2">{group}</p>
              <div className="space-y-1">
                {visibleItems.filter((s) => s.group === group).map((s) => {
                  const Icon     = s.icon;
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
        {active === 'plan-of'      && <ShiftPlanning    platform="of" />}
        {active === 'plan-mym'     && <ShiftPlanning    platform="mym" />}
        {active === 'dashboard'    && <ModelCADashboard />}
        {active === 'mon-planning' && <ChatterView />}
        {active === 'chatters'     && <ChatterList />}
      </main>
    </div>
  );
}
