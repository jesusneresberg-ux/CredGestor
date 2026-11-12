// Preserves the deployed Firestore rules and adds an isolated owner-controlled ACL.
const {GoogleAuth}=require('google-auth-library');
const fs=require('node:fs');
(async()=>{
 const project='credigestor-testes',credentials=JSON.parse(process.env.FIREBASE_DEPLOY_ACCOUNT||'{}');
 if(credentials.project_id!==project)throw Error('Projeto incorreto.');
 const client=await new GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/cloud-platform']}).getClient();
 const api='https://firebaserules.googleapis.com/v1',release=`projects/${project}/releases/cloud.firestore`;
 const current=(await client.request({url:`${api}/${release}`})).data;
 const ruleset=(await client.request({url:`${api}/${current.rulesetName}`})).data;
 const files=ruleset.source.files.map(f=>({...f}));
 if(files.length!==1)throw Error('Estrutura de regras inesperada; publicação interrompida.');
 let content=files[0].content;
 if(!content.includes('// CrediGestor account approval v1')){
   // Existing application rules use only these explicit top-level collections.
   // A broad wildcard could override the approval ACL, so never publish over one.
   const paths=[...content.matchAll(/match\s+\/([^\s{]+|\{[^}]+\})/g)].map(m=>m[1]);
   if(paths.some(p=>p.startsWith('{'))||!content.includes('match /databases/{database}/documents {')||!/\n  }\s*}\s*$/.test(content))throw Error('As regras atuais precisam de revisão antes de acrescentar aprovações. Caminhos: '+paths.join(', '));
   const block=fs.readFileSync('scripts/account-approval.rules.fragment','utf8');
   content=content.replace(/\n  }\s*}\s*$/,`\n${block}\n  }\n}\n`);
   files[0].content=content;
   const path='/databases/(default)/documents/accountApprovals/test-approval';
   const cases=[
     {expectation:'DENY',request:{path,method:'get',auth:null}},
     {expectation:'ALLOW',request:{path,method:'get',auth:{uid:'test-approval',token:{email:'test@example.com'}}}},
     {expectation:'DENY',request:{path,method:'get',auth:{uid:'other-user',token:{email:'other@example.com'}}}},
     {expectation:'DENY',request:{path,method:'update',auth:{uid:'test-approval',token:{email:'test@example.com'}}}},
     {expectation:'ALLOW',request:{path,method:'list',auth:{uid:'r7XvaVZzBhglpaMAuMlBXuipBBt1',token:{email_verified:true,email:'admin@example.com'}}}},
     {expectation:'DENY',request:{path,method:'list',auth:{uid:'test-approval',token:{email:'test@example.com'}}}}
   ];
   const check=await client.request({url:`${api}/projects/${project}:test`,method:'POST',data:{source:{files},testSuite:{testCases:cases}}});
   if(check.data.issues?.some(i=>i.severity==='ERROR'))throw Error('Regras de aprovação inválidas.');
   if(check.data.testResults?.length!==cases.length||check.data.testResults.some(r=>r.state!=='SUCCESS'))throw Error('Os testes de permissão das aprovações falharam.');
   const created=(await client.request({url:`${api}/projects/${project}/rulesets`,method:'POST',data:{source:{files}}})).data;
   await client.request({url:`${api}/${release}`,method:'PATCH',data:{release:{name:release,rulesetName:created.name},updateMask:'rulesetName'}});
 }
 const readback=(await client.request({url:`${api}/${release}`})).data;
 const verified=(await client.request({url:`${api}/${readback.rulesetName}`})).data;
 if(!verified.source.files.some(f=>f.content.includes('// CrediGestor account approval v1')))throw Error('Regras não confirmadas.');
 console.log('Aprovações protegidas por regras do servidor; regras anteriores preservadas.');
})().catch(e=>{console.error('Falha ao configurar aprovações:',e.response?.status||'',e.response?.data?.error?.message||e.message);try{console.error('Conta de publicação:',JSON.parse(process.env.FIREBASE_DEPLOY_ACCOUNT||'{}').client_email||'não identificada');}catch(_){}process.exitCode=1;});
