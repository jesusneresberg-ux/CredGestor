const fs=require('node:fs'),path=require('node:path');
const colors=require('../native-icon-colors.json');
fs.mkdirSync('www',{recursive:true});
fs.writeFileSync('www/index.html','<!doctype html><title>CrediGestor</title><p>Conecte-se à internet para entrar no CrediGestor.</p>');
const config=JSON.parse(fs.readFileSync('capacitor.config.json'));
config.webDir='www';config.server.cleartext=false;
fs.writeFileSync('capacitor.config.json',JSON.stringify(config,null,2));
if(fs.existsSync('android')){
 const dest='android/app/src/main/java/com/credigestor/app';fs.mkdirSync(dest,{recursive:true});
 for(const name of ['MainActivity.java','CrediBiometricPlugin.java','CrediAppIconPlugin.java'])fs.copyFileSync(name,path.join(dest,name));
 const gradle='android/app/build.gradle';let text=fs.readFileSync(gradle,'utf8');
 if(!text.includes('androidx.biometric:biometric:'))text=text.replace('dependencies {',"dependencies {\n    implementation 'androidx.biometric:biometric:1.1.0'");
 // Keep version codes increasing for APK updates from this workflow.
 if(process.env.GITHUB_RUN_NUMBER)text=text.replace(/versionCode\s+\d+/,`versionCode ${1000+Number(process.env.GITHUB_RUN_NUMBER)}`);
 text=text.replace(/versionName\s+"[^"]+"/,'versionName "2026.11.17"');
 fs.writeFileSync(gradle,text);
 const res='android/app/src/main/res';
 for(const dir of ['drawable','mipmap-anydpi-v26','values'])fs.mkdirSync(path.join(res,dir),{recursive:true});
 // Same C mark as the header. Keep the glyph within the adaptive-icon safe zone.
 const cPath='M44,19 A20,20 0,1 0,44 45 L44,36 A12,12 0,1 1,44 28 Z';
 const vector=(body,size=64)=>`<?xml version="1.0" encoding="utf-8"?><vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="${size}dp" android:height="${size}dp" android:viewportWidth="${size}" android:viewportHeight="${size}">${body}</vector>`;
 fs.writeFileSync(path.join(res,'drawable/cg_foreground.xml'),vector(`<group android:translateX="28" android:translateY="28" android:scaleX="0.8125" android:scaleY="0.8125"><path android:fillColor="#FFFFFF" android:pathData="${cPath}"/></group>`,108));
 fs.writeFileSync(path.join(res,'values/cg_icon_colors.xml'),`<resources>${colors.map(c=>`<color name="cg_icon_${c.id}">${c.color}</color>`).join('')}</resources>`);
 for(const c of colors){
  fs.writeFileSync(path.join(res,`drawable/cg_icon_${c.id}.xml`),vector(`<path android:fillColor="${c.color}" android:pathData="M18,0 H46 Q64,0 64,18 V46 Q64,64 46,64 H18 Q0,64 0,46 V18 Q0,0 18,0 Z"/><path android:fillColor="#FFFFFF" android:pathData="${cPath}"/>`));
  fs.writeFileSync(path.join(res,`mipmap-anydpi-v26/cg_launcher_${c.id}.xml`),`<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/cg_icon_${c.id}"/><foreground android:drawable="@drawable/cg_foreground"/></adaptive-icon>`);
 }
 const manifest='android/app/src/main/AndroidManifest.xml';text=fs.readFileSync(manifest,'utf8');
 // Preserve MainActivity and other intents; the launcher entries live in aliases.
 text=text.replace(/<intent-filter\b[^>]*>[\s\S]*?<\/intent-filter>/g,block=>block.includes('android.intent.action.MAIN')&&block.includes('android.intent.category.LAUNCHER')?'':block);
 text=text.replace(/\s*<!-- CREDIGESTOR ICONS START -->[\s\S]*?<!-- CREDIGESTOR ICONS END -->/,'');
 text=text.replace(/android:icon="[^"]+"/,'android:icon="@drawable/cg_icon_blue"').replace(/android:roundIcon="[^"]+"/,'android:roundIcon="@drawable/cg_icon_blue"');
 const aliases=colors.map(c=>`<activity-alias android:name=".Launcher_${c.id}" android:targetActivity=".MainActivity" android:enabled="${c.id==='blue'}" android:exported="true" android:label="@string/app_name" android:icon="@drawable/cg_icon_${c.id}" android:roundIcon="@drawable/cg_icon_${c.id}"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity-alias>`).join('\n');
 // Versioned manifests override icon resources to use Android adaptive icons.
 for(const c of colors){
  const dir=path.join(res,'drawable-v26');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,`cg_icon_${c.id}.xml`),`<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/cg_icon_${c.id}"/><foreground android:drawable="@drawable/cg_foreground"/></adaptive-icon>`);
 }
 text=text.replace('</application>',`<!-- CREDIGESTOR ICONS START -->\n${aliases}\n<!-- CREDIGESTOR ICONS END -->\n</application>`);
 if(!text.includes('android.permission.USE_BIOMETRIC'))text=text.replace('</manifest>','<uses-permission android:name="android.permission.USE_BIOMETRIC" /></manifest>');
 fs.writeFileSync(manifest,text);
}
