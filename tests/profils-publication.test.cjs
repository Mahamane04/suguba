require('../scripts/test-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {REGLAGES_PAR_DEFAUT}=require('../src/lib/pricing.ts');
let notifications=0,matched=true,filters=[];
require.cache[require.resolve('../src/lib/platform-settings.ts')]={exports:{chargerReglages:async()=>({reglages:REGLAGES_PAR_DEFAUT})}};
require.cache[require.resolve('../src/lib/reseau/notifications.ts')]={exports:{annoncerNouveauProduit:async()=>{notifications++;}}};
const admin={from(){let update=false;const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},update(){update=true;return q;},async maybeSingle(){return {data:update?(matched?{id:'offre'}:null):{id:'offre',status:'submitted',supplier_price:20000,commission_proposee:4000,images:['photo']},error:null};}};return q;}};
const {publierAutomatiquement}=require('../src/lib/publication-auto.ts');
test('TEST-UX-PROFILS-PUBLICATION : aucune annonce ni faux prix publié en cas de retrait concurrent',async()=>{
 matched=false;notifications=0;filters=[];const r=await publierAutomatiquement(admin,'offre');assert.equal(r.publie,false);assert.equal(r.prix,undefined);assert.equal(notifications,0);assert.ok(filters.some(([k,v])=>k==='status'&&v==='submitted'));
 matched=true;const ok=await publierAutomatiquement(admin,'offre');assert.equal(ok.publie,true);assert.ok(ok.prix>20000);assert.equal(ok.commission,4000);assert.equal(notifications,1);
});
