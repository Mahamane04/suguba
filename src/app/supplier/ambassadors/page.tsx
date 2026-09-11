'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { Users, Store, Copy, Check, ArrowLeft, MessageCircle, ExternalLink, Loader2 } from 'lucide-react';

/**
 * Boutique publique du fournisseur et kit de recrutement de revendeurs.
 *
 * Réécrite le 2026-09-10. L'ancienne page :
 *  - affichait un réseau entièrement INVENTÉ : « 14 ambassadrices », « 38
 *    ventes », « 1,33 M F de chiffre d'affaires », « bonus marraine » —
 *    constantes écrites en dur, présentées à un vrai fournisseur comme ses
 *    propres résultats ;
 *  - calculait l'adresse de boutique à partir du nom de l'entreprise, lu dans
 *    des données de démonstration, au lieu de l'adresse réellement attribuée ;
 *  - promettait aux recrues des gains versés « sur Wave », que SasPay ne
 *    propose pas au Mali, et une fourchette de commission (3 000 à 7 000 F)
 *    que rien ne garantit : la commission dépend de chaque produit ;
 *  - envoyait vers un code de parrainage fabriqué avec les quatre premières
 *    lettres du nom de l'entreprise, qui ne correspondait à aucun vrai code.
 */
export default function SupplierBoutiquePage() {
  const [nom, setNom] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [copie, setCopie] = useState<'boutique' | 'message' | null>(null);

  useEffect(() => {
    fetch('/api/supplier/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        setNom(j?.supplier?.companyName || null);
        setSlug(j?.supplier?.slug || null);
      })
      .catch(() => {})
      .finally(() => setChargement(false));
  }, []);

  const origine = typeof window !== 'undefined' ? window.location.origin : 'https://app.sugubaml.com';
  const urlBoutique = slug ? `${origine}/s/${slug}` : '';

  const message =
    `🛍️ *${(nom || 'Notre boutique').toUpperCase()} recrute des revendeurs sur Suguba !*\n\n` +
    `Vous avez une communauté sur WhatsApp, TikTok ou Facebook ? Vendez nos articles sans acheter de stock.\n\n` +
    `✅ Pas de stock, pas d'avance d'argent\n` +
    `✅ Suguba livre le client et encaisse à la livraison\n` +
    `✅ Une commission sur chaque vente livrée, versée sur Orange Money, Moov ou Mobi Cash\n\n` +
    (urlBoutique ? `👀 Nos articles : ${urlBoutique}\n` : '') +
    `👉 Inscription gratuite : ${origine}/rejoindre`;

  const copier = async (texte: string, quoi: 'boutique' | 'message') => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(quoi);
      setTimeout(() => setCopie(null), 2000);
    } catch {
      // Presse-papiers refusé : le texte reste affiché, sélectionnable à la main.
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        <div className="space-y-1">
          <Link href="/supplier" className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" /><span>Retour à l&apos;espace fournisseur</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center space-x-2">
            <Users className="w-6 h-6 text-suguba-brand" /><span>Ma boutique et mes revendeurs</span>
          </h1>
          <p className="text-xs text-slate-500">
            Partagez votre boutique, et invitez des revendeurs à vendre vos articles sans stock.
          </p>
        </div>

        {chargement ? (
          <div className="flex items-center space-x-2 text-xs text-slate-500 py-8">
            <Loader2 className="w-4 h-4 animate-spin" /><span>Chargement…</span>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div>
                <h2 className="font-black text-sm text-slate-900 flex items-center space-x-2">
                  <Store className="w-4 h-4 text-emerald-600" /><span>Ma boutique publique</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Tous vos articles approuvés, à partager sur WhatsApp, Facebook ou TikTok. Suguba encaisse et livre.
                </p>
              </div>
              {slug ? (
                <>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-emerald-800 break-all">{urlBoutique}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => copier(urlBoutique, 'boutique')}
                      className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center space-x-1.5">
                      {copie === 'boutique' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copie === 'boutique' ? 'Lien copié' : 'Copier le lien'}</span>
                    </button>
                    <a href={urlBoutique} target="_blank" rel="noopener noreferrer"
                      className="h-11 rounded-2xl bg-slate-900 hover:bg-black text-white text-xs font-black flex items-center justify-center space-x-1.5">
                      <ExternalLink className="w-4 h-4" /><span>Voir ma boutique</span>
                    </a>
                  </div>
                </>
              ) : (
                <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                  Votre boutique n&apos;a pas encore d&apos;adresse : complétez votre dossier fournisseur
                  (nom de l&apos;entreprise) pour qu&apos;elle soit créée.
                </p>
              )}
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-black text-sm text-slate-900 flex items-center space-x-2">
                    <MessageCircle className="w-4 h-4 text-[#25D366]" /><span>Message de recrutement</span>
                  </h2>
                  <p className="text-xs text-slate-500">À poster sur vos statuts pour trouver des revendeurs.</p>
                </div>
                <button type="button" onClick={() => copier(message, 'message')}
                  className="h-11 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-black flex items-center justify-center space-x-1.5 self-start sm:self-auto">
                  {copie === 'message' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copie === 'message' ? 'Texte copié' : 'Copier le message'}</span>
                </button>
              </div>
              <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-2xl text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                {message}
              </div>
            </div>
          </>
        )}
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
