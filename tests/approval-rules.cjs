const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,updateDoc,serverTimestamp}=require('firebase/firestore');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-credigestor',firestore:{host:'127.0.0.1',port:8188}});
 try{
  const user=env.authenticatedContext('new-user',{email:'new@example.com',email_verified:false}).firestore();
  const other=env.authenticatedContext('other-user',{email:'other@example.com',email_verified:true}).firestore();
  const admin=env.authenticatedContext('r7XvaVZzBhglpaMAuMlBXuipBBt1',{email:'admin@example.com',email_verified:true}).firestore();
  const anonymous=env.unauthenticatedContext().firestore();
  const path='accountApprovals/new-user',ref=doc(user,path);
  await assertFails(getDoc(doc(anonymous,path)));
  await assertSucceeds(setDoc(ref,{uid:'new-user',email:'new@example.com',status:'pending',createdAt:serverTimestamp()}));
  await assertSucceeds(getDoc(ref));
  await assertFails(updateDoc(ref,{status:'approved'}));
  await assertFails(setDoc(ref,{uid:'new-user',email:'new@example.com',status:'approved',createdAt:serverTimestamp()}));
  await assertFails(getDoc(doc(other,path)));
  await assertFails(getDocs(collection(user,'accountApprovals')));
  await assertSucceeds(getDocs(collection(admin,'accountApprovals')));
  const review=status=>({status,reviewedBy:'r7XvaVZzBhglpaMAuMlBXuipBBt1',reviewedAt:serverTimestamp()});
  await assertSucceeds(updateDoc(doc(admin,path),review('approved')));
  if((await getDoc(ref)).data().status!=='approved')throw Error('Aprovação não confirmada.');
  await assertFails(updateDoc(doc(admin,path),{...review('approved'),uid:'changed'}));
  await assertSucceeds(updateDoc(doc(admin,path),review('blocked')));
  await assertSucceeds(updateDoc(doc(admin,path),review('rejected')));
  await assertFails(getDoc(doc(user,'organizations/org_r7XvaVZzBhglpaMAuMlBXuipBBt1/appData/main')));
  console.log('PASS: servidor impede autoaprovação e leitura de terceiros; somente o administrador aprova, bloqueia e recusa.');
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
