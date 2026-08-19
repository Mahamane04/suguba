# Définition du Mode Produit — Suguba (V3.0)

## Mode Sélectionné : `MODE_PWA` (Progressive Web App Installable + SaaS Responsive Web)

### 1. Rationale du Choix PWA pour le Marché Malien :
1. **Zéro Friction de Téléchargement** : Pas besoin de passer par Google Play Store ou Apple App Store (qui consomme 50 à 100 Mo de forfait data). L'utilisateur ouvre un lien WhatsApp et clique sur « Ajouter à l'écran d'accueil » (taille < 2 Mo).
2. **Compatibilité Totale Smartphone** : Fonctionne sur tous les téléphones Android (Tecno, Infinix, Itel, Samsung) et iPhones iOS en zone UEMOA.
3. **Résilience Hors-Ligne (Offline-First)** : Le Service Worker PWA V2 met en cache les 41 routes et les catalogues pour un affichage instantané même en coupure réseau 2G/3G dans la circulation de Bamako.
4. **Notifications Push Web Natives** : Permet à l'Admin d'envoyer des alertes flash d'arrivage de stock directement sur l'écran verrouillé du revendeur sans passer par le store.
