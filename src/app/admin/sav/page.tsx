'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import BottomNav from '@/components/common/BottomNav';
import Footer from '@/components/common/Footer';
import CreateSavTicketModal from '@/components/admin/CreateSavTicketModal';
import { useSugubaStore, sugubaStore } from '@/lib/store';
import { SavTicket } from '@/types';
import { 
  ShieldAlert, ShieldCheck, RefreshCw, Truck, 
  Phone, MessageCircle, ArrowLeft, Plus, CheckCircle2, Clock, Wrench
} from 'lucide-react';

export default function AdminSavPage() {
  const state = useSugubaStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTicketForDispatch, setSelectedTicketForDispatch] = useState<SavTicket | null>(null);

  const deliveredOrders = state.orders.filter(o => o.status === 'delivered');
  const tickets = state.savTickets || [];

  const openTickets = tickets.filter(t => t.status === 'open');
  const inProgressTickets = tickets.filter(t => t.status === 'courier_dispatched');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved');

  const handleDispatchCourier = (ticketId: string, driverId: string) => {
    sugubaStore.dispatchSavCourier(ticketId, driverId);
    setSelectedTicketForDispatch(null);
  };

  const handleResolveTicket = (ticketId: string) => {
    sugubaStore.resolveSavTicket(ticketId, 'Échange neuf remis au client et pièce défectueuse retournée au fournisseur.');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-10">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        
        {/* Header & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link 
              href="/admin" 
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à la console Suguba Ops</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Desk SAV, Garantie & Gestion des Échanges 72h
            </h1>
            <p className="text-xs text-slate-500">
              Traitement des pannes sous garantie, réclamations et remplacements à domicile à Bamako.
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs shadow-md transition-all self-start sm:self-auto active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Ouvrir un Dossier SAV</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-3xl border border-rose-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-rose-700 uppercase">Dossiers Ouverts</span>
            <p className="text-2xl font-black text-rose-600">{openTickets.length}</p>
            <p className="text-[10px] text-slate-400">À traiter en priorité</p>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-amber-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-amber-700 uppercase">Échanges en Cours</span>
            <p className="text-2xl font-black text-amber-600">{inProgressTickets.length}</p>
            <p className="text-[10px] text-slate-400">Livreur moto en mission</p>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-emerald-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-emerald-700 uppercase">Dossiers Résolus</span>
            <p className="text-2xl font-black text-emerald-600">{resolvedTickets.length}</p>
            <p className="text-[10px] text-slate-400">Échanges réussis sous 72h</p>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Taux de Résolution</span>
            <p className="text-2xl font-black text-slate-900">100%</p>
            <p className="text-[10px] text-slate-400">Engagement Qualité Suguba</p>
          </div>
        </div>

        {/* Active Tickets List */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <h2 className="font-black text-sm text-slate-900">
                File des Réclamations & Échanges sous Garantie ({tickets.length})
              </h2>
            </div>
            <span className="text-[11px] font-bold text-slate-500">
              Garantie Certifiée
            </span>
          </div>

          {tickets.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Aucun dossier SAV en cours. Tout fonctionne parfaitement !
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => {
                const isResolved = ticket.status === 'resolved';
                const isDispatched = ticket.status === 'courier_dispatched';

                const whatsappClientUrl = `https://api.whatsapp.com/send?phone=${ticket.customerPhone.replace(/\D/g, '')}&text=${encodeURIComponent(
                  `Bonjour ${ticket.customerName}, votre dossier SAV #${ticket.ticketNumber} sur Suguba Mali a été pris en charge. Un livreur est en cours de passage pour l'échange de votre ${ticket.productName} sous garantie.`
                )}`;

                return (
                  <div 
                    key={ticket.id}
                    className={`p-4 sm:p-5 rounded-3xl border ${
                      isResolved ? 'bg-slate-50/50 border-slate-200 opacity-80' :
                      isDispatched ? 'bg-amber-50/40 border-amber-300 shadow-xs' :
                      'bg-rose-50/40 border-rose-300 shadow-xs'
                    } space-y-3`}
                  >
                    {/* Top Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-black text-xs px-2.5 py-1 bg-slate-900 text-white rounded-lg">
                          #{ticket.ticketNumber}
                        </span>
                        <span className="font-bold text-xs text-slate-900">
                          Commande #{ticket.orderNumber} • {ticket.productName}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          isResolved ? 'bg-emerald-100 text-emerald-800' :
                          isDispatched ? 'bg-amber-100 text-amber-900 animate-pulse' :
                          'bg-rose-100 text-rose-900'
                        }`}>
                          {isResolved && '✅ DOSSIER RÉSOLU'}
                          {isDispatched && '🛵 COURSIER ASSIGNÉ'}
                          {ticket.status === 'open' && '⚠️ EN ATTENTE ASSIGNATION'}
                        </span>
                      </div>
                    </div>

                    {/* Ticket Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <p className="text-slate-600">Client : <strong className="text-slate-900">{ticket.customerName}</strong> ({ticket.customerPhone})</p>
                        <p className="text-slate-600">Résolution : <strong className="text-rose-800 uppercase font-black">{ticket.resolutionType === 'swap_new' ? 'Échange Neuf 72h' : ticket.resolutionType}</strong></p>
                        <p className="text-slate-600 font-medium">Panne déclarée : <span className="text-slate-900 font-bold bg-white p-1 rounded-md border border-slate-200 block mt-1">{ticket.issueDescription}</span></p>
                      </div>

                      <div className="space-y-1 bg-white p-3 rounded-2xl border border-slate-200">
                        {isDispatched && (
                          <>
                            <p className="text-amber-900 font-bold">🛵 Coursier : {ticket.driverName} ({ticket.driverPhone})</p>
                            <p className="text-xs text-slate-700">Code Secret Échange OTP : <strong className="font-mono text-rose-700">{ticket.swapOtp}</strong></p>
                          </>
                        )}
                        {ticket.notes && <p className="text-[11px] text-slate-500 italic">Notes : {ticket.notes}</p>}
                      </div>
                    </div>

                    {/* Actions Row */}
                    {!isResolved && (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60">
                        <a
                          href={`tel:${ticket.customerPhone}`}
                          className="py-2 px-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-[11px] flex items-center space-x-1"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Appeler Client</span>
                        </a>

                        <a
                          href={whatsappClientUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-xl text-[11px] flex items-center space-x-1"
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-current" />
                          <span>WhatsApp Suivi</span>
                        </a>

                        {ticket.status === 'open' && (
                          <button
                            onClick={() => handleDispatchCourier(ticket.id, state.drivers[0]?.id || 'drv-1')}
                            className="py-2 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-[11px] flex items-center space-x-1 shadow-xs"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Assigner Coursier pour Échange</span>
                          </button>
                        )}

                        {isDispatched && (
                          <button
                            onClick={() => handleResolveTicket(ticket.id)}
                            className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-[11px] flex items-center space-x-1 shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Valider Échange Réussi & Clôturer</span>
                          </button>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}

        </div>

      </main>

      {/* Create SAV Modal */}
      {isCreateModalOpen && (
        <CreateSavTicketModal
          orders={deliveredOrders}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}

      <Footer />
      <BottomNav />
    </div>
  );
}
