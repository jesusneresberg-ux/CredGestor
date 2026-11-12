// One-time, explicitly requested grant for the existing publication account.
const {GoogleAuth}=require('google-auth-library');
(async()=>{
 const project='credigestor-testes',email='firebase-adminsdk-fbsvc@credigestor-testes.iam.gserviceaccount.com';
 const credentials=JSON.parse(process.env.FIREBASE_DEPLOY_ACCOUNT||'{}');
 if(credentials.project_id!==project||credentials.client_email!==email)throw Error('Conta ou projeto incorreto.');
 const client=await new GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/cloud-platform']}).getClient();
 const url=`https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
 const required=['resourcemanager.projects.getIamPolicy','resourcemanager.projects.setIamPolicy'];
 const check=(await client.request({url:url+':testIamPermissions',method:'POST',data:{permissions:required}})).data;
 const missing=required.filter(p=>!check.permissions?.includes(p));
 if(missing.length)throw Error('A conta de publicação não pode conceder papéis IAM. Permissões ausentes: '+missing.join(', '));
 const policy=(await client.request({url:url+':getIamPolicy',method:'POST',data:{options:{requestedPolicyVersion:3}}})).data;
 const role='roles/firebaserules.admin',member='serviceAccount:'+email;
 policy.bindings=policy.bindings||[];
 let binding=policy.bindings.find(b=>b.role===role&&!b.condition);
 if(!binding?.members?.includes(member)){
  if(!binding){binding={role,members:[]};policy.bindings.push(binding);}
  binding.members.push(member);
  await client.request({url:url+':setIamPolicy',method:'POST',data:{policy}});
 }
 const verified=(await client.request({url:url+':getIamPolicy',method:'POST',data:{options:{requestedPolicyVersion:3}}})).data;
 if(!verified.bindings?.some(b=>b.role===role&&!b.condition&&b.members?.includes(member)))throw Error('Papel não confirmado.');
 console.log('CONFIRMADO: Firebase Rules Admin concedido somente à conta de publicação do CrediGestor.');
})().catch(e=>{console.error(e.response?.data?.error?.message||e.message);process.exitCode=1;});
