import { BarChart3, FileText, Megaphone, MessageCircleQuestion, Package, Store, UsersRound, Users, Wallet } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import GrilleOutils from '@/components/reseau/GrilleOutils';

/**
 * « Plus » du fournisseur (REV-12 / FOU-08) : la page s'intitulait « Mon espace
 * fournisseur », comme l'accueil ; intitulés désormais identiques aux titres des pages.
 */
export default function Outils() {
  return (
    <PageReseau titre="Tous mes outils" sousTitre="Boutique, réseau, demandes et suivi de votre activité."
      retour={{ href: '/supplier', libelle: 'Espace fournisseur' }}>
      <GrilleOutils groupes={[
        { titre: 'Vendre', outils: [
          { href: '/supplier/inventory', titre: 'Mes produits', aide: 'Stocks, prix et nouvelles offres', icone: Package },
          { href: '/supplier/devis', titre: 'Demandes de devis', aide: 'Répondre avec un prix adapté', icone: FileText },
          { href: '/supplier/boutique', titre: 'Ma boutique', aide: 'Personnaliser ma vitrine publique', icone: Store },
        ] },
        { titre: 'Mon réseau', outils: [
          { href: '/supplier/revendeurs', titre: 'Mes revendeurs', aide: 'Ceux qui vendent mes produits', icone: Users },
          { href: '/supplier/questions', titre: 'Questions sur les offres', aide: 'Répondre aux revendeurs', icone: MessageCircleQuestion },
          { href: '/supplier/campagnes', titre: 'Campagnes', aide: 'Budget et promotion', icone: Megaphone },
        ] },
        { titre: 'Suivi', outils: [
          { href: '/supplier/paiements', titre: 'Mes paiements', aide: 'Ce que Suguba me doit et mes retraits', icone: Wallet },
          { href: '/supplier/analyses', titre: 'Analyses', aide: 'Les résultats de mes ventes', icone: BarChart3 },
          { href: '/supplier/equipe', titre: 'Mon équipe', aide: 'Gérer les accès de mes collaborateurs', icone: UsersRound },
        ] },
      ]} />
    </PageReseau>
  );
}
