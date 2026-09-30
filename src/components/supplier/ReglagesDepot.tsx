'use client';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import NeighborhoodPicker from '@/components/common/NeighborhoodPicker';
import SugubaLoader from '@/components/ui/SugubaLoader';
import { Card } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';

export default function ReglagesDepot() {
  const { toast } = useToast();
  const [fiche, setFiche] = useState({ managerName: '', contactPhone: '', contactEmail: '', warehouseNeighborhood: '' });
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [positionChangee, setPositionChangee] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  async function charger() {
    setChargement(true); setErreur('');
    try {
      const r = await fetch('/api/supplier/me'); const d = await r.json();
      if (!r.ok || !d.supplier) throw new Error('Dépôt indisponible. Réessayez.');
      const f = d.supplier;
      setFiche({ managerName: f.managerName || '', contactPhone: f.contactPhone || '', contactEmail: f.contactEmail || '', warehouseNeighborhood: f.warehouseNeighborhood || '' });
      setPosition(f.positionDepot || null);
    } catch (e) { setErreur((e as Error).message); } finally { setChargement(false); }
  }
  useEffect(() => { charger(); }, []);
  async function enregistrer(e: React.FormEvent) {
    e.preventDefault(); if (envoi) return; setEnvoi(true);
    try {
      const r = await fetch('/api/supplier/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fiche, ...(positionChangee ? { positionDepot: position } : {}) }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Enregistrement impossible.');
      setPositionChangee(false); toast('Dépôt enregistré.', { ton: 'succes' });
    } catch (e) { toast((e as Error).message, { ton: 'erreur' }); } finally { setEnvoi(false); }
  }
  return <Card className="space-y-4 scroll-mt-24" id="depot">
    <h2 className="text-lg font-bold">Mon dépôt et mes coordonnées</h2>
    <p className="text-sm text-slate-600">Informations réservées à Suguba pour le ramassage et le suivi. Elles ne sont pas affichées aux clients ou aux revendeurs.</p>
    {chargement ? <SugubaLoader/> : erreur ? <div role="alert"><p>{erreur}</p><Button variant="ghost" onClick={charger}>Réessayer</Button></div> : <form onSubmit={enregistrer} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nom du gérant" htmlFor="depot-gerant"><Input id="depot-gerant" maxLength={80} value={fiche.managerName} onChange={e => setFiche(f => ({ ...f, managerName: e.target.value }))}/></Field>
        <Field label="Téléphone de contact" htmlFor="depot-telephone"><Input id="depot-telephone" type="tel" maxLength={30} value={fiche.contactPhone} onChange={e => setFiche(f => ({ ...f, contactPhone: e.target.value }))}/></Field>
      </div>
      <Field label="E-mail de contact" htmlFor="depot-email"><Input id="depot-email" type="email" maxLength={160} value={fiche.contactEmail} onChange={e => setFiche(f => ({ ...f, contactEmail: e.target.value }))}/></Field>
      <Field label="Quartier du dépôt" htmlFor="depot-quartier" aide="Point de départ des livraisons. Depuis le dépôt, vous pouvez indiquer votre position exacte."><NeighborhoodPicker id="depot-quartier" value={fiche.warehouseNeighborhood} onChange={q => setFiche(f => ({ ...f, warehouseNeighborhood: q }))} onPosition={p => { setPosition(p); setPositionChangee(true); }}/></Field>
      <p className="text-xs text-slate-600">{position ? positionChangee ? 'Nouvelle position à enregistrer.' : 'Position exacte enregistrée.' : 'Position exacte non renseignée : le centre du quartier est utilisé.'}</p>
      <Button type="submit" disabled={envoi}>{envoi ? <SugubaLoader/> : null}{envoi ? 'Enregistrement…' : 'Enregistrer le dépôt'}</Button>
    </form>}
  </Card>;
}
