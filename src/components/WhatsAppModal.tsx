import React, { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Client, Order, SystemConfig, WhatsAppTemplateKey } from '../types';
import { buildWhatsAppMessage, formatPhone, waPhone } from '../utils/formatters';

interface WhatsAppModalProps {
  order: Order | null;
  client: Client | null;
  config: SystemConfig;
  onClose: () => void;
}

const TEMPLATE_LABELS: Record<WhatsAppTemplateKey, string> = {
  registro: 'Registro do pedido',
  confirmacao: 'Confirmação do pedido',
  producao: 'Pedido em produção',
  pronto: 'Pedido pronto para retirada',
  entregue: 'Pedido entregue',
};

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  order,
  client,
  config,
  onClose,
}) => {
  const [templateKey, setTemplateKey] = useState<WhatsAppTemplateKey>('registro');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!order || !client) return;
    const statusMap: Record<string, WhatsAppTemplateKey> = {
      aguardando_confirmacao: 'registro',
      confirmado: 'confirmacao',
      em_producao: 'producao',
      pronto_retirada: 'pronto',
      entregue: 'entregue',
    };
    const initialKey = statusMap[order.status] ?? 'registro';
    setTemplateKey(initialKey);
    setMessage(buildWhatsAppMessage(config.templates[initialKey], order, client, config));
  }, [order, client, config]);

  if (!order || !client) return null;

  const handleTemplateChange = (key: WhatsAppTemplateKey) => {
    setTemplateKey(key);
    setMessage(buildWhatsAppMessage(config.templates[key], order, client, config));
  };

  const waUrl = `https://wa.me/${waPhone(client.telefone)}?text=${encodeURIComponent(message)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Enviar Mensagem pelo WhatsApp</h3>
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

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
              <input
                type="text"
                readOnly
                value={client.nome}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Telefone / WhatsApp</label>
              <input
                type="text"
                readOnly
                value={formatPhone(client.telefone)}
                className="font-mono-num w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Modelo de mensagem</label>
            <select
              value={templateKey}
              onChange={(e) => handleTemplateChange(e.target.value as WhatsAppTemplateKey)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {(Object.keys(TEMPLATE_LABELS) as WhatsAppTemplateKey[]).map((key) => (
                <option key={key} value={key}>
                  {TEMPLATE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Revise a mensagem antes de enviar
            </label>
            <textarea
              rows={9}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              Utiliza o link oficial <span className="font-mono-num">https://wa.me/</span> sem APIs pagas.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            Cancelar
          </button>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Abrir no WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
};
