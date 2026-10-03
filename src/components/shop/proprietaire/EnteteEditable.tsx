'use client';

import React, { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import EnteteBoutique from '@/components/shop/EnteteBoutique';
import ListeEtapes from '@/components/reseau/ListeEtapes';
import PanneauImage from './PanneauImage';
import PanneauNomAccueil from './PanneauNomAccueil';
import { useProprietaire, type IdentiteVitrine } from './ModeProprietaire';
import { titreVitrine } from '@/lib/enseigne';
import { etapesBoutique, progressionBoutique, type PanneauBoutique } from '@/lib/reseau/etapes-boutique';

/**
 * En-tête de la vitrine, modifiable sur place par son propriétaire (lot 2 du
 * chantier boutique, 2026-10-03).
 *
 * Trois crayons de 40 px seulement : couverture, logo, nom et mot d'accueil.
 * Chacun ouvre un panneau à un seul sujet. Après l'enregistrement : toast et mise
 * à jour locale de l'en-tête (et du bandeau, par le contexte du mode
 * propriétaire), sans router.refresh() qui rechargerait toute la vitrine sur un
 * réseau lent. ?editer=logo|couverture|nom ouvre directement le bon panneau
 * (liens « Ajouter mon logo » de l'accueil, du créateur de visuels…), puis le
 * paramètre est retiré de l'adresse pour qu'un rechargement ne le rouvre pas.
 *
 * Sous l'en-tête : « Ma boutique est prête à X % », masquée à 100 %. Chaque
 * étape ouvre son panneau sans quitter la page.
 *
 * Réservé au propriétaire en gestion, chargé avec next/dynamic : jamais envoyé
 * aux visiteurs. Les crayons et la carte disparaissent en vue client.
 */
export default function EnteteEditable({
  identite: identiteInitiale,
  surtitre,
  apresTitre,
  infos,
  description,
  articles,
  coupsDeCoeur = 0,
  dejaPartage = false,
  enLigne = true,
  panneauInitial,
  children,
  pied,
}: {
  identite: IdentiteVitrine;
  surtitre: string;
  apresTitre?: React.ReactNode;
  infos?: React.ReactNode;
  description?: string | null;
  /** Articles que la vitrine affiche (0 quand elle montre le catalogue Suguba). */
  articles: number;
  /** Coups de cœur parmi eux : étape « Choisir un coup de cœur » (lot 3, 2026-10-03). */
  coupsDeCoeur?: number;
  /** Un lien suivi de la boutique existe : étape « Partager ma boutique » (lot 4, 2026-10-03). */
  dejaPartage?: boolean;
  /** Boutique en ligne : masquée par Suguba, elle ne se partage pas (l'étape n'ouvre rien). */
  enLigne?: boolean;
  /** ?editer= reçu à l'ouverture. */
  panneauInitial?: PanneauBoutique | null;
  children?: React.ReactNode;
  pied?: React.ReactNode;
}) {
  const proprietaire = useProprietaire();
  const [locale, setLocale] = useState<IdentiteVitrine>(identiteInitiale);
  const identite = proprietaire?.identite ?? locale;
  const maj = (changements: Partial<IdentiteVitrine>) => {
    if (proprietaire) proprietaire.majIdentite(changements);
    else setLocale((x) => ({ ...x, ...changements }));
  };
  const [panneau, setPanneau] = useState<PanneauBoutique | null>(null);

  useEffect(() => {
    if (!panneauInitial) return;
    setPanneau(panneauInitial);
    try {
      const adresse = new URL(window.location.href);
      adresse.searchParams.delete('editer');
      window.history.replaceState(window.history.state, '', `${adresse.pathname}${adresse.search}${adresse.hash}`);
    } catch {
      // Adresse non modifiable : le panneau s'ouvre quand même.
    }
  }, [panneauInitial]);

  const fermer = () => setPanneau(null);
  const crayon = (sujet: PanneauBoutique, libelle: string, position?: string) => (
    <button
      type="button"
      onClick={() => setPanneau(sujet)}
      aria-label={libelle}
      className={`group-data-[vue=client]:hidden w-10 h-10 shrink-0 rounded-full bg-white/95 text-suguba-profond shadow-md ring-1 ring-slate-200 flex items-center justify-center hover:bg-white active:scale-95 transition-all${position ? ` ${position}` : ''}`}
    >
      <Pencil className="w-4 h-4" />
    </button>
  );

  const etapes = etapesBoutique({
    enseigne: identite.enseigne,
    logo: identite.logo,
    couverture: identite.couverture,
    accueil: identite.accroche,
    articles,
    coupsDeCoeur,
    // Lot 4 : cochée sur place dès qu'un lien est préparé dans la feuille de partage.
    partage: proprietaire ? proprietaire.aPartage : dejaPartage,
  });
  const prete = progressionBoutique(etapes);

  return (
    <>
      <EnteteBoutique
        couverture={identite.couverture}
        logo={identite.logo}
        nom={identite.nom}
        titre={titreVitrine({ type: 'revendeur', nom: identite.nom, enseigne: identite.enseigne })}
        surtitre={surtitre}
        apresTitre={apresTitre}
        accroche={identite.accroche}
        infos={infos}
        description={description}
        surCouverture={crayon('couverture', 'Changer la photo de couverture', 'absolute top-3 right-3')}
        surLogo={crayon('logo', 'Changer le logo', 'absolute -bottom-2 -right-2')}
        surNom={crayon('nom', 'Modifier le nom et le mot d’accueil')}
        pied={pied}
      >
        {children}
      </EnteteBoutique>

      {prete.pourcentage < 100 && (
        <ListeEtapes
          id="boutique-prete-titre"
          className="group-data-[vue=client]:hidden"
          titre={<>Ma boutique est prête à <span className="tabular-nums">{prete.pourcentage} %</span></>}
          etapes={etapes.map((e) => ({
            libelle: e.libelle,
            fait: e.fait,
            // « Boutique créée » est offerte : rien à ouvrir. « Partager ma boutique »
            // ouvre la feuille de partage sur place (lot 4).
            ...(e.cle === 'creee' || (e.cle === 'partage' && !enLigne) ? {}
              : e.editer ? { onClick: () => setPanneau(e.editer as PanneauBoutique) }
                : e.cle === 'partage' && proprietaire ? { onClick: proprietaire.ouvrirPartage }
                  : { href: e.href }),
          }))}
        />
      )}

      <PanneauImage
        sujet="couverture"
        ouvert={panneau === 'couverture'}
        onFermer={fermer}
        valeur={identite.couverture}
        nom={identite.nom}
        onEnregistre={(url) => maj({ couverture: url })}
      />
      <PanneauImage
        sujet="logo"
        ouvert={panneau === 'logo'}
        onFermer={fermer}
        valeur={identite.logo}
        nom={identite.nom}
        onEnregistre={(url) => maj({ logo: url })}
      />
      <PanneauNomAccueil
        ouvert={panneau === 'nom'}
        onFermer={fermer}
        valeur={{ nom: identite.nom, enseigne: identite.enseigne, accroche: identite.accroche }}
        onEnregistre={(nouveau) => maj(nouveau)}
      />
    </>
  );
}
