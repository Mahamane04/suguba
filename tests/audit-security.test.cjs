// Tests du vrai code serveur ; transport isolé, assertions SQL dans audit-transactions.
require('../scripts/test-typescript.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const sharp = require('sharp');
process.env.SESSION_SECRET='local-test-only-no-real-secret';
global.fetch=async()=>{throw Error('External network forbidden')};
let state={}, faults={}, calls=[], rpcValues={};
const adapter={from(table){let op='select',patch,filters=[],one=false;const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},gte(){return q},order(){return q},limit(){return q},update(p){op='update';patch=p;return q},insert(p){op='insert';patch=p;return q},delete(){op='delete';return q},maybeSingle(){one=true;return q},then(resolve,reject){calls.push({table,op,patch});if(faults[table+':'+op])return Promise.resolve({data:null,error:{code:'TEST_FAILURE'}}).then(resolve,reject);let rows=(state[table]||[]).filter(r=>filters.every(f=>f(r)));if(op==='update')rows.forEach(r=>Object.assign(r,patch));if(op==='insert'){rows=[patch];(state[table]||=[]).push(patch)}return Promise.resolve({data:one?(rows[0]?{...rows[0]}:null):rows.map(r=>({...r})),count:rows.length,error:null}).then(resolve,reject)}};return q},async rpc(name,args){calls.push({rpc:name,args});if(faults[name])return {data:null,error:{code:'TEST_FAILURE'}};if(name==='track_order')return {data:(state.orders||[]).filter(o=>o.order_number===args.p_order_number&&o.customer_phone===args.p_customer_phone).map(o=>({...o})),error:null};return {data:rpcValues[name]??null,error:null}},storage:{from(){return {async upload(path,buffer,options){calls.push({upload:true,path,buffer,options});return {error:null}},getPublicUrl(){return {data:{publicUrl:'http://localhost/fake.webp'}}}}}}};
require.cache[require.resolve('../src/lib/supabase-admin.ts')]={exports:{getSupabaseAdmin:()=>adapter}};
require.cache[require.resolve('../src/lib/saspay.ts')]={exports:{estReseau:n=>['orange_ml','moov_ml'].includes(n),estReseauGlobal:()=>false,RESEAUX_MALI:{orange_ml:'Orange',moov_ml:'Moov'},RESEAUX_GLOBAUX:{},initierPayin:async p=>{calls.push({payin:p});return {ok:true,id:'fake-tx',statut:'PENDING'}},verifierPayin:async()=>({ok:true,statut:'SUCCESS'})}};
require.cache[require.resolve('../src/lib/cloud-sync.ts')]={exports:{cloudSyncService:{}}};
const {NextRequest}=require('next/server');
const {createSessionToken,verifySessionToken}=require('../src/lib/session.ts');
const active = require('../src/lib/active-session.ts').verifyActiveSession;
function profile(uid,role,status='active'){state.profiles.push({id:uid,role,status,phone:'+22300000000'});state.profile_roles.push({profile_id:uid,role,status})}
function reset(){state={profiles:[],profile_roles:[],admin_team_members:[]};faults={};calls=[];rpcValues={};for(const role of ['driver','supplier','reseller','admin','customer'])profile('test-'+role,role);state.admin_team_members=[{profile_id:'test-admin',team_role:'super_admin',permissions:[]}];}
const token=(role,uid='test-'+role,status='active')=>createSessionToken({uid,phone:'+22300000000',role,status});
async function req(url,body,role,uid){const headers={'Content-Type':'application/json'};if(role)headers.cookie='suguba_session='+await token(role,uid);return new NextRequest('http://localhost'+url,{method:body===undefined?'GET':'POST',headers,...(body===undefined?{}:{body:JSON.stringify(body)})})}
const order=()=>({id:'test-order',order_number:'SG-ABCDEFGH',customer_phone:'+22300000000',customer_name:'Client fictif',product_id:'test-product',product_name:'Article fictif',status:'in_transit',assigned_driver_id:'test-driver',reseller_id:null,delivery_otp:'4321',pickup_code:'8765',failed_otp_attempts:0,payment_collected:false,total_amount:25000});
test('TEST-AUD-S1 : le feed légitime du livreur ne révèle aucun code secret, ni le suivi public',async()=>{
 reset();state.orders=[order()];const f=await require('../src/app/api/orders/feed/route.ts').GET(await req('/api/orders/feed',undefined,'driver'));assert.equal(f.status,200);const row=(await f.json()).orders[0];assert.equal(row.delivery_otp,undefined);
 const route=require('../src/app/api/orders/track/route.ts').POST;const response=await route(await req('/api/orders/track',{orderNumber:row.order_number,phone:row.customer_phone}));assert.equal(response.status,200);assert.equal((await response.json()).commande.deliveryOtp,undefined);
 const key=randomUUID();state.order_creation_requests=[{key_hash:createHash('sha256').update(key).digest('hex'),receipt:{order_number:row.order_number}}];
 const good=await route(await req('/api/orders/track',{orderNumber:row.order_number,phone:row.customer_phone,accessKey:key}));assert.equal((await good.json()).commande.deliveryOtp,undefined); // Le reçu n’est jamais une preuve de possession du téléphone.
 const wrong=await route(await req('/api/orders/track',{orderNumber:row.order_number,phone:row.customer_phone,accessKey:randomUUID()}));assert.equal((await wrong.json()).commande.deliveryOtp,undefined);
});
test('TEST-AUD-S3 : cookie actif ancien refusé après suspension, suppression ou retrait du rôle',async()=>{
 reset();const t=await token('driver');assert.equal((await active(t)).uid,'test-driver');
 state.profiles.find(p=>p.id==='test-driver').status='suspended';assert.equal(await active(t),null);
 state.profiles.find(p=>p.id==='test-driver').status='active';state.profile_roles.find(p=>p.profile_id==='test-driver').status='rejected';assert.equal(await active(t),null);
 state.profiles=state.profiles.filter(p=>p.id!=='test-driver');assert.equal(await active(t),null);
});
test('TEST-AUD-S3 : onboarding pending légitime, opérations privées refusées, panne fermée',async()=>{
 reset();state.profiles.find(p=>p.id==='test-supplier').status='pending_approval';state.profile_roles.find(p=>p.profile_id==='test-supplier').status='pending_approval';const t=await token('supplier');assert.equal(await active(t),null);assert.equal((await active(t,true)).status,'pending_approval');
 faults['profile_roles:select']=true;assert.equal(await active(t,true),null);
 const response=await require('../src/app/api/orders/feed/route.ts').GET(await req('/api/orders/feed',undefined,'supplier'));assert.equal(response.status,401);
});
test('TEST-AUD-S3 : aperçu conservé seulement pour un administrateur encore autorisé',async()=>{
 reset();const t=await createSessionToken({uid:'apercu-supplier',phone:'+22300000093',role:'supplier',status:'active',apercu:{depuis:{uid:'test-admin',phone:'+22300000000'}}});
 assert.equal((await active(t)).uid,'apercu-supplier');state.admin_team_members[0].team_role='support';assert.equal(await active(t),null);
});
test('TEST-AUD-S4 : permission explicite, refus limité/absent, refus de panne',async()=>{
 reset();const {adminPeut,estAdministrateurGeneral}=require('../src/lib/reseau/db.ts');assert.equal(await adminPeut('test-admin','finance.payer'),true);assert.equal(await estAdministrateurGeneral('test-admin'),true);
 state.admin_team_members[0].team_role='support';assert.equal(await adminPeut('test-admin','finance.payer'),false);assert.equal(await adminPeut('test-admin','commande.lire'),true);
 faults['admin_team_members:select']=true;assert.equal(await adminPeut('test-admin','finance.payer'),false);assert.equal(await estAdministrateurGeneral('test-admin'),false);faults={};state.admin_team_members=[];assert.equal(await adminPeut('test-admin','finance.payer'),false);
});
test('TEST-AUD-STATE : sync refuse contournement de ramassage et réouverture, confirme légitimement',async()=>{
 reset();state.orders=[{...order(),status:'dispatched',picked_up_at:null}];const route=require('../src/app/api/orders/sync/route.ts').POST;
 for(const [from,to] of [['dispatched','in_transit'],['delivered','confirmed']]){state.orders[0].status=from;const r=await route(await req('/api/orders/sync',{order:{id:'test-order',orderNumber:'SG-ABCDEFGH',status:to}},'driver'));assert.equal(r.status,403);assert.equal(state.orders[0].status,from);}
 state.orders[0].status='pending_call';const good=await route(await req('/api/orders/sync',{order:{id:'test-order',orderNumber:'SG-ABCDEFGH',status:'confirmed'}},'admin'));assert.equal(good.status,200);assert.equal(state.orders[0].status,'confirmed');
});
test('TEST-AUD-OWNER : fournisseur étranger refusé, propriétaire autorisé pour lecture de son état',async()=>{
 reset();state.orders=[order()];state.products=[{id:'test-product',supplier_id:'supplier-A'}];const route=require('../src/app/api/orders/sync/route.ts').POST;
 let r=await route(await req('/api/orders/sync',{order:{id:'test-order',orderNumber:'SG-ABCDEFGH',status:'in_transit'}},'supplier'));assert.equal(r.status,403);
 state.products[0].supplier_id='test-supplier';r=await route(await req('/api/orders/sync',{order:{id:'test-order',orderNumber:'SG-ABCDEFGH',status:'in_transit'}},'supplier'));assert.equal(r.status,200);
});
test('TEST-AUD-DELIVERY : la route transmet l’identité signée, ne confirme jamais un RPC en échec',async()=>{
 reset();faults.verify_delivery_atomic=true;const route=require('../src/app/api/driver/verify-delivery-otp/route.ts').POST;const body={orderId:'test-order',code:'4321',driverId:'forged'};
 const r=await route(await req('/api/driver/verify-delivery-otp',body,'driver'));assert.equal(r.status,503);assert.notEqual((await r.json()).success,true);assert.equal(calls.find(c=>c.rpc==='verify_delivery_atomic').args.p_driver_id,'test-driver');
 faults={};rpcValues.verify_delivery_atomic={error:'Autre livreur',http:403};assert.equal((await route(await req('/api/driver/verify-delivery-otp',body,'driver'))).status,403);
 rpcValues.verify_delivery_atomic={success:true};assert.equal((await route(await req('/api/driver/verify-delivery-otp',body,'driver'))).status,200);
});
test('TEST-AUD-M3 : retrait jamais annoncé réglé lorsque le règlement atomique échoue',async()=>{
 reset();state.payouts=[{id:'WTH-TEST',status:'pending',payment_method:'cash'}];faults.finalize_payout_atomic=true;const route=require('../src/app/api/admin/payouts/route.ts').POST;
 const r=await route(await req('/api/admin/payouts',{id:'WTH-TEST',action:'payer_especes'},'admin'));assert.equal(r.status,503);assert.equal(state.payouts[0].status,'pending');
 faults={};rpcValues.finalize_payout_atomic={id:'WTH-TEST',status:'completed'};assert.equal((await route(await req('/api/admin/payouts',{id:'WTH-TEST',action:'payer_especes'},'admin'))).status,200);
 state.admin_team_members[0].team_role='support';assert.equal((await route(await req('/api/admin/payouts',{id:'WTH-TEST',action:'payer_especes'},'admin'))).status,403);
});
test('TEST-AUD-PAYIN : intention bloquée = aucun appel prestataire ; reprise = même clé',async()=>{
 reset();state.orders=[order()];faults.begin_order_payment=true;const route=require('../src/app/api/payments/saspay/create/route.ts').POST;
 assert.equal((await route(await req('/api/payments/saspay/create',{orderNumber:'SG-ABCDEFGH',network:'orange_ml'}))).status,503);assert.equal(calls.filter(c=>c.payin).length,0);
 faults={};rpcValues.begin_order_payment={id:'attempt-fixe',phone:'+22300000000'};rpcValues.record_order_payment={id:'attempt-fixe'};
 const r=await route(await req('/api/payments/saspay/create',{orderNumber:'SG-ABCDEFGH',network:'orange_ml'}));assert.equal(r.status,200);assert.equal(calls.find(c=>c.payin).payin.cleIdempotence,'order-attempt-attempt-fixe');
 rpcValues.begin_order_payment={id:'attempt-fixe',transaction_id:'fake-tx'};await route(await req('/api/payments/saspay/create',{orderNumber:'SG-ABCDEFGH',network:'orange_ml'}));assert.equal(calls.filter(c=>c.payin).length,1);
});
test('TEST-AUD-PAYIN : état confirmé persisté via RPC ; panne donne paye=false et 503',async()=>{
 reset();state.orders=[{...order(),status:'confirmed',payment_transaction_id:'fake-tx'}];const route=require('../src/app/api/payments/saspay/status/route.ts').GET;
 let r=await route(await req('/api/payments/saspay/status?orderNumber=SG-ABCDEFGH'));assert.equal((await r.json()).paye,true);assert.equal(calls.find(c=>c.rpc==='apply_verified_payment').args.p_status,'SUCCESS');
 faults.apply_verified_payment=true;r=await route(await req('/api/payments/saspay/status?orderNumber=SG-ABCDEFGH'));assert.equal(r.status,503);assert.equal((await r.json()).paye,false);
});
test('TEST-AUD-PRIVACY : aucune commande persistée ; logout et feed vide purgent la mémoire',async()=>{
 reset();const saved=new Map();global.window={};global.localStorage={setItem:(k,v)=>saved.set(k,v),getItem:k=>saved.get(k)||null};const {sugubaStore:s}=require('../src/lib/store.ts');
 s.definirUtilisateur({id:'account-A',role:'reseller'});s.setOrdersFromCloud([{id:'test-order',customerName:'Client fictif',customerPhone:'+22300000000'}]);assert.ok([...saved.values()].every(v=>!v.includes('Client fictif')));s.definirUtilisateur(null,true);assert.equal(s.getState().orders.length,0);
 s.setOrdersFromCloud([{id:'test-order'}]);s.setOrdersFromCloud([]);assert.equal(s.getState().orders.length,0);delete global.window;delete global.localStorage;
});
test('TEST-AUD-UPLOAD : faux JPEG et anonyme refusés ; PNG réel réencodé en WebP',async()=>{
 reset();const route=require('../src/app/api/products/upload-image/route.ts').POST;
 async function upload(bytes,role){const form=new FormData();form.set('file',new File([bytes],'test.png',{type:'image/png'}));return route(new NextRequest('http://localhost/api/products/upload-image',{method:'POST',headers:role?{cookie:'suguba_session='+await token(role)}:{},body:form}));}
 assert.equal((await upload(Buffer.from('pas une image'),'supplier')).status,400);assert.equal(calls.filter(c=>c.upload).length,0);
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer();assert.equal((await upload(bytes)).status,401);assert.equal((await upload(bytes,'supplier')).status,200);
 const sent=calls.find(c=>c.upload);assert.equal(sent.options.contentType,'image/webp');assert.equal((await sharp(sent.buffer).metadata()).format,'webp');
});
test('TEST-AUD-SMS : numéro public insuffisant ; reçu requis et quota vérifié avant transport',async()=>{
 reset();state.orders=[{...order(),status:'pending_call',created_at:new Date().toISOString()}];const route=require('../src/app/api/sms/send-otp/route.ts').POST;
 assert.equal((await route(await req('/api/sms/send-otp',{orderNumber:'SG-ABCDEFGH'}))).status,403);
 const key=randomUUID();state.order_creation_requests=[{key_hash:createHash('sha256').update(key).digest('hex'),receipt:{order_number:'SG-ABCDEFGH'}}];rpcValues.claim_order_sms=false;
 assert.equal((await route(await req('/api/sms/send-otp',{orderNumber:'SG-ABCDEFGH',accessKey:key}))).status,429);
});
test('TEST-AUD-SMS : absence de configuration = échec explicite sans OTP dans les logs',async()=>{
 const names=Object.keys(process.env).filter(k=>/^(ORANGE_SMS_|TWILIO_|TERMII_)/.test(k));const old=names.map(k=>[k,process.env[k]]);names.forEach(k=>delete process.env[k]);const logs=[];const log=console.log;console.log=(...x)=>logs.push(x.join(' '));try{const r=await require('../src/lib/sms-gateway.ts').smsGateway.sendDeliveryOtpSms({toPhone:'+22300000000',deliveryOtp:'4321',orderNumber:'SG-TEST',productName:'Test',totalAmount:1000});assert.equal(r.success,false);assert.equal(logs.length,0);}finally{console.log=log;for(const[k,v]of old)process.env[k]=v;}
});
test('TEST-AUD-SESSION : cookie falsifié et session absente refusés',async()=>{reset();assert.equal(await verifySessionToken((await token('driver'))+'x'),null);assert.equal((await require('../src/app/api/orders/feed/route.ts').GET(await req('/api/orders/feed'))).status,401);});

test('TEST-AUD-PAYOUT : reprise rattachée au propriétaire, même avec réglages indisponibles',async()=>{
 reset();const key=randomUUID();const fingerprint=createHash('sha256').update(JSON.stringify([5000,'cash','+22300000000'])).digest('hex');
 state.payouts=[{id:'SERVER-WITHDRAWAL',reseller_id:'test-reseller',request_key:createHash('sha256').update(key).digest('hex'),request_fingerprint:fingerprint,amount:4900,montant_demande:5000,frais_retrait:100,detail_frais:{suguba:100}}];faults['platform_settings:select']=true;
 const route=require('../src/app/api/payouts/create/route.ts').POST;const body={amount:5000,payoutProvider:'Agence Suguba',payoutPhone:'+22300000000',withdrawalCode:key,resellerId:'forged'};
 const r=await route(await req('/api/payouts/create',body,'reseller'));assert.equal(r.status,200);assert.equal((await r.json()).withdrawalCode,'SERVER-WITHDRAWAL');assert.equal(calls.filter(c=>c.rpc==='create_payout_atomic').length,0);
 profile('reseller-B','reseller');assert.equal((await route(await req('/api/payouts/create',body,'reseller','reseller-B'))).status,503);
});

test('TEST-AUD-CLOSE-02 : aucun rôle du feed, même admin, ne reçoit le secret',async()=>{
 reset();state.orders=[{...order(),reseller_id:'test-reseller'}];
 for(const role of ['admin','driver','reseller']){
  const r=await require('../src/app/api/orders/feed/route.ts').GET(await req('/api/orders/feed',undefined,role));
  assert.equal(r.status,200);const data=await r.json();assert.equal(data.orders.length,1);assert.ok(!JSON.stringify(data).includes('4321'));assert.equal(data.orders[0].delivery_otp,undefined);
 }
});
test('TEST-AUD-CLOSE-03 : SMS indépendant, destinataire imposé par la DB, accès légitime et refus',async()=>{
 reset();state.orders=[{...order(),status:'in_transit'}];const key=randomUUID();state.order_creation_requests=[{key_hash:createHash('sha256').update(key).digest('hex'),receipt:{order_number:'SG-ABCDEFGH'}}];rpcValues.claim_order_sms=true;rpcValues.confirm_delivery_sms=true;
 const gateway=require('../src/lib/sms-gateway.ts').smsGateway, original=gateway.sendDeliveryOtpSms;const sent=[];
 gateway.sendDeliveryOtpSms=async payload=>{sent.push(payload);return {success:true}};
 try{
  const route=require('../src/app/api/sms/send-otp/route.ts').POST;
  let r=await route(await req('/api/sms/send-otp',{orderNumber:'SG-ABCDEFGH',accessKey:key,toPhone:'+22311111111',deliveryOtp:'0000'}));assert.equal(r.status,200);assert.deepEqual(await r.json(),{success:true});assert.equal(sent[0].toPhone,state.orders[0].customer_phone);assert.equal(sent[0].deliveryOtp,state.orders[0].delivery_otp);
  r=await route(await req('/api/sms/send-otp',{orderNumber:'SG-ABCDEFGH'},'driver'));assert.equal(r.status,403);assert.equal(sent.length,1);
  state.admin_team_members[0].team_role='finance';assert.equal((await route(await req('/api/sms/send-otp',{orderNumber:'SG-ABCDEFGH'},'admin'))).status,403);
  state.admin_team_members[0].team_role='support';assert.equal((await route(await req('/api/sms/send-otp',{orderNumber:'SG-ABCDEFGH'},'admin'))).status,200);
  state.orders[0].status='delivered';assert.equal((await route(await req('/api/sms/send-otp',{orderNumber:'SG-ABCDEFGH',accessKey:key}))).status,409);
 }finally{gateway.sendDeliveryOtpSms=original;}
});
test('TEST-AUD-CLOSE-04 : panne SMS ou confirmation DB = échec visible, jamais succès',async()=>{
 reset();state.orders=[order()];rpcValues.claim_order_sms=true;rpcValues.confirm_delivery_sms=true;
 const gateway=require('../src/lib/sms-gateway.ts').smsGateway,original=gateway.sendDeliveryOtpSms;const route=require('../src/app/api/sms/send-otp/route.ts').POST;
 try{
  gateway.sendDeliveryOtpSms=async()=>({success:false});let r=await route(await req('/api/sms/send-otp',{orderNumber:'SG-ABCDEFGH'},'admin'));assert.equal(r.status,503);assert.equal((await r.json()).success,false);assert.equal(calls.filter(c=>c.rpc==='confirm_delivery_sms').length,0);
  gateway.sendDeliveryOtpSms=async()=>({success:true});faults.confirm_delivery_sms=true;r=await route(await req('/api/sms/send-otp',{orderNumber:'SG-ABCDEFGH'},'admin'));assert.equal(r.status,503);assert.equal((await r.json()).success,false);
 }finally{gateway.sendDeliveryOtpSms=original;}
});
test('TEST-AUD-CLOSE-13 : solde nul réel accepté, panne de lecture refusée et autre rôle interdit',async()=>{
 reset();const route=require('../src/app/api/reseller/me/route.ts').GET;
 let response=await route(await req('/api/reseller/me',undefined,'reseller'));assert.equal(response.status,200);assert.equal((await response.json()).reseller.availableBalance,0);
 assert.equal((await route(await req('/api/reseller/me',undefined,'driver'))).status,401);
 for(const table of ['orders','commissions']){faults[table+':select']=true;response=await route(await req('/api/reseller/me',undefined,'reseller'));assert.equal(response.status,503);assert.equal((await response.json()).reseller,undefined);faults={};}
});
