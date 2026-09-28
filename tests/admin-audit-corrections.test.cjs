require('../scripts/test-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {syntheseFinance}=require('../src/lib/admin/finance.ts');
const {fusionnerBrouillon}=require('../src/lib/admin/settings-draft.ts');
const commande={id:'o',order_number:'SG-TEST',product_name:'Test',reseller_name:'Test',created_at:'2026-09-24T12:00:00Z',delivered_at:'2026-09-28T12:00:00Z',status:'delivered',payment_collected:false,quantity:2,total_product_amount:1000,total_amount:1000,delivery_fee:0,reseller_commission:100,pricing_snapshot:{devis:{tarif:{prixFournisseur:600},remise:0}}};
test('TEST-AUD-103 : livraison gratuite, perte visible et coût historique',()=>{
 const f=syntheseFinance([commande],[]);assert.equal(f.livraison,0);assert.equal(f.margeCommerciale,-300);assert.equal(f.encaisseSurLivrees,0);assert.equal(f.commissionsCommandes,100);assert.equal(f.grandLivre.paid,0);
 const autre={...commande,pricing_snapshot:{devis:{tarif:{prixFournisseur:200},remise:50}}};assert.equal(syntheseFinance([autre],[]).margeCommerciale,450);
});
test('TEST-AUD-104 : création et livraison portent des dates distinctes, UTC inclusif',()=>{
 const f=syntheseFinance([commande],[],'2026-09-28','2026-09-28');assert.equal(f.creees,0);assert.equal(f.livrees,1);
 assert.equal(syntheseFinance([{...commande,delivered_at:'2026-09-28T23:59:59.999Z'}],[],'2026-09-28','2026-09-28').livrees,1);
 assert.equal(syntheseFinance([{...commande,delivered_at:'2026-09-29T00:00:00Z'}],[],'2026-09-28','2026-09-28').livrees,0);
 const absent=syntheseFinance([{...commande,delivered_at:null}],[],'2026-09-28','2026-09-28');assert.equal(absent.livrees,0);assert.equal(absent.livraisonsSansDate,1);
});
test('TEST-AUD-103 : snapshot absent donne une marge inconnue, jamais coût zéro inventé',()=>{
 const f=syntheseFinance([{...commande,pricing_snapshot:null}],[]);assert.equal(f.margesInconnues,1);assert.equal(f.lignes[0].margeCommerciale,null);
});
test('TEST-AUD-105 : sommes du grand-livre distinctes et commission liée à la commande',()=>{
 const f=syntheseFinance([commande],[{id:'a',order_id:'o',status:'locked',amount:42,unlock_at:'2026-09-30T00:00:00Z'},{status:'paid',amount:12},{status:'reversed',amount:9},{status:'reserved',amount:5}]);
 assert.equal(f.grandLivre.locked,42);assert.equal(f.grandLivre.paid,12);assert.equal(f.grandLivre.reversed,9);assert.equal(f.verrouillees[0].resellerName,'Test');assert.equal(f.verrouillees.length,1);
});
test('TEST-AUD-110 : une sauvegarde ne remplace pas les champs non édités',()=>{
 const base={commission:8,livraison:1500};assert.deepEqual(fusionnerBrouillon({commission:8,livraison:2000},base,{commission:10,livraison:1500}),{commission:10,livraison:2000});
 assert.throws(()=>fusionnerBrouillon({commission:12,livraison:1500},base,{commission:10,livraison:1500}),/autre membre/);
 assert.deepEqual(fusionnerBrouillon({commission:10,livraison:2000},base,{commission:10,livraison:1500}),{commission:10,livraison:2000});
});
let panne=false;let updates=0;let dossier={id:'v',profile_id:'p',kind:'identity',status:'pending',document_url:null};
const adapter={from(table){let one=false,patch=null;const query={select(){return query},eq(){return query},in(){return query},order(){return query},range(){return query},maybeSingle(){one=true;return query},update(p){patch=p;return query},then(ok,ko){if(patch)updates++;return Promise.resolve({data:panne?null:table==='verification_requests'?(one?dossier:[dossier]):[],error:panne?{message:'panne'}:null}).then(ok,ko)}};return query}};
require.cache[require.resolve('../src/lib/supabase-admin.ts')]={exports:{getSupabaseAdmin:()=>adapter}};
const {fileDattente,deciderVerification}=require('../src/lib/reseau/verifications-db.ts');
test('TEST-AUD-101 : panne vérifications levée, jamais liste vide',async()=>{panne=true;await assert.rejects(()=>fileDattente(),/indisponibles/);panne=false;});
test('TEST-AUD-102 : pas de décision sans constat ni identité sans document',async()=>{
 updates=0;let r=await deciderVerification({demandeId:'v',decision:'approved',adminId:'a'});assert.equal(r.ok,false);
 r=await deciderVerification({demandeId:'v',decision:'approved',note:'Pièce vérifiée',adminId:'a'});assert.equal(r.ok,false);assert.match(r.erreur,/manquant/);assert.equal(updates,0);
 dossier={...dossier,status:'approved'};r=await deciderVerification({demandeId:'v',decision:'rejected',note:'À compléter',adminId:'a'});assert.equal(r.ok,false);assert.equal(updates,0);
});
