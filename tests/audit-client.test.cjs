require('../scripts/test-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {PayoutCheckout}=require('../src/lib/payout-submit.ts');
const input={amount:5000,payoutProvider:'Orange Money',payoutPhone:'+22300000000'};
function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}}
test('TEST-AUD-RETRY : retrait double clic = une seule requête et un reçu serveur',async()=>{
 let count=0,resolve;const s=storage();const c=new PayoutCheckout('attempt',s,()=>{count++;return new Promise(r=>resolve=r)});
 const a=c.submit(input),b=c.submit(input);assert.equal(a,b);assert.equal(count,1);resolve(Response.json({success:true,withdrawalCode:'SERVER-ID'}));assert.equal((await a).withdrawalCode,'SERVER-ID');assert.equal(c.restore(),null);
});
test('TEST-AUD-RETRY : réponse perdue/rechargement = clé stable, modification interdite',async()=>{
 const s=storage();let key;const a=new PayoutCheckout('attempt',s,async(_,options)=>{key=JSON.parse(options.body).withdrawalCode;throw Error('réseau')});await assert.rejects(a.submit(input));
 const b=new PayoutCheckout('attempt',s,async(_,options)=>{assert.equal(JSON.parse(options.body).withdrawalCode,key);return Response.json({success:true,withdrawalCode:'SERVER-ID'})});
 await assert.rejects(b.submit({...input,amount:6000}),/Reprenez/);assert.equal((await b.submit()).withdrawalCode,'SERVER-ID');
});
test('TEST-AUD-RETRY : stockage bloqué, JSON invalide et refus proxy conservent une clé sûre',async()=>{
 let keys=[];const c=new PayoutCheckout('x',{getItem(){throw Error()},setItem(){throw Error()},removeItem(){throw Error()}},async(_,o)=>{keys.push(JSON.parse(o.body).withdrawalCode);return new Response('Proxy',{status:400})});
 await assert.rejects(c.submit(input));await assert.rejects(c.submit());assert.equal(keys[0],keys[1]);
 const s=storage();s.setItem('x','{bad');assert.equal(new PayoutCheckout('x',s).restore(),null);
});
test('TEST-AUD-FIELD : label, aide et erreur reliés au champ natif',()=>{
 const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const {Field,Input}=require('../src/components/ui/Field.tsx');
 const html=renderToStaticMarkup(React.createElement(Field,{label:'Nom',htmlFor:'nom',erreur:'Nom requis',requis:true},React.createElement(Input)));
 assert.match(html,/for="nom"/);assert.match(html,/id="nom"/);assert.match(html,/aria-describedby="nom-description"/);assert.match(html,/aria-invalid="true"/);assert.match(html,/id="nom-description" role="alert"/);
});
