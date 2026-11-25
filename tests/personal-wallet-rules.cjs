// Somente o dono lê e grava a carteira sincronizada em tempo real.
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,getDocs,collection}=require('firebase/firestore');
(async()=>{
 const rules=require('node:fs').readFileSync(process.env.CREDIGESTOR_RULES_PATH,'utf8');
 const env=await initializeTestEnvironment({projectId:'demo-credigestor',firestore:{host:'127.0.0.1',port:8188,rules}});
 try{
  const OWNER='r7XvaVZzBhglpaMAuMlBXuipBBt1';
  const owner=env.authenticatedContext(OWNER,{email:'owner@example.com'}).firestore();
  const other=env.authenticatedContext('other-user',{email:'other@example.com',email_verified:true}).firestore();
  const anonymous=env.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(owner,`personalWallets/${OWNER}`),{top:'{}',topHash:'a',order:[]}));
  await assertSucceeds(setDoc(doc(owner,`personalWallets/${OWNER}/clients/c1`),{json:'{}',hash:'h',deleted:false}));
  await assertSucceeds(getDocs(collection(owner,`personalWallets/${OWNER}/clients`)));
  await assertFails(getDoc(doc(other,`personalWallets/${OWNER}/clients/c1`)));
  await assertFails(setDoc(doc(other,`personalWallets/${OWNER}/clients/c2`),{json:'{}'}));
  await assertFails(getDoc(doc(anonymous,`personalWallets/${OWNER}`)));
  await assertFails(setDoc(doc(other,'personalWallets/other-user'),{top:'{}'}));
  console.log('PASS: carteira em tempo real acessível só pelo dono.');
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
