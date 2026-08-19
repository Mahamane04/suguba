'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Scale, Award, Lock } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 py-8 px-4 sm:px-6 mt-12">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Brand info */}
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-xs">
            S
          </div>
          <div>
            <span className="text-white font-bold text-sm tracking-tight">SUGUBA.ML</span>
            <span className="block text-[10px] text-slate-500">© 2026 Suguba Technologies Mali — Bamako</span>
          </div>
        </div>

        {/* Legal & B2B links */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-300">
          <Link href="/diaspora" className="text-indigo-400 hover:underline font-bold">
            🌍 Espace Diaspora (Cadeaux Famille)
          </Link>
          <Link href="/b2b/partner" className="text-amber-400 hover:underline font-bold">
            🤝 Devenir Partenaire Entreprise
          </Link>
          <Link href="/b2b/quote" className="text-emerald-400 hover:underline font-bold">
            🏢 Devis & Proforma B2B
          </Link>
          <Link href="/legal/terms" className="hover:text-emerald-400 transition-colors">
            Conditions Générales
          </Link>
          <Link href="/legal/reseller-agreement" className="hover:text-emerald-400 transition-colors">
            Contrat Revendeur
          </Link>
          <Link href="/legal/privacy" className="hover:text-emerald-400 transition-colors">
            Confidentialité (APDP)
          </Link>
          <Link href="/legal/warranty" className="hover:text-emerald-400 transition-colors">
            Garantie & SAV
          </Link>
        </div>

        {/* Region compliance badge */}
        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-emerald-400 font-bold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Zone UEMOA / Mali</span>
        </div>

      </div>
    </footer>
  );
}
