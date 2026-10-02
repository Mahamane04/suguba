import { Award, BarChart3, BadgeCheck, CalendarDays, Calculator, Gift, ImagePlus, Package, Store, Tag, Target, Truck, Users } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import GrilleOutils from '@/components/reseau/GrilleOutils';

/** Outils du revendeur (REV-12) : intitulés identiques aux titres des pages, rangés par usage. */
export default function Outils() {
  return (
    <PageReseau titre="Mes outils de vente" sousTitre="Tout ce qui aide à partager, vendre et suivre vos résultats."
      retour={{ href: '/reseller', libelle: 'Espace revendeur' }}>
      <GrilleOutils groupes={[
        { titre: 'Partager', outils: [
          { href: '/reseller/catalog', titre: 'Catalogue à partager', aide: 'Les produits, leur commission, le partage WhatsApp', icone: Package },
          { href: '/reseller/createur', titre: 'Créer un visuel', aide: 'Image produit ou carte boutique pour WhatsApp et Facebook', icone: ImagePlus },
          { href: '/reseller/boutique', titre: 'Ma boutique', aide: 'Personnaliser et partager ma vitrine', icone: Store },
          { href: '/reseller/calendrier', titre: 'Mon calendrier', aide: 'Préparer mes publications et rappels', icone: CalendarDays },
          { href: '/reseller/prix', titre: 'Mes prix', aide: 'Mon prix de vente sur les articles au prix de gros', icone: Tag },
        ] },
        { titre: 'Suivre', outils: [
          { href: '/reseller/partages', titre: 'Mes partages', aide: 'Les clics et les ventes de chaque partage', icone: BarChart3 },
          { href: '/reseller/clients', titre: 'Mes clients', aide: 'Les personnes qui ont commandé par mon lien', icone: Users },
          { href: '/reseller/missions', titre: 'Missions', aide: 'Objectifs et récompenses en cours', icone: Target },
          { href: '/reseller/parrainages', titre: 'Mes parrainages', aide: 'Les revendeurs que j’ai invités', icone: Gift },
        ] },
        { titre: 'Mon activité', outils: [
          { href: '/reseller/fournisseurs', titre: 'Fournisseurs', aide: 'Découvrir les offres et leurs boutiques', icone: Truck },
          { href: '/reseller/verification', titre: 'Mon profil vérifié', aide: 'Ma pièce d’identité et mon badge de confiance', icone: BadgeCheck },
          { href: '/reseller/badge', titre: 'Votre carte professionnelle', aide: 'À imprimer ou à montrer pour présenter ma boutique', icone: Award },
          { href: '/reseller/calculator', titre: 'Combien pouvez-vous gagner ?', aide: 'Estimer mes commissions, sans promesse', icone: Calculator },
        ] },
      ]} />
    </PageReseau>
  );
}
