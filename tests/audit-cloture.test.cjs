require('../scripts/test-typescript.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {recu}=require('../src/lib/order-create.ts');
test('TEST-AUD-CLOSE-01 : le reçu et sa reprise ne divulguent jamais le code, même au créateur',()=>{
 const row={id:'fictif',order_number:'SG-FICTIF',delivery_otp:'4321',pricing_snapshot:{devis:{},panier:{cartId:'cart-fictif',groupeLivraison:'supplier-private'}}};
 const receipt=recu(row);assert.equal(receipt.deliveryOtp,undefined);assert.ok(!JSON.stringify(receipt).includes('4321'));assert.ok(!JSON.stringify(receipt).includes('supplier-private'));assert.equal(typeof receipt.deliveryGroup,'string');
});

test('TEST-AUD-CLOSE-07 : erreur et double clic SMS, reprise et absence de preuve',async()=>{
 const {rememberOrderAccess,clearPrivateSessionStorage}=require('../src/lib/order-access-client.ts');const {requestDeliverySms}=require('../src/lib/delivery-sms-client.ts');rememberOrderAccess('SG-LOCAL','fictional-receipt');let calls=0,resolve;
 const send=()=>{calls++;return new Promise(r=>resolve=r)};const a=requestDeliverySms('SG-LOCAL',false,send),b=requestDeliverySms('SG-LOCAL',false,send);assert.equal(a,b);assert.equal(calls,1);resolve(Response.json({success:false,error:'Panne'},{status:503}));assert.equal((await a).success,false);
 assert.equal((await requestDeliverySms('SG-LOCAL',true,async()=>Response.json({success:true}))).success,true);
 clearPrivateSessionStorage();assert.equal((await requestDeliverySms('SG-LOCAL',true,()=>{throw Error('Aucun appel sans reçu')})).success,false);
});
test('TEST-AUD-CLOSE-08 : déconnexion pendant création = pas de reçu privé réinjecté',async()=>{
 const {soumettreCommande}=require('../src/lib/order-submit.ts');const {clearPrivateSessionStorage,orderAccessKey}=require('../src/lib/order-access-client.ts');const old=global.fetch;let resolve;
 global.fetch=()=>new Promise(r=>resolve=r);
 try{const pending=soumettreCommande({key:'local-attempt',input:{productId:'p',quantity:1,customerName:'Client fictif',customerPhone:'+22370000000',city:'Bamako',neighborhood:'ACI 2000',landmark:'Repère fictif'}});clearPrivateSessionStorage();resolve(Response.json({success:true,order:{id:'id',orderNumber:'SG-PRIVATE',creationConfirmed:true}}));await assert.rejects(pending,/session a changé/);assert.equal(orderAccessKey('SG-PRIVATE'),undefined);}finally{global.fetch=old;}
});
test('TEST-AUD-CLOSE-09 : choix accessible relié au label, à l’erreur et à sa liste',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const {Field}=require('../src/components/ui/Field.tsx');const Choice=require('../src/components/ui/ChoicePicker.tsx').default;
 const html=renderToStaticMarkup(React.createElement(Field,{htmlFor:'ville',label:'Ville',erreur:'Choisissez une ville',requis:true},React.createElement(Choice,{valeur:'',choix:[{valeur:'Bamako',libelle:'Bamako'}],onChange:()=>{}})));
 assert.match(html,/role="combobox"/);assert.match(html,/aria-controls="ville-options"/);assert.match(html,/aria-describedby="ville-description"/);assert.match(html,/aria-invalid="true"/);assert.match(html,/aria-required="true"/);assert.match(html,/role="listbox"/);assert.match(html,/role="option"/);
});
test('TEST-AUD-CLOSE-10 : réponse SMS tardive après déconnexion jamais mise en cache comme succès',async()=>{
 const {rememberOrderAccess,clearPrivateSessionStorage}=require('../src/lib/order-access-client.ts');const {requestDeliverySms}=require('../src/lib/delivery-sms-client.ts');let resolve;
 rememberOrderAccess('SG-LATE','fictional-proof');const pending=requestDeliverySms('SG-LATE',false,()=>new Promise(r=>resolve=r));clearPrivateSessionStorage();resolve(Response.json({success:true}));assert.equal((await pending).success,false);
 rememberOrderAccess('SG-LATE','fictional-proof');let calls=0;assert.equal((await requestDeliverySms('SG-LATE',false,async()=>{calls++;return Response.json({success:true})})).success,true);assert.equal(calls,1);clearPrivateSessionStorage();
});
test('TEST-AUD-CLOSE-11 : chargements concurrents et reconnexion du même compte ne réinjectent pas des commandes obsolètes',async()=>{
 const {sugubaStore}=require('../src/lib/store.ts');const {cloudSyncService}=require('../src/lib/cloud-sync.ts');const old=global.fetch;let replies=[];global.fetch=()=>new Promise(r=>replies.push(r));const identity={id:'reseller-local',role:'reseller',fullName:'Compte fictif'};
 try{
  sugubaStore.definirUtilisateur(identity);const first=cloudSyncService.fetchOrdersFromCloud(),second=cloudSyncService.fetchOrdersFromCloud();replies[1](Response.json({cloud:true,orders:[{id:'new',order_number:'SG-NEW'}]}));await second;replies[0](Response.json({cloud:true,orders:[{id:'stale',order_number:'SG-OLD'}]}));await first;assert.equal(sugubaStore.getState().orders[0].id,'new');
  const late=cloudSyncService.fetchOrdersFromCloud();sugubaStore.definirUtilisateur(null,true);sugubaStore.definirUtilisateur(identity);replies[2](Response.json({cloud:true,orders:[{id:'private-old',order_number:'SG-PRIVATE'}]}));await late;assert.equal(sugubaStore.getState().orders.length,0);
  global.fetch=async()=>Response.json({error:'Indisponible'},{status:503});await cloudSyncService.fetchOrdersFromCloud();assert.equal(sugubaStore.getState().ordersSync,'error');
  global.fetch=async()=>Response.json({cloud:true,orders:[]});await cloudSyncService.fetchOrdersFromCloud();assert.equal(sugubaStore.getState().ordersSync,'ready');
  global.fetch=async()=>Response.json({error:'Refus'},{status:403});await cloudSyncService.fetchOrdersFromCloud();assert.equal(sugubaStore.getState().ordersSync,'forbidden');assert.deepEqual(sugubaStore.getState().orders,[]);
 }finally{global.fetch=old;sugubaStore.definirUtilisateur(null,true);}
});
test('TEST-AUD-CLOSE-12 : SMS de colis sans montant trompeur d’une seule ligne ni contenu produit injecté',async()=>{
 const {smsGateway}=require('../src/lib/sms-gateway.ts');const old=smsGateway.sendPlainSms;let message;
 smsGateway.sendPlainSms=async(phone,text)=>{assert.equal(phone,'+22370000000');message=text;return {success:true}};
 try{await smsGateway.sendDeliveryOtpSms({toPhone:'70000000',orderNumber:'SG-FICTIF',productName:'NOM NON DESTINE AU SMS',deliveryOtp:'4321',totalAmount:123});assert.match(message,/SG-FICTIF/);assert.match(message,/4321/);assert.match(message,/verification du colis/);assert.ok(!message.includes('123'));assert.ok(!message.includes('NOM NON DESTINE'));}finally{smsGateway.sendPlainSms=old}
});
