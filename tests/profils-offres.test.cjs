require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
let allowed, source, writes, filters, fault, matched, publications;
require.cache[require.resolve('../src/lib/reseau/contexte-fournisseur.ts')] = { exports: { exigerDroitFournisseur: async () => allowed ? { ok:true,contexte:{fournisseurId:'proprietaire'} } : { ok:false,erreur:'Refusé',statut:403 }, contexteFournisseur: async () => ({ fournisseurId: 'proprietaire', droits: ['catalogue'] }) } };
require.cache[require.resolve('../src/lib/publication-auto.ts')] = { exports: { publierAutomatiquement: async (_,id) => { publications.push(id); return { publie:true,prix:45000,commission:4000 }; } } };
const db = { from(table) { assert.equal(table,'products'); let mutation = false;
 const q = {then(resolve){return Promise.resolve({error:fault}).then(resolve);},select(){return q;},eq(k,v){filters.push([k,v]);return q;},insert(v){mutation=true;writes.push(v);return q;},update(v){mutation=true;writes.push(v);return q;},async maybeSingle(){return {data:mutation?(matched?{id:writes.at(-1).id||'offre'}:null):source,error:fault};}};return q;
} };
require.cache[require.resolve('../src/lib/supabase-admin.ts')] = { exports:{ getSupabaseAdmin:()=>db } };
const {GET,POST,PATCH}=require('../src/app/api/supplier/products/[id]/route.ts');
const ctx={params:Promise.resolve({id:'offre'})};
const req=(body={},method='PATCH')=>new NextRequest('http://localhost/api/supplier/products/offre',{method,body:JSON.stringify(body)});
function reset(){allowed=true;source={id:'offre',slug:'adresse-partagee',supplier_price:20000,commission_proposee:3000,status:'approved',name:'Téléviseur',stock:5,images:['photo'],mode_commande:'devis',etapes:[{titre:'Installation'}],quantite_min:2};writes=[];filters=[];fault=null;matched=true;publications=[];}
test('TEST-UX-PROFILS-OFFRES : permissions et propriétaire obligatoires',async()=>{
 reset();allowed=false;assert.equal((await GET(req({},'POST'),ctx)).status,403);assert.equal(writes.length,0);
 reset();source=null;assert.equal((await POST(req({},'POST'),ctx)).status,404);assert.equal(writes.length,0);
 assert.ok(filters.some(([k,v])=>k==='supplier_id'&&v==='proprietaire'));
});
test('TEST-UX-PROFILS-OFFRES : copie isolée à stock zéro, aucun montant ou statut accepté du navigateur',async()=>{
 reset();const r=await POST(req({supplier_price:1,public_price:1,status:'approved'},'POST'),ctx);assert.equal(r.status,201);
 const p=writes[0];assert.equal(p.supplier_price,20000);assert.equal(p.stock,0);assert.equal(p.status,'draft');assert.equal(p.public_price,0);assert.equal(p.reseller_commission,0);assert.equal(p.mode_commande,'devis');assert.equal(p.quantite_min,2);assert.deepEqual(p.etapes,source.etapes);assert.notEqual(p.slug,source.slug);assert.notEqual(p.id,source.id);assert.equal(publications.length,0);
});
test('TEST-UX-PROFILS-OFFRES : une offre retirée ne peut pas contourner l’admin par duplication ou publication',async()=>{
 for(const status of ['rejected','archived']){reset();source.status=status;assert.equal((await POST(req({},'POST'),ctx)).status,409);assert.equal((await PATCH(req({publier:true}),ctx)).status,409);assert.equal((await PATCH(req({partRevendeur:4000}),ctx)).status,409);assert.equal(writes.length,0);}
});
test('TEST-UX-PROFILS-OFFRES : aucun prix navigateur, descriptif sans changement d’adresse, part recalculée serveur',async()=>{
 reset();assert.equal((await PATCH(req({supplier_price:1}),ctx)).status,400);assert.equal(writes.length,0);
 reset();assert.equal((await PATCH(req({nom:'Nouveau nom',stock:8}),ctx)).status,200);assert.deepEqual(writes[0],{name:'Nouveau nom',stock:8});assert.equal(publications.length,0);
 reset();assert.equal((await PATCH(req({partRevendeur:4000}),ctx)).status,200);assert.deepEqual(writes[0],{commission_proposee:4000,status:'submitted',public_price:0,reseller_commission:0});assert.deepEqual(publications,['offre']);assert.ok(filters.some(([k,v])=>k==='status'&&v==='approved'));
});
test('TEST-UX-PROFILS-OFFRES : validation du stock, conflit concurrent et écriture échouée sans faux succès',async()=>{
 for(const stock of [-1,1.5,'5',100001]){reset();assert.equal((await PATCH(req({stock}),ctx)).status,400);assert.equal(writes.length,0);}
 reset();matched=false;assert.equal((await PATCH(req({stock:5}),ctx)).status,409);
 reset();fault={message:'panne'};assert.equal((await POST(req({},'POST'),ctx)).status,503);
});

require.cache[require.resolve('../src/lib/active-session.ts')]={exports:{verifyActiveSession:async()=>({uid:'proprietaire',role:'supplier'})}};
require.cache[require.resolve('../src/lib/reseau/permission-admin.ts')]={exports:{refusSansPermissionAdmin:async()=>null}};
test('TEST-UX-PROFILS-OFFRES : changer les photos d’une copie ne la publie pas avant vérification',async()=>{
 reset();source.status='draft';source.supplier_id='proprietaire';
 const photos=require('../src/app/api/products/images/route.ts').POST;
 const r=await photos(req({productId:'offre',images:[]},'POST'));
 assert.equal(r.status,200);assert.equal((await r.json()).publication.publie,false);assert.equal(publications.length,0);assert.deepEqual(writes,[{images:[]}]);
});
