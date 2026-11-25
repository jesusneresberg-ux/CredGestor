// Qualquer conta autenticada lê e grava a própria carteira; acesso cruzado é negado.
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,getDocs,collection}=require('firebase/firestore');
(async()=>{
 const rules=require('node:fs').readFileSync(process.env.CREDIGESTOR_RULES_PATH,'utf8');
 const env=await initializeTestEnvironment({projectId:'demo-credigestor',firestore:{host:'127.0.0.1',port:8188,rules}});
 try{
  const OWNER='r7XvaVZzBhglpaMAuMlBXuipBBt1';
  const OTHER='other-user';
  const owner=env.authenticatedContext(OWNER,{email:'owner@example.com'}).firestore();
  const other=env.authenticatedContext(OTHER,{email:'other@example.com',email_verified:true}).firestore();
  const anonymous=env.unauthenticatedContext().firestore();

  // Dono acessa a própria carteira
  await assertSucceeds(setDoc(doc(owner,`personalWallets/${OWNER}`),{top:'{}',topHash:'a',order:[]}));
  await assertSucceeds(setDoc(doc(owner,`personalWallets/${OWNER}/clients/c1`),{json:'{}',hash:'h',deleted:false}));
  await assertSucceeds(getDocs(collection(owner,`personalWallets/${OWNER}/clients`)));

  // Outra conta autenticada acessa a própria carteira
  await assertSucceeds(setDoc(doc(other,`personalWallets/${OTHER}`),{top:'{}',topHash:'b',order:[]}));
  await assertSucceeds(setDoc(doc(other,`personalWallets/${OTHER}/clients/c2`),{json:'{}',hash:'h2',deleted:false}));
  await assertSucceeds(getDocs(collection(other,`personalWallets/${OTHER}/clients`)));

  // Acesso cruzado é negado
  await assertFails(getDoc(doc(other,`personalWallets/${OWNER}/clients/c1`)));
  await assertFails(setDoc(doc(other,`personalWallets/${OWNER}/clients/c2`),{json:'{}'}));
  await assertFails(getDoc(doc(owner,`personalWallets/${OTHER}`)));
  await assertFails(setDoc(doc(owner,`personalWallets/${OTHER}/clients/c3`),{json:'{}'}));

  // Anônimo não acessa nada
  await assertFails(getDoc(doc(anonymous,`personalWallets/${OWNER}`)));
  await assertFails(setDoc(doc(anonymous,`personalWallets/${OTHER}`),{top:'{}'}));

  console.log('PASS: carteira em tempo real acessível por qualquer conta autenticada, isolada por UID.');
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});