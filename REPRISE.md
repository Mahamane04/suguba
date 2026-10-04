# Suguba — Fiche de reprise (11 septembre 2026)

> **4 octobre 2026 — boutique revendeur : corrections de la relecture finale (en ligne).** **Aucun nouveau SQL** ; `supabase/A-EXECUTER-2026-10-03-vitrine-boutique.sql` reste à exécuter par le fondateur (rien ne s'y ajoute). 6 constats vérifiés dans le code, tous fondés. **(A)** `.carte-produit { container-type }` était sur l'`<article>` de `ProductCard`, qui rend `AfficheModal` (`fixed inset-0`, sans portail) : sur Chrome ≤ 128 et Safari iOS 16-17, container-type crée le bloc conteneur des descendants fixés → la fenêtre « Affiche pour mon statut » s'ouvrait enfermée dans la carte. La classe est maintenant sur la RANGÉE « bouton principal + rond de partage » (aucun élément fixé dessous ; ne jamais y rendre une fenêtre), règle `@container (max-width: 151px)` (rangée = carte − 26 px, même seuil). **(B)** `realignerBoutiquesAvantNouveauNom(admin, uid, ancienNom, nouveauNom)` (`src/lib/reseau/boutiques.ts`), appelée AVANT d'écrire `profiles.full_name` par `PATCH /api/reseller/me` et `POST /api/auth/complete-profile` (les deux seules routes qui le modifient ; `supabase-exchange` et `admin/boutiques` insèrent un compte neuf) : les boutiques revendeur du compte dont le nom n'était pas une enseigne avec l'ANCIEN nom reçoivent `nomPublic(nouveau)` ; lecture ou écriture en échec → 503, nom inchangé, boutiques remises ; profil en échec ensuite → `annuler()`. Sans cela, « Awa Traore Dialo » (boutique d'avant le lot 2) passait pour une enseigne dès que le compte devenait « Awa Traoré Diallo ». `PATCH /api/reseller/me` lit désormais le profil avant tout (illisible → 503 : `metadata` fusionné sur une lecture ratée perdait le numéro Mobile Money). **Aperçu admin (contre-relecture du même jour)** : la route contrôle d'abord le nom (trop court, réservé → 400, sans rien lire), puis répond `{ success: true, apercu: true }` SANS rien lire ni écrire — le 403 posé d'abord ici arrêtait `/reseller/demarrer` à sa première étape et l'étape quartier de `/reseller/verification` (les deux seuls appelants, qui ne jugent que `ok`) ; avant la relecture, l'`update` touchait 0 ligne (`apercu-reseller` n'est pas dans `profiles`) et la route répondait déjà succès. Ne pas remettre de 403 ni de lecture de profil avant ce retour. En aperçu, l'étape « Boutique » reste refusée par `POST /api/reseller/boutique` (403, lot 2) ; `PATCH /api/reseller/boutique` n'a pas de garde d'aperçu (une boutique `apercu-reseller` existante est renommée pour de vrai). **L'existant n'est pas corrigé** (requête de contrôle dans le guide). **(C)** `nomPublic` (`src/lib/enseigne.ts`) rend `NOM_NEUTRE` « Revendeur partenaire » quand le nom du compte est réservé (`nomReserve`) — seul endroit, tout l'affichage public y passe ; `revendeur-partenaire` ajouté à `ADRESSES_RESERVEES` (ni enseigne ni adresse : la boutique d'un tel compte garde `/boutique/ma-boutique`) ; nom réservé refusé (400) pour un revendeur dans `reseller/me`, `complete-profile` (rôle demandé, actif ou détenu) et admin `creer_compte`. **(D)** `creerBoutiqueSupplementaire` lit `profiles.full_name` pour un revendeur et enregistre `nomPublicBoutique(nom, nomComplet)` (nom ET adresse) — couvre admin `creer_compte`, admin `creer` et « Mes boutiques › Créer » ; profil illisible → 503, rien créé ; indication de l'écran admin corrigée. **(E)** `visite-boutique` : `Sec-Fetch-Site` présent et ≠ `same-origin` → 204 sans rien lire ; `meta.ipj` = `empreinteAdresseDuJour(ip, jour)` (`src/lib/reseau/db.ts`, sha256 salé du secret + du jour + de l'IP seule) ; une lecture de plus (≤ 200 lignes, index existant) : 30/jour/boutique et 200/jour par IP ; lecture en échec → rien d'écrit. Ni index ni migration. NAT d'opérateur : plafond partagé (dit au guide). **(F)** `articlesDeLaBoutique` → `string[] | null` ; `GET /api/compte/boutiques` renvoie `articles[id] = null` ; la page affiche « Articles indisponibles pour le moment », n'ouvre pas `SelecteurArticles` et propose « Réessayer » (plus de `|| []`). Tests : `tests/ma-boutique-relecture-finale.test.cjs` (16 : 14 en échec sur le code d'avant, 2 « G » en échec sur le code d'avant la contre-relecture ; rendu réel de `ProductCard`, écrans « Mes boutiques » et démarrage montés avec crochets simulés) ; `ma-boutique-verification`, `lot6`, `lot7` ajustés. Rien observé à l'écran (aucun serveur lancé) : « Affiche pour mon statut » sur un téléphone ancien et le rond de partage à 390 px sont à regarder en QA.

> **4 octobre 2026 — boutique revendeur : vérification à l'écran, captures, mise en ligne.** Branche `ux/boutique-revendeur` (8 lots + relectures) fusionnée dans `main`. **Reste au fondateur : exécuter `supabase/A-EXECUTER-2026-10-03-vitrine-boutique.sql` en production** (rejouable ; 5 vérifications en bas de fichier) — d'ici là « Mes rayons », l'annonce datée et le changement d'adresse restent masqués, tout le reste fonctionne. Vérifié sur la copie locale isolée avec les comptes [QA] (390 et 1440 px) : parcours complet (ajout d'articles, coups de cœur, crayon nom/accueil, vue client, partage suivi, statistiques, abonnement + annonce reçue), SQL exécuté 2 fois en local puis rayons et changement d'adresse (redirection de l'ancienne adresse avec `?rayon` et `?ref`), boutique masquée. 5 défauts d'écran corrigés (logo de la carte d'accueil sous la couverture ; rond WhatsApp rogné sur carte étroite → règle `.carte-produit` en requête de conteneur dans `globals.css` ; `BarreEnregistrement` : état sur sa ligne sur téléphone ; tuile Adresse de Personnaliser ; date des notifications). `tests/ma-boutique-verification.test.cjs` ; 756 tests réussis ; scan de 21 pages sans débordement ; nouveau code essayé en lecture seule contre la base de production sans le SQL (écritures bloquées). 74 captures du guide refaites. Outils locaux (hors git) : `audit-local/2026-10-03-boutique/outils/` (`connexion-qa.mjs` pose le cookie [QA] sans l'afficher — utiliser `localhost`, pas `127.0.0.1` ; `voir-lecture-seule.mjs`). Non essayé à l'écran : envoi réel d'une image, boutique Pro, iPhone avec l'application installée.

> **3 octobre 2026 — boutique revendeur, lot 8 : corrections de relecture (en ligne).** **SQL À RELANCER par le fondateur s'il a déjà exécuté `supabase/A-EXECUTER-2026-10-03-vitrine-boutique.sql`** (même fichier, toujours le seul du chantier boutique, rejouable, aucune donnée modifiée ; 5 vérifications en bas de fichier au lieu de 4 ; pas encore exécuté : rien de plus à faire). 6 constats vérifiés, tous fondés. **(1) « Une ancienne adresse n'est jamais redonnée » ne tenait que par le code, en deux temps** : `adressesDejaPortees` lit `store_slug_aliases`, PUIS l'insertion dans `stores` ; un `changer_adresse_boutique` validé entre les deux donnait à la nouvelle boutique l'ancienne adresse d'une autre — elle captait ses liens et QR codes (`boutiqueParSlug` sert `stores` avant les alias) et répondait `pris` à tout changement d'adresse (`unique_violation` sur l'alias, avalée par le bloc EXCEPTION). Bloc 3 du fichier : `stores_refuser_ancienne_adresse()` (SECURITY INVOKER, `search_path = ''`, droits retirés à PUBLIC/anon/authenticated) + déclencheur `stores_ancienne_adresse_reservee` **AFTER** INSERT OR UPDATE OF slug (pas BEFORE : l'insertion attend d'abord, sur l'index unique `stores_slug_key`, la fin du changement en cours ; le déclencheur s'exécute ensuite et voit l'alias validé), erreur **23505** → `obtenirOuCreerBoutique` et `creerBoutiqueSupplementaire` passent déjà au candidat suivant (« -2 »), `changer_adresse_boutique` répond `pris`. Un UPDATE qui ne change pas le slug n'est pas contrôlé ; une boutique ne reprend pas non plus SA propre ancienne adresse ; l'existant n'est pas corrigé (vérification 4 du fichier) ; boutique supprimée → ses alias partent (CASCADE), l'adresse redevient libre. Fichier pas relancé : rien ne casse, la règle reste tenue par le code seul. **(2) Réponse du POST perdue** (`src/components/reseau/AdresseBoutique.tsx`) : l'écran disait « Changement impossible », puis « Vous avez déjà changé l'adresse » en gardant l'ancienne adresse, le champ et le bouton. `relireEtat()` (GET `/api/reseller/boutique/adresse` sans `?adresse=`, `null` si illisible) + `suivre(etat)` : dès que le serveur annonce une `ancienne`, `onChange(actuelle, ancienne)` — toast de succès si c'est l'adresse demandée, sinon « L'adresse de votre boutique a déjà été changée : … ». Appelé après la vérification du début, après un POST refusé et dans le `catch` d'un POST parti (`envoye`) ; état illisible → « Connexion coupée pendant le changement : votre adresse a peut-être changé… » ; jamais de second POST automatique. **(3)** Aperçu « Vos clients ouvriront » : `{apercu && !erreur && (` (il restait affiché sous « déjà prise »). **(4)** `/reseller/demarrer` : « qui ne changera plus » → « choisissez-le bien » (vrai avant comme après le SQL). **(5)** `WhatsAppFloatingButton` à la charte : `<Button variant="whatsapp">` pour la bulle, 3 × `<Button variant="ghost" fullWidth>` (44 px), fermeture `w-11 h-11` + `aria-label="Fermer"` (comme `Sheet`), `text-suguba-brand-dark`, menu `w-80 max-w-[calc(100vw-2rem)]`, `aria-expanded` / `aria-controls` ; **icône seule sous 640 px, volontairement** (avec son libellé elle recouvrirait les cartes ; dit au guide). **(6)** Guide : bulle décrite sur les fiches `vitrine-fournisseur` et `rejoindre`, citées par l'entrée du lot 8 ; l'entrée du lot 6 annonce 5 vérifications. Tests : `tests/ma-boutique-lot8-relecture.test.cjs` (13, tous en échec sur le code du lot 8 ; 3 sous PGlite avec le vrai SQL : la course est rejouée par `clientSql(pg, { apresLectureDesAnciennes })`, avec un témoin sans le déclencheur ; écran : crochets React simulés + vraie route, `brancher(appels, regle)` exécute le POST puis perd sa réponse). Rien observé à l'écran (aucun serveur lancé) : bulle et coupure réseau à vérifier en QA à 390 px.

> **3 octobre 2026 — boutique revendeur, lot 8 « Adresse à l’enseigne et contact » (en ligne).** **Aucun nouveau SQL** : tout dépend du bloc 2 de `supabase/A-EXECUTER-2026-10-03-vitrine-boutique.sql` (lot 6 : `store_slug_aliases` + `changer_adresse_boutique`), auquel ce lot n'ajoute qu'un `COMMENT ON COLUMN stores.slug` (depuis la relecture du lot 8, il porte aussi un déclencheur : fichier à relancer une fois, voir la ligne au-dessus). Décisions du fondateur : UN seul changement d'adresse, l'ancienne redirige ; contact = bulle du support Suguba, PAS de WhatsApp du revendeur. Règles pures `src/lib/adresse-boutique.ts` : `adresseDepuis` (= `slugifier` sans le repli « boutique » ; brut ≤ 120, 50 caractères, jamais de tiret final), `adresseBienFormee` (même expression que la fonction SQL), `refusAdresse` (3 caractères mini, lettres exigées, `adresseReservee`, numéro de téléphone `(?:\d-?){8,}`, « déjà la vôtre »), `adresseProposee`, `refusChangement` (résultat → message + statut), `adresseDeRedirection(slug, {rayon, ref, via})`. `src/lib/reseau/boutiques.ts` : `boutiqueParSlug` cherche l'adresse dans `store_slug_aliases` quand aucune boutique ne la porte (une lecture de plus seulement pour une adresse introuvable ; 42P01/PGRST205 ou échec → `null`) et rend la boutique avec son `slug` ACTUEL + `ancienneAdresse` ; `etatAdresse(id)` → `{option, ancienne}` ; `adresseLibre` (`null` si on ne sait pas, jamais « libre » sur une panne) ; `changerAdresse(id, uid, nouveau)` → `rpc('changer_adresse_boutique', {p_store_id, p_owner_id, p_nouveau})`, `invalide`/`reservee` sans appeler la base, PGRST202/42883/42P01/PGRST205 → `indisponible`, autre erreur → `erreur` ; `adressesDejaPortees(a, candidats)` (ensemble vide si la table est absente, `null` si panne → rien n'est créé), appelée par `obtenirOuCreerBoutique` et `creerBoutiqueSupplementaire` : une ancienne adresse n'est jamais redonnée (« -2 »). Route privée `/api/reseller/boutique/adresse` : GET `{option, actuelle, ancienne}`, et avec `?adresse=` `demande {adresse, etat: libre|prise|refusee, message}` (503 si on ne sait pas) ; POST `{adresse}` DÉJÀ normalisée (sinon 400 : le changement est sans retour, on n'écrit que ce que l'écran a confirmé), boutique principale et uid de la SESSION, `Sec-Fetch-Site`, aperçu admin refusé, 409 `pris` / `deja_change` / option absente, 503 panne. GET/PATCH `/api/reseller/boutique` : `options.adresse` (lu seulement si `options.reglages`, même fichier SQL) + `ancienneAdresse` ; `slug` toujours ignoré par PATCH. Écran : `src/components/reseau/AdresseBoutique.tsx` dans « Personnaliser » (`{optionAdresse && (`) : proposition depuis une vraie enseigne seulement, aperçu, avertissement « Une seule fois », GET → `confirmer` (danger) → POST, puis `onChange` met à jour lien, QR et StatCard sans recharger. Vitrine `/boutique/[slug]` : `charger` renvoie `{deplacee}` pour l'ancienne adresse d'une boutique EN LIGNE → `permanentRedirect(adresseDeRedirection(...))` dans la page ET dans `generateMetadata` (boutique masquée → introuvable). **Piège à vérifier en QA : `src/app/loading.tsx` fait partir la page par morceaux ; la redirection peut alors arriver en balise de rafraîchissement (code 200) au lieu d'un 308.** `WhatsAppFloatingButton` : préfixe `/boutique/` ajouté (ne couvre pas `/boutiques`) ; la bulle (`BulleSupport`, montée seulement sur les vitrines) lit le profil dans `useSugubaStore` et ne prend plus `md:bottom-6` pour `supplier`/`reseller`/`driver`, dont la barre du bas reste affichée dès 768 px (même liste que `navigationMetier` de `BottomNav`, vérifiée par un test). Limites notées au guide : boutique principale seulement ; les anciens liens suivis (`tracking_links.target_ref` = ancien slug) ne sont pas repointés (ils redirigent, un nouveau partage crée un nouveau lien). Tests : `tests/ma-boutique-lot8.test.cjs` (27, dont 3 sous PGlite avec le vrai SQL, par un petit client Supabase → SQL) ; 2 assertions du lot 6 adaptées (`adresse: true` après le SQL).

> **3 octobre 2026 — boutique revendeur, lot 7 : corrections de relecture (en ligne).** **Aucun SQL.** 4 constats vérifiés, tous fondés : 3 corrigés dans le code, 1 dans le guide seulement. **(1) Fournisseur, boutique supplémentaire.** Depuis le lot 7, `definirArticlesDeLaBoutique` ne revalidait plus les articles GARDÉS ; or la liste à cocher de `/compte/boutiques` ne montre que les produits approuvés, tout en repartant de tous les identifiants de `store_products` : un produit refusé ou archivé après coup revenait à chaque enregistrement — impossible à retirer, compté dans « N article(s) choisis » et dans la limite de 60. Désormais, POUR `type === 'supplier'` SEULEMENT : `produitsEnVenteDuFournisseur(fournisseurId, ids)` (approuvé ET à lui ; `null` si la lecture échoue → 503, rien n'est écrit) revalide toute la liste voulue en UNE lecture ; les gardés hors vente rejoignent `retires` (place des autres intacte) et ne comptent pas dans la limite (borne large `2 × 60` avant toute lecture, limite exacte ensuite) ; `GET /api/compte/boutiques` filtre `articles` de même pour un fournisseur (lecture en échec : liste entière, on n'invente pas un retrait). « Hors vente » = tout statut autre que `approved` : un produit repassé `submitted` après un changement de prix sort donc aussi de la boutique s'il est enregistré pendant l'attente (comme avant le lot 7 ; noté « à valider » au journal). Revendeur : inchangé (un article gardé hors vente reste ; « Mes articles » le signale et le retire). **(2) Piège : une fonction qui avale l'erreur transforme une panne en « introuvable ».** `cibleArticles` passait par `boutiqueDuCompte` → `boutiquesDuCompte` (`if (error || !data) return []`) : `stores` illisible = 404 « Boutique introuvable » pour le vrai propriétaire, sans « Réessayer ». Nouveau `lireBoutiqueDuCompte(type, proprietaireId, boutiqueId)` dans `src/lib/reseau/boutiques.ts` → `{ boutique, illisible }` : UNE lecture de `stores` par `id` + `owner_type` + `owner_id` (avant : 1 + N). `cibleArticles` renvoie `BOUTIQUE_ILLISIBLE` (`'illisible'`), jamais `null` ni la principale → 503 dans `GET /api/reseller/boutique/articles` (« Vos articles sont indisponibles. Réessayez. » : l'écran montre son état d'erreur avec « Réessayer ») et `POST /api/reseller/shop` (« Votre boutique est illisible pour le moment. Réessayez. ») ; `POST /api/compte/boutiques` (`articles`, `modifier`) → 503 « Vos boutiques sont indisponibles pour le moment. Réessayez. ». `boutiqueDuCompte` garde sa signature (null aussi en cas de panne) pour la porte `/reseller/ma-boutique`, qui a un repli ; toute route qui répondrait « introuvable » doit appeler `lireBoutiqueDuCompte`. **(3) `SelecteurArticles`** : `<ProductImage … fill sizes="40px" compact />` — sans `sizes`, `next/image` en `fill` annonce `100vw` (variantes de 640 px et plus pour une vignette de 40 px, jusqu'à 300 lignes) ; sans photo, icône seule. Vaut pour « Choisir les articles », « Mes rayons » et « Mes boutiques ». **(4) NON CORRIGÉ DANS LE CODE — écart avec la décision du fondateur « ces outils s'appliquent aussi à chaque boutique Pro (lot 7) ».** Personnaliser, Statistiques, Mes rayons, annonce datée, « Prévenir mes abonnés », lien suivi et « prête à X % » ne visent que la boutique principale : `boutiqueDuProprietaire('reseller', uid)` dans `/api/reseller/boutique` (GET/PATCH), `…/stats`, `…/partage`, `…/annonce` ; pages `/reseller/boutique`, `…/rayons`, `…/statistiques`. C'est un lot entier, pas une correction : **lot complémentaire à lancer, ou décision à faire confirmer**. Piste : `?boutique=<id>` vérifié par `lireBoutiqueDuCompte`, sélection lue par `cibleArticles` (`store_products`) ; à trancher avec le fondateur : (a) « une annonce par 24 h » par boutique (filtrer `STORE_ANNOUNCE` par `subject_ref`) ou par compte (aujourd'hui `reseller_id`) ; (b) Statistiques d'une boutique Pro — visites et abonnés sont par boutique, commandes et gains par revendeur. Le journal du guide le dit (lot 7 ; lots 5 et 6, qui annonçaient ces outils « au lot 7 »). **Reste connu, antérieur au chantier :** `boutiquesDuCompte` avale toujours l'erreur — `GET /api/compte/boutiques` renvoie une liste vide quand `stores` ne répond pas (« 0 / 1 boutique utilisée »), et `creer` répondrait alors « Choisissez un autre nom de boutique » (l'index `stores_principale_key` empêche la création d'une seconde principale). Tests : `tests/ma-boutique-lot7-relecture.test.cjs` (11 ; 10 en échec sur le code du lot 7, vérifié sur une copie de HEAD) ; `ma-boutique-lot7` : 2 vérifications adaptées.

> **3 octobre 2026 — boutique revendeur, lot 7 « Boutiques Pro au même niveau » (en ligne).** **Aucun SQL.** Les boutiques supplémentaires (formules Pro) d'un REVENDEUR reçoivent le mode propriétaire, les crayons, « Mes articles » et les coups de cœur. **Couche commune `src/lib/reseau/articles-boutique.ts`** : `cibleArticles(uid, boutiqueId?)` → `reseller_shop_items` (principale, clé `reseller_id` = uid de la session, aucune lecture) ou `store_products` (boutique Pro, clé `store_id`, vérifiée par `boutiqueDuCompte('reseller', uid, id)`, sinon `null` → 404 « Boutique introuvable ») ; `lireSelection`, `ordonnerArticles` (UPDATE de position seulement), `ajouterArticle` (article approuvé et `partageable`, position `positionAjout`), `retirerArticle`. **Piège : un identifiant vide ou illisible donne `null`, JAMAIS la principale** (seuls `undefined`/`null` la désignent) : un écran qui perdrait l'identifiant d'une boutique Pro écrirait sinon dans la table qui porte les offres. `POST /api/reseller/shop` délègue ses trois actions à cette couche (comportement de la principale inchangé, tests du lot 3 verts) et accepte `boutique: <id>` ; `GET /api/reseller/boutique/articles?boutique=<id>` renvoie en plus `boutique {id, slug, nom, enseigne, statut}` (nom public calculé côté serveur) ; avec l'identifiant de SA principale : ses articles et `principale: true` (l'écran se comporte alors comme sans paramètre). **`definirArticlesDeLaBoutique` (boutiques-multiples.ts) n'efface plus avant de réécrire** : lecture de la sélection (illisible → rien n'est écrit), insertion des NOUVEAUX d'abord (à la suite, `positionAjout`), puis suppression des seuls retirés (`.delete().eq('store_id').in('product_id', retires)`) ; les lignes gardées ne sont pas réécrites (ordre et coups de cœur intacts) ; plus de 60 → 400 (avant : liste coupée, donc articles « retirés » en silence) ; liste absente ou illisible → 400 (avant : prise pour une liste vide, la boutique était vidée) ; renvoie `refuses`. Vaut aussi pour les fournisseurs. **`partageable` est exportée par `src/lib/shop.ts`** (commission > 0 et prix « ok ») et appliquée, POUR LES REVENDEURS SEULEMENT, à `chargerProduitsDeLaBoutique(storeId, revendeurId)` (vitrine Pro : + `coupDeCoeur`, `nouveau`, tri `trierSelection`), à la sélection et au catalogue de `GET /api/compte/boutiques` ; les boutiques supplémentaires des fournisseurs gardent tous leurs produits approuvés (comme leur principale). Vitrine `/boutique/<slug>` : `proprietaire` pour toute boutique revendeur de la session, avec `boutiquePro: <id>` quand elle n'est pas la principale (pas de clé sinon : les `deepEqual` des lots 1 à 3 tiennent) ; une boutique Pro masquée reste visible pour son revendeur ; `compterArticlesNonServis(uid, servis, boutiqueProId)` ; pour une boutique Pro : `suiviProprietaire = null`, `reglages.option = false`, `lienModifier = null`. `ShopView`/`BandeauProprietaire`/`EnteteEditable` reçoivent `boutiquePro` : tuiles Articles (`pageMesArticles(id)`), Mes boutiques, Outils ; ni Personnaliser, ni Stats, ni Rayons, ni « prête à X % » ; `PartageBoutique suivi={false}` (adresse brute, jamais la route du lien suivi, qui est celle de la principale). Crayons d'une boutique Pro : `PanneauImage`/`PanneauNomAccueil` → `POST /api/compte/boutiques {action:'modifier', boutiqueId, champs}`, qui renvoie désormais `boutique` et `vitrine {nom, enseigne}` pour un revendeur et enregistre son propre nom en « Prénom I. ». Porte `/reseller/ma-boutique?boutique=<id>` (bandeau « C'est votre boutique · Gérer » d'une boutique Pro) ; `porteMaBoutique(id)`, `pageMesArticles(id)`, `PAGE_MES_BOUTIQUES` dans `porte-boutique.ts`. « Mes articles » lit `?boutique=` (`useSearchParams` sous `Suspense`) ; `FeuilleSelectionPro` (liste à cocher, catalogue lu à l'ouverture, action « articles ») ; `/compte/boutiques` : « Choisir les articles » d'un revendeur → Mes articles, la liste à cocher reste pour les fournisseurs ; `/reseller/prix?boutiquePro=<id>` ne change que le retour. Restent propres à la boutique principale : Personnaliser, Statistiques, Mes rayons, annonce datée, « Prévenir mes abonnés », lien suivi. Tests : `tests/ma-boutique-lot7.test.cjs` (25, tous en échec sur le code d'avant) ; 3 vérifications des lots 1 et 3 réécrites (règle changée par ce lot). **À faire par le fondateur** : parcours sur la copie QA avec un compte [QA] Pro (logo par le crayon, ranger 3 articles, 1 coup de cœur, recharger), captures de « Mes boutiques » et « Mes articles ».

> **3 octobre 2026 — boutique revendeur, lot 6 : corrections de relecture (en ligne).** 8 constats vérifiés, tous fondés (2 décrivent le même défaut). **Piège : nettoyer AVANT de borner.** `textePropre` (`src/lib/boutique-reglages.ts`) appliquait `/<[^>]*>/g` — quadratique : chaque « < » relit toute la suite — au nom d'un rayon et à l'annonce avant tout contrôle de longueur : PATCH `/api/reseller/boutique` avec 80 000 « < » = 3 s de calcul (×4 par doublement, ~7 min pour 1 Mo, aucune limite de taille de corps), et l'annonce répondait 200 (prise pour « pas d'annonce »). Maintenant `TEXTE_BRUT_MAX = 200` : à l'écriture (strict), refus immédiat avec le message de longueur (`rayonsPropres`, `annoncePropre`, et `refusNomRayon` / `refusAnnonce` appelées seules) ; à la lecture, `brut.slice(0, 200)` avant tout remplacement ; expression linéaire `/<[^<>]*>/g`. `refusNomRayon` : + `prixSeul` (nombre de 3 chiffres ou plus hors année, comme l'annonce : « Tout à 5000 » refusé, « Pagnes 2026 » permis). `contact()` commun à l'annonce et au nom de rayon : `NUMERO` avec les séparateurs `/ _ ,` (UN seul entre deux chiffres : « Tailles 38, 40, 42, 44 » passe), dates complètes `JJ/MM/20AA` retirées avant (`DATE`), `LIEN` élargi (sites par terminaisons courantes non suivies d'une lettre, `wa|t|m|fb.me`, tout `nom.xx/`, e-mail ; « .me » nu exclu : « Merci.Me voici » ; pas de lookbehind, pour Safari < 16.4). `cleRayon` (`src/lib/partage-boutique.ts`) : dès qu'une lettre ou un chiffre du nom ne s'écrit pas en a-z0-9 (arabe, n'ko, « ɛ », « ɔ »), la clé finit par `-<empreinte>` (FNV-1a 32 bits en base 36, 7 caractères : `rayon-157fkh2`, `bazin-0db82jc`), 40 caractères au plus ; avant, tous ces noms valaient `rayon` (ou `f-r` pour « Fɛrɛ » et « Fɔrɔ ») → « Vous avez déjà un rayon de ce nom » à tort. Clés des noms a-z (accents compris) inchangées ; la règle vaut aussi pour les catégories des fournisseurs (deux catégories non latines ne se fondent plus). `PartageBoutique` : `choixInitial` appliqué PENDANT le rendu (`demande` / `applique`, setState en rendu : React rejoue le rendu avant tout effet), plus dans un `useEffect` — l'effet de préparation partait avant, avec l'ancien choix, et créait un lien « Ma boutique » + un SHARE pour un simple partage de rayon. « Mes rayons » : `libelle="Enregistrer"` (à 390 px, « Enregistrer mes rayons » + « Annuler » occupaient les 332 px de la barre : « Non enregistré » passait sous « Annuler »). `SelecteurArticles` : la note a sa propre ligne (`break-words`), plus de « prix · note » tronqué. Guide : entrée de relecture, entrée du lot 6 et fiches rev-boutique-rayons, rev-boutique, vitrine-boutique corrigées. Tests : `tests/ma-boutique-lot6-relecture.test.cjs` (11 ; feuille de partage jouée avec des crochets React simulés — setState en rendu, effets à dépendances — sur la vraie route ; seuil de temps à 1 s parce que la suite tourne en parallèle), ma-boutique-lot6 adapté ; 676 tests, `tsc` OK. **Écarts à valider** : « Mes articles » (« Enregistrer l'ordre », lot 3) a le même manque de place, plus léger, non corrigé ; sous 390 px « Non enregistré » reste à l'étroit (composant commun) ; « @awamode » et « 76 - 12 - 34 - 56 » passent, « Tailles 38/40/42/44 » est refusé ; « 12.10.2026 » reste pris pour un montant (règle du lot 3). Aucune migration : le SQL du lot 6 est inchangé et reste à exécuter.

> **3 octobre 2026 — boutique revendeur, lot 6 « Rayons personnalisés et annonce datée » (en ligne).** **SQL À EXÉCUTER par le fondateur : `supabase/A-EXECUTER-2026-10-03-vitrine-boutique.sql`** (seul fichier du chantier boutique, rejouable, aucune donnée modifiée ; copie locale isolée puis production, 5 vérifications en bas de fichier depuis la relecture du lot 8) : `stores.reglages JSONB NOT NULL DEFAULT '{}'` + contrainte `stores_reglages_objet` (objet, ≤ 16 Ko) ; `store_slug_aliases` (RLS, `REVOKE … FROM PUBLIC, anon, authenticated`) et `changer_adresse_boutique(store, owner, nouveau)` SECURITY INVOKER → `ok | deja_change | pris | invalide | introuvable | identique` (aucun écran ne l'appelle : lot 8). **Le code marche AVANT le SQL** : `versBoutique` renvoie `reglages` (toujours relus par `lireReglages`) et `options.reglages = ('reglages' in row)` ; `majBoutique(id, owner, champs, vitrine?)` — les réglages ne passent JAMAIS par `champs` (les routes fournisseur, Suguba et « modifier » transmettent le corps brut) : seul PATCH `/api/reseller/boutique {reglages: {rayons?, annonce?}}` les fournit, avec la sélection de la session (`reseller_shop_items` LU seulement, jamais écrit) ; colonne absente à la lecture, ou 42703 / PGRST204 à l'écriture → **409 « Option pas encore activée »**, jamais 500 ; GET et PATCH renvoient `options {reglages, adresse: false}`. Règles pures `src/lib/boutique-reglages.ts` : `normaliserReglages(brut, {selection, maintenant, actuels})` (fusion : seules les parties présentes changent ; 8 rayons, nom 2–24 sans balise, prix, numéro ni nom réservé, clé = `cleRayon(nom)` unique, un article dans UN rayon maison, ids ⊂ sélection ; annonce ≤ 90, `promesseChiffree` + numéro et lien refusés, année permise, `fin` « AAAA-MM-JJ » d'aujourd'hui à J+14, jour de Bamako = UTC), `lireReglages` (tolérant, jamais d'erreur), `annonceEnCours`, `refusNomRayon` / `refusAnnonce` / `refusFinAnnonce`, `poserRayon` / `deplacerRayon` / `refusRayon` / `memesRayons`, `jourLisible`, `OPTION_ABSENTE`. `partage-boutique.ts` : `RayonChoisi`, `rayonMaisonDe` (le rayon qui contient l'article, sinon le rayon maison de même clé que sa catégorie : jamais deux rayons du même nom), `rayonsDeLaVitrine` / `choixDePartage` / `articlesDuChoix` / `articlesAAnnoncer(…, rayonsMaison)`, `ArticlePartage.id`. Vitrine : `/boutique/[slug]` passe `reglages {rayons, annonce (texte seulement si en cours), option (propriétaire en gestion)}` à `ShopView` pour une boutique revendeur (/r/ et /s/ inchangés) ; `BoutiqueProduits rayonsMaison` → `organiserVitrine(produits, recherche, rayonsMaison)` : rayons maison d'abord, dans l'ordre choisi, rien pour une sélection vide ; bandeau d'annonce `role="note"` (+ « Modifier » en gestion) ; `BandeauProprietaire optionRayons` (5 tuiles : grille de 6 colonnes sur téléphone, 3 + 2). Pages : `/reseller/boutique/rayons` « Mes rayons » (`PAGE_RAYONS`, `shop/proprietaire/FeuilleRayon.tsx`, ▲▼ 40 px, `BarreEnregistrement`, une seule requête, états `option_absente` / `sans_boutique`), Personnaliser (cartes « Annonce sur ma boutique » et « Mes rayons » sous `optionReglages`, annonce envoyée seulement si modifiée), `components/reseau/SelecteurArticles.tsx` (extrait de `/compte/boutiques` ; `onEnregistrer` avec bouton, `onChange` sans). `PartageBoutique` : `boutique.rayons`, `choixInitial` ; `/api/reseller/me?avec=boutique` et `/api/reseller/boutique/stats` n'ajoutent `rayons` que s'il y en a (réponses identiques avant le SQL) ; route de partage : libellé du lien = nom du rayon maison. `tests/ma-boutique-lot6.test.cjs` (31 tests : le SQL exécuté deux fois dans PGlite ; « Mes rayons » et « Personnaliser » jouées avec des crochets React simulés et les vraies routes ; 30 en échec sur le code du lot 5, « rendu identique » réussi des deux côtés) ; 665 tests réussis ; `tsc` OK. Guide : fiche `rev-boutique-rayons`. Reste : exécuter le SQL ; captures [QA] ; boutiques Pro (lot 7) ; écran du changement d'adresse et redirection des anciennes adresses (lot 8). À valider : rayon du nom d'une catégorie = un seul rayon ; renommer un rayon change son lien.

> **3 octobre 2026 — boutique revendeur, lot 5 : corrections de relecture (en ligne).** 6 constats vérifiés, tous fondés. **Piège : `.slice()` coupe un emoji en deux** (paire UTF-16) → demi-paire isolée, que `encodeURIComponent` refuse (URIError AU RENDU : `FeuilleAnnonce` composait le lien du statut WhatsApp même fermée, donc « Mes articles » et « Statistiques » tombaient au chargement pour tout revendeur ayant un article récent au nom long avec un emoji à l'indice 59) et que Postgres refuse à l'écriture (annonce en 503 à chaque essai). Nouveau `src/lib/texte-entier.ts` (pur) : `texteBienForme` (`/[\uD800-\uDFFF]/gu` : avec `u`, seules les demi-paires isolées correspondent) et `couperTexte(texte, max)` ; utilisés par `nomPropre` (annonce-boutique, 60), `texteStatutAnnonce` (toujours bien formé) et `notifier` (titre 140, texte 400 : avant, un titre coupé au milieu d'un emoji faisait rejeter toute l'écriture, en silence). `FeuilleAnnonce` fermée : `<Sheet ouvert={false}>` rendu AVANT toute composition (même instance, focus rendu). Titre de l'annonce : `nomBoutiqueAnnonce(nom, nomComplet)` = `nomPublicBoutique`, ou `nomPublic` (« Awa D. ») si `nomAnnoncable` est faux — `promesseChiffree(nom, { nombreSeul: false })` (extrait de `message-affiche.ts`, `refusMessageAffiche` inchangé : `%`, montant + monnaie, « 10k », milliers séparés, baisse, mot de remise + chiffre, « 2 pour 1 ») ou `NUMERO` (8 chiffres ou plus) ; « Bamako 2000 », « Mode 223 » passent. `sousTitreAnnonce(mode)` : notifications Suguba pour `prete`/`envoyee`, « sur votre statut WhatsApp » pour `limite`/`sans_compte`. `BoutonAnnonce` : après l'envoi, bouton `ghost` `LIBELLE_ANNONCE_ENVOYEE` (« Annonce envoyée · Publier sur mon statut ») qui rouvre la feuille en mode `envoyee` (avant : résultat et statut perdus dès la feuille fermée). `annoncerBaissePrix` : `formatF` (plus de `toLocaleString`). Commentaires `BoutonSuivre` / `boutiques-suivies` et entrée du lot 5 du guide : les boutiques de revendeur ne font pas de promotion, mais « Baisse de prix chez … » existe côté fournisseur. Guide : entrée de relecture, fiches rev-boutique-articles, rev-boutique-stats, notifications. Tests : `tests/ma-boutique-lot5-relecture.test.cjs` (9, tous en échec sur le code du lot 5 ; la base simulée refuse une demi-paire à l'insertion, comme Postgres), ma-boutique-lot5 adapté ; 634 tests, `tsc` OK. **Écarts à valider** : titre « chez Prénom I. » quand l'enseigne annonce un prix (le nom de boutique reste libre sur la vitrine) ; « Tout à 5000 » (nombre seul) passe ; l'accès « Annonce envoyée » disparaît au rechargement (rien ne rappelle l'annonce pendant les 24 h). Aucune migration.

> **3 octobre 2026 — boutique revendeur, lot 5 « Prévenir mes abonnés » (en ligne).** Le revendeur annonce ses nouveautés à ses abonnés, une fois par 24 h, DANS L'APPLICATION seulement (aucun WhatsApp/SMS, aucun appel sortant), texte écrit par le serveur. Règles pures `src/lib/annonce-boutique.ts` : `prochaineAnnonce` (24 h), `debutDesNouveautes` (dernière annonce, 14 j au plus = `NOUVEAU_JOURS`), `annoncable` (filtre de la vitrine + en stock), `nouveautesAAnnoncer`, `contenuAnnonce` (« Nouveautés chez <nom public> », « À découvrir : A, B et C » / « et N autres articles », lien `/boutique/<slug>`), `texteStatutAnnonce`, `annonceAProposer`, `modeAnnonce` (`prete` / `limite` / `sans_compte` / `envoyee`), phrases et libellés, types `EtatAnnonce` / `ResultatAnnonce`. Route privée `/api/reseller/boutique/annonce` : GET (lecture seule) → `{nouveautes, apercu, abonnesAvecCompte, abonnesSansCompte, derniereAnnonce, possibleLe}` (sans nouveauté : ni profil ni abonnés lus) ; POST SANS CORPS (refus `Sec-Fetch-Site` ≠ same-origin, aperçu admin 403) → `{prevenus, sansCompte, possibleLe}` ; 404 sans boutique, 409 boutique masquée, 429 annonce < 24 h (avec `possibleLe`), 400 aucune nouveauté, 409 aucun abonné avec compte (rien n'est consommé), 503 si journal/profil/compte illisible. Limite = événement `STORE_ANNOUNCE` (ajouté à `EvenementAnalytique`, lu par `reseller_id`, `subject_ref` = id de boutique, meta `{prevenus, sansCompte, nouveautes, reservation}`) : trace écrite AVANT l'envoi (`journaliser` renvoie maintenant un booléen), la plus ancienne trace des 24 h l'emporte (2 onglets → 429, trace retirée par `.eq('meta->>reservation', …)`), trace retirée aussi si 0 notification écrite. `notifications.ts` : `notifier` renvoie le nombre de notifications ÉCRITES, `notifierAbonnes` le relaie (toujours `.not('follower_id','is',null)`) ; `boutiquePrincipaleFournisseur` (order created_at, limit 10, `principale !== false`) remplace les deux `.maybeSingle()` d'`annoncerNouveauProduit` / `annoncerBaissePrix` (annonces fournisseur muettes dès 2 boutiques). UI : `shop/proprietaire/BoutonAnnonce.tsx` (GET au montage et quand `rafraichir` change, bouton `secondary` « Prévenir mes abonnés (N nouveautés) » seulement si nouveautés ET ≥ 1 abonné, POST sans corps sous verrou, 429/409 → la feuille change de mode, lien suivi WhatsApp de la boutique préparé par POST `/api/reseller/boutique/partage` seulement quand le statut WhatsApp est proposé) et `FeuilleAnnonce.tsx` (Sheet, affichage pur : aperçu, « N abonnés avec un compte seront prévenus dans l'application », « M abonnés inscrits par téléphone ne reçoivent rien », « Prévenir mes N abonnés » ; après l'envoi « N abonnés prévenus », prochaine annonce via `formatDate(…, 'jourHeure')`, « Publier sur mon statut WhatsApp » = `api.whatsapp.com/send?text=`, partage manuel) ; posé dans Mes articles (sous les compteurs, `rafraichir={articles.length}`) et Statistiques (sous « Abonnés », si en ligne). `BoutonSuivre` : « Vous serez prévenu des nouveautés de cette boutique. » ; `/boutiques-suivies` : « Leurs nouveautés, en premier. » Tests : `tests/ma-boutique-lot5.test.cjs` (20 ; base simulée avec `not`/`is`, `maybeSingle` sur 2 lignes = PGRST116, composant appelé avec des crochets simulés et branché sur les vraies routes ; 8 échouent sur l'ancien `notifications.ts`/`db.ts`/`BoutonSuivre`), lot4-relecture adapté (journal) ; 625 tests, `tsc` OK. **Écarts à valider** : fenêtre de 14 jours pour les nouveautés ; bouton compte toutes les nouveautés, la notification en nomme 3 ; 409 (au lieu de `prevenus: 0`) sans abonné avec compte. **À faire** : captures (rev-boutique-articles, rev-boutique-stats, feuille sans envoi) et vérifications QA (un client [QA] suit, le revendeur ajoute 2 articles et annonce, notification dans /notifications → vitrine, 2e annonce refusée, abonné par téléphone compté « ne reçoivent rien »). Aucune migration.

> **3 octobre 2026 — boutique revendeur, lot 4 : corrections de relecture (en ligne).** 13 constats vérifiés, tous fondés (2 en double). Statistiques : `statsDeLaPeriode` (`lib/reseau/stats.ts`) — la page garde la dernière réponse (`lues`) mais n'affiche que celle dont `jours` est la période cochée ; sinon chargement, ou `EmptyState` erreur + « Réessayer » (avant : chiffres de 7 j sous « 30 derniers jours » si la 2e lecture échouait, sans message) ; pied : visites par l'ancien lien /r/ non comptées. `conseilBoutique` : « Vos liens WhatsApp marchent » seulement si `origine.whatsapp * 2 >= visites` (et > 0), sinon « Imprimez votre carte avec son QR… ». **Route de partage en POST** : `/api/reseller/boutique/partage` n'a plus de GET (cookie `sameSite: 'lax'` → une navigation d'un autre site créait un lien + SHARE + étape cochée, avec `?nom=` choisi par ce site) ; POST `{canal, rayon}`, 403 si `Sec-Fetch-Site` présent et ≠ `same-origin` ; libellé du rayon recalculé côté serveur (`nomDuRayon` : catégories des articles de `reseller_shop_items`, `cleRayon`, `nomDeRayonPropre`), lu seulement à la création (`lienPermanent` accepte `libelle` en fonction) ; appelants (feuille, badge, créateur) en POST. Fiche produit : sans enseigne `titreVitrine` → « La sélection de Awa D. », titre `line-clamp-2`, lien « Voir » + `sr-only sm:not-sr-only` « sa boutique ». Bandeau : `formatNombre(visites7j)`. `aria-label="Partager ma boutique"` (bandeau, accueil, Mes articles). Feuille : « Votre message ». Accueil : `prochaineEtape(etapes, enLigne)` (`etapes-boutique.ts`) saute `partage` pour une boutique masquée. Guide : entrée de relecture, écarts du lot 4 complétés (carte & QR et créateur préparent le lien et cochent l'étape ; visites /r/ non comptées), fiches rev-boutique-stats, rev-badge, rev-createur, fiche-produit, rev-accueil, vitrine-boutique, rev-partages. Tests : `tests/ma-boutique-lot4-relecture.test.cjs` (9, tous rouges sur le lot 4 ; la page Statistiques y est rendue avec des crochets React simulés pour elle seule via `Module._load`) ; lot4 et lot2 adaptés. **À faire** : captures et vérifications QA à 390 px (Statistiques réseau coupé, fiche produit sans enseigne et enseigne longue, accueil boutique masquée) ; seuil « moitié des visites » à valider par le fondateur. Aucune migration.

> **3 octobre 2026 — boutique revendeur, lot 4 « Partager et mesurer » (en ligne).** Lien suivi PERMANENT de la boutique : `lienPermanent` (`src/lib/reseau/db.ts`) relit le premier `tracking_links` (owner, cible `store`, ref, canal) avant tout insert, SHARE journalisé à la création seulement ; ref d'un rayon = `slug~cle` (`codes.ts` : `estCleRayon` [a-z0-9-]{1,40}, `refBoutique`, `lireRefBoutique`, `RAYON_COUPS_DE_COEUR` réservée ; `destinationDuLien` → `/boutique/slug?rayon=cle&ref=…&via=…`, clé invalide ignorée). Route privée GET `/api/reseller/boutique/partage?canal=whatsapp|qr&rayon=<cle>&nom=` → `{url, suivi}` (`/go/<code>` réutilisé, adresse brute en repli, 409 si masquée, rien créé en aperçu admin). `src/lib/partage-boutique.ts` (pur : `cleRayon` NFD + œ/æ, `choixDePartage`, `articlesAAnnoncer`, `texteBoutique` formatF, `libellePartageBoutique`, `versArticlesPartage`) ; feuille `shop/proprietaire/PartageBoutique.tsx` (choix en radiogroup, lien préparé à l'ouverture et au toucher, échec relancé seulement par un geste, WhatsApp/Copier/QR, QR chargé à la demande), branchée dans le bandeau (contexte `ModeProprietaire` : `partage`, `aPartage`, ?partager=1 retiré de l'adresse), la carte de l'accueil (`next/dynamic`), Mes articles et Statistiques. Visites : `shop/VisiteBoutique.tsx` (2 s de page visible, keepalive), monté par ShopView (`visite`) pour un visiteur d'une boutique en ligne sur /boutique/ seulement ; POST public `/api/reseau/visite-boutique` (toujours 204 ; propriétaire, `estRobotApercu` et boutique non active exclus ; une par visiteur/boutique/jour via `.eq('meta->>v', empreinte)` ; STORE_VIEW subject_ref = id de boutique, meta {v, canal}, ni IP ni UA, actor_id null). Stats : GET `/api/reseller/boutique/stats?jours=7|30` (visites, visiteurs, série, origine, clics des liens store, commandes à son nom hors annulées, livrées, gains = reseller_commission des livrées, abonnés + nouveaux via store_follows.created_at, top 3 `visites_mesurees` (42P01/PGRST205 → null), mesuré depuis = 1re STORE_VIEW, conseil `conseilBoutique`) ; page `/reseller/boutique/statistiques` ; `stats.ts` + `origineDeVisite`, `debutPeriode`, `resumeVisites`, `plusVus`. Bandeau : 4 outils (Personnaliser, Articles, Stats « 7 j : N visites », Outils), `suiviProprietaire` {visites7j, dejaPartage} calculé par la page pour le propriétaire en gestion seulement. 8e étape `partage` d'`etapesBoutique` (`aUnLienDeBoutique`, aussi dans /api/reseller/me?avec=boutique, + `enseigne`). Vitrine : ?rayon= → `BoutiqueProduits` (`ancreDuRayon`, défilement), métadonnées canonical `/boutique/<slug>`, description = accroche, titre « Rayon · Enseigne » ; `/r/<code>` canonical via `Boutique.slugBoutique` (pas de redirection) ; `livraisons` = commandes livrées à son nom (orders.reseller_id). `/api/shop/revendeur` → `{nom, enseigne, slug}` (`boutiqueRevendeurPublique`) ; fiche produit « Boutique de <enseigne> · Voir sa boutique » aux jetons suguba. Badge : QR en lien suivi `qr` ; créateur : carte boutique en lien suivi ; Mes partages : « Ma boutique · <rayon> ». `/api/reseau/suivre` : FOLLOW avec resellerId/supplierId. Tests : `tests/ma-boutique-lot4.test.cjs` (19), `reseau.test.cjs` +1, lot1/lot2/lot3/lot3-relecture adaptés (8 étapes, Partager du bandeau en bouton, journal) ; 18 des 19 nouveaux tests échouent sur le code du lot 3 ; 596 tests, `tsc` OK. **À faire** : captures (rev-boutique-stats, vitrine-boutique, rev-partages, rev-badge, fiche-produit, rev-accueil) et vérifications QA (1 visite, rechargement = 1, propriétaire = 0, même /go/ au 2e partage, aperçu WhatsApp, ?rayon=) ; en production après déploiement, lecture seule : `SELECT count(*) FROM analytics_events WHERE event='STORE_VIEW' AND occurred_at > now() - interval '1 day';`. Aucune migration.

> **3 octobre 2026 — boutique revendeur, lot 3 : corrections de relecture (en ligne).** 13 constats vérifiés, tous fondés (2 en double). **Piège Next.js** : quand seuls les paramètres d'adresse changent, la page garde son état (`createRouterCacheKey(segment, true)`, layout-router.js) ; un filtre lu au montage (`window.location.search` dans un `useEffect([])`) ne suit donc pas « Tous mes prix » ni « Produits » → `/reseller/prix` et `/reseller/catalog` lisent `useSearchParams()` à chaque rendu, sous `<Suspense fallback={<ChargementPage/>}>` (Mes prix : effet relancé sur `[toast, boutique, produit]`, réponse tardive ignorée). « ordonner » : `positionsAEcrire` (boutique-ordre, pur) écrit d'abord les positions ≥ 0, puis les négatives → jamais 7 coups de cœur si l'écriture s'interrompt (503 « Rangement interrompu »). « retirer » lit l'erreur du `delete` → 503 « Retrait impossible. Réessayez. ». Créateur : `selectionPourCarte` reprend les épuisés en repli, `vitrineMontreSelection` (affiche ou épuisé) décide seule du repli sur le catalogue, lecture des articles en échec jamais gardée (`null`) et signalée par un toast, sans carte. `message-affiche` : « k » seulement après 2 chiffres ou un décimal (« Télé 4K » permis), `MOT_REMISE` (promo, remise, soldes, réduc, rabais, offert…) + chiffre et « N pour M » refusés (« Pas de remise chiffrée »). Vitrine : `shop/DescriptionBoutique.tsx` (client, « Lire la suite »/« Réduire » 40 px, téléphone seulement, affiché si `scrollHeight > clientHeight`) dans `EnteteBoutique` (toujours serveur). Mes articles : accord « Touchez un article pour le retirer », prix en `whitespace-nowrap` dans une rangée `flex-wrap` (passe sous la pastille). Guide : journal, « Nouveau » pendant 14 jours, fiche `vitrine-fournisseur` (recherche · rayons, Lire la suite), 6 fiches. Tests : `tests/ma-boutique-lot3-relecture.test.cjs` (10, tous rouges sur le lot 3) ; `ma-boutique-lot3` adapté (forme de l'appel du créateur). **À faire** : captures et vérifications QA à 390 px (aucun serveur lancé). Aucune migration.

> **3 octobre 2026 — boutique revendeur, lot 3 « Mes articles : ranger, coups de cœur, gain visible » (en ligne).** Convention sans migration dans `src/lib/boutique-ordre.ts` (pur) : `reseller_shop_items.position` < 0 = coup de cœur (`COUPS_DE_COEUR_MAX` = 6, `ARTICLES_MAX` = 60, `NOUVEAU_JOURS` = 14), `positionsPourOrdre` (−k…−1 puis 0…n−1), `positionAjout` (max + 1, jamais négative), `controlerEnsemble`, `trierSelection` (position, puis `added_at`), `estCoupDeCoeur`, `estNouveau`, rangement à l'écran (`basculerCoupDeCoeur`, `monterArticle`, `mettreEnPremier`, `sansArticle`), `selectionPourCarte`, types `ArticleBoutique`/`EtatArticle`. POST `/api/reseller/shop` : « ajouter » n'écrit rien si l'article est déjà là, sinon `insert` à `positionAjout` (plus d'`upsert` à `position: count`, 23505 = déjà là) ; nouvelle action « ordonner » `{ordre, coupsDeCoeur}` : 400 (forme, > 6 cœurs, cœur hors ordre), 409 « Votre boutique a changé, rechargez » si l'ensemble ≠ sélection de la session, puis **UPDATE de position seulement**, ligne par ligne, pour les seules places qui changent. Route privée GET `/api/reseller/boutique/articles` (session revendeur ; `prixVitrine`, `gain` = `calculerTarifGros(...).commission` au prix de gros sinon `reseller_commission`, `monPrix`, `prixMinimal`, `coupDeCoeur`, `ajouteLe`, `etat` affiche/epuise/retire/sans_gain). Page `/reseller/boutique/articles` (« Mes articles », `PageReseau`, compteurs, blocs Coups de cœur / Autres, `LigneListe` + « Vous gagnez X F », cœur et Monter 40 px, `BarreEnregistrement` « Enregistrer l’ordre » avec verrou, conflit → « Recharger », `EmptyState`) et feuille `shop/proprietaire/FeuilleArticle.tsx` (Coup de cœur, Mettre en premier, Mon prix, Partager, Voir dans ma boutique, Retirer confirmé « Votre offre disparaîtra aussi de la fiche produit de cet article »). Vitrine : `chargerBoutiqueRevendeur` lit `position, added_at` → `ProduitVitrine.coupDeCoeur`/`nouveau` ; `BoutiqueProduits` : `organiserVitrine` exportée (recherche `normaliserRecherche`, section « Coups de cœur » en tête sans doublon, épuisés en fin de rayon, pastilles d'ancres dès 2 rayons, « Nouveau » seulement sans `etiquetteOffre`). `/boutique/[slug]` : `compterArticlesNonServis` (lib/shop) pour le propriétaire seulement → `proprietaire.articlesMasques` (posé seulement si > 0) → alerte « N articles de votre sélection ne s’affichent plus · Voir ». Bandeau « Articles » → `PAGE_MES_ARTICLES` ; `CATALOGUE_DEPUIS_BOUTIQUE` (`lib/reseau/porte-boutique.ts`). `etapesBoutique` : 7e étape `coupDeCoeur` (`compterVitrine` dans `/api/reseller/me`, prop `coupsDeCoeur` d'`EnteteEditable`). Catalogue : pastille « Dans ma boutique (N) », « Ajouté à ma boutique · Voir ma boutique », `?depuis=boutique` (bandeau collant « Revenir à ma boutique »), retrait confirmé. Mes prix : `?boutique=1` et `?produit=<id>` (route et page). Créateur : carte boutique = `selectionPourCarte` (route des articles, catalogue si vide) ; « Bandeau promo » → « Message », `src/lib/message-affiche.ts` (`refusMessageAffiche` : ni %, ni montant, ni nombre ≥ 3 chiffres, ni baisse chiffrée), aussi vérifié dans `genererAffiche`. `PageHeader` : retour vers la porte jamais préchargé. Tests : `tests/ma-boutique-lot3.test.cjs` (19, tous rouges sur le lot 2) ; `ma-boutique-lot2` adapté (7 étapes, lien « Articles ») ; 566 tests, `tsc` OK. **À faire** : captures (rev-boutique-articles, vitrine-boutique, rev-catalogue, rev-prix, rev-createur) et vérifications QA à 390 px (aucun serveur lancé). Aucune migration.

> **3 octobre 2026 — boutique revendeur, lot 2 : corrections de relecture (en ligne).** 10 constats vérifiés, tous fondés. Liste blanche revendeur extraite dans `src/lib/reseau/champs-boutique-revendeur.ts` (pur : nom ≤ 60 / accueil ≤ 90, noms réservés sauf valeur déjà enregistrée, images du dossier `boutiques/<uid>/` ou déjà en place, `categories` ⊂ `FAMILLES_CATEGORIES`, ni `recrute` ni `whatsapp`), appliquée par PATCH `/api/reseller/boutique` ET par POST `/api/compte/boutiques` « modifier » quand `c.type === 'reseller'` (le contournement passait par là, principale comprise) ; « creer » refuse un nom réservé pour un revendeur. `boutiquesQuiRecrutent` : `.neq('owner_type','reseller')`. `src/lib/enseigne.ts` : `NOM_PAR_DEFAUT` (« Revendeur Suguba », jamais une enseigne), `ADRESSES_RESERVEES`, `nomReserve` (mot contenant « suguba », « sugu ba », ou adresse réservée ; « Sugu Bamako » libre), `adresseReservee`, `nomPublicBoutique` ; `estEnseigne` renvoie faux pour ces noms. `obtenirOuCreerBoutique` et `creerBoutiqueSupplementaire` : adresse réservée → base `ma-boutique`. POST/PATCH `/api/reseller/boutique` : nom réservé → 400 ; nom non-enseigne enregistré en « Prénom I. » (`nomPublicBoutique`, PATCH lit le profil avant d'écrire). Noms publics des listes publiques : `nomsPublicsRevendeurs(a, elements, boutiqueDe)` (`lib/reseau/boutiques.ts`, `profiles.full_name` en une requête, boutique revendeur au profil illisible ou absent retirée) dans `boutiquesParQuartier`, `boutiquesSuivies` et `/api/reseau/recherche` (qui ne garde une boutique revendeur que si son nom public contient le texte cherché). `ModeProprietaire` : pilule sans `md:bottom-6`, `z-50` ; `BarreEnregistrement` : prop `barreDuBasPermanente` (rôles métier, barre du bas affichée sur ordinateur), utilisée par `/reseller/boutique`. Créateur : sans `vitrine`, `nomIndisponible` (« Boutique indisponible ») au lieu de `boutique.nom` ; `/reseller/boutique` : WhatsApp sans nom, initiale « Ma boutique ». `GalerieEditeur` : boutons `w-10 h-10`, un seul `SugubaLoader` ; `LogoUploader` : « Retirer » = `Button variant="danger" size="sm"` (40 px), appareil photo en `span aria-hidden` ; prop `confirmerRetrait` (via `useToast().confirmer`) sur `GalerieEditeur`, `LogoUploader`, `CouvertureEditeur`, passée par `PanneauImage` et `/reseller/boutique`. Guide : fiche `vitrine-boutique` corrigée (propriétaire sous un autre profil) + 7 fiches. Tests : `tests/ma-boutique-lot2-relecture.test.cjs` (14, tous rouges sur le lot 2). **À faire** : captures et vérifications QA (390 px et 1 024 px), aucun serveur lancé. Aucune migration.

> **3 octobre 2026 — boutique revendeur, lot 2 « Je gère là où le client regarde » (en ligne).** Mode propriétaire sur `/boutique/<adresse>` (profil revendeur actif seulement) : `ShopView` charge par `next/dynamic` `proprietaire/ModeProprietaire` (enveloppe `group` + `data-vue="gestion"|"client"`, choix en `sessionStorage` dans un try, pilule « Vue client · Revenir », contexte `useProprietaire` qui partage l'identité affichée), `BandeauProprietaire` (barre collante `top-16` : logo, état, « Partager » WhatsApp adresse brute ; Personnaliser · Articles → catalogue · Outils ; « Voir comme un client ») et `EnteteEditable` (3 crayons 40 px, `PanneauImage` = PATCH dès la fin de l'envoi, `PanneauNomAccueil` nom 60 / accueil 90, mise à jour locale + toast, sans `router.refresh`, `?editer=` lu par la page puis retiré de l'adresse, carte « prête à X % »). Outils : `group-data-[vue=client]:hidden` ; Suivre, `ShopShareBar`, « Devenir revendeur » et l'avis de sélection vide rendus aussi au propriétaire dans `<div inert className="hidden group-data-[vue=client]:block">`. En-tête extrait dans `shop/EnteteBoutique.tsx` (purement visuel, emplacements `surCouverture`/`surLogo`/`surNom`). Enseigne : `src/lib/enseigne.ts` (pur : `nomPublic` déplacé ici et réexporté par `lib/shop`, `estEnseigne` = ni le nom du compte, ni « Prénom I. », ni seulement des mots du nom, `titreVitrine`) ; `chargerBoutiqueRevendeur` et `boutique/[slug]` renvoient `nom` = enseigne ou « Awa D. » + `enseigne`, titres et métadonnées (`/boutique/`, `/r/`) via `titreVitrine`. `/api/reseller/boutique` : GET `?creer=non` sans création, `vitrine {nom, enseigne}`, `maxGalerie` ; POST `{nom}` (201, 409 si existe, 403 en aperçu, adresse tirée de l'enseigne ou de « Prénom I. » via `obtenirOuCreerBoutique({adresseDepuis})`) ; PATCH liste blanche (images seulement de `product-images/boutiques/<uid>/` de `NEXT_PUBLIC_SUPABASE_URL` ou déjà enregistrées, `src/lib/reseau/images-boutique.ts` ; ni `recrute` ni `whatsapp` ; `categories` ⊂ `FAMILLES_CATEGORIES`). `majBoutique` : galerie validée comme le logo, une URL invalide refuse tout. `src/lib/reseau/etapes-boutique.ts` (6 étapes, `progressionBoutique`) ; `/api/reseller/me?avec=boutique` + `etapes` et nom public ; accueil : barre « prête à X % » + prochaine étape ; `ListeEtapes` extraite (ListeDemarrage la rend). Démarrage : GET `?creer=non` au montage, POST à l'étape « Boutique » (PATCH si existe ou 409). `/reseller/boutique` : images à l'envoi, `GalerieEditeur`, « Ce que je vends », `BarreEnregistrement`. `LogoUploader` : `useEffect` sur `value`, `forme="carre"`, `accept="image/*"` ; `CouvertureEditeur` : `hauteur`. Créateur : `/reseller/ma-boutique?editer=logo|couverture` (`prefetch={false}`), carte au nom public. Tests : `ma-boutique-lot2` (15, dont 14 rouges sur l'ancien code), `boutique-images` +2, `ma-boutique-lot1` adapté (mock `next/dynamic` qui charge le module de l'`import()`). 533 tests, `tsc` OK. **À faire** : captures et vérifications QA 390 px (aucun serveur lancé), compilation de production à confirmer (`next/dynamic` dans un composant serveur), règle « mots du nom ≠ enseigne » à valider par le fondateur. Aucune migration.

> **3 octobre 2026 — boutique revendeur, lot 1 : corrections de relecture (en ligne).** 12 constats vérifiés, tous fondés. `ShopView` : `BoutiqueProduits refCode={proprietaire ? null : refCode}` + `codePartage` (le propriétaire ne s'ancrait plus via `AncrageRevendeur`, mais ses cartes portaient `?ref=<son code>` et l'ancrage global du layout le rattachait à lui-même ; `ProductCard` partage avec `monCode || codePartage || refCode`). Boutique masquée : textes rendus exacts (« Cette adresse affiche « page introuvable » à vos clients ») sur la vitrine et `/reseller/boutique`, car `/r/<code>` sert encore la sélection (`chargerBoutiqueRevendeur` ne lit `stores.status` que pour l'identité) : **décision à prendre** sur /r/ d'une boutique masquée (plan l. 1297 : garder l'ancien rendu). `CarteLien` non rendue si masquée sur `/reseller/boutique` et `/supplier/boutique` (avertissement « Masquée par Suguba » côté fournisseur, `statut` lu de `/api/supplier/boutique`). `compterArticlesEnVitrine` (`lib/shop.ts`, même filtre `partageable` que la vitrine) pour `/api/reseller/me?avec=boutique`. Démarrage : plus de `lienOuvrir` à l'étape 7 (sortait sans `terminer()`). Catalogue : bandeau « Ma boutique » sans condition sur `codeRevendeur` (`selectionLue`). `obtenirOuCreerBoutique` : `slugsCandidats` (base, -2 à -5, suffixes 4/6/8/12 de l'uid, puis 8 aléatoires ; 10 essais au lieu de 30) ; `/api/reseller/boutique` GET crée avec `nomPublic` ; porte et GET ne créent rien si le profil est illisible. `tests/ma-boutique-lot1-vitrine.test.cjs` (4 tests, page `/boutique/[slug]` exécutée : visiteur, autre compte, aperçu admin, propriétaire, Pro, fournisseur, métadonnées) ; `ma-boutique-lot1` 11 → 15 tests (9 échouent sans ces corrections) ; 516 tests réussis ; `tsc` réussi. **SQL de lecture à lancer par le fondateur** : les 4 requêtes du plan (décision « contrôles en lecture », texte dans l'écart du journal). Aucune migration. Captures et vérifications manuelles toujours à faire [QA].

> **3 octobre 2026 — boutique revendeur, lot 1 « Ma boutique ouvre ma boutique » (en ligne).** Porte unique `src/app/reseller/ma-boutique/route.ts` (GET, 307 vers `/boutique/<adresse>`, seuls `?editer=logo|couverture|nom` et `?partager=1` recopiés ; session = uid + `possedeRoleActif(session,'reseller')`, pas `sessionAvecRole` ; création avec `nomPublic`, aperçu admin refusé) ; règles pures `src/lib/reseau/porte-boutique.ts` (`PORTE_MA_BOUTIQUE`, `adresseVitrine`, `sansPrechargement` : `Button`, `BottomNav`, `CarteAccesReseau`, `GrilleOutils` ne préchargent jamais la porte). Barre du bas revendeur : Accueil · Produits · Boutique · Ventes · Gains (`prefixesActifs`, prop `actif`). Accueil : carte « Ma boutique » via `/api/reseller/me?avec=boutique` (lu après les soldes, dans un try : `boutique: null`, jamais 503 ; `articles: null` si le compte échoue), 2 raccourcis, étape « Choisir mes articles », « Tous mes outils ». `/boutique/[slug]` : `charger` dans `cache()`, statut renvoyé ; boutique masquée = page introuvable (noindex) sauf pour le propriétaire de la boutique revendeur principale, qui reçoit `ShopView proprietaire={statut, abonnes, gestion}` (ni `AncrageRevendeur`, ni Suivre, ni « Devenir revendeur » ; pastille ; « Personnaliser » ; bandeau « Gérer » hors profil revendeur). `CarteLien lienOuvrir` (réglages, démarrage, fournisseur) ; `/reseller/boutique` = « Personnaliser ma boutique ». Guide : fiche `vitrine-boutique`, `/boutique/*` retiré de `HORS_GUIDE`. `tests/ma-boutique-lot1.test.cjs` (11 tests, 10 échouent sur l'ancien code), REV-04 mis à jour. Aucune migration. Captures et vérifications 390/1440 px, iPhone et boutique masquée à faire sur la copie locale [QA]. Les 4 requêtes de lecture en production décidées avant ce lot (`plan-final.md`, « contrôles en lecture ») n'ont pas été lancées : à lancer par le fondateur dans Supabase › SQL Editor.

> **2 octobre 2026 — audit UI/UX publié en production.** Demande de fusion #1 (`ux/lot-8-arbitrages` → `main`, commit `24e4656`) : sécurité `products` + lots 1 à 8. Vercel a déployé la nouvelle version (21 h 06) ; vérifié en lecture seule : accueil (bande de garanties), fiche produit (« Livraison à Bamako : 1 500 F »), formulaire de commande commun (total serveur), diaspora, panier, suivi, connexion, page 404 en français ; espaces pro toujours redirigés vers la connexion. SQL `A-EXECUTER-2026-10-02-droits-products.sql` exécuté par le fondateur. Reste : renseigner le lieu de la caisse livreurs (Paramètres › Livraison).

> **3 octobre 2026 — sélecteur « Mon quartier » redessiné (en ligne, branche `ux/selecteur-quartier` fusionnée dans `main`).** `NeighborhoodPicker` variante `puce` (accueil, `/boutiques`) : une seule pilule de 48 px comme « Boutiques » (repère citron, quartier en gras, « Choisir » en citron, localisation dans la pilule). `ChoicePicker` accepte `nu`, `rendu`, `listeClassName` (champ par défaut inchangé). `tests/selecteur-quartier.test.cjs` (échoue sur l'ancien code) ; 497 tests réussis. Aucune migration.

> **2 octobre 2026 — captures du guide refaites (en ligne).** 70 captures : 26 pages publiques sur la vraie base (`npm run guide:captures` contre `npm run dev`), 44 pages pro sur la copie locale isolée avec les comptes fictifs [QA] : `COMPTES_QA=audit-local/2026-10-01-integral/comptes.json BASE=http://127.0.0.1:3300 npm run guide:captures -- <pages pro>` (la connexion de démonstration mène à la page de connexion depuis la vérification des sessions). `scripts/guide/capturer.mjs` bloque toute requête qui écrit, retire le bandeau « Installer l'application » et ne masque plus les montants de 8 chiffres suivis de « F ».
>
> **2 octobre 2026 — audit UI/UX, lot 8 « arbitrages » (en ligne).** REV-10 : `commandePourRevendeur` (`src/lib/acces-contacts.ts`) masque le numéro du client (`telephoneMasque`, « •• 34 56 ») hors commande en cours ; « Mes clients » utilise la même fonction. PUB-10 : formulaire commun `src/components/commande/FormulaireCommande.tsx` + règles `src/lib/formulaire-commande.ts` pour `/p/<produit>/commander` (694 → 348 lignes) et `/panier` (erreur au champ, promo replié, devis en erreur géré, minimum, relais interdit si remise vendeur, bandeau de reprise, une seule commande → `/order-success`). Lot 4 : réglage `caisseLivreurs {lieu, horaires}` dans `platform_settings.valeurs` (aucune migration), remis par `/api/driver/caisse` seulement ; vue d'ensemble « Aujourd'hui » (`syntheseFinance` → `appelsEnRetard`, seuil 4 h) ; `BandeauDemarrage` supprimé. `tests/audit-ui-ux-lot8.test.cjs` (7 tests) ; `acces-contacts` et lot 5 adaptés ; 495 tests réussis ; compilation isolée réussie ; trois commandes fictives [QA] passées sur la copie locale. Accès revendeur au numéro non journalisé (contrainte `role` de `acces_coordonnees`). Aucune migration.
>
> **2 octobre 2026 — audit UI/UX, lot 7 « les finitions » (en ligne).** Constats hors des six lots : carte de course livreur (une action principale « Saisir le code du client », 4 boutons secondaires identiques), formulaire de retrait masqué sous le minimum chez le fournisseur aussi (reprise d'une demande interrompue conservée), « Mes achats » pour les pros dans le menu du compte, `body` en `min-h-full` (PUB-15), Ma boutique fournisseur calmée, `src/components/reseau/GrilleOutils.tsx` pour les deux pages Outils (titres = titres des pages), catalogue revendeur resserré, vignettes `compact` + `sizes`, tuiles à 0 masquées (partages, parrainages), centre des modules sans « Fermé : Fermé : » (`lib/admin/pilotage.ts`), Mobile Money replié après un panier, `src/lib/initiale.ts` pour les avatars. `tests/audit-ui-ux-lot7.test.cjs` (10 tests, échouent sur le lot 6) ; 488 tests réussis ; compilation isolée réussie ; captures 390/1440 px [QA] (0 défaut axe, 0 débordement). **À arbitrer : REV-10** (numéro du client masqué dans Mes clients, visible dans Mes ventes). PUB-10 (unifier les deux tunnels) reste un chantier à part. Aucune migration. Captures du guide à refaire.
>
> **2 octobre 2026 — audit UI/UX, lot 6 « le fond » (en ligne).** Ajouter une offre : étape 1 allégée (remise, commande, étapes, frais repliés derrière un résumé, ouverts d'office hors cas courant), récapitulatif en lignes, remise à zéro complète (`reinitialiser`), une action principale. Mes produits : prix affiché, stock modifié à l'écran puis un seul « Enregistrer », reste dans « Plus ». `src/lib/admin/libelles-journal.ts` : journal et validations en français. Menu équipe (`lib/admin/poste.ts`) : 7 rubriques (« Plus » scindé en Campagnes / Réglages et équipe), `cheminDuMenu` + `entreeActive` (vue cartes et ajout de produit allument Catalogue). `src/components/ui/BarreEnregistrement.tsx` : une seule barre pour Paramètres, Accueil client, Priorité au réseau, Sécurité. `StatCard` : `alerte`, libellé sans capitales ; `PageHeader` à 14 px. Coquille `PageReseau` pour 9 pages de l'ancienne génération ; 62 libellés en capitales grasses adoucis ; aide livreur réécrite. `tests/audit-ui-ux-lot6.test.cjs` (10 tests, échouent sur le lot 5) ; menu : test passé de 6 à 7 rubriques ; 478 tests réussis ; compilation isolée réussie ; captures 390/1440 px avec comptes [QA] (0 défaut axe, 0 débordement). Aucune migration. Captures du guide à refaire.
>
> **2 octobre 2026 — audit UI/UX, lot 5 « la commande » (en ligne).** Fiche produit : frais de livraison sous le prix, « Partager » en contour pour le client. « Commande reçue » : prochaine étape en premier, Mobile Money replié et facultatif, un seul bouton plein « Suivre ma commande » (`DeliveryCodeNotice` : reçu QR en contour). `src/lib/suivi-commande.ts` (`etapesSuivi`, `maintenantSuivi`, `commandeArretee`) : suivi avec carte « maintenant », étape « En cours », libellés sans jargon, « Écrire à Suguba » au logo WhatsApp. Diaspora : « Offrez » seulement si la carte est ouverte, e-mail facultatif sinon, bouton commun, plus d'`emerald`, montant annoncé en F (devise en repère), écran « Paiement validé » mort supprimé. Vitrines : `ProduitVitrine` porte unité, minimum, « Sur devis », bouton du catalogue (`offreVitrine`, colonnes lues à part dans `avecOffre` : une colonne absente en production laisse la vitrine comme avant). « Suivre » secondaire, accueil avec garanties sous la recherche, « Suivre ma commande » dans l'en-tête sur ordinateur, commande en cours en tête du compte client. `tests/audit-ui-ux-lot5.test.cjs` (9 tests, échouent sur le lot 4) ; 468 tests réussis ; compilation isolée réussie ; vérifié sur la copie locale avec une commande fictive [QA]. PUB-10 (deux tunnels de commande) non traité. Aucune migration. Captures du guide à refaire.
>
> **2 octobre 2026 — audit UI/UX, lot 4 « les accueils » (en ligne).** `src/lib/a-faire-fournisseur.ts` (`prioriteCommande` 0 livreur en route → 4 terminée, `trierParUrgence`, `resumeAFaire`) : accueil fournisseur « À faire maintenant » (code de ramassage, colis, devis, argent daté, bouton principal contextuel), Commandes « À préparer » sans les commandes non confirmées par le client (repliées). Accueil revendeur : liste « Vers votre première vente », carte argent unique, plus de bloc sombre en double ni de « Retirer mes gains » à 0 F, 3 raccourcis ; `BandeauDemarrage` n'est plus utilisé (fichier gardé). Portefeuille livreur : verser en 3 étapes + « Demander où verser » (aucun lieu en dur : **un réglage « caisse livreurs » reste à décider**). Vue d'ensemble admin : files d'abord, `StatCard` accepte `href`, tuiles datées sans jargon. `tests/audit-ui-ux-lot4.test.cjs` (7 tests) ; 459 tests réussis ; compilation isolée réussie ; aucune migration. Captures du guide à refaire.

> **2 octobre 2026 — audit UI/UX, lot 3 « les composants » (en ligne).** `Button` accepte `loading` (largeur conservée, double appui bloqué, `aria-busy`) ; **`BoutonPartageWhatsApp`** (`ui/`) est le seul bouton de partage (carte produit, accueil revendeur, `CarteLien`, carte revendeur) ; **`LigneListe`** (`ui/`) pour les listes à montant (livreur) ; `StatusPill` : succès en menthe + point vert de marque, attente en ambre, info en contour ; `EmptyState` de `Surface` gagne `erreur` et `onReessayer`, et `ui/EmptyState.tsx` n'en est plus qu'une façade (un seul rendu) ; `TableauAdmin` : dernière colonne `fixe`+`droite` collée au bord droit, colonnes `droite` insécables, plus de bande vide ; accueil et commandes fournisseur : erreur réessayable au lieu d'un compte vide ; gestes clés admin (publier, tarifer, vérifier un livreur) sur `Button` ; cartes produit et catalogue à 40 px. `tests/audit-ui-ux-lot3.test.cjs` (9 tests, rendu React réel) ; 452 tests réussis ; aucune migration. Captures du guide à refaire.

> **2 octobre 2026 — audit UI/UX, lot 2 « le langage de l'argent » (en ligne).** Montants : une seule règle, `formatF` dans `src/lib/montant.ts` (« 24 000 F », espaces U+00A0, vrai signe moins, jamais de « k » ni de « FCFA » à l'écran ; `formatNombre` quand « F » est affiché à part ; `formatDevise` pour la diaspora). Les 39 formateurs locaux sont devenus des alias de `formatF` ; 79 montants écrits à la main remplacés. **Règle : tout nouveau montant passe par `formatF`** (`tests/audit-ui-ux-lot2.test.cjs` échoue sinon). Dates : `FORMAT_DATE` (jour, jourHeure, complet, completHeure ; 49 formats remplacés). Revendeur : `src/lib/libelles-vente.ts` (`STATUT_VENTE` pour les 8 statuts, `etatCommissionVente` à partir des lignes du grand-livre) ; `/api/reseller/me` renvoie en plus `commissionsParVente` ; « Mes ventes » ne lit plus `state.commissions` (liste locale jamais remplie). « Déjà versé » remplace « Total gagné ». Saisie d'argent : `MontantInput` (dans `ui/Field.tsx`, suffixe « F » + écho « = 25 000 F ») sur 12 champs. Textes légaux et choix de devise diaspora gardent « FCFA ». 443 tests réussis ; aucune migration. Captures du guide à refaire.

> **2 octobre 2026 — audit UI/UX, lot 1 « urgences » (en ligne).** Rapport : `docs/qa/audit-ui-ux-2026-10-02.md` (60 constats, plan en 6 lots ; page visuelle privée https://claude.ai/artifact/X5fHtUNF4XrcD212k1Bvuj). Lot 1 livré en local : accueil livreur sur la même source que le portefeuille (`useCaisseLivreur`, `statutEncaissement` dans `lib/caisse-livreur.ts` — il affichait 196 750 F « dans la sacoche » contre 46 850 F à remettre, et « Payé en ligne » partout), bandeau de blocage d'espèces, liste réparée ; « Confirmer » du tableau des commandes remplacé par « Appeler » (la confirmation reste dans le dossier, après l'appel) ; approbation financière confirmée et protégée du double clic ; retrait d'autorisation livreur avec motif obligatoire (UI + serveur) ; « Tous les métiers » pour la Direction (`metierAffiche`) ; champ du code de retrait et boutons produits réparés sur mobile ; raccourci revendeur « Ma boutique » (il menait aux Fournisseurs), raccourcis non tronqués ; `not-found.tsx` et `error.tsx` en français ; barre du bas à 13 px ; jeton `shadow-xs` ajouté (27 usages sans effet) ; texte Garantie corrigé (**à valider**). `tests/audit-ui-ux-lot1.test.cjs` (10 tests, échouent sur l'ancien code) ; 434 tests réussis ; compilation isolée réussie. Aucune migration. **Captures du guide à refaire** (port 3000 occupé) : `npm run guide:captures -- liv-courses,liv-portefeuille,rev-accueil,adm-produits,garantie`. Copie locale isolée : utiliser `audit-local/2026-10-02-ui-ux/outils/lancer-local-3300.sh`.

> **2 octobre 2026 — droits d'écriture sur `products` (en ligne, SQL exécuté en production le 2 octobre par le fondateur).** REQ-SEC-RLS-001 / TASK-SEC-RLS-001 / TEST-SEC-RLS-001. Revue RLS de la base locale isolée : 63 tables avec RLS actif, 62 sans aucune règle (accès serveur seulement) ; aucune fonction `SECURITY DEFINER` exécutable par `anon`/`authenticated`. Seul écart : `anon` et `authenticated` gardaient sur `products` les droits Supabase par défaut INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER. Non exploitable (aucune règle d'écriture), mais une seule barrière. **SQL à exécuter : `supabase/A-EXECUTER-2026-10-02-droits-products.sql`** (droits seulement, sans ordre avec le code, rejouable ; vérifications et retour arrière en fin de fichier). Local : 12 droits → 0, lecture publique des 21 colonnes conservée, écriture refusée (`permission denied`), `supplier_price` toujours caché. `tests/droits-tables-sql.test.cjs` (échoue sans le SQL) ; 424 tests réussis. Preuves : `audit-local/2026-10-01-offensif/preuves/`. Recommandations non faites : test bloquant une nouvelle table sans RLS ; `orders` est dans la publication temps réel (`supabase_realtime`) — vérifier qu'aucun client n'en reçoit, sinon la retirer.

> **1er octobre 2026 — audit intégral publié en production.** Commit `2720fc8` sur `main`. Vercel confirme « Deployment has completed » ; `/`, `/rejoindre`, `/login`, `/track` et `/diaspora` répondent HTTP 200 ; les styles publics contiennent le nouveau gris `#5f6f86` (et plus l'ancien). Les 3 SQL avaient été exécutés et vérifiés juste avant. Aucun paiement ni écriture de test en production.

> **1er octobre 2026 — audit intégral QA / sécurité / argent / UI.** **Les 3 SQL ont été exécutés en production le 1er octobre**, puis vérifiés en lecture seule (sondes anonymes refusées en 401/42501, `apply_verified_payment` avec `p_montant`, colonnes `fonds_couverts` / `anomalie` / `variant_*` présentes : `audit-local/2026-10-01-integral/preuves/verif-sql-production.txt`). Code publié à la suite (voir la ligne de publication). REQ-AUDIT-INT-001. Environnement de test isolé construit (Supabase local Docker + compilation de production locale + faux SasPay + intercepteur réseau) : `audit-local/2026-10-01-integral/` (outils, preuves, comptes fictifs). **FAILLE CRITIQUE EN PRODUCTION** : fonctions de la base exécutables avec la clé publique (`verser_recompense` crée des commissions retirables) — prouvée par une sonde sans effet, aucun abus constaté. **À exécuter d'urgence : `supabase/A-EXECUTER-2026-10-01-securite-fonctions.sql`**, puis `A-EXECUTER-equipe-v3-variantes.sql` (jamais exécuté en production) suivi d'un nouveau passage du premier, puis `A-EXECUTER-2026-10-01-integrite-argent.sql` AVANT de déployer le code de cet audit. Corrigé en local : livraison forcée et versement incomplet qui libéraient des gains sans argent reçu, paiement Mobile Money tardif ou incomplet, refus SasPay bloquant, double validation ouverte en cas d'erreur, redirections ouvertes, push de paiement vers n'importe quel numéro, review-profile sur tout compte, plafond de commandes en attente, rattachement de compte par adresse non confirmée. Interface : 623 défauts d'accessibilité détectés automatiquement → 0 (jeton `slate-500` = `#5f6f86`, texte vert en `brand-dark`, noms accessibles, zones tactiles), décalages de page réduits (revendeur 0,27 → 0,11, livreur 0,19 → 0,03, catalogue 0,17 → 0,02) ; aucune migration pour l'interface. 422 tests réussis, `npm run build` réussi ; preuves runtime 14/14 et matrice 2 332 appels (0 hors rôle, 0 erreur) rejouées sur la compilation finale. Rapport : `docs/qa/audit-integral-2026-10-01.md` (verdict, registre, notes /5 par profil, non testé). Consigne rappelée : le scanner ne capture plus `/admin/boutique-suguba`. Piège nouveau : sur Supabase, `REVOKE … FROM PUBLIC` ne retire PAS l'exécution à `anon`/`authenticated` — toujours écrire `FROM PUBLIC, anon, authenticated` (test `tests/securite-fonctions-sql.test.cjs`).

> **30 septembre 2026 — corrections profils déployées en production.** Commit `39048f5`, publié sur `main`. Vercel confirme « Deployment has completed » ; `https://app.sugubaml.com/` et `/rejoindre` répondent HTTP 200. La page publique référence les styles de la compilation corrigée. Aucun paiement ni écriture de test en production. Les mentions « local / non déployé » ci-dessous décrivent les validations avant cette publication.


> **30 septembre 2026 — audit des trois profils, sans correction ni déploiement.** REQ-UX-PROFILS-001 / TASK-UX-PROFILS-001 / TEST-UX-PROFILS-001 : navigation locale revendeur, fournisseur et livreur, 49 captures numérotées mobile/desktop, priorités de simplification et incohérences carte/QR/simulateur. Rapport : `docs/qa/audit-profils-2026-09-30.md` ; preuves : `audit-local/2026-09-30-profils/rapport-visuel.html`. Les transactions et données de production n’ont pas été testées. Le lot cartes/chargements a entre-temps été publié : commit `5a56dc2`, Vercel confirmé, styles publics vérifiés.

> **30 septembre 2026 — cartes sociales et chargements (local, non déployé).** REQ-CONTENU-002 / TASK-CONTENU-002 / TEST-CONTENU-002 et REQ-CHARGEMENT-001 / TASK-CHARGEMENT-001 / TEST-CHARGEMENT-001 : identité séparée de la couverture, images contenues, couverture bornée, résultat annoncé et affiché automatiquement, boutons avant aperçu, logo Suguba animé dans les états de chargement. Aucune migration. Rapport : `docs/qa/cartes-chargements-2026-09-30.md`.

> **30 septembre 2026 — parcours livreur, studio marketing et vitesse perçue.** REQ-DRIVER-UX-001 / TASK-DRIVER-UX-001 / TEST-DRIVER-UX-001, REQ-CONTENU-001 / TASK-CONTENU-001 / TEST-CONTENU-001 et REQ-PERF-001 / TASK-PERF-001 / TEST-PERF-001 : libellés et erreurs livreur clarifiés, confirmation locale immédiate après succès serveur, fenêtres chargées à la demande, squelettes de navigation, studio unique produit/boutique, identité de boutique et QR direct. Aucune migration requise. Build réussi, 389 tests réussis, contrôle local desktop puis mobile et génération réelle d'une carte boutique fictive. Rapport : `docs/qa/analyse-livreur-marketing-performance-2026-09-30.md`.

> **28 septembre 2026 — inscriptions guidées (local, non déployé).** REQ-PROFIL-002 / TASK-PROFIL-002 / TEST-PROFIL-002 : inscription sans profil par défaut, choix explicite commun à la finalisation, rappel du profil avant enregistrement, compte existant dirigé vers Mes profils, anciennes inscriptions revendeur réunies avec conservation du parrainage. Compilation réussie, 389 tests réussis, contrôles navigateur fictifs. Détail : `docs/qa/inscriptions-profils-2026-09-28.md`.

> **28 septembre 2026 — choix des profils (modification locale).** REQ-PROFIL-001 / TASK-PROFIL-001 : `/rejoindre` présente quatre activités explicites sans profil présélectionné, explique le compte multi-profils et exige un choix avant les liens d’inscription. TEST-PROFIL-001 : contrôle navigateur des quatre choix, des destinations, du retour au choix et des largeurs mobile/desktop ; voir `docs/qa/choix-profils-2026-09-28.md`.
> **État du lot admin précédent : déployé.** Le commit `470fee9` a été publié sur `main` ; Vercel a confirmé sa réussite le 28 septembre 2026. Site disponible et accès admin protégés vérifiés en HTTP. Le complément « non déployé » ci-dessous décrit l’état lors de la validation locale, avant cette publication.

> **Complément local du 28 septembre 2026 — admin, ordinateur puis mobile (non déployé).**
> Corrections de l’audit des 37 pages : vérifications avec erreurs explicites et décisions motivées/historisées ; agrégats financiers serveur et périodes réelles ; paramètres en cinq sections avec brouillon commun, simulation, contrôle des saisies et protection contre l’écrasement concurrent ; reprise du recalcul du catalogue ; fournisseur explicite à la création ; navigation six rubriques et menu clavier. Rapport : `docs/qa/admin-corrections-2026-09-28.md` ; preuves fictives : `audit-local/2026-09-28-corrections/`.
> Validation : build réussi, 389 tests automatisés réussis et 7 scénarios HTTP locaux réussis. Aucune nouvelle migration, aucun paiement, aucune écriture ni aucun déploiement de production. La fusion complète cartes/tableau du catalogue et le dossier personne unifié restent des évolutions produit. Les validations locales ne décrivent pas l’état du site déployé.

> **Complément local du 24 septembre 2026 — clôture des corrections d’audit (non déployées).**
> Le rapport à jour est `audit-local/2026-09-24/cloture/rapport-final.md` ; il complète le rapport de corrections précédent. Les validations locales ne décrivent pas la production.
> Le code de remise n’est plus retourné dans les reçus, suivis, feeds ou exports, même au créateur/admin. Le SMS vise uniquement le numéro enregistré en base ; le support doit posséder `commande.modifier`. La remise exige un nouveau code et un acquittement d’envoi enregistré. Les codes des anciens reçus sont invalides pour une remise active ; prévoir leur nouvel envoi avant toute ouverture.
> Les migrations locales `migration-audit-integrite.sql` puis `migration-audit-sms.sql` sont requises, ainsi que les autres migrations du lot précédent. **Aucune migration de production n’a été exécutée.** Ne pas pousser les lecteurs avant validation et application autorisée du SQL.
> `create-admin` affecte explicitement le premier super_admin et préserve une affectation existante. Script testé avec doubles locaux ; aucun compte réel créé ou promu. Un accès admin sans équipe reste refusé.
> Fenêtres de vente/reçu et choix de quartier : clavier/focus corrigés ; erreurs de synchronisation, de solde et de SMS visibles ; couleurs de texte ciblées renforcées sans refonte.

État réel du projet, basé sur l'historique git vérifié (dernier commit : `ddfe83c`, déployé et
vérifié en production). C'est LA fiche de référence : les documents de `docs/` renvoient ici.

---

## Lot déployé le 11 septembre 2026 — REQ-013 / TASK-017

**Lot REQ-013 / TASK-017 : commande confirmée après enregistrement atomique.**
`/api/orders/create` (en production) crée les commandes ; `/api/orders/sync` ne sert plus
qu'aux mises à jour internes authentifiées. Les trois formulaires (produit, revendeur,
diaspora) attendent le reçu serveur avant tout succès ou démarrage de paiement.

- Identifiant et numéro de commande, code secret et montants générés/calculés côté serveur.
- Attribution par le code revendeur transmis explicitement, même si son profil n'est
  pas chargé dans le navigateur. Un code inconnu ou une erreur de lecture est signalé.
- Transaction PostgreSQL unique : commande + commission `pending` + reçu de reprise.
  Échec d'une écriture = annulation complète. Même clé = même reçu, sans doublon.
- Clé de reprise aléatoire conservée dans l'onglet, seul son hash stocké en base.
  Bouton « Reprendre ma commande » après coupure/rechargement ; pas de remplacement
  silencieux des coordonnées d'une demande incertaine.
- Devis serveur dans les trois formulaires, ancien devis invalidé lors d'un changement
  de quantité/ville. Aucun coût de repli après une erreur de lecture des réglages.
- La confirmation n'affiche jamais une autre commande ni un ancien brouillon local.
- `npm test` exécute maintenant le code réel et PostgreSQL embarqué (PGlite), avec les
  migrations du dépôt. Les anciens exemples sont conservés via `npm run test:legacy`.

**Déploiement effectué :** la migration `supabase/migration-order-creation.sql` a été
appliquée sur Supabase production avant la publication du commit `ddfe83c`. Elle ajoute
`order_creation_requests` et `create_order_with_commission`, et retire l'ancienne politique
d'INSERT public sur les commandes. L'URL `https://app.sugubaml.com` répond en HTTP 200
depuis Vercel. Aucun paiement réel ni écriture de test en production n'a été effectué pour
ce lot. Après déploiement, recharger les anciens onglets : leur ancien parcours de création
`/api/orders/sync` n'est plus accepté.

Preuves et limites : `docs/qa/order-creation-tests.md`. Dans les sections suivantes, toute
mention de création de commande via `/api/orders/sync` est antérieure à ce lot : la création
passe désormais par `/api/orders/create`.

---

## Fait et déployé

1. **Audit de sécurité initial** — RLS resserrées, session signée HMAC, middleware par rôle.
2. **Multi-rôle** (`profile_roles`) — un compte peut cumuler plusieurs rôles (ex: revendeur + livreur).
3. **Téléphone/OTP maison entièrement retiré** (2026-08-26) — aucune passerelle SMS réelle
   n'a jamais été branchée, ce chemin ne délivrait donc jamais de code à un vrai utilisateur.
   Inscription/connexion se font désormais uniquement via **Google** ou lien magique par
   **email**, pour les 4 rôles (revendeur, fournisseur, livreur, diaspora).
   - `/register/complete` collecte les champs métier propres à chaque rôle après le retour Google.
   - `AuthHashCatcher` (2026-09-08) intercepte les retours OAuth Google mal redirigés vers `/`
     au lieu de `/auth/callback`, et les renvoie au bon endroit.
4. **Rôle Fournisseur branché sur Supabase** (2026-08-26) :
   - Vraie table `suppliers` (`migration-suppliers.sql`), dashboard réel, dépôt produit fiable.
   - Faille corrigée : un fournisseur pouvait usurper l'identité d'un autre sur un produit déposé.
   - Faille corrigée : l'admin ne voyait les dépôts produits que depuis son propre navigateur
     (RLS bloquait la lecture anonyme des produits non approuvés).
5. **Rôle Livreur branché sur Supabase** (2026-08-26), avec une faille sérieuse trouvée et
   corrigée au passage :
   - **Avant le correctif** : n'importe quel livreur connecté voyait TOUTES les commandes de
     TOUS les clients (noms, téléphones, adresses), y compris le code OTP de livraison en
     clair pour des commandes qui n'étaient pas les siennes — la validation se faisait
     entièrement côté navigateur.
   - Validation OTP déplacée entièrement côté serveur (`/api/driver/verify-delivery-otp`),
     avec vérification d'appartenance de la commande et verrou à 3 tentatives.
   - Le dispatch admin→livreur ne poussait jamais vers Supabase (`assignDriver` ne faisait
     que `notify()` local) — un vrai livreur ne voyait jamais ses courses assignées depuis
     son propre appareil. Corrigé.
   - Incohérence de statut en base (`assigned_driver`/`in_delivery` dans la contrainte CHECK
     vs `dispatched`/`in_transit` utilisé par tout le code applicatif) qui aurait fait
     échouer silencieusement toute vraie mise à jour de dispatch — corrigée
     (`migration-order-status.sql`).
6. **SasPay est désormais la seule passerelle de paiement** (2026-09-09) — encaissement
   **et** versement, code fait, build vérifié :
   - `src/lib/saspay.ts`, `/api/payments/saspay/create`, `/api/payments/saspay/status`,
     `/api/webhooks/saspay`, `supabase/migration-saspay.sql`.
   - **Supprimés** : LigdiCash (`src/lib/ligdicash.ts` + ses 2 routes), CinetPay/Wave
     (`src/lib/momo-gateway.ts`, `/api/webhooks/momo`), et le desk de paiement manuel
     `MobileMoneyPaymentDesk` (codes USSD à recopier + lien Wave vers le 89 46 00 00),
     remplacé par `SasPayPaymentDesk`. `.env.example` nettoyé de PayDunya, CinetPay, Wave
     et de la passerelle SMS (l'OTP maison ayant été retiré en août).
   - Contrairement à LigdiCash, **SasPay signe ses webhooks** (HMAC-SHA256 sur
     `timestamp.corps`, tolérance 5 min). Signature vérifiée en temps constant, 9 cas de
     test passés (corps modifié, signature forgée, mauvais secret, rejeu, horodatage
     rajeuni…). Une notification non signée est rejetée en **403**, pas ignorée.
   - Le corps du webhook n'est jamais la source de vérité malgré la signature : chaque
     notification déclenche une re-vérification `GET /payments/{id}/verify/`.
   - **Bug d'argent corrigé au passage** : `momoGateway.createPayout` basculait en « mode
     simulation » dès qu'aucune clé n'était configurée — il renvoyait `success: true` avec
     un faux numéro de transaction, et `/api/payouts/initiate` marquait alors le retrait
     `completed` **en consommant les commissions du revendeur, sans qu'un centime bouge**.
     La nouvelle route n'a aucun mode dégradé : sans clé elle échoue, et un retrait ne passe
     `completed` qu'à la confirmation du webhook (`processing` en attendant).
   - ✅ **Mis en service le 2026-09-09** et vérifié en production : clé `sk_live_`
     authentifiée, réseaux Mali actifs, portefeuilles `ML/XOF` et `XX/USD` ouverts,
     migration appliquée, code déployé (commit `e802fb1`), webhook `9e74305b` actif et
     abonné aux 4 events `transaction.*`. Test signé de bout en bout : **200**. Rejets
     confirmés en 403 sur signature forgée, rejeu hors tolérance et corps modifié.
   - ⚠️ **Aucun paiement réel n'a encore été encaissé** : le solde `ML/XOF` est à 0. Le
     premier vrai client reste le seul test qui vaille.


7. **Plus aucune validation manuelle des inscriptions** (2026-09-10) — tous les comptes naissent
   **actifs**. L'ancienne approbation admin ne vérifiait rien : l'admin ne voyait que des
   données saisies par le candidat (nom, téléphone, numéro de pièce tapé au clavier). Elle
   ajoutait un délai, pas de la sécurité. Le contrôle se déplace là où il y a de la valeur :
   - revendeur → délai de sécurité des commissions, puis le retrait ;
   - fournisseur → modération des produits (`products.status`) ;
   - **livreur → vérification PHYSIQUE au guichet de Bamako**, seule exception.
   Deux notions désormais séparées : `profile_roles.status` (le compte fonctionne) et
   `drivers.active_status` (le livreur peut recevoir des courses). Ce dernier existait déjà
   avec `DEFAULT false` mais n'était lu nulle part ; il devient le seul verrou du dispatch.
   Panneau admin « Livreurs — vérification au guichet » : **note de constat obligatoire**
   (pièce présentée, permis, assurance, moto), horodatée avec l'agent (`verified_at/by/note`,
   `migration-livreurs-agence.sql`). Le livreur non vérifié voit son espace avec la liste de ce
   qu'il doit apporter. `/pending-approval` ne sert plus qu'aux comptes **suspendus**.
   Vérifié : 16 tests contre la base réelle (dispatch vide sans vérification, constat exigé,
   dossier incomplet refusé, retrait d'autorisation, traçabilité).


8. **Tarification automatique et boutiques** (2026-09-10) — déployé ; `migration-tarification.sql`
   et `migration-boutiques.sql` appliquées (vérifié en lecture le 2026-09-10).
   - **Moteur** `src/lib/pricing.ts` (fonctions pures, même code côté admin et serveur) :
     plancher Suguba = coûts variables (paiement 1,5 %, provision refus 4 %, message,
     déficit livraison) + coûts fixes ÷ **volume de référence** + marge nette minimale (5 %).
     Commission = 70 % du reste, arrondie **vers le bas**. Vérifié sur 50 000 tirages : un
     produit « ok » ne passe jamais sous la marge minimale, le prix minimal est bien le plus
     bas prix rentable.
   - **Réglages** dans `platform_settings` (écran admin « Réglages économiques ») : coûts,
     part revendeur, livraison par ville, points relais, codes promo, retrait minimum. Les
     coûts fixes par défaut (300 000 F/mois) sont une **estimation provisoire** signalée
     « non confirmée » tant que l'admin ne les a pas remplacés.
   - L'admin ne fixe plus que le **prix de vente** (`/api/admin/products/price`), la
     commission est calculée ; un prix sous le plancher est refusé.
   - **Devis serveur unique** (`calculerCommande`) pour l'affichage (`/api/orders/quote`) et
     l'enregistrement (`/api/orders/create` depuis le 2026-09-11, auparavant `/api/orders/sync`). Remise promo prise sur la marge Suguba, jamais
     sur la commission, et plafonnée pour ne **jamais vendre à perte**.
   - **Boutiques** : fournisseur `/s/<adresse>` (reconstruite, composant serveur),
     revendeur `/r/<code>` (sélection depuis le catalogue). Aperçus de partage Open Graph.
     Aucune coordonnée fournisseur publiée.
   - **Supprimé** : fausses chaînes de marque `/c/`, faux tableau de bord `/business`, faux
     réseau d'ambassadrices, note « 4.9/5 » inventée, option « acompte » qui ne faisait rien.

9. **Design system** (2026-09-09 → 11) — un seul vert `suguba-brand` (#09b500), slate, texte
   ≥ 11 px, composant `<Button>` ; tableaux de bord fournisseur et revendeur convertis. Les
   « promesses d'argent » sans mécanisme (parrainage, défis, académie) ne sont plus proposées
   depuis le tableau de bord revendeur.
10. **Parcours d'inscription refait** (2026-09-10) — plus aucun compte créé en silence : sans
    rôle choisi, la connexion Google/email mène au choix du profil ; `/register/complete`
    (nom, WhatsApp obligatoire, champs du rôle) est imposé par le middleware tant que le profil
    n'a pas de numéro. Carte « Client » = achat sans compte.
11. **Partage WhatsApp et cartes produit** (2026-09-11) — partage photo + texte + lien en un clic
    (`src/lib/partage.ts`), aperçu Open Graph de `/p/[slug]`, carte unique `ProductCard`
    (carrousel, logo WhatsApp), jusqu'à 6 photos par produit, photos allégées avant l'envoi,
    ajout de photos aux produits existants (`/admin/products`, bouton du fournisseur).
12. **Affiches pour statut WhatsApp** (2026-09-11) — `src/lib/affiche.ts` + `AfficheModal`
    (1080×1920 ou carré), code revendeur réel, jamais de téléphone ; `/reseller/marketing`
    refait, `/reseller/story-generator` redirige.
13. **Page produit honnête** (2026-09-11) — garantie inventée retirée (« 6 mois certifiés » sur
    tous les produits), nombre réel de livraisons, bouton « Une question ? ». Un produit pas en
    vente affiche « Pas encore en vente » (plus de partage à « 0 F »).
14. **Service worker v3** (2026-09-11) — plus aucune réponse d'API en cache (données privées),
    seul l'accueil préchargé, caches plafonnés.
15. **Publication automatique des produits** (2026-09-11) — décision de l'utilisateur : plus de
    validation avant la mise en vente ; contrôle après coup dans `/admin/products`
    (« Nouveautés fournisseurs », Prix, Retirer).
16. **Part revendeur choisie par le fournisseur** (2026-09-11) — prix client = fournisseur + part
    revendeur + part Suguba (% du prix de vente ou % de la part revendeur, réglable avec un
    tableau de simulation), toujours relevé au plancher. `migration-part-revendeur.sql` appliquée.
17. **iPhone : barre du bas qui flottait** après fermeture du clavier — masquée pendant la saisie
    (`useClavierOuvert`).

---

## ⚠️ À vérifier en tout premier

**Migrations** — vérifiées présentes en base par lecture (service_role) les 2026-09-10 et 11 :
`migration-saspay.sql`, `migration-tarification.sql`, `migration-boutiques.sql`,
`migration-livreurs-agence.sql`, `migration-part-revendeur.sql`, `migration-order-creation.sql`
(table `order_creation_requests` présente). Les plus anciennes (`multi-role`, `suppliers`,
`drivers`, `order-status`, `commission-safety-window`, `sav`) ont été appliquées en août ;
`migration-suivi-commande.sql` : table `track_attempts` vérifiée le 2026-09-11 (voir ci-dessous).

Vérification rapide (lecture seule, service_role) : tenter un `select` sur les colonnes/tables
attendues plutôt que de supposer. **Toute nouvelle migration doit être appliquée AVANT de pousser**
le code qui la lit : sinon devis et commandes cassent en production.

**Réglage à faire par l'admin** : la part Suguba est à 8 % du prix de vente par défaut. Avec les
coûts actuels, ce taux ne couvre pas les frais : les prix sont relevés au plancher. Pour que le
pourcentage décide réellement du prix, viser **12 à 13 %** (tableau de simulation des réglages).

**SasPay est en service** (2026-09-09, tout vérifié en production). Ce qui reste à
surveiller : le solde `ML/XOF` est à **0**, et c'est de ce solde que partent les versements
de commissions. Un `POST /payouts/initialize/` sur un wallet vide échoue en `422` — la route
remet alors le retrait en `pending` et rend son solde au revendeur, donc rien n'est perdu,
mais le virement ne part pas. **Encaisser avant de verser, ou approvisionner le wallet.**

Commande de contrôle de l'intégration (lecture seule, aucune transaction) :

```bash
KEY=$(grep '^SASPAY_API_KEY=' .env.local | cut -d= -f2- | tr -d '"')
curl -s -H "Authorization: Bearer $KEY" https://api.saspay.me/api/v1/merchant-webhook-subscriptions/
curl -s -H "Authorization: Bearer $KEY" https://api.saspay.me/api/v1/merchant-balances/
```

---

## Chantiers non commencés et décisions en attente

**Décisions de l'utilisateur en attente** (ne pas trancher à sa place) :
- Pages qui promettent de l'argent sans mécanisme (point 10 ci-dessous) : supprimer ou brancher.
- Forcer le **choix du compte Google** à chaque connexion (`prompt: 'select_account'`) —
  proposé, mis de côté par l'utilisateur.
- **Numéro du support** `+223 89 46 00 00` : c'est aussi celui de l'agent WhatsApp Micro Office
  (« Fatouma ») — les clients Suguba tomberaient sur lui. Voulu ou non ?
- **Formulaire fournisseur** : garantie, délai de préparation et adresse du stock sont demandés
  mais jamais enregistrés (aucune colonne) — ajouter en base ou retirer du formulaire.

**À tester en vrai** (jamais fait de bout en bout) : partage WhatsApp avec photo et affiche en
statut sur un vrai téléphone (Android et iPhone), dépôt de photos, publication automatique d'un
dépôt fournisseur, premier paiement SasPay réel.

1. **Rôle Diaspora** — même traitement que Fournisseur/Livreur (table réelle, dashboard,
   inscription). Prochain sur la liste, jamais démarré.
2. **Remplir le catalogue** — le vrai blocage commercial. Au 2026-09-11 : 5 produits `[DÉMO]`
   **sans photo**, et un portable créé par l'admin, en attente de prix.
3. **Terminer le multi-rôle côté UI** — sélecteur d'espace dans le Header, page pour
   demander un rôle supplémentaire (`/api/auth/request-role` existe déjà côté serveur).
4. **Parcours invité** — suivi de commande sans compte, invitation à devenir revendeur
   juste après une livraison réussie.
5. **Vérification d'identité** fournisseurs/livreurs.
6. **Scores calculés** (livreurs, boutiques) — décision explicite de ne PAS les simuler tant
   qu'il n'y a pas de vraies transactions. Ne jamais initialiser un score à une valeur par défaut.
7. **Refonte UI/UX** — audit complet de tous les rôles fait le 2026-09-11 :
   `docs/ux/audit-ux-2026-09-11.md` (constats avec preuves, grille de satisfaction, plan en 10
   phases, protocole de vérification). **Phase 0 (confiance) faite le 2026-09-11** et vérifiée
   par rôle : identité réelle partout (`/api/auth/me` renvoie le nom, `definirUtilisateur`),
   gains revendeur sur le grand-livre + historique réel (`/api/reseller/payouts`), ventes du
   revendeur connecté, stocks fournisseur réels (`/api/supplier/stock`), code revendeur réel
   dans « Créer une commande » et la carte QR, promesses diaspora et jargon technique retirés.
   **Phase 1 (fondations) faite le 2026-09-11** (commit 21ed85a) : composants communs dans
   `src/components/ui/` (Toast/`useToast`, Sheet, Field, Surface), plus aucun `alert`/`confirm`
   natif, en-tête refait (prénom, sans cloche ni mode sombre), barre diaspora, bouton WhatsApp
   masqué sur `/p/*` et `/admin`. **Phase 2 (client) : première passe faite le 2026-09-11** —
   squelettes via `useCatalogueCharge()` (plus de « Produit introuvable » au chargement), barre
   « Commander » fixe sur mobile, champs 16 px, « Recommandé par » réel (`/api/shop/revendeur`).
   Suivi : `/track/[n]` relit le vrai statut (la copie locale restait figée), 8 statuts
   libellés, annulée/retournée sans code ni paiement ; `/track` liste les commandes du
   téléphone ; « Copier » le numéro sur la confirmation.
   **Phase 3 (revendeur) : première passe faite le 2026-09-11** — plus de « 0 F » pendant le
   chargement (squelettes du solde et des indicateurs), « Créer une commande » mène au catalogue
   (il ouvrait la commande sur le 1er produit, sans choix), produits à commission nulle retirés
   du tableau de bord, squelettes du catalogue. Vérifié avec une session revendeur jetable.
   **Phase 4 (fournisseur) : première passe faite le 2026-09-11** — tableau de bord en squelette,
   indicateur « Catalogue en vente » (somme de prix, sans sens) remplacé par « Sans photo » +
   bandeau d'action, pastille pour tous les statuts (« Retiré de la vente »). Formulaire : fiche
   réelle via `/api/supplier/me` (lisait le fournisseur de démo — sans conséquence en base :
   `/api/products/sync` impose l'uid de session), bouton « Mettre en vente » (plus de
   « modération »), champs 16 px, plus de bleu, « Ajouter un autre produit » après succès.
   **Phase 5 (diaspora) : première passe faite le 2026-09-11** — les 3 « packs » inventés
   (photos Unsplash, prix fictifs) sont remplacés par la grille des vrais produits en vente : leur
   bouton sélectionnait un produit quelconque, l'acheteur payait par carte un autre article que
   celui choisi. Présélection limitée aux produits en vente, quartier « Hamdallaye ACI 2000 »
   pré-rempli retiré, mention « 3D-Secure 256-bit » remplacée par un texte vérifiable, un seul
   vert, champs 16 px.
   **Phase 6 (admin) : première passe faite le 2026-09-11** — ⚠️ correctif fonctionnel : les
   retraits affichés à l'admin venaient de la mémoire LOCALE (une demande faite depuis le
   téléphone d'un revendeur n'apparaissait jamais) et « Valider le virement » / « Guichet » ne
   changeaient que cette mémoire (`updatePayoutInCloud` est désactivé depuis BUG-006). Nouvelle
   route `/api/admin/payouts` : GET des vrais retraits ; POST `payer_especes` (guichet, code
   WTH-…, `completed` + `settle_commissions_for_withdrawal` comme le webhook) ; POST `rejeter`
   (`rejected` + `release_commissions_for_withdrawal`). Les virements passent par
   `/api/payouts/initiate` (SasPay). Plus de `prompt()`. En-tête neutre « Tableau de bord »,
   onglets Revendeurs/Diaspora de démo remplacés par des explications, coordonnées admin
   locales et « Recharger le jeu de démo » retirés, plus de violet/indigo/bleu ni de 10 px.
   Vérifié avec une session admin jetable, sans aucune action sur les retraits.
   **Reste admin** : les commissions « verrouillées » lisent encore la mémoire locale ;
   découpage « Aujourd'hui / Catalogue / Réglages » à faire.
   **Phase 7 (livreur) : première passe faite le 2026-09-11** — portefeuille refait sur des
   données réelles : rémunération = réglage admin `remunerationLivreur` × livraisons (exposé
   seulement au livreur via `/api/driver/me` → `remunerationParLivraison`) ; retirés : 1 000 F
   et « indemnité carburant » en dur, bouton « Déclarer mon versement » sans effet, adresse
   « Hub ACI 2000 / Clinique Pasteur / avant 19h » et « compte marchand Wave », inventés.
   Espèces encaissées = commandes livrées NON payées en ligne (elles comptaient tout). Courses :
   point de retrait = fournisseur réel (« Hub Central » en dur retiré), « OTP » → « Code
   client », plus de bleu ni de 10 px.
   **Phase 8 (qualité transverse) : première passe faite le 2026-09-11** — 34 fichiers : texte
   9/10 px → 11 px et bleu/violet/indigo → slate dans toute l'app (sauf parrainage/défis, en
   attente de décision). Rapport du soir : livreurs actifs réels (`/api/admin/drivers/active`),
   compte de revendeurs de démo retiré. Checklist de lancement : 9 affirmations fausses
   corrigées (paiement 1-clic Wave, 6 points relais, codes RAMADAN « actifs », prime carburant,
   assistance H24, académie « prête »). **Suite : phase 9 (vérification finale par rôle).**
   Produit « [DÉMO] Blender » retiré de la vente (statut `rejected`) le 2026-09-11 à la demande
   de l'utilisateur. ⚠️ 4 autres « [DÉMO] » restent en vente (ventilateur, kit solaire,
   batterie, écouteurs) — en attente de sa décision.
   Règle : tout nouveau message utilisateur passe par `useToast()` — jamais `alert()`.
   **Phase 9 (vérification finale) faite le 2026-09-11.** Parcours rejoué pour les 6 rôles avec
   des sessions jetables ; console sans erreur sur les 6 une fois corrigé au passage un bruit
   systémique : `/api/orders/feed` (401 attendu pour admin/livreur/revendeur non connectés)
   partait en réalité pour **tout visiteur, sur toute page** — `cloud-sync.ts` ne connaissait pas
   le rôle avant d'appeler. Ne fetch plus que pour les 3 rôles concernés (voir
   `fetchOrdersFromCloudSiEligible`). Nouvelle notation détaillée dans l'audit : Client ~82 %,
   Livreur ~80 %, Admin/Revendeur/Diaspora ~77-78 %, Fournisseur ~77 % — net progrès depuis les
   25-45 % de départ, **mais aucun rôle n'atteint encore la cible de 90 %**. Ce qui retient
   chacun, par ordre d'impact : accessibilité jamais auditée formellement (contrastes, focus,
   cibles tactiles), admin toujours un flux unique sans le découpage « Aujourd'hui / Catalogue /
   Réglages » prévu, « premier usage guidé » partiel pour un revendeur/fournisseur/livreur à zéro
   vente, et les 4 décisions ci-dessous encore ouvertes. Détail complet :
   `docs/ux/audit-ux-2026-09-11.md`, section 4 phase 9.
   **Phase 9b (« vraiment bien fondé ») faite le 2026-09-11**, à la demande explicite de
   l'utilisateur (« fait le nécessaire pour que l'app soit vraiment bien fondée ») — j'ai tranché
   3 des 4 décisions en attente dans le sens le plus honnête, documenté ici :
   - **4 produits « [DÉMO] » restants retirés de la vente** (statut `rejected`, même geste que le
     Blender). Les 5 produits de démonstration sont maintenant tous hors catalogue public.
   - **Parrainage, défis et académie SUPPRIMÉS** (pas seulement masqués) — `/reseller/referrals`
     listait un « réseau de filleuls » entièrement inventé (noms, téléphones de personnes
     fictives présentées comme réelles), en plus des primes sans mécanisme déjà relevées. Les
     garder en ligne sans lien, atteignables par URL directe, restait trompeur. À reconstruire
     seulement le jour où un vrai mécanisme (table, calcul, paiement) existe.
   - **Champs garantie / délai de préparation / adresse de stock retirés** du formulaire
     fournisseur — vérifié dans le code : aucune colonne `products` ne les stocke, ni
     `/api/products/sync` ni aucun autre chemin d'écriture ne les enregistre. Le fournisseur les
     remplissait pour rien depuis le début. À réintroduire seulement avec de vraies colonnes et
     un affichage réel.
   - **Numéro de support laissé tel quel** (+223 89 46 00 00, partagé avec le bot Fatouma) : je ne
     peux pas inventer un numéro de remplacement — décision toujours ouverte si l'utilisateur veut
     un numéro dédié.
   **Accessibilité, réellement vérifiée cette fois** (pas juste estimée) :
   - **Contraste** : 87 usages réels de `text-slate-400` (texte informatif sur fond blanc, ratio
     ~2,85:1, sous le seuil AA de 4,5:1) remontés à `text-slate-500` (~4,6:1) sur 30 fichiers —
     icônes et `placeholder:` exclus du balayage (contraste non requis pour eux).
   - **Focus clavier** : j'ai d'abord cru 20 champs sans indicateur de focus visible, ajouté un
     correctif — puis vérifié en conditions réelles (vraie touche Tab, pas `.focus()` JS qui ne
     déclenche pas `:focus-visible`) que `globals.css` a déjà une règle globale
     `:focus-visible { outline: 2.5px solid var(--brand-green) }` qui couvre TOUT élément
     focusable de l'app. Le correctif était donc inutile : **annulé**, pour ne pas laisser un
     style redondant. Vérifié avec un `<input>` de test et `el.matches(':focus-visible')` après
     un vrai clic : `outline: 2.5px solid rgb(9,181,0)`, conforme WCAG 2.4.7.
   - **Cibles tactiles** : le plus petit bouton du composant `Button` (`sm`) fait ~32 px de haut —
     sous les 44 px d'Apple/Material, mais au-dessus des 24×24 px exigés par WCAG 2.5.8 (le vrai
     critère normatif). Rien à corriger.
   - **Trouvé en creusant l'accessibilité** : la checklist de lancement (`/admin/launch-checklist`)
     affichait en dur « 100% PRÊT AU DÉPLOIEMENT TERRAIN », « 16/16 Points Validés » et un badge
     « Certifié » — **alors qu'un point est marqué `fail`** (avis clients) juste en dessous, avec
     quand même une coche verte comme les 15 autres. Score maintenant calculé depuis les vraies
     données (`15/16`, `94%`, badge ambre « 1 point à traiter », icône ambre sur le point en échec).
     Retiré aussi : la mention « standards MicroOffice SaaS Factory V3 » (un autre projet, sans
     rapport, visiblement copié-collé).
   Build vérifié après chaque lot de changements, aucune écriture de test en production (sessions
   jetables uniquement pour /supplier, /reseller, /admin). **Reste pour un 90% honnête partout** :
   découpage de l'admin en sections (P2, pas fait), premier usage plus explicitement guidé pour un
   revendeur/fournisseur/livreur à zéro vente (P4, partiel).

   ⚠️ **Bug trouvé EN VÉRIFIANT le retrait des produits démo, corrigé le 2026-09-11** :
   `sugubaStore.setProductsFromCloud` ne faisait que FUSIONNER le lot renvoyé par le cloud dans le
   cache existant — jamais en retirer ce qui n'y figure plus. Retirer un produit de la vente
   (`rejected` en base) ne le faisait donc JAMAIS disparaître chez un visiteur qui l'avait déjà
   chargé : constaté en rechargeant l'accueil dans CE navigateur après avoir retiré les 4 derniers
   produits « [DÉMO] » — ils s'affichaient encore. Pire : si le catalogue public devenait
   entièrement vide, la fonction ne faisait RIEN du tout (`if (!cloudProducts || .length === 0)
   return`), laissant l'ancien catalogue affiché indéfiniment. Nouveau paramètre
   `estCatalogueApprouveComplet` (`cloud-sync.ts` le passe `true`, seul appelant public/anonyme) :
   toute fiche en cache avec `status: 'approved'` absente du nouveau lot est retirée ; toute fiche
   avec un AUTRE statut (soumise, en attente — injectées séparément par `/admin/page.tsx`) est
   préservée, quel que soit l'ordre d'arrivée des deux requêtes réseau. **Vérifié par un vrai test**
   (pas une lecture de code) : produit fantôme injecté dans le cache local → disparaît après le
   rechargement ; produit `submitted` injecté → survit. Purement un bug de cache client, jamais
   dans la base ni le SSR (le catalogue part toujours vide côté serveur, voir `getDefaultState`).
8. ~~**Versement des commissions**~~ — code fait le 2026-09-09 via SasPay Payouts. Reste à
   valider avec de vraies clés : aucun virement réel n'a encore été déclenché.
9. **Revendeurs payés en Wave** — `payouts.payment_method` accepte encore `wave`, que SasPay
   ne couvre pas au Mali. La route de versement le refuse explicitement (422 avec un message
   lisible) plutôt que d'échouer obscurément, mais ces revendeurs ne peuvent pas être payés
   automatiquement : il faut leur demander un numéro Orange, Moov ou Mobi Cash.
10. ~~**Promesses d'argent sans mécanisme derrière**~~ — `/reseller/referrals` (réseau de
   filleuls fictif), `/reseller/challenges` et `/reseller/academy` **supprimées le 2026-09-11**
   (phase 9b), pas juste masquées. À reconstruire seulement avec un vrai mécanisme derrière.
11. **Corrections UI du 2026-09-11, à partir d'une vidéo filmée par l'utilisateur** :
    - **Flash Header/BottomNav à chaque navigation** — les deux lisaient l'identité via leur
      propre `fetch('/api/auth/me')`, refait à chaque remontage (chaque page monte son propre
      Header/BottomNav, pas de layout partagé) : bandeau « Se connecter »/nav visiteur pendant
      ~200 ms à chaque tap, même pour un admin connecté. Corrigé en lisant
      `useSugubaStore().currentUser` (déjà résolu, jamais remonté) au lieu de refetcher — voir
      « Pièges déjà rencontrés » ci-dessous.
    - **Fiche produit trop chargée** — le formulaire de commande complet (nom, téléphone,
      livraison, promo, récapitulatif) restait affiché EN PERMANENCE sous la description. Refait
      en boîte d'achat compacte (prix + quantité + total) qui ouvre une fenêtre dédiée
      (`Sheet.tsx`, jamais utilisée jusqu'ici : feuille du bas sur téléphone, boîte centrée sur
      ordinateur) pour les informations de livraison — la quantité reste réglable directement sur
      la page, sans ouvrir la fenêtre. Vérifié : ouverture/fermeture (Escape, backdrop), champs
      conservés à la réouverture, positionnement correct mobile ET ordinateur (mesuré au DOM,
      512 px centré sur 1024).
    - **« Se connecter en tant que » pour l'admin** — nouvelle section dans Compte Admin (icône
      réglages) : Client, Revendeur, Fournisseur, Diaspora. Ouvre l'espace choisi avec une
      identité de TEST dédiée et stable (`apercu-<role>`, jamais le vrai compte admin), donc les
      écrans affichés sont exactement ceux d'un compte neuf sans historique — utile aussi pour
      juger le « premier usage » (phase 9, point resté ouvert). Un bandeau ambre reste affiché
      tant que l'aperçu est ouvert, avec un bouton pour en sortir et retrouver le vrai compte
      admin (jamais perdu : `apercu.depuis` le garde dans le jeton signé). Vérifié : bascule,
      chaînage d'aperçu bloqué (409/403), sortie qui restaure le bon uid/téléphone (revérifié
      côté serveur, pas juste l'affichage), bandeau qui survit à un rechargement complet.
      ⚠️ Les actions faites en aperçu écrivent en base RÉELLE comme n'importe quel compte de ce
      rôle (un produit déposé en aperçu fournisseur part en vente pour de vrai) — le bandeau le
      rappelle, mais rien ne le bloque techniquement : à l'admin de nettoyer ce qu'il crée pour
      tester. Voir `/api/admin/preview-role` (entrée, admin uniquement) et
      `/api/auth/preview-exit` (sortie, hors `/api/admin/*` car le rôle actif n'est plus admin à
      ce moment — sécurité assurée par la présence d'un `apercu` signé, pas par le rôle).

---

## Pièges déjà rencontrés (ne pas les redécouvrir)

- **L'identité affichée ne vient JAMAIS de la mémoire du téléphone** (2026-09-11). La mémoire
  locale démarrait sur le compte démo « Moussa Coulibaly » et `hydrateFromLocalStorage`
  restaurait l'utilisateur mémorisé : 12 écrans l'affichaient à tout le monde. Désormais
  `currentUser` est neutre au démarrage, remplacé par `/api/auth/me` (CloudSyncInitializer →
  `sugubaStore.definirUtilisateur`), et jamais restauré depuis le cache. Toute donnée d'un rôle
  (soldes, ventes, stocks, code revendeur) se lit via une route serveur, pas via
  `state.resellers` / `state.suppliers` / `state.withdrawals` (données de démonstration).
- **`fetchOrdersFromCloud` s'appelait pour TOUT visiteur, sur TOUTE page** (corrigé phase 9,
  2026-09-11) — `CloudSyncInitializer`/`CloudSyncBadge` déclenchaient `initRealtimeSync()` sans
  connaître le rôle, qui allait chercher `/api/orders/feed`, une route réservée à
  admin/livreur/revendeur : 401 en bruit de fond sur l'accueil, le suivi, la fiche produit…
  pour un client, un fournisseur ou un diaspora. `fetchOrdersFromCloudSiEligible(role)` ne part
  plus que pour les 3 rôles concernés, appelé depuis `CloudSyncInitializer` une fois `/api/auth/me`
  résolu. Piège pour la suite : ne jamais rattacher un fetch réservé à un rôle à un effet qui
  monte pour tout le monde sans passer le rôle en paramètre.

- **`setProductsFromCloud` fusionnait, ne retirait jamais** (corrigé phase 9b, 2026-09-11) —
  retirer un produit de la vente ne le faisait jamais disparaître d'un cache déjà chargé, et un
  catalogue devenu entièrement vide laissait l'ancien affiché pour toujours. Voir
  `estCatalogueApprouveComplet` dans `store.ts`. Piège pour la suite : toute fonction qui FUSIONNE
  des données cloud dans un cache local doit aussi dire ce qu'il faut RETIRER quand la source de
  vérité ne les renvoie plus — une fusion qui n'ajoute/ne met à jour jamais ne suffit pas.

- **`next dev` ne détecte pas tout.** Toujours tester avec un vrai `npm run build` avant de
  conclure qu'un déploiement va réussir (un `useSearchParams()` sans `<Suspense>` a déjà fait
  échouer tous les déploiements Vercel silencieusement).
- **Ne JAMAIS lancer `npm run build` pendant qu'un `npm run dev` tourne sur le même dossier**
  (constaté phase 9, 2026-09-11) — les deux écrivent dans le même `.next/`. Résultat : le serveur
  dev plante (`Cannot find module './XXXX.js'`), et même après redémarrage le middleware peut se
  comporter bizarrement (sessions valides rejetées) jusqu'à un `rm -rf .next` + redémarrage propre.
  Faire le build de contrôle serveur dev arrêté, ou sur un port/checkout distinct.
- **Le Service Worker PWA cache les anciens bundles JS.** En cas de comportement qui ne colle
  pas avec le code déployé : `unregister()` le SW + vider les caches avant de chercher ailleurs.
- **`localStorage` peut ressusciter des données supprimées du code et de la base.** Changer la
  clé de stockage (`suguba_platform_state_v1` → `v2` → ...) invalide les anciens caches.
- **Header/BottomNav flashaient la version "visiteur" à CHAQUE navigation** (corrigé 2026-09-11,
  à partir d'une vidéo filmée par l'utilisateur). Cause : chaque `page.tsx` monte SON PROPRE
  `<Header />`/`<BottomNav />` (pas de layout partagé) — ces composants redémarraient donc à zéro
  à chaque clic, avec un `useState` qui repartait à `null` le temps d'un nouveau
  `fetch('/api/auth/me')`. Résultat filmé : bandeau/navbar « Se connecter »/visiteur pendant
  ~200 ms à chaque tape, avant de revenir au bon état. Les deux composants lisent désormais
  `useSugubaStore().currentUser`, déjà résolu une fois pour toutes par `CloudSyncInitializer`
  (lui monté dans layout.tsx, donc jamais remonté) et disponible de façon SYNCHRONE dès le
  premier rendu — plus aucune requête dans Header/BottomNav, plus de flash. Vérifié en
  chronométrant le DOM toutes les 20 ms pendant un clic : une seule valeur du début à la fin.
  Piège pour la suite : tout composant qui lit l'identité doit passer par le store, jamais par
  son propre `fetch('/api/auth/me')`, sous peine de refaire cette même erreur.
- **Le statut vivait dans un cookie de session signé de 7 jours, pas seulement en base** —
  toute action admin qui change un statut doit forcer un rafraîchissement de session.
- **Ne jamais faire de boucles `curl` rapprochées sur la prod** — déclenche le Attack
  Challenge Mode de Vercel (403 sur tout le site, pas juste l'IP fautive).
- **Deux clés Supabase différentes existent** : ancien format JWT (`anon`, `service_role`) et
  nouveau (`sb_publishable_...`, `sb_secret_...`). Ne pas les confondre.
- **Vercel ne relit pas les variables d'environnement sans un nouveau déploiement explicite.**
- **Aucun environnement de test/sandbox séparé n'existe** — une seule base Supabase, un seul
  déploiement Vercel, utilisés en conditions réelles. Toute donnée de test doit être marquée
  clairement et nettoyée après usage.
- **Le webhook SasPay ne transporte PAS nos `metadata`.** Son `data` ne contient que l'id de
  transaction SasPay, sa référence interne, le statut et les montants — aucun numéro de
  commande Suguba. Le mécanisme LigdiCash (`custom_data.reference` = notre `order_number`)
  est donc **irreproductible**. D'où deux conséquences structurantes :
  1. on stocke l'id SasPay sur la ligne **à l'initiation** (`payment_transaction_id`), et le
     webhook retrouve la commande par cet id ;
  2. on encaisse via `POST /payments/softpay/` (qui renvoie l'id tout de suite) et **non**
     via `POST /checkout-sessions/`, dont le champ `transaction` vaut `null` à la création —
     un webhook y serait impossible à rattacher. Ne pas « simplifier » vers checkout-sessions.
- **Softpay ne pousse pas toujours sur le téléphone.** Si la réponse contient une
  `checkout_url` non vide, **aucune demande n'arrivera sur le téléphone du client** : il faut
  le rediriger, sinon le paiement n'a jamais lieu. C'est le comportement normal d'Orange
  Money et des cartes, et un même réseau peut basculer d'un mode à l'autre sans préavis.
  Toujours tester `checkout_url` avant de conclure au push.
- **SasPay ne couvre pas Wave au Mali.** Réseaux disponibles : `orange_ml`, `moov_ml`,
  `mobi_cash_ml`. Ne pas ajouter `wave_ml` « au cas où » — un code réseau inconnu fait un 422
  `invalid_method`. (Wave existe chez SasPay en Côte d'Ivoire et au Sénégal, pas au Mali.)
- **Le portail Diaspora utilise le réseau global `card`** — carte bancaire via Stripe,
  **facturée en USD** quel que soit le `country` envoyé, avec conversion automatique depuis
  le XOF au taux configuré sur le compte. `return_url` y est **obligatoire** (422 sinon), et
  `customer.phone` reste exigé même s'il n'est jamais utilisé.
- **Le `signing_secret` du webhook SasPay n'est affiché qu'une seule fois**, à la création
  dans le tableau de bord. Perdu, il faut en générer un nouveau (Webhooks → Changer le
  secret). Il n'est jamais renvoyé en lecture par l'API.
- **Créer ou modifier un webhook SasPay se fait uniquement au tableau de bord**, pas par API
  (la clé ne donne accès qu'à la consultation et à l'historique de livraison).
- **Les numéros de commande étaient tirés dans 90 000 valeurs, sans contrôle d'unicité.**
  `SG-${Math.floor(10000 + Math.random() * 90000)}` — alors que `orders.order_number` est
  `UNIQUE NOT NULL`. Paradoxe des anniversaires : 49 % de risque de collision dès la 350ᵉ
  commande, 99,6 % dès la 1000ᵉ. À la collision, l'INSERT échoue — et comme la synchro part
  en arrière-plan sans que personne n'attende son résultat, **l'échec était silencieux** :
  le client voyait sa confirmation et son code secret, mais la commande n'existait nulle
  part. Ni paiement, ni livreur, ni trace. Corrigé le 2026-09-10 : 8 caractères sur un
  alphabet de 30 symboles sans ambiguïté visuelle (6,5 × 10¹¹ combinaisons), et tout échec
  de synchronisation est désormais journalisé en `console.error` avec le numéro concerné.
  Le SMS n'est plus envoyé si la commande n'a pas atteint la base.
- **La base refusait le statut « submitted » des produits** (découvert le 2026-09-10). La
  contrainte de `schema.sql` n'autorisait que `pending / approved / rejected / archived`,
  alors que toute l'application utilise `submitted` pour un dépôt en attente de modération.
  **Chaque dépôt de produit par un fournisseur échouait donc en base** : il voyait son article
  dans son navigateur, l'admin ne le recevait jamais. Cause la plus probable du « catalogue
  vide » signalé depuis août. Corrigé dans `migration-tarification.sql` (section 4). Même
  famille que la contrainte des statuts de commande : vérifier les CHECK contre le code avant
  de chercher ailleurs.
- **Les montants d'une commande venaient du navigateur** (corrigé le 2026-09-10).
  `/api/orders/sync` enregistrait tels quels prix, total, commission et statut, sur une route
  publique : commission de 500 000 F sur son propre code, commande créée « livrée »
  (commission disponible sans livraison), total à 100 F pour un article à 45 000 F — que la
  route SasPay « relisait en base » en toute confiance. Tout est désormais calculé par le
  serveur à partir du produit en base et figé dans `pricing_snapshot`. Les mises à jour ne
  touchent plus aucun montant. **Règle : aucune route ne doit accepter un montant du
  navigateur.**
- **La synchro produit acceptait statut et prix du navigateur** : un fournisseur pouvait
  publier son article « approuvé » sans modération, avec la commission de son choix, et
  écraser la fiche d'un autre. L'approbation ne passe plus que par la tarification admin, et
  un changement de prix fournisseur sur un produit approuvé le renvoie en modération.
- **La page produit promettait une remise jamais appliquée.** Codes promo, frais par ville et
  point relais étaient calculés dans la page, pendant que la commande gardait 1 500 F et aucune
  remise. Le client lisait un total, le livreur en réclamait un autre.
- **Le prix fournisseur est lisible publiquement** (lecture anon des produits approuvés, et
  `cloud-sync` fait `select('*')`). La marge Suguba s'en déduit. Non corrigé : le resserrer
  demande de revoir le chargement des produits côté navigateur. Ne pas y ajouter de colonnes
  de marge — elles sont calculées à la volée côté admin.
- **Deux sources de vérité pour les rôles, écrites de façon incohérente.** `profile_roles`
  est la source de vérité du multi-rôle, mais `/api/admin/promote` et
  `scripts/create-admin.js` n'écrivaient que `profiles.role`. Le repli de `chargerRoles()`
  masquait le problème — mais il ne jouait que tant que `profile_roles` était **vide** pour
  ce compte. Dès qu'une première ligne y apparaissait (une demande de rôle revendeur, par
  exemple), la carte se reconstruisait exclusivement à partir de la table et **le rôle admin
  disparaissait en silence** : l'administrateur devenait un simple revendeur en attente, sans
  message d'erreur. Corrigé le 2026-09-09 aux deux bouts — `chargerRoles()` réinjecte le
  rôle principal du profil quand il n'a pas de ligne à lui (sans jamais écraser une ligne
  existante), et les deux points de promotion écrivent désormais `profile_roles`.
- **Le `matcher` du middleware ne couvrait qu'une seule route API** (`/api/payouts/initiate`).
  Toutes les autres se défendaient elles-mêmes — ce qui marche tant que chaque auteur y
  pense, mais une nouvelle route écrite sans son contrôle serait restée ouverte sans que
  rien ne le signale. Étendu le 2026-09-09 à toutes les routes à rôle
  (`/api/admin|driver|supplier|reseller/*`, `/api/payouts/*`) et à celles exigeant une
  session. Les routes gardent leur propre contrôle : défense en profondeur, pas délégation.
  ⚠️ `/api/payouts/` mélange deux rôles (`create` → revendeur, `initiate` → admin) : deux
  entrées explicites, jamais un préfixe commun.
- **Deux sens du mot « retrait » chez SasPay, à ne pas confondre.** Le versement d'une
  commission (Suguba → revendeur) est un **payout**, et il produit un event
  `transaction.*` — pas un `settlement.*`. Les events `settlement.*` (pastilles « Retrait
  demandé/approuvé/réussi… » du dashboard) concernent le retrait de ton propre solde SasPay
  vers ta banque : aucun rapport avec les commissions, et la doc précise que la forme de
  leur `data` n'est pas garantie. Ne pas s'y abonner.
- **Le modèle d'abonnement webhook n'a pas de champ `is_active`.** Un script qui le lit
  obtient `None` et pourrait conclure à tort que l'abonnement est inactif. Sa seule
  existence suffit.
- **Passer les comptes « actifs à la création » a failli casser l'inscription Google.** Le
  callback n'envoyait vers `/register/complete` que si `status !== 'active'` ET pas de téléphone.
  Avec des comptes toujours actifs, un inscrit Google aurait filé vers son tableau de bord
  sans jamais donner numéro ni quartier. La condition ne porte plus que sur le téléphone.
  Leçon : changer une valeur par défaut oblige à relire toutes les conditions qui la testaient.
- **Toute connexion d'une adresse inconnue créait un compte « revendeur » en silence**
  (corrigé le 2026-09-10). `/login` n'envoie aucun rôle, et `supabase-exchange` retombait sur
  `'reseller'` par défaut ; `/auth/callback` n'envoyait vers `/register/complete` que les
  comptes non actifs — or tous naissent actifs. Résultat : ni rôle choisi, ni nom confirmé,
  ni numéro, ni fiche fournisseur/livreur (0 ligne dans `suppliers` et `drivers`). Désormais :
  sans rôle explicite, **rien n'est créé** (`needsRole`) ; `/register/complete` fait choisir le
  profil puis crée le compte ; le rôle reste modifiable tant qu'aucun numéro n'est enregistré ;
  le numéro est obligatoire ; le middleware renvoie vers le formulaire toute session dont le
  « phone » est encore un email (admin exempté). Les 2 comptes créés en silence le 2026-09-10
  seront invités à choisir leur profil à leur prochaine connexion.
- **Les partages WhatsApp n'étaient qu'un lien nu** (corrigé le 2026-09-11). Deux causes :
  `api.whatsapp.com/send?text=` ne transporte que du texte, et `/p/[slug]` étant `'use client'`
  sans métadonnées, WhatsApp ne trouvait aucune image d'aperçu. Désormais : `src/lib/partage.ts`
  partage photo + texte + lien en un clic (Web Share avec fichier, image préchargée au toucher
  car Safari refuse un partage trop long après le geste), repli texte puis `wa.me` ;
  `app/p/[slug]/layout.tsx` produit l'aperçu (logo Suguba tant que le produit n'a pas de photo).
  Carte produit unique `components/product/ProductCard.tsx` (carrousel, logo WhatsApp) utilisée
  par l'accueil, le catalogue revendeur et les boutiques ; dépôt de **plusieurs photos**
  (`PhotosUploader`, 6 max, la première = principale). ⚠️ Au 2026-09-11, **aucun produit n'a de
  photo** : le partage part sans image tant que le catalogue n'est pas photographié.
  Pour en ajouter à un produit EXISTANT : `/admin/products` (filtre « Sans photo », onglet
  « Produits » de la barre du bas) ou bouton « Photos » du tableau de bord fournisseur. Route
  dédiée `/api/products/images` : ne touche qu'aux photos, n'accepte que des URL de notre
  stockage `product-images`, fournisseur limité à ses produits, statut inchangé.
- **Les outils marketing revendeur affichaient de fausses données** (corrigé le 2026-09-11).
  `BannerGeneratorModal` et `/reseller/story-generator` prenaient le revendeur dans les données
  de démonstration (`state.resellers[0]`) : code et **téléphone d'un autre** sur l'affiche, ventes
  non attribuées. La page Marketing proposait des « kits » pour des produits inexistants (Smart TV
  145 000 F, kit solaire 65 000 F) et une garantie inventée ; le studio stories envoyait le lien
  du revendeur à quickchart.io. Remplacés par `src/lib/affiche.ts` (canvas 1080×1920 ou carré,
  sans bibliothèque, jamais de téléphone) + `AfficheModal` (aperçu PUIS partage : générer au
  clic ferait refuser le partage sur iPhone). `/reseller/story-generator` redirige vers
  `/reseller/marketing`. Bouton « affiche » sur les cartes du catalogue revendeur.
- **`/api/auth/me` renvoyait 401 à tout visiteur non connecté** (corrigé le 2026-09-11) : elle
  figurait dans les routes « session requise » du middleware alors qu'elle sert précisément à
  répondre `{ authenticated: false }`. Une erreur rouge dans la console, sur chaque page.
- **Tester une page à rôle en local sans exposer le vrai `SESSION_SECRET`** : lancer le serveur
  avec un secret jetable (`env SESSION_SECRET=… npm run dev`), signer la session de test avec
  lui, et l'ouvrir sur `127.0.0.1` (cookies séparés de `localhost`). Un jeton signé avec le vrai
  secret serait valable en production : ne jamais l'écrire dans une conversation.
- **Une garantie inventée s'affichait sur tous les produits** (corrigé le 2026-09-11) :
  `cloud-sync.ts` fixait `warrantyMonths: 6` en dur, et la page produit affichait « Garantie 6
  mois — Service certifié » (la page devis B2B, « Garantie certifiée »). La table `products` n'a
  **aucune** colonne garantie. Remplacé par des engagements réels (paiement à la livraison, code
  secret remis au livreur, livré par Suguba) et le nombre réel de livraisons réussies du produit
  (`/api/products/livraisons`, affiché seulement s'il est > 0).
  ⚠️ Non corrigé : le formulaire fournisseur demande garantie, délai de préparation et adresse
  du stock, **jamais enregistrés** (aucune colonne). À ajouter en base ou à retirer du formulaire.
- **Photos allégées avant l'envoi** (2026-09-11, `src/lib/compression-image.ts`) : 1600 px,
  JPEG 0,82. Une photo de téléphone de 8 à 13 Mo était refusée (limite serveur 5 Mo) ; vérifié :
  13,8 Mo → 0,67 Mo. En cas d'échec, le fichier d'origine part tel quel.
- **Le service worker v2 mettait en cache toutes les réponses d'API** (corrigé le 2026-09-11,
  `public/sw.js` v3) : commandes, soldes, données admin restaient lisibles hors ligne sur un
  téléphone partagé. Il préchargeait aussi 27 pages à la première visite, sans plafond. La v3 ne
  met jamais `/api/` en cache, ne précharge que l'accueil, plafonne pages (40) et photos (200),
  et supprime les anciens caches à l'activation. Le SW n'est enregistré qu'en production : pour
  le tester en local, l'enregistrer à la main (`navigator.serviceWorker.register('/sw.js')`).
- **Un produit pas en vente pouvait être partagé à « 0 F »** (corrigé le 2026-09-11, signalé
  par l'utilisateur avec capture). Deux bugs combinés :
  1. `/admin/products/new` enregistrait via `/api/products/sync` — qui crée TOUJOURS un produit
     `submitted` à prix 0 depuis la tarification automatique — puis affichait « Produit publié ! ».
     Le formulaire appelle désormais `/api/admin/products/price` (commission calculée, prix sous
     le plancher refusé avec le prix minimal) et dit la vérité s'il n'a pas pu publier.
  2. `/p/[slug]` cherche le produit dans la mémoire locale SANS regarder son statut ; sur le
     téléphone de l'admin (qui y charge les produits en attente), la page s'affichait à 0 F avec
     le bouton de partage. Le destinataire, lui, voyait « Produit introuvable ». La page affiche
     désormais « Pas encore en vente » (ni commande ni partage), et le partage comme l'affiche
     refusent un produit sans prix. Règle : **« en vente » = `approved` ET prix > 0**, partout.
- **La barre du bas « flottait » au milieu de l'écran sur iPhone** (corrigé le 2026-09-11,
  signalé avec capture sur /admin). Ce n'était ni un zoom ni un conteneur transformé : l'écart
  valait la hauteur du clavier. Safari repositionne mal les éléments `fixed` en bas après la
  fermeture du clavier. `src/lib/useClavierOuvert.ts` masque la barre du bas et le bouton
  WhatsApp flottant pendant la saisie ; les réafficher force Safari à les recalculer.
  ⚠️ Détecter la fin de saisie avec `relatedTarget` de l'événement `focusout`, **jamais**
  `document.activeElement` lu juste après : selon le navigateur il désigne encore l'ancien
  champ, et la barre restait masquée pour de bon.
- **Tester du focus ou des minuteries dans le panneau Browser masqué** : la page n'a pas le
  focus (aucun vrai `focusin`) et Chrome ralentit les minuteries à ~1 par seconde. Déclencher
  les `FocusEvent` à la main et attendre plusieurs secondes avant de conclure.
- **Publication automatique des produits** (décision de l'utilisateur, 2026-09-11) : plus de
  validation manuelle avant la mise en vente. `src/lib/publication-auto.ts` publie au **prix
  recommandé** du moteur (commission calculée) si le produit a au moins une photo et qu'un prix
  rentable existe ; sinon il reste « en attente » avec la raison, renvoyée au fournisseur.
  Déclenchée au dépôt fournisseur (`/api/products/sync`), au changement de prix fournisseur
  (retarification) et à l'ajout de photos (`/api/products/images`). Un produit **retiré** par
  l'admin (`rejected`/`archived`) n'est jamais republié automatiquement. Contrôle après coup :
  `/admin/products` → « Nouveautés fournisseurs » (14 jours), boutons « Prix » et « Retirer »
  (`/api/admin/products/status`). Pas de période d'essai pour les nouveaux fournisseurs (option
  proposée, écartée pour l'instant — facile à ajouter dans `publierAutomatiquement`).
  ⚠️ Les prix publiés dépendent des réglages économiques : tant que les coûts fixes par défaut
  (estimation) n'ont pas été remplacés par les vrais, les prix recommandés en héritent.
- **Part revendeur choisie par le fournisseur** (décision de l'utilisateur, 2026-09-11) — colonne
  `products.commission_proposee` (`migration-part-revendeur.sql`). Réglages économiques :
  `modePartSuguba` = `prix_vente` (Suguba prend X % du prix client) | `part_revendeur` (X % de la
  part revendeur) | `auto` (le moteur calcule, comme avant), `tauxPartSuguba`, `minimumPartSuguba`.
  Prix client = fournisseur + part revendeur + part Suguba (`prixDepuisPartRevendeur`), **relevé
  au plancher** s'il ne couvre pas les coûts. `calculerTarif(…, commissionProposee)` impose la
  part choisie partout (publication auto, tarification admin, recalcul des réglages, devis,
  commande) — sinon la commission figée sur la commande différerait de celle affichée. Tableau
  de simulation dans « Réglages économiques ». Aperçu du prix pour le fournisseur via
  `/api/products/apercu-prix` (ne renvoie jamais les coûts). ⚠️ Le mode `part_revendeur` avec un
  petit % ne couvre pas les coûts : c'est le relèvement au plancher qui protège la marge.
- **`payouts.status` n'accepte que `pending`/`processing`/`completed`/`rejected`** (contrainte
  CHECK). Écrire `failed` ferait échouer la mise à jour — même famille de piège que
  l'incohérence de statut des commandes corrigée en août. Un versement raté s'écrit
  `rejected`.
- **RLS ne donne à la clé anon qu'un accès en LECTURE aux produits `approved`** — un dépôt
  fournisseur "submitted" est invisible à l'admin sans passer par une route service_role
  authentifiée (`/api/admin/products/pending`, même principe pour les commandes livreur).

---

## Identifiants et emplacements utiles

- Projet Supabase : `jwbryyaysptokzmfwijo` — `https://jwbryyaysptokzmfwijo.supabase.co`
- Domaine prod : `https://app.sugubaml.com` (hébergé sur Vercel)
- Admin : `+22371360525` / `infos@sugubaml.com`
- Scripts utiles : `scripts/create-admin.js`, `scripts/link-admin-google.js`,
  `scripts/purge-test-data.js` (`--confirm` obligatoire pour agir réellement)
- `.env.local` contient les vraies clés (Supabase service_role, SESSION_SECRET, OTP_PEPPER) —
  jamais les réafficher dans le chat, toujours passer par `grep` + copie locale si besoin

### 2026-09-30 — Implémentation audit profils (local)
REQ-UX-PROFILS-001 / TASK-UX-PROFILS-002 à 006 : navigation métier, outils, carte/QR réel, simulateur sans primes fictives, wizard fournisseur avec brouillon et confirmation, recherche/stock direct, parcours livreur et incident enregistré dans SAV, vérification selon le rôle et quartier direct. Rapport : `docs/qa/implementation-profils-2026-09-30.md`. Tests : 393 réussis ; TypeScript et build local avec services fictifs. Aucun déploiement ni modification de données de production. Fusion des modèles historiques de boutique et options avancées conservées pour un lot séparé documenté, pas annoncées comme réalisées.

### 2026-09-30 — Suite audit profils (local)
REQ-UX-PROFILS-001 / TASK-UX-PROFILS-007 à 009 : identité publique fournisseur canonique dans stores avec reprise historique explicite et anciennes adresses conservées ; dépôt privé dans la même page, ambassadeurs redirigé. Calendrier : partage préparé distinct de confirmation manuelle, erreurs et dates validées. Gains : aucun faux zéro ni retrait si solde inconnu. Build final et TypeScript réussis ; 396 tests de suite + 2 nouveaux tests API et guide ciblé réussis. Rapport et captures locaux mis à jour. Aucun déploiement, aucune migration destructive, aucun envoi externe ni données de production modifiées. Duplication/prix/favoris/campagnes avancées restent documentés comme non implémentés.

### 2026-09-30 — Finalisation corrections profils (local, avant déploiement)
REQ-UX-PROFILS-001 / TASK-UX-PROFILS-010 à 013 : éditeur d’offre propriétaire (descriptif/stock/part revendeur), copies serveur draft stock/prix public zéro, photos sans publication implicite des copies, garde de publication concurrente. Catalogue/visuel/calendrier continu, textes unifiés, CTA questions/devis et explications campagnes. Commissions en attente/date grand-livre/réservations et minimum retrait guidés. Vitrines secondaires indépendantes et WhatsApp fournisseur non sérialisé. Rapport QA mis à jour, captures fin-*.png locales. Suite 407 réussis + 14 ciblés sur code final ; build et TypeScript réussis. Corrections d’audit terminées localement ; propositions exploratoires distinctes. Aucun déploiement ni données de production modifiées, aucune nouvelle migration. Coût fournisseur non éditable dans cette nouvelle API (règle AGENTS : seul montant accepté = part revendeur).
