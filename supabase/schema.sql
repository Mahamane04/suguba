-- ==============================================================================
-- SUGUBA SAAS — SCHÉMA POSTGRESQL COMPLET AVEC RLS (SUPABASE)
-- Conforme aux spécifications MicroOffice SaaS Factory V3.1
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ÉNUMÉRATIONS
CREATE TYPE user_role AS ENUM ('reseller', 'supplier', 'driver', 'admin', 'customer');
CREATE TYPE product_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
CREATE TYPE order_status AS ENUM ('new', 'pending_call', 'confirmed', 'dispatched', 'in_transit', 'delivered', 'cancelled', 'returned');
CREATE TYPE commission_status AS ENUM ('potential', 'pending', 'locked', 'available', 'withdrawal_requested', 'paid', 'cancelled');
CREATE TYPE withdrawal_status AS ENUM ('pending', 'approved', 'processing', 'completed', 'rejected');
CREATE TYPE reseller_tier AS ENUM ('new', 'verified', 'vip');

-- 3. TABLES PRINCIPALES

-- Table Utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'reseller',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profils Revendeurs
CREATE TABLE IF NOT EXISTS reseller_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    available_balance NUMERIC(15, 2) DEFAULT 0.00,
    pending_balance NUMERIC(15, 2) DEFAULT 0.00,
    total_earned NUMERIC(15, 2) DEFAULT 0.00,
    successful_orders_count INT DEFAULT 0,
    tier reseller_tier DEFAULT 'new',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profils Fournisseurs
CREATE TABLE IF NOT EXISTS supplier_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    city VARCHAR(100) DEFAULT 'Bamako',
    neighborhood VARCHAR(100) NOT NULL,
    commission_type VARCHAR(50) DEFAULT 'fixed_fcfa',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profils Livreurs
CREATE TABLE IF NOT EXISTS driver_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(100) DEFAULT 'Moto',
    plate_number VARCHAR(50),
    city VARCHAR(100) DEFAULT 'Bamako',
    active_runs_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Produits
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    supplier_id UUID REFERENCES supplier_profiles(id),
    supplier_name VARCHAR(255) NOT NULL,
    supplier_price NUMERIC(15, 2) NOT NULL,
    public_price NUMERIC(15, 2) NOT NULL,
    reseller_commission NUMERIC(15, 2) NOT NULL,
    suguba_margin NUMERIC(15, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    warranty_period_months INT DEFAULT 6,
    location_neighborhood VARCHAR(100) NOT NULL,
    status product_status DEFAULT 'draft',
    images TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Commandes (Transactions Maîtrisées par Suguba)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    product_id UUID REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    product_image TEXT,
    reseller_id UUID REFERENCES reseller_profiles(id),
    reseller_name VARCHAR(255),
    reseller_code VARCHAR(50),
    reseller_commission NUMERIC(15, 2) DEFAULT 0.00,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(15, 2) NOT NULL,
    total_product_amount NUMERIC(15, 2) NOT NULL,
    delivery_fee NUMERIC(15, 2) DEFAULT 1500.00,
    total_amount NUMERIC(15, 2) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    city VARCHAR(100) DEFAULT 'Bamako',
    neighborhood VARCHAR(100) NOT NULL,
    landmark VARCHAR(255) NOT NULL,
    delivery_notes TEXT,
    status order_status DEFAULT 'pending_call',
    delivery_otp VARCHAR(10) NOT NULL, -- Code secret à 4 chiffres
    failed_otp_attempts INT DEFAULT 0,
    otp_locked_until TIMESTAMP WITH TIME ZONE,
    driver_id UUID REFERENCES driver_profiles(id),
    driver_name VARCHAR(255),
    driver_phone VARCHAR(50),
    payment_method VARCHAR(50) DEFAULT 'cash_on_delivery',
    payment_collected BOOLEAN DEFAULT FALSE,
    call_verified_by VARCHAR(255),
    call_verified_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Registre Comptable des Commissions
CREATE TABLE IF NOT EXISTS commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commission_code VARCHAR(50) UNIQUE NOT NULL,
    reseller_id UUID REFERENCES reseller_profiles(id) NOT NULL,
    reseller_name VARCHAR(255) NOT NULL,
    order_id UUID REFERENCES orders(id) NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    status commission_status DEFAULT 'potential',
    safety_window_days INT DEFAULT 7,
    unlock_at TIMESTAMP WITH TIME ZONE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Demandes de Retrait Mobile Money
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    withdrawal_code VARCHAR(50) UNIQUE NOT NULL,
    reseller_id UUID REFERENCES reseller_profiles(id) NOT NULL,
    reseller_name VARCHAR(255) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    payout_phone VARCHAR(50) NOT NULL,
    payout_provider VARCHAR(50) NOT NULL,
    status withdrawal_status DEFAULT 'pending',
    transaction_ref VARCHAR(100),
    processed_by VARCHAR(255),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Journal d'Audit & Sécurité
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. INDEX DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_reseller_id ON orders(reseller_id);
CREATE INDEX IF NOT EXISTS idx_commissions_reseller_id ON commissions(reseller_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Politiques de lecture publique pour le catalogue approuvé
CREATE POLICY "Public approved products are viewable by everyone" 
ON products FOR SELECT USING (status = 'approved');

-- Politiques de création publique pour les commandes clients
CREATE POLICY "Anyone can insert an order" 
ON orders FOR INSERT WITH CHECK (true);
