'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard, Users, Settings, LogOut, MessageSquare, TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS, ModuleKey } from '@/lib/users';

interface NavItem {
  href: string; label: string; icon: React.ElementType; modules: ModuleKey[];
}

const navItems: NavItem[] = [
  { href: '/dashboard',           label: 'Dashboard',  icon: LayoutDashboard, modules: ['dashboard'] },
  { href: '/dashboard/models',    label: 'Management', icon: Users,           modules: ['models'] },
  { href: '/dashboard/marketing', label: 'Marketing',  icon: TrendingUp,      modules: ['marketing_mym', 'marketing_of'] },
  { href: '/dashboard/chatter',   label: 'Chatting',   icon: MessageSquare,   modules: ['chatting'] },
  { href: '/dashboard/settings',  label: 'Paramètres', icon: Settings,        modules: ['settings'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => { logout(); router.push('/login'); };
  const userModules = user?.modules ?? [];
  const visibleItems = navItems.filter((item) => item.modules.some((m) => userModules.includes(m)));

  return (
    <aside className="flex flex-col h-screen w-64 bg-[#0a0a0a] border-r border-[#1a1a1a] fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="flex items-center justify-center px-4 py-5 border-b border-[#1a1a1a]">
        <Image src="/logo-load.png" alt="Load Agency" width={80} height={32} className="object-contain" style={{ mixBlendMode: 'lighten' }} priority />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-[#1a1a1a] text-white font-medium border-l-2 border-[#C9A84C] pl-[10px]'
                  : 'text-[#555] hover:text-[#888] hover:bg-[#141414] border-l-2 border-transparent pl-[10px]'
              }`}
            >
              <Icon size={17} style={{ color: isActive ? '#C9A84C' : '#555' }} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      {user && (
        <div className="px-3 py-4 border-t border-[#1a1a1a]">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-[#C9A84C]/15 flex items-center justify-center flex-shrink-0">
              <span className="text-[#C9A84C] text-xs font-bold uppercase">{user.firstName.charAt(0)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{user.name}</p>
              <p className="text-[#555] text-xs">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-[#555] hover:text-[#888] hover:bg-[#141414] transition-all duration-150"
          >
            <LogOut size={17} />
            Déconnexion
          </button>
        </div>
      )}
    </aside>
  );
}
