import type { NextRequest } from 'next/server';
import { verifyActiveSession } from '@/lib/active-session';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { journaliserAction } from './journal';

/**
 * Journal automatique des actions admin (A2, 2026-09-27).
 *
 * Chaque gestionnaire POST/PUT/PATCH/DELETE de /api/admin est enveloppé :
 *
 *   export async function POST(req: NextRequest) {
 *     return avecJournal(req, 'POST /api/admin/payouts', () => postInterne(req));
 *   }
 *
 * Seule une action RÉUSSIE (statut < 400) d'un admin est inscrite : qui,
 * quelle action, quel dossier (déduit des identifiants envoyés), le motif et
 * un résumé des champs envoyés — secrets retirés (voir nettoyerDetails).
 * L'écriture du journal ne peut pas faire échouer l'action.
 */

const CLES_ID = [
  'dossier', 'orderId', 'orderNumber', 'productId', 'payoutId', 'driverId', 'profileId', 'userId', 'uid',
  'ticketId', 'packId', 'sponsorshipId', 'sponsorisationId', 'missionId', 'verificationId', 'demandeId', 'messageId',
  'storeId', 'boutiqueId', 'commissionId', 'paiementId', 'id', 'slug',
] as const;

const CLES_MOTIF = ['motif', 'raison', 'reason', 'note', 'commentaire'] as const;

/** « POST /api/admin/products/price » → « products/price ». */
export function typeDepuisCle(cle: string): string {
  return cle.split(' ')[1]?.replace(/^\/api\/admin\//, '') || 'admin';
}

/** Dossier concerné : premier identifiant trouvé dans le corps ou l'URL. */
export function extraireDossier(cle: string, corps: Record<string, unknown> | null, params: URLSearchParams): string | null {
  const type = typeDepuisCle(cle);
  for (const k of CLES_ID) {
    const v = corps?.[k] ?? params.get(k);
    if (typeof v === 'string' && v.trim()) return k === 'dossier' ? v.trim().slice(0, 160) : `${type}:${v.trim().slice(0, 120)}`;
    if (typeof v === 'number' && Number.isFinite(v)) return `${type}:${v}`;
  }
  const liste = corps?.orderIds;
  if (Array.isArray(liste) && liste.length) return `${type}:${liste.slice(0, 5).join(',')}${liste.length > 5 ? '…' : ''}`;
  return null;
}

export function extraireMotif(corps: Record<string, unknown> | null): string | null {
  for (const k of CLES_MOTIF) {
    const v = corps?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 500);
  }
  return null;
}

/** Résumé des champs envoyés : valeurs simples seulement, 20 champs au plus. */
export function resumeCorps(corps: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!corps || typeof corps !== 'object') return null;
  const sortie: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(corps).slice(0, 20)) {
    if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) sortie[k] = v;
    else if (Array.isArray(v)) sortie[k] = `[${v.length} élément${v.length > 1 ? 's' : ''}]`;
    else sortie[k] = '{…}';
  }
  return sortie;
}

export async function avecJournal(req: NextRequest, cle: string, traiter: () => Promise<Response>): Promise<Response> {
  let corps: Record<string, unknown> | null = null;
  if (req.method !== 'GET' && (req.headers.get('content-type') || '').includes('application/json')) {
    corps = await req.clone().json().catch(() => null);
  }
  const reponse = await traiter();
  if (reponse.status < 400) {
    try {
      const session = await verifyActiveSession(req.cookies.get(SESSION_COOKIE_NAME)?.value);
      const admin = getSupabaseAdmin();
      if (session?.role === 'admin' && admin) {
        await journaliserAction(admin, {
          auteurId: session.uid,
          action: cle,
          dossier: extraireDossier(cle, corps, req.nextUrl.searchParams),
          motif: extraireMotif(corps),
          apres: resumeCorps(corps),
        });
      }
    } catch (e) {
      console.error('[journal_admin]', (e as Error).message);
    }
  }
  return reponse;
}
