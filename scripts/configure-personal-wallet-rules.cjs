// Preserves the deployed Firestore rules and adds the owner's real-time wallet sync paths.
const {GoogleAuth}=require('google-auth-library');
const MARKER='// CrediGestor personal wallets v2';
const OLD_MARKER='// CrediGestor personal wallets v1';
const fs=require('node:fs'),os=require('node:os'),pathModule=require('node:path'),{execFileSync}=require('node:child_process');
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
 if(!content.includes(MARKER)){
   const block=fs.readFileSync('scripts/personal-wallet.rules.fragment','utf8');
   if(content.includes(OLD_MARKER)){
     // Substitui o bloco v1 (só dono) pelo v2 (qualquer conta autenticada).
     content=content.replace(/\n\s*\/\/ CrediGestor personal wallets v1[\s\S]*?match \/clients\/\{clientId\}\s*\{[^}]*\}\s*\}\s*/,`\n${block}`);
   }else{
     // Existing application rules use only these explicit top-level collections.
     // A broad wildcard could override the approval ACL, so never publish over one.
     const paths=[...content.matchAll(/match\s+\/([^\s{]+|\{[^}]+\})/g)].map(m=>m[1]);
     if(paths.some(p=>p.startsWith('{'))||!content.includes('match /databases/{database}/documents {')||!/\n  }\s*}\s*$/.test(content))throw Error('As regras atuais precisam de revisão antes de acrescentar a sincronização. Caminhos: '+paths.join(', '));
     content=content.replace(/\n  }\s*}\s*$/,`\n${block}\n  }\n}\n`);
   }
   files[0].content=content;
   const temp=fs.mkdtempSync(pathModule.join(os.tmpdir(),'credigestor-wallet-'));
   const rulesPath=pathModule.join(temp,'firestore.rules'),configPath=pathModule.join(temp,'firebase.json');
   fs.writeFileSync(rulesPath,content);
   fs.writeFileSync(configPath,JSON.stringify({firestore:{rules:'firestore.rules'},emulators:{firestore:{host:'127.0.0.1',port:8188},ui:{enabled:false},singleProjectMode:true}}));
   const testEnv={...process.env,CREDIGESTOR_RULES_PATH:rulesPath};delete testEnv.FIREBASE_DEPLOY_ACCOUNT;
   execFileSync('npx',['--no-install','firebase','emulators:exec','--only','firestore','--project','demo-credigestor','--config',configPath,'node tests/personal-wallet-rules.cjs'],{stdio:'inherit',env:testEnv});
   const created=(await client.request({url:`${api}/projects/${project}/rulesets`,method:'POST',data:{source:{files}}})).data;
   await client.request({url:`${api}/${release}`,method:'PATCH',data:{release:{name:release,rulesetName:created.name},updateMask:'rulesetName'}});
 }
 const readback=(await client.request({url:`${api}/${release}`})).data;
 const verified=(await client.request({url:`${api}/${readback.rulesetName}`})).data;
 if(!verified.source.files.some(f=>f.content.includes(MARKER)))throw Error('Regras não confirmadas.');
 console.log('Sincronização em tempo real liberada para qualquer conta autenticada (isolada por UID); regras anteriores preservadas.');
})().catch(async e=>{
 console.error('Falha ao configurar a sincronização:',e.response?.status||'',e.response?.data?.error?.message||e.message);
 try{
  const credentials=JSON.parse(process.env.FIREBASE_DEPLOY_ACCOUNT||'{}');
  console.error('Conta de publicação:',credentials.client_email||'não identificada');
  const client=await new GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/cloud-platform']}).getClient();
  const permissions=['firebaserules.releases.get','firebaserules.rulesets.get','firebaserules.rulesets.create','firebaserules.rulesets.test','firebaserules.releases.update'];
  const result=(await client.request({url:'https://cloudresourcemanager.googleapis.com/v1/projects/credigestor-testes:testIamPermissions',method:'POST',data:{permissions}})).data;
  console.error('Permissões de regras ausentes no projeto:',permissions.filter(p=>!result.permissions?.includes(p)).join(', ')||'nenhuma');
 }catch(_){console.error('Não foi possível verificar as permissões efetivas do projeto.');}
 process.exitCode=1;
});
