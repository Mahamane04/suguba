'use client';
import { use, useCallback, useEffect, useState } from 'react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Surface';
import { Field, Input, Textarea } from '@/components/ui/Field';
import SugubaLoader from '@/components/ui/SugubaLoader';
import { useToast } from '@/components/ui/Toast';
interface Offre { name: string; description: string | null; stock: number; supplier_price: number; public_price: number; reseller_commission: number; commission_proposee: number | null; status: string; mode_prix?: string }
export default function ModifierOffre({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const { toast } = useToast();
  const [offre, setOffre] = useState<Offre | null>(null);
  const [nom, setNom] = useState(''); const [description, setDescription] = useState('');
  const [stock, setStock] = useState(''); const [part, setPart] = useState('');
  const [chargement, setChargement] = useState(true); const [erreur, setErreur] = useState(''); const [envoi, setEnvoi] = useState(false);
  const charger = useCallback(async () => {
    setChargement(true); setErreur('');
    try { const r = await fetch(`/api/supplier/products/${encodeURIComponent(id)}`); const d = await r.json(); if (!r.ok || !d.produit) throw new Error(d.error || 'Offre indisponible.');
      const p = d.produit; setOffre(p); setNom(p.name); setDescription(p.description || ''); setStock(String(p.stock)); setPart(p.commission_proposee == null ? '' : String(p.commission_proposee));
    } catch(e) { setErreur((e as Error).message); } finally { setChargement(false); }
  }, [id]);
  useEffect(() => { charger(); }, [charger]);
  const retiree = offre && ['rejected', 'archived'].includes(offre.status);
  async function enregistrer(e: React.FormEvent) {
    e.preventDefault(); if (envoi || !offre) return; setEnvoi(true);
    const commissionChangee = part !== (offre.commission_proposee == null ? '' : String(offre.commission_proposee));
    try { const r = await fetch(`/api/supplier/products/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nom, description, stock: Number(stock), ...(commissionChangee ? { partRevendeur: Number(part) } : {}), publier: !retiree && offre.status !== 'approved' }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Enregistrement impossible.');
      toast(d.publication && !d.publication.publie ? `Offre enregistrée. ${d.publication.raison}` : 'Offre enregistrée.', { ton: d.publication && !d.publication.publie ? 'info' : 'succes' }); await charger();
    } catch(e) { toast((e as Error).message, { ton: 'erreur' }); } finally { setEnvoi(false); }
  }
  return <PageReseau titre="Modifier mon offre" sousTitre="Vérifiez les informations avant l’enregistrement." retour={{href:'/supplier/inventory',libelle:'Mes produits'}}>
    {chargement ? <SugubaLoader/> : erreur ? <Card role="alert"><p>{erreur}</p><Button onClick={charger}>Réessayer</Button></Card> : offre && <>
      <Card className="space-y-2"><h2 className="font-bold">Prix et statut</h2><p className="text-sm">Mon prix fournisseur : {Number(offre.supplier_price).toLocaleString('fr-FR')} F.</p><p className="text-sm">{offre.status === 'approved' ? `En vente à ${Number(offre.public_price).toLocaleString('fr-FR')} F · gain revendeur ${Number(offre.reseller_commission).toLocaleString('fr-FR')} F` : retiree ? 'Offre retirée : seul Suguba peut la remettre en vente.' : 'Offre à vérifier avant sa mise en vente.'}</p><p className="text-xs text-slate-600">Suguba recalcule le prix public quand vous changez la part revendeur. Les anciennes commandes et l’adresse du produit sont conservées. Pour corriger le prix fournisseur, contactez Suguba depuis l’aide.</p></Card>
      <Card><form onSubmit={enregistrer} className="space-y-4">
        <Field label="Nom de l’offre" htmlFor="offre-nom" requis><Input id="offre-nom" value={nom} minLength={2} maxLength={120} onChange={e=>setNom(e.target.value)} required/></Field>
        <Field label="Présentation" htmlFor="offre-description"><Textarea id="offre-description" value={description} maxLength={4000} rows={4} onChange={e=>setDescription(e.target.value)}/></Field>
        <Field label="Quantité disponible" htmlFor="offre-stock" requis><Input id="offre-stock" type="number" min={0} max={100000} step={1} value={stock} onChange={e=>setStock(e.target.value)} required/></Field>
        {offre.mode_prix !== 'gros' && <Field label="Part revendeur (F)" htmlFor="offre-part" aide="Vide : conserver le réglage actuel. Une nouvelle part doit être positive."><Input id="offre-part" type="number" min={1} max={10000000} step={1} value={part} disabled={Boolean(retiree)} onChange={e=>setPart(e.target.value)}/></Field>}
        <Button type="submit" disabled={envoi} fullWidth>{envoi && <SugubaLoader/>}{envoi ? 'Enregistrement…' : offre.status === 'approved' || retiree ? 'Enregistrer les changements' : 'Enregistrer et vérifier la mise en vente'}</Button>
      </form></Card>
    </>}
  </PageReseau>;
}
