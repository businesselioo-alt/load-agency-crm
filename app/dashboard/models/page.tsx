'use client';

import { useState } from 'react';
import { BarChart2, BookOpen } from 'lucide-react';
import SuiviContenTab from '@/components/models/SuiviContenTab';
import ResourcesTab from '@/components/models/ResourcesTab';
import { useAuth } from '@/contexts/AuthContext';

type TabId = 'suivi' | 'ressources';

export default function ManagementPage() {
  const { user } = useAuth();
  const isModel = user?.role === 'model';

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = isModel
    ? [{ id: 'suivi', label: 'Mon contenu', icon: BarChart2 }]
    : [
        { id: 'suivi', label: 'Suivi Contenu', icon: BarChart2 },
        { id: 'ressources', label: 'Ressources', icon: BookOpen },
      ];

  const [activeTab, setActiveTab] = useState<TabId>('suivi');

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">
          {isModel ? 'Mon contenu' : 'Management'}
        </h1>
        <p className="text-[#888] text-sm">
          {isModel
            ? 'Note ici ce que tu déposes sur le Drive, catégorie par catégorie.'
            : 'Suivi du contenu et ressources des créatrices.'}
        </p>
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-1 bg-[#111] rounded-xl p-1.5 border border-[#222] w-fit mb-6 flex-wrap">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === id
                  ? 'bg-[#C9A84C] text-black shadow-sm'
                  : 'text-[#555] hover:text-[#888] hover:bg-[#1a1a1a]'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'suivi' ? <SuiviContenTab /> : <ResourcesTab />}
    </div>
  );
}
