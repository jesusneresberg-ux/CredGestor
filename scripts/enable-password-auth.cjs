// Uses the existing Firebase deployment account. Never print credential or API payloads.
const {GoogleAuth}=require('google-auth-library');
(async()=>{
 const project='credigestor-testes';
 const credentials=JSON.parse(process.env.FIREBASE_DEPLOY_ACCOUNT||'{}');
 if(credentials.project_id!==project)throw Error('Conta de publicação não corresponde ao projeto CrediGestor.');
 const client=await new GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/cloud-platform']}).getClient();
 const url=`https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
 const current=await client.request({url});
 if(!current.data.signIn?.email?.enabled||!current.data.signIn?.email?.passwordRequired){
  await client.request({url,method:'PATCH',params:{updateMask:'signIn.email.enabled,signIn.email.passwordRequired'},data:{signIn:{email:{enabled:true,passwordRequired:true}}}});
 }
 const check=await client.request({url});
 if(!check.data.signIn?.email?.enabled||!check.data.signIn?.email?.passwordRequired)throw Error('Configuração de e-mail/senha não confirmada.');
 console.log('Login por e-mail e senha habilitado no CrediGestor.');
})().catch(e=>{console.error('Não foi possível habilitar e-mail/senha. Verifique a permissão firebaseauth.configs.update da conta de publicação. HTTP:',e.response?.status||'indisponível');process.exitCode=1;});
