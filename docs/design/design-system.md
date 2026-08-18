# Design System Mobile-First — Suguba SaaS

## 1. Identité Visuelle & Principes de Conception
Suguba est conçu pour être l'outil commercial de poche des revendeurs, livreurs et acheteurs au Mali. Le design repose sur 4 piliers :
1. **Lisibilité Haute Luminosité** : Contraste élevé (texte `#0f172a` sur fond clair `#f8fafc`) pour une utilisation en plein soleil à Bamako.
2. **Thumb-Zone Prioritaire** : Toutes les actions critiques (Partager WhatsApp, Valider commande, Valider OTP, Retrait) sont placées dans la zone naturelle du pouce (bas d'écran, hauteur minimum 48px).
3. **Clarté Monétaire Immédiate** : Les gains revendeurs sont toujours mis en avant en **Vert Émeraude** avec le symbole `+` et en FCFA entiers.
4. **Zéro Jargon Technique** : Vocabulaire simple et direct (*"Tu gagnes : +4 000 F"*, *"Repère visuel"*, *"Code secret de livraison"*).

---

## 2. Palette de Couleurs (Design Tokens)

| Rôle | Nom du Token | Valeur Hex | Utilisation |
| :--- | :--- | :--- | :--- |
| **Primary (Succès / Gains)** | `suguba-emerald-600` | `#16a34a` | Boutons d'action principaux, badges de gains, commissions acquises. |
| **Primary Dark** | `suguba-emerald-800` | `#166534` | En-têtes, textes d'accentuation, boutons au survol/clic. |
| **Mobile Money & Attention** | `suguba-amber-500` | `#f59e0b` | Alertes, délais de sécurité J+7, boutons Orange Money / Wave. |
| **WhatsApp Social Action** | `suguba-whatsapp` | `#25D366` | Bouton de partage 1-clic vers WhatsApp Statut / Contact. |
| **Surface Principale** | `suguba-bg` | `#f8fafc` | Fond de l'application (Slate 50). |
| **Surface Cartes & Modales** | `suguba-card` | `#ffffff` | Cartes blanches avec bordures douces (`#e2e8f0`). |
| **Texte Principal** | `suguba-text-main` | `#0f172a` | Titres et montants (Slate 900). |
| **Texte Secondaire** | `suguba-text-muted` | `#64748b` | Descriptions, labels et métadonnées (Slate 500). |

---

## 3. Typographie & Hiérarchie

| Niveau | Taille | Poids | Usage |
| :--- | :--- | :--- | :--- |
| **Display 1 (Montants Clés)** | `24px - 32px` | 900 (Black) | Soldes disponibles, gains par vente, prix produit. |
| **Heading 1 (Titres Pages)** | `20px - 24px` | 900 (Black) | Titres des dashboards et fiches produits. |
| **Heading 2 (Sections)** | `16px - 18px` | 800 (ExtraBold) | Titres de cartes et modales. |
| **Body (Corps de texte)** | `13px - 14px` | 500 (Medium) | Paragraphes, descriptions et formulaires. |
| **Caption (Micro-copie)** | `10px - 11px` | 700 (Bold) | Badges de statut, repères, codes d'affiliation. |

---

## 4. Composants Clés & Ergonomie Mobile

### A. La Carte Produit Rémunérée
- Image haute qualité optimisée WebP avec ratio 1:1 ou 16:9.
- Badge flottant haut-droite : `+4 000 F de gain`.
- Bloc économique encadré : *Prix client* vs *Ta commission*.
- Double action basse : Bouton Vert `WhatsApp` (Partager) + Bouton Noir `Créer vente` (Commande directe).

### B. Le Formulaire Express 1-Clic
- Aucun champ superflu (pas d'email, pas de mot de passe, pas de confirmation de mot de passe).
- Champ repère visuel obligatoire avec icône 📍 (`"En face de la pharmacie du pont"`).
- Bouton CTA géant pleine largeur collé en bas avec feedback tactile (`active:scale-[0.98]`).

### C. La Modale OTP de Livraison
- Pavé de saisie numérique centré à gros caractères (`tracking-[0.5em]`).
- Affichage clair du montant en espèces à encaisser avant toute validation.

### D. La Barre de Navigation Basse (`BottomNav`)
- Hauteur fixe `64px` avec support de la zone de sécurité iPhone (`pb-safe`).
- 4 à 5 onglets maximum avec icônes Lucide stroke 2.5 pour l'onglet actif.
