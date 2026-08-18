# Architecture & Schéma de Base de Données — Suguba SaaS

## Schéma Relationnel PostgreSQL

```sql
-- 1. Utilisateurs & Authentification
CREATE TYPE user_role AS ENUM ('admin', 'supplier', 'reseller', 'driver');
CREATE TYPE reseller_tier AS ENUM ('new', 'verified', 'vip');
CREATE TYPE product_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'archived');
CREATE TYPE order_status AS ENUM ('new', 'pending_call', 'confirmed', 'dispatched', 'delivered', 'cancelled', 'returned');
CREATE TYPE commission_status AS ENUM ('pending', 'confirmed', 'locked', 'available', 'withdrawal_requested', 'paid', 'cancelled', 'reversed');
CREATE TYPE withdrawal_status AS ENUM ('pending', 'processing', 'completed', 'rejected');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'reseller',
    password_hash VARCHAR(255) NOT NULL,
    city VARCHAR(50) DEFAULT 'Bamako',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Profils Spécifiques
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(100) NOT NULL,
    warehouse_address TEXT NOT NULL,
    warehouse_neighborhood VARCHAR(100),
    contact_phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE resellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    tier reseller_tier DEFAULT 'new',
    pending_balance INT DEFAULT 0,
    available_balance INT DEFAULT 0,
    momo_number VARCHAR(20),
    momo_provider VARCHAR(50), -- 'Orange Money', 'Wave', 'Moov'
    total_earned INT DEFAULT 0,
    successful_orders_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE delivery_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(50) DEFAULT 'Moto',
    license_plate VARCHAR(30),
    active_status BOOLEAN DEFAULT true,
    total_deliveries INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Catalogue & Produits
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon_name VARCHAR(50)
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id),
    images TEXT[] NOT NULL DEFAULT '{}',
    video_url TEXT,
    supplier_price INT NOT NULL,         -- ex: 30 000 FCFA
    public_price INT,                    -- ex: 40 000 FCFA (fixé par Suguba)
    reseller_commission INT,             -- ex: 4 000 FCFA (fixé par Suguba)
    suguba_margin INT,                   -- ex: 6 000 FCFA (fixé par Suguba)
    stock_quantity INT DEFAULT 0,
    warranty_months INT DEFAULT 0,
    preparation_delay_hours INT DEFAULT 2,
    stock_location_type VARCHAR(50) DEFAULT 'supplier', -- 'supplier' ou 'suguba_hub'
    status product_status DEFAULT 'draft',
    is_featured BOOLEAN DEFAULT false,
    marketing_pitch TEXT, -- Texte prêt à copier pour WhatsApp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Commandes & Attribution Revendeur
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(30) UNIQUE NOT NULL, -- ex: SG-10492
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    reseller_id UUID REFERENCES resellers(id), -- NULL si vente directe Suguba
    quantity INT DEFAULT 1,
    unit_price INT NOT NULL,
    total_product_amount INT NOT NULL,
    delivery_fee INT DEFAULT 1500,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    city VARCHAR(50) DEFAULT 'Bamako',
    neighborhood VARCHAR(100) NOT NULL,
    landmark TEXT NOT NULL, -- Repère visuel (ex: à côté du Grand Marché)
    delivery_notes TEXT,
    status order_status DEFAULT 'new',
    delivery_otp VARCHAR(6) NOT NULL, -- Code secret à 4 chiffres (ex: '5832')
    driver_id UUID REFERENCES delivery_partners(id),
    payment_method VARCHAR(50) DEFAULT 'cash_on_delivery',
    payment_collected BOOLEAN DEFAULT false,
    call_verified_by UUID REFERENCES users(id),
    call_verified_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Registre Comptable des Commissions
CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_code VARCHAR(30) UNIQUE NOT NULL,
    reseller_id UUID REFERENCES resellers(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES orders(id) ON DELETE RESTRICT,
    amount INT NOT NULL,
    status commission_status DEFAULT 'pending',
    safety_window_days INT DEFAULT 7,
    unlock_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Demandes de Retrait Mobile Money
CREATE TABLE withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    withdrawal_code VARCHAR(30) UNIQUE NOT NULL,
    reseller_id UUID REFERENCES resellers(id) ON DELETE RESTRICT,
    amount INT NOT NULL,
    payout_provider VARCHAR(50) NOT NULL, -- 'Orange Money', 'Wave', 'Moov'
    payout_phone VARCHAR(20) NOT NULL,
    status withdrawal_status DEFAULT 'pending',
    transaction_reference VARCHAR(100),
    processed_by UUID REFERENCES users(id),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Audit & Journal d'Événements
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
