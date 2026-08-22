'use client';

import { useState } from 'react';
import { ClipboardCheck, Wallet, Building2, Banknote } from 'lucide-react';
import ValidationTab from '@/components/compta/ValidationTab';
import DeclarationTab from '@/components/compta/DeclarationTab';
import AgencyTab from '@/components/compta/AgencyTab';
import PaymentsTab from '@/components/compta/PaymentsTab';
import { useAuth } from '@/contexts/AuthContext';

type TabId = 'validation' | 'paiements' | 'agence' | 'declaration';

export default function ComptaPage() {
  const { user } = useAuth();

  const isAgency = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'compta';
  const isModel = user?.role === 'model';
  // Le suivi des encaissements est la vue financière consolidée de l'agence :
  // réservée à l'admin, pas aux managers.
  const isAdmin = user?.role === 'admin';

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = isAgency
    ? [
        { id: 'validation', label: 'Déclarations', icon: ClipboardCheck },
        ...(isAdmin ? [{ id: 'paiements' as TabId, label: 'Paiements', icon: Banknote }] : []),
        { id: 'agence', label: 'Agence', icon: Building2 },
      ]
    : [{ id: 'declaration', label: 'Ma comptabilité', icon: Wallet }];

  const [activeTab, setActiveTab] = useState<TabId>(tabs[0]?.id ?? 'declaration');

  if (!isAgency && !isModel) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-10 text-center">
          <p className="text-white font-medium mb-1">Accès restreint</p>
          <p className="text-[#666] text-sm">
            Ce module est réservé aux rôles Admin, Manager, Comptable et Model.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">
          {isAgency ? 'Compta Modèle' : 'Ma comptabilité'}
        </h1>
        <p className="text-[#888] text-sm">
          {isAgency
            ? 'Montants déclarés, validation des commissions et suivi des encaissements.'
            : 'Déclare le montant que tu as reçu sur chaque période.'}
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

      {activeTab === 'validation' && <ValidationTab />}
      {activeTab === 'paiements' && isAdmin && <PaymentsTab />}
      {activeTab === 'agence' && <AgencyTab />}
      {activeTab === 'declaration' && <DeclarationTab />}
    </div>
  );
}
