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
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'reseller' CHECK (role IN ('reseller', 'supplier', 'driver', 'admin', 'customer')),
  reseller_code TEXT UNIQUE,
  city TEXT DEFAULT 'Bamako',
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- Lecture publique des produits approuvés
CREATE POLICY "Public read approved products" 
  ON public.products FOR SELECT 
  USING (true);

-- Insertion & lecture publique/anonyme autorisée pour le web app (commandes)
CREATE POLICY "Public insert orders" 
  ON public.orders FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Public read orders" 
  ON public.orders FOR SELECT 
  USING (true);

CREATE POLICY "Public update orders" 
  ON public.orders FOR UPDATE 
  USING (true);

CREATE POLICY "Public profiles access" 
  ON public.profiles FOR ALL 
  USING (true);

CREATE POLICY "Public payouts access" 
  ON public.payouts FOR ALL 
  USING (true);

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
    ARRAY['https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=80'],
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
    ARRAY['https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&q=80'],
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
    ARRAY['https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=800&q=80'],
    'approved', 
    'Atelier Couture ACI 2000'
  )
ON CONFLICT (slug) DO NOTHING;
