'use client';

import React from 'react';

// Primitives de formulaire « dark premium » du module Compta.

const base =
  'w-full px-3 py-2.5 bg-[#0f0f0f] border border-[#222] rounded-xl text-sm text-white ' +
  'placeholder:text-[#444] outline-none transition-colors focus:border-[#C9A84C]/60 ' +
  'focus:ring-2 focus:ring-[#C9A84C]/10 disabled:opacity-50';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[#111] border border-[#1f1f1f] rounded-2xl ${className}`}>{children}</div>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-4">{children}</h3>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-[#888] mb-1.5">
        {label}
        {required && <span className="text-[#C9A84C] ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-[#555] mt-1">{hint}</p>}
    </div>
  );
}

export function TextInput({ className = '', ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${base} ${className}`} />;
}

export function TextArea({ className = '', ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={`${base} resize-none leading-relaxed ${className}`} />;
}

export function GoldButton({
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={
        'inline-flex items-center gap-2 px-4 py-2.5 bg-[#C9A84C] text-black rounded-xl text-sm font-semibold ' +
        'hover:bg-[#d9b95c] active:bg-[#b89840] transition disabled:opacity-40 disabled:cursor-not-allowed ' +
        className
      }
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={
        'inline-flex items-center gap-2 px-4 py-2.5 border border-[#2a2a2a] text-[#888] rounded-xl text-sm ' +
        'hover:text-white hover:border-[#3a3a3a] hover:bg-[#161616] transition disabled:opacity-40 ' +
        className
      }
    >
      {children}
    </button>
  );
}

export function Banner({ kind, message }: { kind: 'ok' | 'error' | 'info'; message: string }) {
  const styles = {
    ok: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
    error: 'bg-red-500/10 border-red-500/25 text-red-300',
    info: 'bg-[#C9A84C]/10 border-[#C9A84C]/25 text-[#C9A84C]',
  }[kind];
  return <div className={`px-4 py-3 rounded-xl border text-sm ${styles}`}>{message}</div>;
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="py-14 text-center">
      <p className="text-[#666] text-sm font-medium">{title}</p>
      {subtitle && <p className="text-[#444] text-xs mt-1">{subtitle}</p>}
    </div>
  );
}

/**
 * Champ numérique.
 *
 * Un <input type="number"> manipule du texte : si le champ affiche « 0 » et
 * qu'on tape « 70 » à la suite, la valeur brute devient « 070 » et reste
 * affichée ainsi. On tient donc une chaîne locale pendant la saisie, on
 * supprime les zéros de tête, et on ne réaffiche la valeur du parent qu'une
 * fois le champ quitté. Un zéro s'affiche comme un champ vide, pour qu'on
 * puisse taper directement par-dessus.
 */
export function NumberInput({
  value,
  onValueChange,
  className = '',
  onFocus,
  onBlur,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number;
  onValueChange: (n: number) => void;
}) {
  const [text, setText] = React.useState('');
  const [focused, setFocused] = React.useState(false);

  const asText = (n: number) => (n === 0 ? '' : String(n));
  const display = focused ? text : asText(value);

  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      value={display}
      onFocus={(e) => {
        setText(asText(value));
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/^(-?)0+(?=\d)/, '$1');
        setText(cleaned);
        onValueChange(cleaned === '' || cleaned === '-' ? 0 : Number(cleaned));
      }}
      className={`${base} ${className}`}
    />
  );
}
