'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import { useSugubaStore } from '@/lib/store';
import { 
  Building2, Store, Users, ShieldCheck, Share2, 
  Sparkles, Star, Phone, MapPin, ArrowRight, CheckCircle2, MessageCircle
} from 'lucide-react';

export default function SupplierPublicShowroomPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const state = useSugubaStore();

  const refCode = searchParams.get('ref');
  const supplierSlug = resolvedParams.slug;

  // Find supplier by company name slug or fallback
  const supplier = state.suppliers.find(s => 
    s.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-') === supplierSlug
  ) || state.suppliers[0];

  const supplierUser = state.users.find(u => u.id === supplier.userId) || state.users[1];

  // Filter products strictly belonging to this supplier
  const supplierProducts = state.products.filter(p => p.supplierId === supplier.id);

  const [copiedLink, setCopiedLink] = useState(false);

  const shareShowroomUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/s/${supplierSlug}${refCode ? `?ref=${refCode}` : ''}`
    : `https://app.sugubaml.com/s/${supplierSlug}`;

  const handleCopyShowroomLink = () => {
    navigator.clipboard.writeText(shareShowroomUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full space-y-8">
        
        {/* Merchant Hero Banner */}
        <div className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl overflow-hidden space-y-6">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            <div className="flex items-start space-x-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-black text-2xl sm:text-3xl shadow-lg border-2 border-white/20 shrink-0">
                {supplier.companyName.charAt(0)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                    Boutique Certifiée Suguba
                  </span>
                  <div className="flex items-center space-x-1 text-amber-400 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>4.9 / 5</span>
                  </div>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-white">
                  {supplier.companyName}
                </h1>
                <p className="text-xs text-slate-300 flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Entrepôt & Stock : {supplier.warehouseNeighborhood} ({supplier.warehouseAddress})</span>
                </p>
                <p className="text-[11px] text-slate-400">
                  Gérant(e) : <strong>{supplierUser.fullName}</strong> • Tél : <strong>{supplier.contactPhone}</strong>
                </p>
              </div>
            </div>

            {/* Actions for Ambassador Network */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                onClick={handleCopyShowroomLink}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>{copiedLink ? 'Lien de la Boutique Copié !' : 'Partager la Boutique'}</span>
              </button>

              <Link
                href={`/reseller/join?sponsor=${refCode || 'SUGUBA'}`}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all active:scale-95 text-center"
              >
                <Users className="w-4 h-4" />
                <span>Devenir Ambassadrice de la Boutique</span>
              </Link>
            </div>

          </div>

          {/* Value Props Bar */}
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-white/10 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Catalogue Dédié</span>
              <p className="font-black text-emerald-400 text-sm">{supplierProducts.length} Produits Exclusifs</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Livraison Bamako</span>
              <p className="font-black text-white text-sm">24h Express à Domicile</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Garantie & Authenticité</span>
              <p className="font-black text-white text-sm">100% Certifié d&apos;Origine</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Paiement Sécurisé</span>
              <p className="font-black text-amber-400 text-sm">À la Livraison + Code OTP</p>
            </div>
          </div>
        </div>

        {/* Products Grid of this specific Merchant */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h2 className="font-black text-lg text-slate-900 flex items-center space-x-2">
                <Store className="w-5 h-5 text-emerald-600" />
                <span>Collection Exclusive — {supplier.companyName}</span>
              </h2>
              <p className="text-xs text-slate-500">
                Commandez directement en ligne avec livraison et encaissement gérés par Suguba.
              </p>
            </div>

            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full self-start sm:self-auto">
              {supplierProducts.length} Articles Disponibles en Stock
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {supplierProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between group">
                <div>
                  <div className="relative h-56 w-full bg-slate-100 overflow-hidden">
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold rounded-lg">
                        {product.category}
                      </span>
                    </div>
                    {product.stockQuantity > 0 && (
                      <div className="absolute bottom-3 right-3">
                        <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-md shadow-xs">
                          En Stock ({product.stockQuantity})
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-2">
                    <h3 className="font-black text-sm text-slate-900 line-clamp-2 leading-snug">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {product.description}
                    </p>

                    <div className="pt-2 flex items-baseline justify-between">
                      <div>
                        <span className="text-lg font-black text-emerald-600">
                          {product.publicPrice.toLocaleString('fr-FR')} FCFA
                        </span>
                        <span className="text-[11px] text-slate-400 line-through block -mt-1">
                          {(product.publicPrice * 1.2).toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-600">
                        Garantie {product.warrantyMonths} mois
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <Link
                    href={`/p/${product.slug}${refCode ? `?ref=${refCode}` : ''}`}
                    className="w-full py-3 bg-slate-900 hover:bg-emerald-600 text-white font-black rounded-2xl text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-xs"
                  >
                    <span>Commander Cet Article</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
