const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const crypto=require('node:crypto');
async function bootstrap({team=null,fault=false}={}){
 const writes=[];
 const db={from(table){const q={select(){return q},eq(){return q},async maybeSingle(){return {data:table==='profiles'?{id:'local-admin'}:team,error:table==='admin_team_members'&&fault?{message:'failure'}:null}},async update(p){writes.push({table,p});return {error:null}},async upsert(p,options){writes.push({table,p,options});return {error:null}}};q.update=p=>{writes.push({table,p});return {eq:async()=>({error:null})}};return q}};
 const ctx={require:n=>n==='fs'?{existsSync:()=>false}:n==='path'?require('node:path'):n==='@supabase/supabase-js'?{createClient:()=>db}:null,crypto,console:{log(){},error(){}},process:{cwd:()=>'/local-only',argv:['node','script','+22370000000','Compte fictif'],env:{NEXT_PUBLIC_SUPABASE_URL:'local-only',SUPABASE_SERVICE_ROLE_KEY:'fictitious-key'},exit:()=>{throw Error('BOOTSTRAP_FAILED')}}};
 const source=fs.readFileSync(require.resolve('../scripts/create-admin.js'),'utf8').replace('main().catch','globalThis.completion=main().catch');vm.runInNewContext(source,ctx);await ctx.completion;return writes;
}
test('TEST-AUD-BOOTSTRAP : premier administrateur explicitement affecté, aucune exécution distante',async()=>{
 const writes=await bootstrap();const team=writes.find(x=>x.table==='admin_team_members');assert.equal(team.p.team_role,'super_admin');assert.equal(team.options.ignoreDuplicates,true);assert.ok(writes.some(x=>x.table==='profile_roles'));
});
test('TEST-AUD-BOOTSTRAP : affectation existante conservée ; panne sans droits implicites',async()=>{
 assert.equal((await bootstrap({team:{profile_id:'local-admin'}})).filter(x=>x.table==='admin_team_members').length,0);await assert.rejects(bootstrap({fault:true}),/BOOTSTRAP_FAILED/);
});
