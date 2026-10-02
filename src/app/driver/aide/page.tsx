'use client';
import { useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import PageReseau from '@/components/reseau/PageReseau';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { Card, EmptyState } from '@/components/ui/Surface';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { useSugubaStore } from '@/lib/store';
import { whatsappHelper } from '@/lib/whatsapp-helper';

const MOTIFS = ['Fournisseur indisponible', 'Client absent', 'Client refuse le colis', 'Colis endommagé', 'Code de remise manquant'];

/**
 * Signaler un problème de course.
 *
 * LIV-05 (lot 6 de l'audit UI/UX du 2026-10-02) : la page était une seule ligne
 * de balises sans la coquille des autres écrans ; sans course en cours, le
 * formulaire restait affiché, inutilisable, avec une phrase sans issue. Ici :
 * même en-tête et même retour que le portefeuille, champs étiquetés, la course
 * choisie d'office quand il n'y en a qu'une, et sans course, un recours direct
 * (écrire à Suguba sur WhatsApp).
 */
export default function AideLivreur() {
  const state = useSugubaStore();
  const courses = state.orders.filter(o => ['dispatched', 'in_transit'].includes(o.status));
  const [orderId, setOrderId] = useState('');
  const [motif, setMotif] = useState('Client absent');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const courseChoisie = orderId || (courses.length === 1 ? courses[0].id : '');

  async function envoyer(e: React.FormEvent) {
    e.preventDefault(); if (busy || !courseChoisie) return; setBusy(true); setMessage(null);
    try {
      const r = await fetch('/api/driver/incident', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: courseChoisie, motif, detail }) });
      const d = await r.json();
      setMessage(r.ok
        ? { ok: true, texte: `Signalement enregistré (${d.ticketNumber}). L’équipe Suguba le voit et vous donne la suite ; la course reste inchangée en attendant.` }
        : { ok: false, texte: d.error || 'Échec du signalement.' });
    } catch { setMessage({ ok: false, texte: 'Connexion impossible. Réessayez.' }); } finally { setBusy(false); }
  }

  return (
    <PageReseau titre="Signaler un problème" sousTitre="L’équipe Suguba décide de la suite. Ce signalement ne valide ni livraison ni encaissement."
      retour={{ href: '/driver', libelle: 'Mes courses' }}>
      {courses.length === 0 ? (
        <EmptyState icone={LifeBuoy} titre="Aucune course en cours"
          texte="Le signalement se fait sur une course que vous livrez. Pour toute autre question, écrivez à Suguba."
          action={<>
            <Button href={whatsappHelper.getSupportChatLink()} variant="whatsapp" target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="w-5 h-5" />Écrire à Suguba</Button>
            <Button href="/driver" variant="ghost">Mes courses</Button>
          </>} />
      ) : (
        <Card>
          <form onSubmit={envoyer} className="space-y-4">
            <Field label="Course" htmlFor="incident-course" requis>
              <Select id="incident-course" required value={courseChoisie} onChange={e => setOrderId(e.target.value)}>
                {courses.length > 1 && <option value="">Choisir la course</option>}
                {courses.map(o => <option key={o.id} value={o.id}>{o.orderNumber} — {o.neighborhood}</option>)}
              </Select>
            </Field>
            <Field label="Problème rencontré" htmlFor="incident-motif">
              <Select id="incident-motif" value={motif} onChange={e => setMotif(e.target.value)}>
                {MOTIFS.map(m => <option key={m}>{m}</option>)}
              </Select>
            </Field>
            <Field label="Précisions (facultatif)" htmlFor="incident-detail">
              <Textarea id="incident-detail" maxLength={1000} rows={3} value={detail} onChange={e => setDetail(e.target.value)} />
            </Field>
            <Button type="submit" size="lg" fullWidth loading={busy} disabled={!courseChoisie}>Envoyer à Suguba</Button>
            {message && (
              <p role={message.ok ? 'status' : 'alert'} className={`rounded-2xl p-3 text-sm ${message.ok ? 'bg-suguba-menthe text-suguba-profond' : 'bg-rose-50 text-rose-800'}`}>
                {message.texte}
              </p>
            )}
          </form>
        </Card>
      )}
    </PageReseau>
  );
}
