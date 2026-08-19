# Matrice de Tests Multi-Plateformes & Conditions Réseau — Suguba (V3.0)

| Environnement / Appareil | Résolution | Navigateur | Comportement Testé | Résultat |
| :--- | :--- | :--- | :--- | :--- |
| **Android Entrée de Gamme (Tecno Spark / Itel)** | 360 x 800 | Chrome Mobile | Layout fluide, boutons d'action 1-tap larges (48px+), z-index correct | **PASS** |
| **iPhone iOS (13 / 14 / 15 / 16 Pro)** | 393 x 852 | Safari Mobile | Safe areas respectées, vibration haptique, PWA installable | **PASS** |
| **Ordinateur de Bureau / Laptop Admin** | 1920 x 1080 | Chrome / Edge | Grille de contrôle des appels, popups de tarification et export CSV | **PASS** |
| **Réseau 2G / 3G Dégradé (100 kbps, 800ms ping)** | Mobile | Tous | Affichage instantané via Cache Service Worker PWA V2 en < 0.2s | **PASS** |
| **Mode Hors-Ligne Total (Mode Avion)** | Mobile | Tous | Bannière « Mode Hors-Ligne » active, catalogues consultables | **PASS** |
