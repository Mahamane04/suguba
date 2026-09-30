require('../scripts/test-typescript.cjs');
const { test }=require('node:test');const assert=require('node:assert/strict');
let principale;
const db={from(table){let single=false;const resultat=()=>({data:table==='suppliers'?{profile_id:'fournisseur',company_name:'Ancien',logo_url:'ancien.png',contact_phone:'privé',warehouse_address:'privé'}:table==='stores'?(single?principale:[principale]):[],error:null});const q={select(){return q;},eq(){return q;},order(){return q;},limit(){return q;},ilike(){return q;},maybeSingle(){single=true;return q;},then(resolve){return Promise.resolve(resultat()).then(resolve);}};return q;}};
require.cache[require.resolve('../src/lib/supabase-admin.ts')]={exports:{getSupabaseAdmin:()=>db}};
const {chargerBoutiqueFournisseur}=require('../src/lib/shop.ts');
test('TEST-UX-PROFILS-VITRINES : ancien lien suit l’identité principale et respecte sa fermeture',async()=>{
 principale={name:'Boutique actuelle',status:'active',logo_url:null,description:null};let b=await chargerBoutiqueFournisseur('ancien-lien');assert.equal(b.nom,'Boutique actuelle');assert.equal(b.logo,null);assert.equal(b.contact_phone,undefined);assert.equal(b.warehouse_address,undefined);
 principale.status='inactive';assert.equal(await chargerBoutiqueFournisseur('ancien-lien'),null);
});
test('TEST-UX-PROFILS-VITRINES : boutique secondaire active garde sa propre identité même si la principale est fermée',async()=>{
 principale={name:'Principale',status:'inactive'};
 const b=await chargerBoutiqueFournisseur('ancien-lien',{name:'Secondaire',status:'active',logo_url:'secondaire.png',cover_url:null,description:'Autre présentation'});
 assert.equal(b.nom,'Secondaire');assert.equal(b.logo,'secondaire.png');assert.equal(b.description,'Autre présentation');
});

test('TEST-UX-PROFILS-VITRINES : aucun WhatsApp fournisseur dans une boutique publique',async()=>{
 principale={id:'boutique',name:'Fournisseur',owner_type:'supplier',owner_id:'fournisseur',status:'active',whatsapp:'+22300000000'};
 const {boutiqueParSlug}=require('../src/lib/reseau/boutiques.ts');
 const b=await boutiqueParSlug('boutique');assert.equal(b.whatsapp,null);
 principale.owner_type='reseller';assert.equal((await boutiqueParSlug('boutique')).whatsapp,'+22300000000');
});
