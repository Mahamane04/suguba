require('../scripts/test-typescript.cjs');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { database, sql } = require('./helpers/audit-db.cjs');
let db;
const query = async (q,p=[]) => (await db.query(q,p)).rows;
const scalar = async (q,p=[]) => (await query(q,p))[0].value;
const hash = x => createHash('sha256').update(x).digest('hex');
before(async()=> { db = await database(); });
after(async()=> { if (db) await db.close(); });
async function product(stock=10) {
 const id=randomUUID(); await query("INSERT INTO products(id,name,slug,category,supplier_price,public_price,commission_proposee,status,stock) VALUES($1,'Fictif',$1,'test',1000,2500,500,'approved',$2)",[id,stock]);return id;
}
async function order(productId,quantity=1,key=randomUUID(),owner='owner-A') {
 const id=randomUUID(), number='SG-'+id;
 const row={id,order_number:number,product_id:productId,product_name:'Fictif',customer_name:'Test',customer_phone:'+22300000000',reseller_id:owner,reseller_commission:500*quantity,quantity,unit_price:2500,total_product_amount:2500*quantity,delivery_fee:0,platform_margin:1000,city:'Bamako',total_amount:2500*quantity,delivery_otp:'4321'};
 return scalar('SELECT create_order_with_commission($1,$2,$3,$4) AS value',[hash(key),hash(productId+quantity),JSON.stringify(row),JSON.stringify({supplier_price:1000,public_price:2500,commission_proposee:500})]);
}
async function payout(owner,amount=5000,key=randomUUID(),id='WTH-'+randomUUID()) {
 const row={id,reseller_name:'Fictif',amount:amount-100,payment_method:'cash',phone_number:'+22300000000',montant_demande:amount,frais_retrait:100,detail_frais:{suguba:100}};
 return scalar('SELECT create_payout_atomic($1,$2,$3,$4) AS value',[owner,hash(key),hash(owner+amount),JSON.stringify(row)]);
}
test('TEST-AUD-M1 : retrait partiel conserve exactement le solde et le propriétaire',async()=>{
 await query("INSERT INTO commissions(reseller_id,amount,status) VALUES('owner-A',10000,'available'),('owner-B',9000,'available')");
 const p=await payout('owner-A');
 assert.equal(Number(await scalar("SELECT sum(amount) AS value FROM commissions WHERE reseller_id='owner-A' AND status='available'")),5000);
 assert.equal(Number(await scalar("SELECT sum(amount) AS value FROM commissions WHERE reserved_for_withdrawal=$1 AND status='reserved'",[p.id])),5000);
 await assert.rejects(scalar('SELECT reserve_commissions_for_withdrawal($1,100,$2) AS value',['owner-B',p.id]),/WITHDRAWAL_OWNER_MISMATCH/);
 assert.equal(Number(await scalar("SELECT sum(amount) AS value FROM commissions WHERE reseller_id='owner-B' AND status='available'")),9000);
 await scalar("SELECT finalize_payout_atomic($1,'completed',NULL) AS value",[p.id]);
 await scalar("SELECT finalize_payout_atomic($1,'completed',NULL) AS value",[p.id]);
 assert.equal(Number(await scalar("SELECT sum(amount) AS value FROM commissions WHERE reseller_id='owner-A' AND status='paid'")),5000);
 assert.equal(Number(await scalar("SELECT sum(amount) AS value FROM commissions WHERE reseller_id='owner-A'")),10000);
});
test('TEST-AUD-M1 : insuffisance annule retrait + réserve, sans toucher au retrait d’autrui',async()=>{
 const b=await payout('owner-B',5000); const before=await query('SELECT * FROM commissions ORDER BY id');
 await assert.rejects(payout('owner-A',999999),/INSUFFICIENT_BALANCE/);
 assert.deepEqual(await query('SELECT * FROM commissions ORDER BY id'),before);
 assert.equal(await scalar('SELECT status AS value FROM payouts WHERE id=$1',[b.id]),'pending');
});
test('TEST-AUD-M1 : reprise et demandes concurrentes ne consomment pas deux fois le solde',async()=>{
 await query("INSERT INTO commissions(reseller_id,amount,status) VALUES('owner-C',7000,'available')");
 const key=randomUUID(); const [a,b]=await Promise.all([payout('owner-C',5000,key),payout('owner-C',5000,key)]);
 assert.equal(a.id,b.id); await assert.rejects(payout('owner-C',6000,key),/IDEMPOTENCY_CONFLICT/);
 const results=await Promise.allSettled([payout('owner-C',2000),payout('owner-C',2000)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(Number(await scalar("SELECT sum(amount) AS value FROM commissions WHERE reseller_id='owner-C'")),7000);
});
test('TEST-AUD-M3 : échec de règlement annule également le statut du retrait',async()=>{
 await query("INSERT INTO commissions(reseller_id,amount,status) VALUES('owner-D',6000,'available')");const p=await payout('owner-D');
 await db.exec("CREATE FUNCTION test_ledger_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_LEDGER_FAILURE'; END; $$; CREATE TRIGGER test_fail BEFORE UPDATE ON commissions FOR EACH ROW EXECUTE FUNCTION test_ledger_failure();");
 try { await assert.rejects(scalar("SELECT finalize_payout_atomic($1,'completed',NULL) AS value",[p.id]),/TEST_LEDGER_FAILURE/);assert.equal(await scalar('SELECT status AS value FROM payouts WHERE id=$1',[p.id]),'pending'); }
 finally {await db.exec('DROP TRIGGER test_fail ON commissions; DROP FUNCTION test_ledger_failure();');}
 assert.equal(Number(await scalar('SELECT sum(amount) AS value FROM commissions WHERE reserved_for_withdrawal=$1 AND status=\'reserved\'',[p.id])),5000);
 await scalar("SELECT finalize_payout_atomic($1,'rejected',NULL) AS value",[p.id]);
 assert.equal(Number(await scalar("SELECT sum(amount) AS value FROM commissions WHERE reseller_id='owner-D' AND status='available'")),6000);
});
test('TEST-AUD-STOCK : stock nul refusé, dernière unité réservée une fois, reprise puis annulation',async()=>{
 const p=await product(0);await assert.rejects(order(p),/STOCK_UNAVAILABLE/);
 await query('UPDATE products SET stock=1 WHERE id=$1',[p]);
 const results=await Promise.allSettled([order(p),order(p)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(Number(await scalar('SELECT stock AS value FROM products WHERE id=$1',[p])),0);
 const o=results.find(r=>r.status==='fulfilled').value.order;
 await query("UPDATE orders SET status='cancelled' WHERE id=$1",[o.id]);
 await query("UPDATE orders SET status='cancelled' WHERE id=$1",[o.id]);
 assert.equal(Number(await scalar('SELECT stock AS value FROM products WHERE id=$1',[p])),1);
 assert.equal(await scalar('SELECT status AS value FROM commissions WHERE order_id=$1',[o.id]),'reversed');
 await assert.rejects(query("UPDATE orders SET status='confirmed' WHERE id=$1",[o.id]),/STATUS_CONFLICT/);
 const key=randomUUID(),a=await order(p,1,key),b=await order(p,1,key);assert.equal(a.order.id,b.order.id);
 assert.equal(Number(await scalar('SELECT stock AS value FROM products WHERE id=$1',[p])),0);
});
test('TEST-AUD-DELIVERY : affectation, preuve de ramassage, seuil atomique et livraison légitime',async()=>{
 const {order:o}=await order(await product());
 await query("UPDATE orders SET status='dispatched',assigned_driver_id='driver-A' WHERE id=$1",[o.id]);
 const verify=(driver,code)=>scalar('SELECT verify_delivery_atomic($1,$2,$3) AS value',[o.id,driver,code]);
 assert.equal((await verify('driver-B','4321')).http,403);assert.equal((await verify('driver-A','4321')).http,409);
 await query("UPDATE orders SET status='in_transit',picked_up_at=now(),delivery_code_version=1,delivery_code_sent_at=now() WHERE id=$1",[o.id]);
 assert.deepEqual((await Promise.all(Array.from({length:4},()=>verify('driver-A','0000')))).map(r=>r.http),[400,400,400,423]);
 assert.equal(Number(await scalar('SELECT failed_otp_attempts AS value FROM orders WHERE id=$1',[o.id])),3);
 await query('UPDATE orders SET failed_otp_attempts=0 WHERE id=$1',[o.id]);
 assert.equal((await verify('driver-A','4321')).success,true);
 const ledger=(await query('SELECT status,unlock_at FROM commissions WHERE order_id=$1',[o.id]))[0];assert.equal(ledger.status,'locked');assert.ok(new Date(ledger.unlock_at)>new Date());
 await assert.rejects(query("UPDATE orders SET status='confirmed' WHERE id=$1",[o.id]),/STATUS_CONFLICT/);
});
test('TEST-AUD-DELIVERY : panne grand-livre = livraison et paiement non validés',async()=>{
 const {order:o}=await order(await product());await query("UPDATE orders SET status='in_transit',picked_up_at=now(),delivery_code_version=1,delivery_code_sent_at=now(),assigned_driver_id='driver-A' WHERE id=$1",[o.id]);
 await db.exec("CREATE FUNCTION test_ledger_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_LEDGER_FAILURE'; END; $$; CREATE TRIGGER test_fail BEFORE UPDATE ON commissions FOR EACH ROW EXECUTE FUNCTION test_ledger_failure();");
 try { await assert.rejects(scalar("SELECT verify_delivery_atomic($1,'driver-A','4321') AS value",[o.id]),/TEST_LEDGER_FAILURE/);assert.equal(await scalar('SELECT status AS value FROM orders WHERE id=$1',[o.id]),'in_transit');assert.equal(await scalar('SELECT payment_collected AS value FROM orders WHERE id=$1',[o.id]),false); }
 finally {await db.exec('DROP TRIGGER test_fail ON commissions; DROP FUNCTION test_ledger_failure();');}
});
test('TEST-AUD-PAYIN : une intention active, reprise même réseau, vérification persistée après confirmation',async()=>{
 const {order:o}=await order(await product());const begin=network=>scalar('SELECT begin_order_payment($1,$2,$3,$4) AS value',[o.order_number,network,'+22300000000',randomUUID()]);
 const a=await begin('orange_ml');assert.equal((await begin('orange_ml')).id,a.id);await assert.rejects(begin('moov_ml'),/PAYMENT_ALREADY_PENDING/);
 const tx=randomUUID();await scalar('SELECT record_order_payment($1,$2,NULL) AS value',[a.id,tx]);await query("UPDATE orders SET status='confirmed' WHERE id=$1",[o.id]);
 await query("SELECT apply_verified_payment($1,$2,'SUCCESS')",[o.order_number,tx]);await query("SELECT apply_verified_payment($1,$2,'SUCCESS')",[o.order_number,tx]);
 assert.equal(await scalar('SELECT payment_collected AS value FROM orders WHERE id=$1',[o.id]),true);assert.equal(await scalar('SELECT status AS value FROM orders WHERE id=$1',[o.id]),'confirmed');
 await assert.rejects(query("SELECT apply_verified_payment($1,'unrelated','SUCCESS')",[o.order_number]),/PAYMENT_CONFLICT/);
 await assert.rejects(begin('moov_ml'),/ORDER_NOT_PAYABLE/);
});
test('TEST-AUD-PAYIN : échec vérifié autorise une autre intention sans perdre la première',async()=>{
 const {order:o}=await order(await product());const id=randomUUID(),tx=randomUUID();
 await scalar("SELECT begin_order_payment($1,'orange_ml','+22300000000',$2) AS value",[o.order_number,id]);await scalar('SELECT record_order_payment($1,$2,NULL) AS value',[id,tx]);await query("SELECT apply_verified_payment($1,$2,'FAILED')",[o.order_number,tx]);
 await scalar("SELECT begin_order_payment($1,'moov_ml','+22300000000',$2) AS value",[o.order_number,randomUUID()]);
 assert.equal(Number(await scalar('SELECT count(*) AS value FROM payment_attempts WHERE order_number=$1',[o.order_number])),2);
 assert.equal(await scalar('SELECT transaction_id AS value FROM payment_attempts WHERE id=$1',[id]),tx);
});
test('TEST-AUD-RPC : opérations privilégiées refusées à anon/authenticated, accordées au service',async()=>{
 for (const signature of ['create_payout_atomic(text,text,text,jsonb)','finalize_payout_atomic(text,text,text,text)','verify_delivery_atomic(text,text,text)','begin_order_payment(text,text,text,text)','record_order_payment(text,text,text)','apply_verified_payment(text,text,text)']) {
  for (const role of ['anon','authenticated','service_role']) assert.equal(await scalar('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS value',[role,'public.'+signature]),role==='service_role');
 }
 await db.exec('SET ROLE anon');try{await assert.rejects(query('SELECT * FROM payment_attempts'),{code:'42501'});}finally{await db.exec('RESET ROLE');}
});
test('TEST-AUD-MIGRATION : les deux migrations se rejouent sans perte de données',async()=>{const count=await scalar('SELECT count(*) AS value FROM orders');await db.exec(sql('migration-audit-integrite.sql'));await db.exec(sql('migration-audit-paiements.sql'));assert.equal(await scalar('SELECT count(*) AS value FROM orders'),count);});
test('TEST-AUD-PICKUP : accès légitime/refus étranger, cinq erreurs atomiques et reprise',async()=>{
 const {order:o}=await order(await product());await query("UPDATE orders SET status='dispatched',pickup_code='8765',assigned_driver_id='driver-A' WHERE id=$1",[o.id]);
 const verify=(driver,code)=>scalar('SELECT verify_pickup_atomic($1,$2,$3) AS value',[o.id,driver,code]);assert.equal((await verify('driver-B','8765')).http,403);
 assert.deepEqual((await Promise.all(Array.from({length:6},()=>verify('driver-A','0000')))).map(r=>r.http),[400,400,400,400,400,423]);
 await query('UPDATE orders SET failed_pickup_attempts=0 WHERE id=$1',[o.id]);assert.equal((await verify('driver-A','8765')).success,true);assert.equal((await verify('driver-A','8765')).dejaFait,true);
 assert.equal(await scalar('SELECT status AS value FROM orders WHERE id=$1',[o.id]),'in_transit');
});
test('TEST-AUD-SMS : trois demandes maximum, attente 60 secondes et fenêtres et récupération après confirmation',async()=>{
 const {order:o}=await order(await product());const claim=()=>scalar('SELECT claim_order_sms($1) AS value',[o.order_number]);
 assert.equal(await claim(),true);assert.equal(await claim(),false);
 for(let i=0;i<2;i++){await query("UPDATE orders SET sms_requested_at=now()-interval '61 seconds' WHERE id=$1",[o.id]);assert.equal(await claim(),true);}
 await query("UPDATE orders SET sms_requested_at=now()-interval '61 seconds' WHERE id=$1",[o.id]);assert.equal(await claim(),false);
 const {order:old}=await order(await product());await query("UPDATE orders SET created_at=now()-interval '31 minutes' WHERE id=$1",[old.id]);assert.equal(await scalar('SELECT claim_order_sms($1) AS value',[old.order_number]),true);
 await query("UPDATE orders SET sms_requested_at=now()-interval '31 minutes',sms_window_started_at=now()-interval '31 minutes',status='confirmed' WHERE id=$1",[o.id]);assert.equal(await claim(),true);
 await query("UPDATE orders SET status='cancelled' WHERE id=$1",[old.id]);assert.equal(await scalar('SELECT claim_order_sms($1) AS value',[old.order_number]),false);
});
test('TEST-AUD-SEARCH : recherche au-delà de 300 résultats, groupes entiers, texte hostile littéral',async()=>{
 const p=await product(400);await query("INSERT INTO orders(id,order_number,product_id,product_name,customer_name,customer_phone,created_at) SELECT 'search-'||n,'SG-SEARCH-'||n,$1,'Test','Client de test','+22300000000',now()+(n||' seconds')::interval FROM generate_series(1,305) n",[p]);
 const search=(q,page=1)=>scalar("SELECT search_admin_orders('', $1, $2) AS value",[q,page]);
 await query("UPDATE orders SET customer_name='Cible ancienne unique' WHERE id='search-1'");const found=await search('Cible ancienne unique');assert.ok(found.orders.some(o=>o.order_number==='SG-SEARCH-1'));
 assert.equal((await search("'); DROP TABLE orders;--")).total,0);
 const all=await search('SG-SEARCH-');assert.equal(all.total,305);assert.equal(all.orders.length,50);assert.equal((await search('SG-SEARCH-',7)).orders.length,5);
 await query("UPDATE orders SET cart_id='search-cart' WHERE id IN ('search-1','search-305')");const group=await search('SG-SEARCH-305');assert.equal(group.total,1);assert.equal(group.orders.length,2);
});
test('TEST-AUD-M3 : reprise virement permise, refus manuel impossible une fois transmis',async()=>{
 await query("INSERT INTO commissions(reseller_id,amount,status) VALUES('owner-transfer',6000,'available')");const p=await payout('owner-transfer');await query("UPDATE payouts SET payment_method='orange_money' WHERE id=$1",[p.id]);
 assert.equal((await scalar('SELECT begin_payout_transfer($1) AS value',[p.id])).status,'processing');assert.equal((await scalar('SELECT begin_payout_transfer($1) AS value',[p.id])).id,p.id);
 await assert.rejects(scalar("SELECT finalize_payout_atomic($1,'rejected',NULL,'pending') AS value",[p.id]),/STATUS_CONFLICT/);
 assert.equal(await scalar('SELECT status AS value FROM payouts WHERE id=$1',[p.id]),'processing');
});

test('TEST-AUD-CLOSE-05 : ancien code inutilisable, SMS distinct, refus avant confirmation et livraison légitime',async()=>{
 const {order:o}=await order(await product());await query("UPDATE orders SET status='in_transit',picked_up_at=now(),assigned_driver_id='driver-A' WHERE id=$1",[o.id]);
 const verify=code=>scalar("SELECT verify_delivery_atomic($1,'driver-A',$2) AS value",[o.id,code]);
 assert.equal((await verify('4321')).http,409,'ancien reçu insuffisant');
 assert.equal(await scalar('SELECT claim_order_sms($1) AS value',[o.order_number]),true);
 const secret=await scalar('SELECT delivery_otp AS value FROM orders WHERE id=$1',[o.id]);assert.notEqual(secret,'4321');assert.match(secret,/^[1-9]\d{3}$/);
 assert.equal((await verify(secret)).http,409,'aucun envoi confirmé');
 assert.equal(await scalar("SELECT confirm_delivery_sms($1,'0000') AS value",[o.order_number]),false);
 assert.equal(await scalar('SELECT confirm_delivery_sms($1,$2) AS value',[o.order_number,secret]),true);
 assert.equal((await verify('4321')).http,400);assert.equal((await verify(secret)).success,true);
});
test('TEST-AUD-CLOSE-06 : code et quota communs au lot, autres commandes isolées',async()=>{
 const a=(await order(await product())).order,b=(await order(await product())).order,c=(await order(await product())).order;
 await query("UPDATE orders SET cart_id='sms-cart',pricing_snapshot=jsonb_set(COALESCE(pricing_snapshot,'{}'::jsonb),'{panier}', '{\"groupeLivraison\":\"groupe-A\"}'::jsonb) WHERE id=ANY($1)",[[a.id,b.id]]);
 assert.equal(await scalar('SELECT claim_order_sms($1) AS value',[a.order_number]),true);
 const secret=await scalar('SELECT delivery_otp AS value FROM orders WHERE id=$1',[a.id]);assert.equal(await scalar('SELECT delivery_otp AS value FROM orders WHERE id=$1',[b.id]),secret);
 assert.equal(await scalar('SELECT claim_order_sms($1) AS value',[b.order_number]),false);assert.equal(await scalar('SELECT delivery_code_version AS value FROM orders WHERE id=$1',[c.id]),0);
 assert.equal(await scalar('SELECT confirm_delivery_sms($1,$2) AS value',[a.order_number,secret]),true);
 assert.ok(await scalar('SELECT delivery_code_sent_at AS value FROM orders WHERE id=$1',[b.id]));
 await db.exec('SET ROLE authenticated');try{await assert.rejects(scalar('SELECT claim_order_sms($1) AS value',[c.order_number]),/permission denied/);await assert.rejects(scalar('SELECT confirm_delivery_sms($1,$2) AS value',[a.order_number,secret]),/permission denied/);}finally{await db.exec('RESET ROLE');}
});
