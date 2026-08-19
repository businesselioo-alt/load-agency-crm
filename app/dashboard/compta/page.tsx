'use client';

import BillingTab from '@/components/compta/BillingTab';
import { useAuth } from '@/contexts/AuthContext';

export default function ComptaPage() {
  const { user } = useAuth();

  const allowed = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'compta';

  if (!allowed) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-10 text-center">
          <p className="text-white font-medium mb-1">Accès restreint</p>
          <p className="text-[#666] text-sm">
            Le module Compta Modèle est réservé aux rôles Admin, Manager et Comptable.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Compta Modèle</h1>
        <p className="text-[#888] text-sm">
          Fiches de facturation des créatrices : identité, adresse et société à facturer.
        </p>
      </div>

      <BillingTab />
    </div>
  );
}
