# Cahier des Tests d'Acceptation — Suguba (V3.0)

| ID Test | Exigence | Scénario de Test | Résultat Attendu | Statut |
| :--- | :--- | :--- | :--- | :--- |
| `TEST-001` | `REQ-001` | Soumission d'un produit par un grossiste | Produit enregistré avec statut `submitted`, masqué du catalogue public tant que l'admin n'a pas fixé la marge. | **PASS** |
| `TEST-002` | `REQ-002` | Modération du prix par l'Admin Desk | L'admin saisit la commission revendeur et la marge Suguba $\rightarrow$ Le produit passe en statut `approved` et devient visible publiquement. | **PASS** |
| `TEST-003` | `REQ-003` | Commande 1-clic client sans compte | Le client remplit Nom, Téléphone, Repère Bamako $\rightarrow$ Commande créée avec statut `pending_call` et OTP à 4 chiffres généré. | **PASS** |
| `TEST-004` | `REQ-004` | Validation livraison par le livreur | Le livreur saisit le code OTP remis par le client $\rightarrow$ Commande passe en `delivered`, paiement marqué collecté, commission créditée. | **PASS** |
| `TEST-005` | `REQ-005` | Protection anti-fraude OTP (3 échecs) | 3 tentatives erronées du code OTP $\rightarrow$ Verrouillage de la commande pendant 15 minutes et alerte immédiate envoyée à l'Admin Desk. | **PASS** |
| `TEST-006` | `REQ-006` | Demande de retrait Mobile Money | Le revendeur demande un retrait de commission $\ge 5 000$ FCFA $\rightarrow$ Déduction du solde retirable et enregistrement de la demande `pending`. | **PASS** |
| `TEST-007` | `REQ-007` | Mode Hors-Ligne PWA V2 | Coupure de la connexion réseau $\rightarrow$ La navigation entre les pages de catalogue et les visuels de vente fonctionne de manière fluide. | **PASS** |
