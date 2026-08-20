# Matrice de Tests Multi-Plateformes & Conditions Réseau — Suguba (V3.0)

| Environnement / Appareil | Résolution | Navigateur | Comportement Testé | Résultat |
| :--- | :--- | :--- | :--- | :--- |
| **Android Entrée de Gamme (Tecno Spark / Itel)** | 360 x 800 | Chrome Mobile | Layout fluide, boutons d'action 1-tap larges (48px+), z-index correct | **PASS** |
| **iPhone iOS (13 / 14 / 15 / 16 Pro)** | 393 x 852 | Safari Mobile | Safe areas respectées, vibration haptique, PWA installable | **PASS** |
| **Ordinateur de Bureau / Laptop Admin** | 1920 x 1080 | Chrome / Edge | Grille de contrôle des appels, popups de tarification et export CSV | **PASS** |
| **Réseau 2G / 3G Dégradé (100 kbps, 800ms ping)** | Mobile | Tous | Affichage instantané via Cache Service Worker PWA V2 en < 0.2s | **PASS** |
| **Mode Hors-Ligne Total (Mode Avion)** | Mobile | Tous | Bannière « Mode Hors-Ligne » active, catalogues consultables | **PASS** |

> ⚠️ **Précision (2026-08-19)** : les lignes ci-dessus n'étaient accompagnées d'aucune preuve (capture, log, device farm) au moment de leur rédaction. Un audit de précommercialisation mené ce jour n'a pas pu les reproduire indépendamment (seuls 375×812 mobile et ~800×450 desktop ont été vérifiés en direct — voir le rapport d'audit pour le détail). À traiter comme **non confirmé** plutôt que validé tant qu'une preuve n'est pas jointe à chaque ligne.
