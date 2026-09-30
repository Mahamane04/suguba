# Cartes et chargements — 30 septembre 2026

REQ-CONTENU-002 / TASK-CONTENU-002 / TEST-CONTENU-002 : corriger les cartes boutique Facebook et WhatsApp et rendre le résultat immédiatement repérable.

- Couverture raccourcie, identité sur bande blanche, logo et produits affichés entièrement.
- Correction du débordement de couverture découvert sur une image carrée pendant le test navigateur.
- Résultat annoncé avec titre, focus et défilement automatique. Actions placées avant aperçu.
- Formulaire bloqué durant génération et protection contre double lancement.
- Délai limite de chargement des images : 15 secondes par image, avec repli existant.

REQ-CHARGEMENT-001 / TASK-CHARGEMENT-001 / TEST-CHARGEMENT-001 : utiliser une animation Suguba commune pendant les attentes.

- Composant léger avec logo local, pulsation CSS, respect de prefers-reduced-motion.
- Remplacement des indicateurs tournants et ajout aux chargements textuels, squelettes et boutons existants des différents portails.

Validation : 389 tests automatisés réussis et TypeScript validé. Build final réussi après les dernières corrections. Génération locale carrée avec boutique et produit fictifs : région résultat active, boutons visibles avant image sur écran 390 × 844. La couverture fictive a révélé le débordement désormais corrigé par clipping Canvas. Aucun paiement ni écriture de production. Aucun déploiement réalisé. Le partage natif vers une application externe n’est pas testé dans le navigateur local.
