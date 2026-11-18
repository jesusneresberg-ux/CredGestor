 (function(){
   'use strict';
   const KEY = 'credigestor_single_owner_v25';
   const OWNER = 'r7XvaVZzBhglpaMAuMlBXuipBBt1';
   const ORG = 'org_' + OWNER;
   let unsubscribe = null;
   let suppressRemote = false;
   let lastKnownRevision = 0;
   let db = null;
   let ref = null;
 
   function log(msg){ console.log('[CrediGestorSync]', msg); }
 
   function init(firebaseDb){
     if(unsubscribe) return;
     db = firebaseDb;
     ref = db.collection('organizations').doc(ORG).collection('appData').doc('main');
     log('Iniciando listener em tempo real para ' + ORG);
     unsubscribe = ref.onSnapshot({ source: 'default' }, function(snap){
       if(!snap.exists || suppressRemote) return;
       var data = snap.data();
       if(!data || typeof data.revision !== 'number') return;
       if(data.revision <= lastKnownRevision) return;
       lastKnownRevision = data.revision;
       var payload = data.state;
       if(data.storage && window.CrediGestorCore && window.CrediGestorCore.hydrate){
         // Hydrate é assíncrono; para snapshot simples assumimos state inline quando não há storage
         log('Snapshot com storage detectado; usando estado inline se disponível.');
       }
       if(!payload || !Array.isArray(payload.clients)) return;
       try{
         var validated = window.CrediGestorCore ? window.CrediGestorCore.validate(payload) : payload;
         var raw = JSON.stringify(validated);
         localStorage.setItem(KEY, raw);
         if(window.state && typeof window.render === 'function'){
           Object.keys(window.state).forEach(function(k){ delete window.state[k]; });
           Object.assign(window.state, validated);
           window.render();
           if(typeof window.applySettings === 'function') window.applySettings();
           log('Estado atualizado via onSnapshot (rev ' + data.revision + ')');
         }
       }catch(e){
         console.error('[CrediGestorSync] Erro ao aplicar snapshot remoto', e);
       }
     }, function(err){
       console.error('[CrediGestorSync] Falha no listener', err);
     });
   }
 
   function notifyLocalSave(revision){
     lastKnownRevision = revision || lastKnownRevision;
     suppressRemote = true;
     setTimeout(function(){ suppressRemote = false; }, 800);
   }
 
   function stop(){
     if(unsubscribe){ unsubscribe(); unsubscribe = null; }
   }
 
   window.CrediGestorPersonalSync = Object.freeze({
     init: init,
     notifyLocalSave: notifyLocalSave,
     stop: stop
   });
 })();
