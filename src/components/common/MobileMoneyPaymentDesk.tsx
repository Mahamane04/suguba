'use client';

import React, { useState } from 'react';
import { 
  Smartphone, Copy, Check, QrCode, ArrowUpRight, 
  ShieldCheck, Zap, Info, CheckCircle2, PhoneCall
} from 'lucide-react';

interface MobileMoneyPaymentDeskProps {
  amount: number;
  orderNumber: string;
  depositOnly?: boolean;
}

export default function MobileMoneyPaymentDesk({
  amount,
  orderNumber,
  depositOnly = false
}: MobileMoneyPaymentDeskProps) {
  const [copiedWave, setCopiedWave] = useState(false);
  const [copiedOm, setCopiedOm] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'wave' | 'orange' | 'moov'>('wave');

  const merchantPhone = '+223 89 46 00 00';
  const merchantPhoneDigits = '89460000';
  const finalAmount = depositOnly ? 3000 : amount;

  // USSD Dial Strings for Mali
  const omUssdCode = `#144#2*1*${merchantPhoneDigits}*${finalAmount}#`;
  const moovUssdCode = `*166*2*1*${merchantPhoneDigits}*${finalAmount}#`;
  const wavePayLink = `https://pay.wave.com/m/M_suguba_mali?amount=${finalAmount}&memo=${encodeURIComponent(`Commande #${orderNumber}`)}`;

  const handleCopy = (text: string, type: 'wave' | 'om') => {
    navigator.clipboard.writeText(text);
    if (type === 'wave') {
      setCopiedWave(true);
      setTimeout(() => setCopiedWave(false), 2000);
    } else {
      setCopiedOm(true);
      setTimeout(() => setCopiedOm(false), 2000);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm text-left space-y-5">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-sm">
            ⚡
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">
              {depositOnly ? "Paiement de l'Acompte Sécurisé" : "Paiement Mobile Money Rapide"}
            </h3>
            <p className="text-[11px] text-slate-500">
              Montant à régler : <strong className="text-emerald-700 font-bold font-mono">{finalAmount.toLocaleString('fr-FR')} FCFA</strong>
            </p>
          </div>
        </div>

        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-black border border-emerald-200">
          Zéro Frais
        </span>
      </div>

      {/* Operator Tabs */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setSelectedMethod('wave')}
          className={`py-2.5 px-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center space-y-1 ${
            selectedMethod === 'wave'
              ? 'bg-[#1DA1F2] text-white shadow-md shadow-[#1DA1F2]/20'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span className="text-sm">🔵</span>
          <span>Wave Mali</span>
        </button>

        <button
          onClick={() => setSelectedMethod('orange')}
          className={`py-2.5 px-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center space-y-1 ${
            selectedMethod === 'orange'
              ? 'bg-[#FF6600] text-white shadow-md shadow-[#FF6600]/20'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span className="text-sm">🟠</span>
          <span>Orange Money</span>
        </button>

        <button
          onClick={() => setSelectedMethod('moov')}
          className={`py-2.5 px-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center space-y-1 ${
            selectedMethod === 'moov'
              ? 'bg-[#008000] text-white shadow-md shadow-[#008000]/20'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span className="text-sm">🟢</span>
          <span>Moov Money</span>
        </button>
      </div>

      {/* WAVE CONTENT */}
      {selectedMethod === 'wave' && (
        <div className="bg-[#1DA1F2]/5 border border-[#1DA1F2]/20 rounded-2xl p-4 space-y-3.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-bold">Compte Marchand Wave :</span>
            <span className="font-mono font-black text-slate-900">{merchantPhone}</span>
          </div>

          <div className="space-y-2">
            <a
              href={wavePayLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-[#1DA1F2] hover:bg-[#1a90d9] text-white font-black rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-[#1DA1F2]/20 transition-transform active:scale-95"
            >
              <Zap className="w-4 h-4" />
              <span>Ouvrir l&apos;Application Wave ({finalAmount.toLocaleString('fr-FR')} F)</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={() => handleCopy(merchantPhoneDigits, 'wave')}
              className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl text-[11px] flex items-center justify-center space-x-1.5"
            >
              {copiedWave ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedWave ? 'Numéro Copié !' : 'Copier le Numéro Marchand (89 46 00 00)'}</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-500 text-center">
            💡 Indiquez votre numéro de commande <strong>#{orderNumber}</strong> en motif de transfert.
          </p>
        </div>
      )}

      {/* ORANGE MONEY CONTENT */}
      {selectedMethod === 'orange' && (
        <div className="bg-[#FF6600]/5 border border-[#FF6600]/20 rounded-2xl p-4 space-y-3.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-bold">Code Court USSD Orange :</span>
            <span className="font-mono font-black text-[#FF6600]">#144#</span>
          </div>

          <div className="space-y-2">
            <a
              href={`tel:${encodeURIComponent(omUssdCode)}`}
              className="w-full py-3 bg-[#FF6600] hover:bg-[#e65c00] text-white font-black rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-[#FF6600]/20 transition-transform active:scale-95"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Composer le Code USSD Automatique</span>
            </a>

            <button
              onClick={() => handleCopy(omUssdCode, 'om')}
              className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl text-[11px] flex items-center justify-center space-x-1.5"
            >
              {copiedOm ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedOm ? 'Code USSD Copié !' : `Copier : ${omUssdCode}`}</span>
            </button>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <p className="font-bold text-slate-900">Procédure Manuelle :</p>
            <p>1. Tapez <strong>#144#</strong> sur votre téléphone</p>
            <p>2. Choisissez <strong>1 (Paiement Marchand)</strong></p>
            <p>3. Numéro Suguba : <strong>89 46 00 00</strong></p>
            <p>4. Montant : <strong>{finalAmount.toLocaleString('fr-FR')} FCFA</strong></p>
          </div>
        </div>
      )}

      {/* MOOV MONEY CONTENT */}
      {selectedMethod === 'moov' && (
        <div className="bg-[#008000]/5 border border-[#008000]/20 rounded-2xl p-4 space-y-3.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-bold">Code Court USSD Moov :</span>
            <span className="font-mono font-black text-[#008000]">*166#</span>
          </div>

          <div className="space-y-2">
            <a
              href={`tel:${encodeURIComponent(moovUssdCode)}`}
              className="w-full py-3 bg-[#008000] hover:bg-[#006e00] text-white font-black rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-[#008000]/20 transition-transform active:scale-95"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Composer le Code USSD Automatique</span>
            </a>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <p className="font-bold text-slate-900">Procédure Manuelle :</p>
            <p>1. Tapez <strong>*166#</strong> $\rightarrow$ 2. Option Marchand</p>
            <p>3. Numéro Suguba : <strong>89 46 00 00</strong></p>
          </div>
        </div>
      )}

    </div>
  );
}
