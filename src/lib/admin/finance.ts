/** REQ-AUD-003/004/005. Historical amounts only; no current product prices. */
export function syntheseFinance(orders: any[], commissions: any[], debut?: string, fin?: string) {
  const nombre = (v: unknown) => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
  const inclus = (date: string | null) => !!date && Number.isFinite(Date.parse(date)) && (!debut || Date.parse(date) >= Date.parse(`${debut}T00:00:00.000Z`)) && (!fin || Date.parse(date) < Date.parse(`${fin}T00:00:00.000Z`) + 86_400_000);
  const creees = orders.filter(o => inclus(o.created_at));
  const livrees = orders.filter(o => o.status === 'delivered' && ((!debut && !fin) || inclus(o.delivered_at)));
  const lignes = livrees.map(o => {
    const pf = nombre(o.pricing_snapshot?.devis?.tarif?.prixFournisseur);
    const articles = nombre(o.total_product_amount);
    const commission = nombre(o.reseller_commission);
    const remise = nombre(o.pricing_snapshot?.devis?.remise) ?? 0;
    return { id: String(o.id), numero: String(o.order_number), produit: String(o.product_name || ''), date: o.delivered_at || null,
      total: nombre(o.total_amount), livraison: nombre(o.delivery_fee), commission,
      margeCommerciale: pf !== null && articles !== null && commission !== null ? articles - pf * Number(o.quantity) - commission - remise : null,
      encaissee: o.payment_collected === true };
  });
  const somme = (cle: 'total'|'livraison'|'commission'|'margeCommerciale', liste = lignes) => liste.reduce((n,o)=>n+(o[cle] ?? 0),0);
  const grandLivre = Object.fromEntries(['pending','locked','available','reserved','paid','reversed'].map(s=>[s, commissions.filter(c=>c.status===s).reduce((n,c)=>n+(nombre(c.amount)??0),0)]));
  const verrouillees = commissions.filter(c=>c.status==='locked').map(c=>{
    const o=orders.find(o=>o.id===c.order_id);
    return { id:c.id, resellerName:o?.reseller_name || 'Revendeur', productName:o?.product_name || c.order_number || 'Commande', amount:nombre(c.amount)??0, unlockAt:c.unlock_at || null, safetyWindowDays: c.safety_window_days ?? null };
  });
  return { creees:creees.length, volumeCree:creees.reduce((n,o)=>n+(nombre(o.total_amount)??0),0), livrees:livrees.length,
    volumeLivre:somme('total'), livraison:somme('livraison'), commissionsCommandes:somme('commission'), margeCommerciale:somme('margeCommerciale'),
    margesInconnues:lignes.filter(o=>o.margeCommerciale===null).length,
    encaisseSurLivrees:somme('total',lignes.filter(o=>o.encaissee)),
    livraisonsSansDate:orders.filter(o=>o.status==='delivered'&&!o.delivered_at).length,
    enAttente:orders.filter(o=>o.status==='pending_call').length, enLivraison:orders.filter(o=>['dispatched','in_transit'].includes(o.status)).length,
    grandLivre, verrouillees, lignes };
}
export type Finance = ReturnType<typeof syntheseFinance>;
