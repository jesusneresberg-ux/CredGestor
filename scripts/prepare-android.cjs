const fs=require('node:fs'),path=require('node:path');
fs.mkdirSync('www',{recursive:true});
fs.writeFileSync('www/index.html','<!doctype html><title>CrediGestor</title><p>Conecte-se à internet para entrar no CrediGestor.</p>');
const config=JSON.parse(fs.readFileSync('capacitor.config.json'));
config.webDir='www';config.server.cleartext=false;
fs.writeFileSync('capacitor.config.json',JSON.stringify(config,null,2));
if(fs.existsSync('android')){
 const dest='android/app/src/main/java/com/credigestor/app';fs.mkdirSync(dest,{recursive:true});
 for(const name of ['MainActivity.java','CrediBiometricPlugin.java'])fs.copyFileSync(name,path.join(dest,name));
 const gradle='android/app/build.gradle';let text=fs.readFileSync(gradle,'utf8');
 text=text.replace('dependencies {',"dependencies {\n    implementation 'androidx.biometric:biometric:1.1.0'");
 fs.writeFileSync(gradle,text);
 const manifest='android/app/src/main/AndroidManifest.xml';text=fs.readFileSync(manifest,'utf8').replace('</manifest>','<uses-permission android:name="android.permission.USE_BIOMETRIC" /></manifest>');fs.writeFileSync(manifest,text);
}
