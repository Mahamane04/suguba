-- ═══════════════════════════════════════════════════════════════════════════
-- Réparer les logos et couvertures de boutiques tronqués (2026-09-26)
--
-- Bug : « Ma boutique » coupait les adresses d'image à 160 caractères. Les
-- images existent bien dans le stockage, mais l'adresse enregistrée était
-- incomplète : la boutique affichait une image cassée.
--
-- Ce script retrouve, pour chaque adresse tronquée, le fichier du stockage
-- qui commence exactement de la même façon, et remet l'adresse complète.
-- Il ne touche qu'aux adresses de 160 caractères pointant vers
-- product-images, et seulement si UN SEUL fichier correspond.
--
-- À exécuter une fois dans le SQL Editor de Supabase. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

WITH reparations AS (
  SELECT s.id,
    (SELECT CASE WHEN count(*) = 1
             THEN split_part(s.logo_url, '/object/public/product-images/', 1) || '/object/public/product-images/' || min(o.name) END
       FROM storage.objects o
      WHERE length(s.logo_url) = 160 AND s.logo_url LIKE '%/object/public/product-images/%'
        AND o.bucket_id = 'product-images'
        AND left(o.name, length(split_part(s.logo_url, '/object/public/product-images/', 2))) = split_part(s.logo_url, '/object/public/product-images/', 2)) AS logo,
    (SELECT CASE WHEN count(*) = 1
             THEN split_part(s.cover_url, '/object/public/product-images/', 1) || '/object/public/product-images/' || min(o.name) END
       FROM storage.objects o
      WHERE length(s.cover_url) = 160 AND s.cover_url LIKE '%/object/public/product-images/%'
        AND o.bucket_id = 'product-images'
        AND left(o.name, length(split_part(s.cover_url, '/object/public/product-images/', 2))) = split_part(s.cover_url, '/object/public/product-images/', 2)) AS couverture
  FROM public.stores s
  WHERE length(s.logo_url) = 160 OR length(s.cover_url) = 160
),
maj AS (
  UPDATE public.stores s
     SET logo_url = coalesce(r.logo, s.logo_url), cover_url = coalesce(r.couverture, s.cover_url), updated_at = now()
    FROM reparations r
   WHERE r.id = s.id AND (r.logo IS NOT NULL OR r.couverture IS NOT NULL)
  RETURNING r.logo, r.couverture
)
SELECT count(logo) AS logos_repares, count(couverture) AS couvertures_reparees FROM maj;
