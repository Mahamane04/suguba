'use client';
import SugubaLoader from '@/components/ui/SugubaLoader';
import { useSugubaStore } from '@/lib/store';
import { cloudSyncService } from '@/lib/cloud-sync';
import Button from '@/components/ui/Button';
/** Un zéro local ne constitue pas une confirmation de l’absence de commandes. */
export default function OrdersSyncNotice() {
  const state=useSugubaStore();
  if(!['admin','driver','reseller'].includes(state.currentUser.role) || state.ordersSync==='ready') return null;
  const loading=state.ordersSync==='loading' || state.ordersSync==='idle';
  // Pendant le chargement : pastille flottante, hors du flux. Dans le flux, elle
  // apparaissait puis disparaissait et décalait toute la page deux fois (CLS de
  // 0,17 sur /driver et /reseller, audit 2026-10-01). L'erreur reste dans le flux.
  if(loading) return <aside role="status" className="fixed z-40 left-1/2 -translate-x-1/2 bottom-24 max-w-[calc(100%-2rem)] rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-950 shadow-lg">
    <SugubaLoader className="mr-2 h-4 w-4 align-middle" />Chargement des commandes… Les totaux ne sont pas encore confirmés.
  </aside>;
  return <aside role={loading?'status':'alert'} className="mx-auto w-full max-w-5xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 space-y-2">
    <p>{loading ? <><SugubaLoader className="mr-2 h-5 w-5 align-middle" />Chargement des commandes… Les totaux ne sont pas encore confirmés.</> : state.ordersSync==='forbidden' ? 'Votre accès aux commandes a expiré ou a été retiré. Reconnectez-vous pour vérifier vos droits.' : 'Commandes indisponibles. Les listes et totaux affichés ne sont pas à jour.'}</p>
    {!loading && <Button variant="ghost" onClick={()=>void cloudSyncService.fetchOrdersFromCloud()}>Réessayer le chargement</Button>}
  </aside>;
}
