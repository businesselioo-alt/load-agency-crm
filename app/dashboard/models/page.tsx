'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Users, BarChart2, Receipt, BookOpen, Calendar, FileText } from 'lucide-react';
import InfosTab from '@/components/models/InfosTab';
import SuiviContenTab from '@/components/models/SuiviContenTab';
import InvoicesTab from '@/components/models/InvoicesTab';
import ResourcesTab from '@/components/models/ResourcesTab';
import ScheduleTab from '@/components/models/ScheduleTab';
import AnnexTab from '@/components/models/AnnexTab';
import { MODELS } from '@/lib/data';
import { useAuth } from '@/contexts/AuthContext';

type TabId = 'infos' | 'suivi' | 'invoices' | 'ressources' | 'schedule' | 'annex';

interface Tab { id: TabId; label: string; icon: React.ElementType; adminOnly?: boolean }

const ALL_TABS: Tab[] = [
  { id: 'infos',      label: 'Infos',          icon: Users },
  { id: 'suivi',      label: 'Suivi Contenu',  icon: BarChart2 },
  { id: 'invoices',   label: 'Invoices',        icon: Receipt },
  { id: 'ressources', label: 'Ressources',      icon: BookOpen },
  { id: 'schedule',   label: 'Schedule',        icon: Calendar },
  { id: 'annex',      label: 'Annex',           icon: FileText, adminOnly: true },
];

function ModelsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabId | null;

  const canSeeAnnex = user?.role === 'admin' || user?.role === 'manager';
  const visibleTabs = ALL_TABS.filter((t) => !t.adminOnly || canSeeAnnex);

  const defaultTab: TabId = tabParam && visibleTabs.some((t) => t.id === tabParam) ? tabParam : 'infos';
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  useEffect(() => {
    if (tabParam && visibleTabs.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  // If user can't see the current tab, reset to infos
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) setActiveTab('infos');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeAnnex]);

  const renderTab = () => {
    switch (activeTab) {
      case 'infos':      return <InfosTab />;
      case 'suivi':      return <SuiviContenTab />;
      case 'invoices':   return <InvoicesTab />;
      case 'ressources': return <ResourcesTab />;
      case 'schedule':   return <ScheduleTab />;
      case 'annex':      return canSeeAnnex ? <AnnexTab /> : null;
    }
  };

  return (
    <>
      <div className="flex gap-1 bg-[#111] rounded-xl p-1.5 border border-[#222] w-fit mb-6 flex-wrap">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
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

      {renderTab()}
    </>
  );
}

export default function ModelsPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-white">Models</h1>
          <span className="px-3 py-1.5 bg-[#C9A84C]/10 text-[#C9A84C] rounded-lg text-sm font-medium">
            {MODELS.length} models
          </span>
        </div>
        <p className="text-[#888] text-sm">Gérez les créatrices de contenu de Load Agency</p>
      </div>

      <Suspense fallback={<div className="h-12 bg-[#111] rounded-xl animate-pulse" />}>
        <ModelsContent />
      </Suspense>
    </div>
  );
}
