import React from 'react';
import { Cloud, Database, ShieldCheck, X } from 'lucide-react';
import { isSupabaseConfigured, supabaseUrl } from '../lib/supabase';

interface DeployGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export const DeployGuideModal: React.FC<DeployGuideModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Cloud className="h-5 w-5 text-blue-700" />
            <h3 className="text-base font-bold text-slate-900">
              Conexão Supabase + Deploy na Vercel
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-6 text-sm text-slate-700">
          <div
            className={`rounded-md border px-4 py-3 text-xs ${
              isSupabaseConfigured
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            <div>
              <strong>Projeto Supabase:</strong>{' '}
              <span className="font-mono-num">{supabaseUrl}</span>
            </div>
            <div className="mt-1">
              <strong>Chave pública (VITE_SUPABASE_ANON_KEY):</strong>{' '}
              {isSupabaseConfigured
                ? 'Configurada no ambiente atual.'
                : 'Pendente — configure VITE_SUPABASE_ANON_KEY com a Publishable Key no .env / Vercel.'}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 p-4">
              <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                <Database className="h-4 w-4 text-blue-700" />
                <span>1. Banco PostgreSQL + RLS no Supabase</span>
              </div>
              <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-slate-600">
                <li>
                  Acesse o painel do projeto no Supabase e abra o <strong>SQL Editor</strong>.
                </li>
                <li>
                  Cole e execute o conteúdo completo de{' '}
                  <code className="font-mono-num">supabase/schema.sql</code>.
                </li>
                <li>
                  O script cria as 8 tabelas, numeração automática de pedidos, catálogo inicial e políticas <strong>RLS</strong> protegendo todos os dados para usuários autenticados.
                </li>
              </ol>
            </div>

            <div className="rounded-md border border-slate-200 p-4">
              <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                <span>2. Variáveis e Deploy na Vercel</span>
              </div>
              <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-slate-600">
                <li>
                  Em <strong>Project Settings &gt; Environment Variables</strong> na Vercel, cadastre{' '}
                  <code className="font-mono-num">VITE_SUPABASE_URL</code> e{' '}
                  <code className="font-mono-num">VITE_SUPABASE_ANON_KEY</code>.
                </li>
                <li>
                  Nunca utilize a <code className="font-mono-num">service_role</code> key no frontend.
                </li>
                <li>
                  No Supabase Auth, adicione a URL da Vercel em <strong>Authentication &gt; URL Configuration</strong>.
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
