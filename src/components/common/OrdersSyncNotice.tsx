'use client';
import { useSugubaStore } from '@/lib/store';
import { cloudSyncService } from '@/lib/cloud-sync';
import Button from '@/components/ui/Button';
/** Un zéro local ne constitue pas une confirmation de l’absence de commandes. */
export default function OrdersSyncNotice() {
  const state=useSugubaStore();
  if(!['admin','driver','reseller'].includes(state.currentUser.role) || state.ordersSync==='ready') return null;
  const loading=state.ordersSync==='loading' || state.ordersSync==='idle';
  return <aside role={loading?'status':'alert'} className="mx-auto w-full max-w-5xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 space-y-2">
    <p>{loading ? 'Chargement des commandes… Les totaux ne sont pas encore confirmés.' : state.ordersSync==='forbidden' ? 'Votre accès aux commandes a expiré ou a été retiré. Reconnectez-vous pour vérifier vos droits.' : 'Commandes indisponibles. Les listes et totaux affichés ne sont pas à jour.'}</p>
    {!loading && <Button variant="ghost" onClick={()=>void cloudSyncService.fetchOrdersFromCloud()}>Réessayer le chargement</Button>}
  </aside>;
}
