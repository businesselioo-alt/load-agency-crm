'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, X, Edit2, Trash2, Eye, EyeOff, Check,
  LayoutDashboard, Users, Receipt, TrendingUp, MessageSquare,
  Calendar, Settings, Shield, AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  CRMUser, UserRole, ModuleKey,
  MODULE_CONFIG, ROLE_LABELS, ROLE_COLORS, ROLE_DEFAULT_MODULES,
  makeUser,
} from '@/lib/users';

// ─── Module icon map ──────────────────────────────────────────────────────────
const MODULE_ICONS: Record<ModuleKey, React.ElementType> = {
  dashboard:     LayoutDashboard,
  models:        Users,
  invoices:      Receipt,
  marketing_mym: TrendingUp,
  marketing_of:  TrendingUp,
  chatting:      MessageSquare,
  calendar:      Calendar,
  settings:      Settings,
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function Avatar({ user }: { user: CRMUser }) {
  const c = ROLE_COLORS[user.role];
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0) || ''}`.toUpperCase();
  return (
    <div className={`w-10 h-10 rounded-full ${c.bg} border ${c.border} flex items-center justify-center flex-shrink-0 font-bold text-sm ${c.text}`}>
      {initials}
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const c = ROLE_COLORS[role];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${c.bg} ${c.text} border ${c.border}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function ModuleChips({ modules }: { modules: ModuleKey[] }) {
  const shown = modules.slice(0, 3);
  const rest = modules.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {shown.map((m) => {
        const cfg = MODULE_CONFIG.find((c) => c.key === m)!;
        return (
          <span key={m} className="px-1.5 py-0.5 bg-[#222] text-[#888] text-[10px] rounded-md font-medium">
            {cfg.label.replace('Marketing SFS ', '')}
          </span>
        );
      })}
      {rest > 0 && <span className="text-[10px] text-[#555] font-medium">+{rest}</span>}
    </div>
  );
}

function StatusBadge({ status }: { status: 'active' | 'inactive' }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
      status === 'active'
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : 'bg-[#1a1a1a] text-[#555] border-[#333]'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-500' : 'bg-[#555]'}`} />
      {status === 'active' ? 'Actif' : 'Inactif'}
    </div>
  );
}

// ─── Form state ───────────────────────────────────────────────────────────────
interface FormState {
  firstName: string;
  lastName:  string;
  email:     string;
  password:  string;
  role:      UserRole;
  modules:   ModuleKey[];
  status:    'active' | 'inactive';
}

const EMPTY_FORM: FormState = {
  firstName: '',
  lastName:  '',
  email:     '',
  password:  '',
  role:      'manager',
  modules:   ROLE_DEFAULT_MODULES['manager'],
  status:    'active',
};

type ModalMode = 'closed' | 'add' | 'edit';

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();
  const { user: me, users, addUser, updateUser, deleteUser, isLoading } = useAuth();

  const [modalMode, setModalMode]           = useState<ModalMode>('closed');
  const [editingUser, setEditingUser]       = useState<CRMUser | null>(null);
  const [form, setForm]                     = useState<FormState>(EMPTY_FORM);
  const [showPassword, setShowPassword]     = useState(false);
  const [formError, setFormError]           = useState('');
  const [isSaving, setIsSaving]             = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg]         = useState('');

  useEffect(() => {
    if (!isLoading && me && me.role !== 'admin') router.replace('/dashboard');
  }, [me, isLoading, router]);

  const flash = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // ── Open add modal ──────────────────────────────────────────────────────────
  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setShowPassword(false);
    setEditingUser(null);
    setModalMode('add');
  };

  // ── Open edit modal ─────────────────────────────────────────────────────────
  const openEdit = (u: CRMUser) => {
    setForm({
      firstName: u.firstName,
      lastName:  u.lastName,
      email:     u.email,
      password:  '',
      role:      u.role,
      modules:   [...u.modules],
      status:    u.status,
    });
    setFormError('');
    setShowPassword(false);
    setEditingUser(u);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode('closed');
    setEditingUser(null);
    setFormError('');
  };

  // ── Role → auto-fill modules ────────────────────────────────────────────────
  const handleRoleChange = (role: UserRole) => {
    setForm((f) => ({ ...f, role, modules: [...ROLE_DEFAULT_MODULES[role]] }));
  };

  const toggleModule = (key: ModuleKey) => {
    setForm((f) => ({
      ...f,
      modules: f.modules.includes(key) ? f.modules.filter((m) => m !== key) : [...f.modules, key],
    }));
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const { firstName, email, password, role, modules, status } = form;

    if (!firstName.trim())    { setFormError('Le prénom est requis.'); return; }
    if (!email.trim())        { setFormError("L'email est requis."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFormError("L'email n'est pas valide."); return; }
    if (modalMode === 'add' && !password) { setFormError('Le mot de passe est requis.'); return; }
    if (modules.length === 0) { setFormError('Sélectionnez au moins un module.'); return; }

    const emailConflict = users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.id !== editingUser?.id
    );
    if (emailConflict) { setFormError('Cette adresse email est déjà utilisée.'); return; }

    setIsSaving(true);
    try {
      if (modalMode === 'add') {
        const created = makeUser({
          firstName: firstName.trim(),
          lastName:  form.lastName.trim(),
          email:     email.trim().toLowerCase(),
          password,
          role,
          modules,
          status: 'active',
        });
        await addUser(created);
        flash(`${created.name || created.firstName} a été ajouté(e).`);
      } else if (editingUser) {
        const finalStatus = editingUser.id === me?.id ? 'active' : status;
        const updated: CRMUser = {
          ...editingUser,
          firstName: firstName.trim(),
          lastName:  form.lastName.trim(),
          name:      `${firstName.trim()} ${form.lastName.trim()}`.trim(),
          email:     email.trim().toLowerCase(),
          password:  password || editingUser.password,
          role,
          modules,
          status: finalStatus,
        };
        await updateUser(updated);
        flash('Modifications enregistrées.');
      }
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = (id: string) => {
    const target = users.find((u) => u.id === id);
    deleteUser(id);
    setConfirmDeleteId(null);
    flash(`${target?.name || 'Utilisateur'} supprimé(e).`);
  };

  if (isLoading) return null;
  if (!me || me.role !== 'admin') return null;

  const activeCount = users.filter((u) => u.status === 'active').length;

  return (
    <div className="p-8">
      {/* Toast */}
      {successMsg && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-xl text-sm font-medium">
          <Check size={15} />
          {successMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs font-medium text-[#555] uppercase tracking-wider mb-1">Paramètres</p>
          <h1 className="text-2xl font-bold text-white">Gestion des accès</h1>
          <p className="text-sm text-[#888] mt-1">Gérez les membres de l'équipe et leurs permissions.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#C9A84C] text-black rounded-xl text-sm font-semibold hover:bg-[#E2C06A] transition shadow-sm"
        >
          <Plus size={17} />
          Ajouter un membre
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total membres',    value: users.length,       color: 'text-white' },
          { label: 'Actifs',           value: activeCount,        color: 'text-emerald-400' },
          { label: 'Managers',         value: users.filter((u) => u.role === 'manager').length, color: 'text-blue-400' },
          { label: 'Admins',           value: users.filter((u) => u.role === 'admin').length,   color: 'text-[#C9A84C]' },
        ].map((s) => (
          <div key={s.label} className="bg-[#111] rounded-2xl border border-[#222] p-4">
            <p className="text-xs text-[#888] mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* User table */}
      <div className="bg-[#111] rounded-2xl border border-[#222] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1a1a1a]">
          <h2 className="text-sm font-semibold text-[#888]">Membres de l'équipe</h2>
        </div>

        <div className="divide-y divide-[#1a1a1a]">
          {users.map((u) => (
            <div
              key={u.id}
              className={`flex items-center gap-4 px-6 py-4 transition-colors ${
                confirmDeleteId === u.id ? 'bg-red-500/5' : 'hover:bg-[#1a1a1a]'
              }`}
            >
              <Avatar user={u} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white truncate">{u.name}</p>
                  {u.id === me.id && (
                    <span className="px-1.5 py-0.5 bg-[#C9A84C]/10 text-[#C9A84C] text-[10px] font-semibold rounded">
                      vous
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#888] truncate">{u.email}</p>
              </div>

              <div className="hidden sm:block w-28 flex-shrink-0">
                <RoleBadge role={u.role} />
              </div>

              <div className="hidden lg:block w-52 flex-shrink-0">
                <ModuleChips modules={u.modules} />
              </div>

              <div className="hidden md:block w-24 flex-shrink-0">
                <StatusBadge status={u.status} />
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => openEdit(u)}
                  className="p-2 text-[#555] hover:text-[#C9A84C] hover:bg-[#C9A84C]/10 rounded-lg transition"
                >
                  <Edit2 size={15} />
                </button>

                {u.id !== me.id ? (
                  confirmDeleteId === u.id ? (
                    <div className="flex items-center gap-1.5 ml-1">
                      <span className="text-xs text-red-400 font-medium">Confirmer ?</span>
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="px-2.5 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition font-medium"
                      >
                        Oui
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="p-1 text-[#555] hover:bg-[#1a1a1a] rounded-lg transition"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(u.id)}
                      className="p-2 text-[#555] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                    >
                      <Trash2 size={15} />
                    </button>
                  )
                ) : (
                  <div className="w-8" />
                )}
              </div>
            </div>
          ))}

          {users.length === 0 && (
            <div className="px-6 py-12 text-center text-[#555] text-sm">
              Aucun membre pour le moment.
            </div>
          )}
        </div>
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────────── */}
      {modalMode !== 'closed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-[#111] border border-[#222] rounded-2xl shadow-2xl w-full max-w-2xl z-10 flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#222] flex-shrink-0">
              <div>
                <h2 className="font-semibold text-white">
                  {modalMode === 'add' ? 'Ajouter un membre' : `Modifier — ${editingUser?.name}`}
                </h2>
                <p className="text-xs text-[#888] mt-0.5">
                  {modalMode === 'add'
                    ? 'Créez un compte et définissez ses accès.'
                    : 'Mettez à jour les informations et les permissions.'}
                </p>
              </div>
              <button onClick={closeModal} className="p-1.5 text-[#555] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition">
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <form id="user-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-6">
              {formError && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  {formError}
                </div>
              )}

              {/* Identité */}
              <div>
                <h3 className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-3">Identité</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5">Prénom *</label>
                    <input
                      type="text"
                      required
                      value={form.firstName}
                      onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                      placeholder="ex : Sadie"
                      className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#333] rounded-xl text-sm text-white placeholder-[#555] outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5">Nom</label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                      placeholder="ex : Martin"
                      className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#333] rounded-xl text-sm text-white placeholder-[#555] outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 transition"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-[#888] mb-1.5">
                      Adresse email *
                      <span className="font-normal text-[#555] ml-1">(identifiant de connexion)</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="prenom@loadagency.com"
                      className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#333] rounded-xl text-sm text-white placeholder-[#555] outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 transition"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-[#888] mb-1.5">
                      {modalMode === 'add' ? 'Mot de passe temporaire *' : 'Nouveau mot de passe'}
                      {modalMode === 'edit' && (
                        <span className="font-normal text-[#555] ml-1">(laisser vide pour ne pas changer)</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required={modalMode === 'add'}
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        placeholder={modalMode === 'add' ? 'Minimum 6 caractères' : '••••••••'}
                        className="w-full px-3 py-2.5 pr-10 bg-[#1a1a1a] border border-[#333] rounded-xl text-sm text-white placeholder-[#555] outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#888] transition"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rôle */}
              <div>
                <h3 className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-3">Rôle</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(['admin', 'manager', 'chatter', 'compta', 'marketing', 'model'] as UserRole[]).map((r) => {
                    const c = ROLE_COLORS[r];
                    const active = form.role === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleRoleChange(r)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          active
                            ? `${c.bg} ${c.border} ${c.text} ring-2 ring-offset-0 ring-current/20`
                            : 'bg-[#1a1a1a] border-[#333] text-[#888] hover:bg-[#222]'
                        }`}
                      >
                        <Shield size={13} />
                        {ROLE_LABELS[r]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-[#555] mt-2">
                  Changer le rôle réinitialise les accès aux valeurs par défaut.
                </p>
              </div>

              {/* Modules */}
              <div>
                <h3 className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-3">
                  Accès aux modules
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {MODULE_CONFIG.map(({ key, label }) => {
                    const Icon = MODULE_ICONS[key];
                    const checked = form.modules.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleModule(key)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all text-left ${
                          checked
                            ? 'bg-[#C9A84C]/10 border-[#C9A84C]/30 text-[#C9A84C]'
                            : 'bg-[#1a1a1a] border-[#333] text-[#555] hover:bg-[#222]'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                          checked ? 'bg-[#C9A84C] border-[#C9A84C]' : 'bg-[#111] border-[#444]'
                        }`}>
                          {checked && <Check size={10} className="text-black" strokeWidth={3} />}
                        </div>
                        <Icon size={14} className="flex-shrink-0" />
                        <span className={`font-medium ${checked ? '' : 'text-[#555]'}`}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Statut (edit only) */}
              {modalMode === 'edit' && (
                <div>
                  <h3 className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-3">
                    Statut du compte
                  </h3>
                  <div className="flex gap-2">
                    {(['active', 'inactive'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={s === 'inactive' && editingUser?.id === me.id}
                        onClick={() => setForm((f) => ({ ...f, status: s }))}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          form.status === s
                            ? s === 'active'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 ring-2 ring-emerald-500/20'
                              : 'bg-[#1a1a1a] border-[#444] text-[#888] ring-2 ring-[#333]'
                            : 'bg-[#1a1a1a] border-[#333] text-[#555] hover:bg-[#222]'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${s === 'active' ? 'bg-emerald-500' : 'bg-[#555]'}`} />
                        {s === 'active' ? 'Actif' : 'Inactif'}
                      </button>
                    ))}
                  </div>
                  {editingUser?.id === me.id && (
                    <p className="mt-2 text-xs text-amber-400 flex items-center gap-1.5">
                      <AlertCircle size={12} />
                      Vous ne pouvez pas désactiver votre propre compte.
                    </p>
                  )}
                </div>
              )}
            </form>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#222] flex-shrink-0 bg-[#0f0f0f] rounded-b-2xl">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving}
                className="px-4 py-2.5 text-sm text-[#888] border border-[#333] rounded-xl hover:bg-[#1a1a1a] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Annuler
              </button>
              <button
                type="submit"
                form="user-form"
                disabled={isSaving}
                className="px-5 py-2.5 bg-[#C9A84C] text-black text-sm font-semibold rounded-xl hover:bg-[#E2C06A] transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Enregistrement…' : modalMode === 'add' ? 'Créer le compte' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
