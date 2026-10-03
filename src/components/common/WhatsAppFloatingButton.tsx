'use client';

import React, { useState } from 'react';
import { MessageCircle, X, ShoppingBag, Users, HelpCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useClavierOuvert } from '@/lib/useClavierOuvert';
import { useSugubaStore } from '@/lib/store';

// Liste AUTORISÉE plutôt que liste d'exclusion (2026-09-13) : sur les écrans
// de formulaire ou d'action (retraits, paiement, badge, commande…), la bulle
// flottante recouvrait les champs et les boutons principaux (captures). Elle
// ne s'affiche que sur les vitrines de découverte ; ailleurs, l'aide reste
// accessible par le menu et les liens « Une question ? » de chaque écran.
// Retirée de l'accueil le 2026-09-27 (V1 vue client) : elle recouvrait les
// cartes produits ; l'aide reste dans Compte → Aide et dans le menu.
// Lot 8 du chantier boutique (2026-10-03, décision du fondateur) : la bulle du
// support Suguba s'affiche aussi sur la vitrine officielle /boutique/<adresse>,
// comme sur /r/ et /s/. Le client n'y avait AUCUN contact. C'est le support de
// Suguba, pas le WhatsApp du revendeur (pas pour l'instant : la commande reste sur
// Suguba). « /boutique/ » ne couvre pas l'annuaire « /boutiques ».
const VISIBLE_SUR_EXACT = ['/rejoindre'];
const VISIBLE_SUR_PREFIXE = ['/s/', '/r/', '/boutique/'];

// Relecture du lot 8 (2026-10-03) : montrée sur une page de plus, la bulle est mise
// à la charte (règle « un écran modifié pour autre chose est converti au passage »,
// tailwind.config.js) — boutons par <Button> (variante `whatsapp`, réservée à ce qui
// ouvre WhatsApp ; choix en `ghost`, 44 px au lieu de 38), fermeture de 44 px avec un
// nom lisible par les lecteurs d'écran (24 px sans nom avant), texte vert en
// `suguba-brand-dark` (lisible sur fond blanc) au lieu d'`emerald-600`. Le menu
// s'élargit un peu (320 px, jamais plus que l'écran) pour que chaque choix tienne
// sur une ligne.
// Sur téléphone, la bulle reste une ICÔNE SEULE, volontairement : avec son libellé
// elle recouvrirait les cartes d'articles (raison de son retrait de l'accueil). Le
// libellé « Besoin d'aide ? » apparaît à partir de 640 px ; le guide le dit.

// Profils dont la barre du bas reste affichée sur tablette et ordinateur : la même
// liste que `navigationMetier` de BottomNav (un test vérifie qu'elles sont égales).
const ROLES_BARRE_PERMANENTE = ['supplier', 'reseller', 'driver'];

export default function WhatsAppFloatingButton() {
  const pathname = usePathname() || '';
  const visible = VISIBLE_SUR_EXACT.includes(pathname) || VISIBLE_SUR_PREFIXE.some((p) => pathname.startsWith(p));
  // Hors des vitrines, rien n'est monté : ni état, ni abonnement au magasin.
  return visible ? <BulleSupport /> : null;
}

function BulleSupport() {
  const [isOpen, setIsOpen] = useState(false);
  // Masqué pendant la saisie : même décalage que la barre du bas sur iPhone
  // après fermeture du clavier (voir src/lib/useClavierOuvert.ts).
  const clavierOuvert = useClavierOuvert();
  // Lot 8 du chantier boutique (2026-10-03) : sur /boutique/<adresse>, le propriétaire
  // est un revendeur, dont la barre du bas reste affichée à toutes les largeurs. À
  // partir de 768 px, la bulle redescend à 24 px du bas (`md:bottom-6`) : elle se
  // poserait sur son onglet « Gains » (même défaut que la pastille « Vue client »,
  // relecture du lot 2 ; il existait déjà sur /r/ et /s/ pour un revendeur ou un
  // fournisseur connecté). Pour ces profils, elle reste au-dessus de la barre.
  const etat = useSugubaStore();
  const role = etat.currentUser.id ? etat.currentUser.role : null;
  const barrePermanente = ROLES_BARRE_PERMANENTE.includes(role || '');
  const supportPhone = '22389460000';

  const handleOpenWhatsApp = (topic: string) => {
    const text = `Bonjour Suguba Mali, je vous contacte concernant : *${topic}*.`;
    window.open(`https://api.whatsapp.com/send?phone=${supportPhone}&text=${encodeURIComponent(text)}`, '_blank');
    setIsOpen(false);
  };

  return (
    // `bottom-20` (80px) plaçait le bouton pile sur la barre de navigation du
    // bas, qui occupe 5rem : il recouvrait en permanence le bouton de partage
    // de la carte produit qui se trouvait dessous. Il démarre désormais
    // au-dessus de la barre, zone sûre iOS comprise, et passe devant elle
    // (z-50 contre z-40). La valeur reste une classe et non un style en ligne,
    // sinon `md:bottom-6` ne pourrait plus reprendre la main sur desktop, où
    // la barre du bas n'existe pas — sauf pour un profil dont la barre reste
    // affichée (`barrePermanente`) : la bulle garde alors sa hauteur.
    <div hidden={clavierOuvert} className={`fixed bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] ${barrePermanente ? '' : 'md:bottom-6'} right-4 z-50`}>
      
      {/* Menu ouvert : trois sujets, chacun ouvre WhatsApp avec le support Suguba. */}
      {isOpen && (
        <div id="aide-suguba" className="mb-3 bg-white rounded-3xl p-4 shadow-2xl border border-slate-200 w-80 max-w-[calc(100vw-2rem)] space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-200 text-xs">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-suguba-wa text-suguba-profond flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4 fill-current" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-slate-900">Assistance Suguba</h4>
                <p className="text-xs text-suguba-brand-dark font-bold">Réponse sur WhatsApp</p>
              </div>
            </div>
            {/* Même bouton de fermeture que les feuilles (src/components/ui/Sheet.tsx) : 44 px. */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Fermer"
              className="w-11 h-11 -mr-2 -mt-2 rounded-full hover:bg-slate-100 flex items-center justify-center shrink-0"
            >
              <X className="w-5 h-5 text-slate-600" aria-hidden="true" />
            </button>
          </div>

          <p className="text-xs text-slate-600 leading-tight">
            Besoin d&apos;aide pour une commande, un suivi ou pour devenir revendeur ?
          </p>

          <div className="space-y-1.5">
            <Button type="button" variant="ghost" fullWidth onClick={() => handleOpenWhatsApp('Aide pour passer une commande')}>
              <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
              Aide pour commander
            </Button>
            <Button type="button" variant="ghost" fullWidth onClick={() => handleOpenWhatsApp('Rejoindre le réseau des Revendeurs')}>
              <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
              Devenir Revendeur rémunéré
            </Button>
            <Button type="button" variant="ghost" fullWidth onClick={() => handleOpenWhatsApp('Suivi de livraison / SAV')}>
              <HelpCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              Suivre mon colis / SAV
            </Button>
          </div>

          <div className="text-center pt-1 border-t border-slate-100 text-xs text-slate-500">
            Tél : <strong>+223 89 46 00 00</strong>
          </div>
        </div>
      )}

      {/* La bulle : icône seule sur téléphone, « Besoin d'aide ? » à partir de 640 px. */}
      <Button
        type="button"
        variant="whatsapp"
        onClick={() => setIsOpen(!isOpen)}
        className="shadow-2xl shadow-suguba-wa/40"
        aria-label="Contacter le support sur WhatsApp"
        aria-expanded={isOpen}
        aria-controls={isOpen ? 'aide-suguba' : undefined}
      >
        <MessageCircle className="w-5 h-5 fill-current" aria-hidden="true" />
        <span className="text-xs hidden sm:inline">Besoin d&apos;aide ?</span>
      </Button>

    </div>
  );
}
