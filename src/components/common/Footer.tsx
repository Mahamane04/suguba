'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Globe, Handshake, FileText, Phone } from 'lucide-react';

const legalLinks = [
  { href: '/legal/terms',              label: 'Conditions générales' },
  { href: '/legal/reseller-agreement', label: 'Contrat Revendeur'    },
  { href: '/legal/privacy',            label: 'Confidentialité (APDP)'},
  { href: '/legal/warranty',           label: 'Garantie & SAV'       },
];

const featureLinks = [
  { href: '/reseller',  label: 'Espace Revendeur'    },
  { href: '/supplier',  label: 'Espace Fournisseur'  },
  { href: '/driver',    label: 'Espace Livreur'      },
  { href: '/diaspora',  label: 'Espace Diaspora'     },
  { href: '/b2b/partner', label: 'Devenir Partenaire'},
  { href: '/b2b/quote', label: 'Devis B2B'           },
];

export default function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400">

      {/* ── CTA Band ── */}
      <div
        className="py-10 px-4 sm:px-6 text-center"
        style={{ background: 'linear-gradient(135deg, #09b500 0%, #16a34a 60%, #065f46 100%)' }}
      >
        <p className="text-white font-black text-xl sm:text-2xl tracking-tight mb-2">
          Prêt à vendre sans stock ?
        </p>
        <p className="text-green-100 text-sm mb-5">
          Rejoignez +142 revendeurs actifs à Bamako et gagnez vos commissions par Mobile Money.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-white text-suguba-brand font-bold px-6 py-2.5 rounded-full hover:bg-green-50 transition-colors shadow-float text-sm"
        >
          Commencer gratuitement
        </Link>
      </div>

      {/* ── Main Footer Content ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">

          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-lg"
                style={{ background: 'linear-gradient(135deg, #09b500 0%, #16a34a 100%)' }}
              >
                S
              </div>
              <div>
                <span className="text-white font-black text-lg tracking-tight">SUGUBA<span className="text-suguba-brand">.ML</span></span>
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
              La plateforme de social commerce N°1 au Mali. Vendez sans stock via WhatsApp et TikTok. Commissions garanties par Mobile Money.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Phone className="w-3 h-3 text-suguba-brand" />
              <a href="tel:+22389460000" className="hover:text-white transition-colors">+223 89 46 00 00</a>
            </div>
            {/* Legal IDs */}
            <div className="text-[10px] text-gray-600 space-y-0.5">
              <p>NIF : 086419208K</p>
              <p>RCCM : MA.BKO.2026.B.14820</p>
              <p>Hamdallaye ACI 2000, Rue 314 P.88, Bamako</p>
            </div>
          </div>

          {/* Platform links */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
              Plateformes
            </p>
            <ul className="space-y-2">
              {featureLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
              Légal & Confiance
            </p>
            <ul className="space-y-2">
              {legalLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            {/* Trust badge */}
            <div className="mt-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900 border border-gray-800 text-[11px] text-suguba-brand font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Zone UEMOA / Mali
            </div>
          </div>

        </div>
      </div>

      {/* ── Bottom Bar ── */}
      <div className="border-t border-gray-900 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-gray-600">
          <p>© 2026 Suguba Technologies Mali — Tous droits réservés</p>
          <p className="flex items-center gap-1">
            Conçu à
            <span className="text-suguba-brand font-bold mx-0.5">Bamako</span>
            pour le Mali et la diaspora
          </p>
        </div>
      </div>
    </footer>
  );
}
