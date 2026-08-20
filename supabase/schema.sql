-- ==============================================================================
-- SUGUBA SAAS — SCHÉMA DE BASE DE DONNÉES SUPABASE (PostgreSQL)
-- V1.3 — MicroOffice SaaS Factory (Mali)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLE DES PRODUITS (products)
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  supplier_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  public_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reseller_commission NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  images TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
  supplier_id TEXT,
  supplier_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLE DES COMMANDES (orders)
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  order_number TEXT UNIQUE NOT NULL,
  product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_image TEXT,
  reseller_id TEXT,
  reseller_name TEXT,
  reseller_code TEXT,
  reseller_commission NUMERIC(12, 2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_product_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 1500,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Bamako',
  neighborhood TEXT,
  landmark TEXT,
  delivery_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending_call' CHECK (
    status IN ('pending_call', 'confirmed', 'assigned_driver', 'in_delivery', 'delivered', 'cancelled', 'returned')
  ),
  delivery_otp TEXT,
  failed_otp_attempts INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash_on_delivery',
  payment_collected BOOLEAN NOT NULL DEFAULT false,
  assigned_driver_id TEXT,
  assigned_driver_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

-- 4. TABLE DES PROFILS UTILISATEURS (profiles)
--
-- `status` et `metadata` ajoutés pour la validation d'inscription : un
-- profil créé via /api/auth/verify-otp naît `pending_approval` (numéro
-- prouvé par OTP, mais dossier pas encore examiné par Suguba) et ne devient
-- `active` qu'après validation admin (/api/admin/review-profile). Aucun
-- rôle ne peut se déclarer lui-même `admin` ni `active` — voir ces routes.
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'reseller' CHECK (role IN ('reseller', 'supplier', 'driver', 'admin', 'customer', 'diaspora')),
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'active', 'suspended', 'rejected')),
  reseller_code TEXT UNIQUE,
  city TEXT DEFAULT 'Bamako',
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration douce si la table existait déjà avant ce correctif (idempotent).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_approval';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('pending_approval', 'active', 'suspended', 'rejected'));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Connexion par email / Google (Supabase Auth) en plus du téléphone (OTP
-- maison) : `phone` n'est donc plus obligatoire, et deux nouvelles colonnes
-- identifient un compte créé par ce chemin. `auth_user_id` est l'ancrage
-- fiable (l'email d'un compte Google peut changer, l'identifiant Supabase
-- Auth non) — voir /api/auth/supabase-exchange.
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

-- 5. TABLE DES RETRAITS & COMMISSIONS (payouts)
CREATE TABLE IF NOT EXISTS public.payouts (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  reseller_id TEXT NOT NULL,
  reseller_name TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('wave', 'orange_money', 'moov', 'cash')),
  phone_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  transaction_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 6. POLITIQUES DE SÉCURITÉ (Row Level Security - RLS)
--
-- ⚠️ CORRECTIF BUG-006 : la version précédente activait RLS puis le
-- neutralisait immédiatement avec des politiques `USING (true)` en FOR ALL
-- sur `profiles` et `payouts`, et sur `orders` en lecture ET écriture — soit
-- un accès total, en lecture comme en écriture, pour n'importe quelle clé
-- anonyme (publique par nature). Concrètement : n'importe qui pouvait lire
-- le solde/rôle de tous les comptes, modifier le statut/montant/numéro
-- bénéficiaire de n'importe quel retrait, et lire toutes les commandes
-- (nom, téléphone, adresse de chaque client).
--
-- Nouveau modèle : cette application n'utilise PAS Supabase Auth (les
-- comptes sont vérifiés par un service serveur, voir src/lib/session.ts) —
-- il n'y a donc pas de auth.uid() fiable à vérifier depuis Postgres. Le vrai
-- périmètre de confiance est le serveur Next.js (routes /api/*), qui accède
-- à la base avec la clé service_role (contourne RLS, voir
-- src/lib/supabase-admin.ts — clé JAMAIS exposée au navigateur). RLS reste
-- activé comme filet de sécurité si la clé anon venait à être appelée
-- directement, mais n'autorise plus AUCUNE lecture/écriture publique sur
-- les tables sensibles.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- Postgres n'a pas de `CREATE POLICY IF NOT EXISTS` : on DROP puis CREATE,
-- pour que ce script reste rejouable sans erreur (et pour supprimer, si
-- elles traînent encore d'un déploiement antérieur au correctif BUG-006,
-- les anciennes policies grandes ouvertes `USING (true)`).
DROP POLICY IF EXISTS "Public read approved products" ON public.products;
DROP POLICY IF EXISTS "Public insert orders" ON public.orders;
DROP POLICY IF EXISTS "Public read orders" ON public.orders;
DROP POLICY IF EXISTS "Public update orders" ON public.orders;
DROP POLICY IF EXISTS "Public profiles access" ON public.profiles;
DROP POLICY IF EXISTS "Public payouts access" ON public.payouts;

-- Catalogue : lecture publique légitime (vitrine produit), écriture
-- réservée au serveur (service_role) — un fournisseur ne doit jamais
-- pouvoir modifier son produit directement depuis le navigateur.
CREATE POLICY "Public read approved products"
  ON public.products FOR SELECT
  USING (status = 'approved');

-- Commandes : la création reste publique (client sans compte, cœur du
-- produit), mais la lecture/modification en masse ne l'est plus — un
-- visiteur ne doit plus pouvoir lister ou modifier les commandes de tout le
-- monde. Le suivi d'une commande précise se fait via la fonction
-- `track_order` ci-dessous (nécessite de connaître le numéro ET le
-- téléphone exacts, pas un simple SELECT * ouvert).
CREATE POLICY "Public insert orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    customer_name IS NOT NULL AND length(trim(customer_name)) > 0 AND
    customer_phone IS NOT NULL AND length(trim(customer_phone)) >= 8 AND
    total_amount >= 0
  );

-- Aucune politique SELECT/UPDATE publique sur orders : admin/livreur/
-- desk d'appel passent par le serveur (service_role), pas par le
-- navigateur avec la clé anon.

-- Profils (rôle, solde) et retraits (montant, bénéficiaire, statut) :
-- aucun accès public, ni en lecture ni en écriture. Tout passe par les
-- routes /api/auth/* et /api/payouts/* qui utilisent service_role après
-- avoir vérifié la session signée (src/lib/session.ts).
-- (Aucune politique = accès refusé par défaut une fois RLS activé — les
-- DROP POLICY ci-dessus suppriment explicitement les anciennes policies
-- ouvertes s'il en restait.)

-- Suivi de commande client, sans ouvrir la table en lecture libre :
-- exige de connaître le numéro de commande ET le téléphone exact du
-- client, retourne le strict minimum utile au suivi.
CREATE OR REPLACE FUNCTION public.track_order(p_order_number TEXT, p_customer_phone TEXT)
RETURNS TABLE (
  order_number TEXT,
  product_name TEXT,
  status TEXT,
  city TEXT,
  neighborhood TEXT,
  total_amount NUMERIC,
  created_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT o.order_number, o.product_name, o.status, o.city, o.neighborhood,
         o.total_amount, o.created_at, o.delivered_at
  FROM public.orders o
  WHERE o.order_number = p_order_number
    AND o.customer_phone = p_customer_phone;
$$;

REVOKE ALL ON FUNCTION public.track_order(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_order(TEXT, TEXT) TO anon, authenticated;

-- 6bis. DÉFIS OTP DE CONNEXION (otp_challenges) — voir src/lib/otp-store.ts
-- Ne stocke jamais le code en clair, seulement son empreinte HMAC. Accès
-- service_role uniquement : aucune politique publique.
CREATE TABLE IF NOT EXISTS public.otp_challenges (
  phone TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;

-- 6ter. GRAND-LIVRE DE COMMISSIONS (commissions)
--
-- Jusqu'ici, le solde disponible d'un revendeur n'existait que côté client
-- (sugubaStore, données de démo) — rien n'empêchait, une fois l'API de
-- retrait sécurisée, qu'un vrai compte demande un montant supérieur à ce
-- qu'il a réellement gagné, puisque le serveur n'avait aucune source de
-- vérité pour son solde. Cette table est cette source de vérité, minimale
-- volontairement (pas de paliers de rétention 14/7/3 jours pour l'instant) :
--   pending   → commande pas encore livrée, commission non réclamable
--   available → commande livrée, commission réclamable
--   reserved  → réclamée par une demande de retrait en attente (voir
--               reserve_commissions_for_withdrawal ci-dessous)
--   paid      → retrait exécuté avec succès
--   reversed  → commande annulée/retournée après coup
CREATE TABLE IF NOT EXISTS public.commissions (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
  order_number TEXT,
  reseller_id TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'reserved', 'paid', 'reversed')),
  reserved_for_withdrawal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  available_at TIMESTAMPTZ
);
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
-- Aucune politique publique : lu/écrit uniquement par le serveur
-- (service_role), via /api/orders/sync, /api/payouts/create et
-- /api/payouts/initiate.

CREATE INDEX IF NOT EXISTS idx_commissions_reseller_status ON public.commissions (reseller_id, status);

-- Réserve atomiquement jusqu'à p_amount de commissions "available" d'un
-- revendeur pour un retrait donné. Le verrouillage de lignes (FOR UPDATE)
-- empêche deux demandes de retrait simultanées de consommer deux fois le
-- même solde — une simple vérification "SELECT puis UPDATE" côté
-- application serait vulnérable à cette course. Renvoie le montant
-- effectivement réservé : si inférieur à p_amount, l'appelant doit annuler
-- (la fonction dé-réserve alors ce qu'elle venait de réserver dans le même
-- appel, pour ne rien laisser bloqué).
CREATE OR REPLACE FUNCTION public.reserve_commissions_for_withdrawal(
  p_reseller_id TEXT,
  p_amount NUMERIC,
  p_withdrawal_id TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reserved NUMERIC := 0;
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT id, amount FROM public.commissions
    WHERE reseller_id = p_reseller_id AND status = 'available'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    EXIT WHEN v_reserved >= p_amount;
    UPDATE public.commissions
      SET status = 'reserved', reserved_for_withdrawal = p_withdrawal_id
      WHERE id = v_row.id;
    v_reserved := v_reserved + v_row.amount;
  END LOOP;

  IF v_reserved < p_amount THEN
    UPDATE public.commissions
      SET status = 'available', reserved_for_withdrawal = NULL
      WHERE reserved_for_withdrawal = p_withdrawal_id AND status = 'reserved';
    RETURN 0;
  END IF;

  RETURN v_reserved;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_commissions_for_withdrawal(TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_commissions_for_withdrawal(TEXT, NUMERIC, TEXT) TO service_role;

-- Libère les commissions réservées pour un retrait qui échoue ou est
-- rejeté, pour qu'elles redeviennent disponibles au lieu de rester
-- bloquées indéfiniment en 'reserved'.
CREATE OR REPLACE FUNCTION public.release_commissions_for_withdrawal(p_withdrawal_id TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.commissions
    SET status = 'available', reserved_for_withdrawal = NULL
    WHERE reserved_for_withdrawal = p_withdrawal_id AND status = 'reserved';
$$;

REVOKE ALL ON FUNCTION public.release_commissions_for_withdrawal(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_commissions_for_withdrawal(TEXT) TO service_role;

-- Marque comme payées les commissions réservées pour un retrait exécuté
-- avec succès.
CREATE OR REPLACE FUNCTION public.settle_commissions_for_withdrawal(p_withdrawal_id TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.commissions
    SET status = 'paid'
    WHERE reserved_for_withdrawal = p_withdrawal_id AND status = 'reserved';
$$;

REVOKE ALL ON FUNCTION public.settle_commissions_for_withdrawal(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_commissions_for_withdrawal(TEXT) TO service_role;

-- 7. ACTIVATION WEBSOCKETS EN TEMPS RÉEL (Supabase Realtime)
-- Permet aux livreurs et à l'admin de recevoir les commandes en direct
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- 8. DONNÉES DE DÉPART (Exemple de produits Bamako)
INSERT INTO public.products (id, name, slug, category, description, supplier_price, public_price, reseller_commission, stock, images, status, supplier_name)
VALUES 
  (
    'prod_01', 
    'Smart TV Samsung 43" 4K UHD', 
    'smart-tv-samsung-43', 
    'Électronique', 
    'Téléviseur Samsung 43 pouces Crystal UHD 4K avec HDR, Smart TV Tizen, HDMI, USB.', 
    165000, 
    215000, 
    25000, 
    18, 
    ARRAY['https://jwbryyaysptokzmfwijo.supabase.co/storage/v1/object/public/product-images/seed/1593359677879-a4bb92f829d1.jpg'],
    'approved', 
    'Grossiste Électro Bamako'
  ),
  (
    'prod_02', 
    'Pack Huile Dinor 5L x 4 Bidons', 
    'pack-huile-dinor-5l', 
    'Alimentation', 
    'Huile végétale raffinée Dinor sans cholestérol. Carton de 4 bidons de 5 litres.', 
    28000, 
    34000, 
    3000, 
    120, 
    ARRAY['https://jwbryyaysptokzmfwijo.supabase.co/storage/v1/object/public/product-images/seed/1474979266404-7eaacbcd87c5.jpg'],
    'approved', 
    'Alimentation Générale Dabanani'
  ),
  (
    'prod_03', 
    'Robe Bazin Riche Getzner Brodé', 
    'robe-bazin-riche-getzner', 
    'Mode & Beauté', 
    'Magnifique ensemble Bazin Riche teinté artisanalement à Bamako avec broderie fine.', 
    42000, 
    55000, 
    8000, 
    35, 
    ARRAY['https://jwbryyaysptokzmfwijo.supabase.co/storage/v1/object/public/product-images/seed/1566737236500-c8ac43014a67.jpg'],
    'approved', 
    'Atelier Couture ACI 2000'
  )
ON CONFLICT (slug) DO NOTHING;
