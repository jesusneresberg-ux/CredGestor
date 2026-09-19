// CrediGestor v26.1 - configuracao do app Web no projeto CrediGestor Testes.
// Esta configuracao identifica o projeto; ela nao e uma senha. A seguranca fica em firestore.rules.
// Use somente na branch multiusuario-v1 e no ambiente de testes. Nao substituir a versao atual na main.
window.CREDIGESTOR_MULTITENANT = true;
window.CREDIGESTOR_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDNFnbBUHScWlSKDlan4t0iOSSH9RBZgKw",
  authDomain: "credigestor-testes.firebaseapp.com",
  projectId: "credigestor-testes",
  storageBucket: "credigestor-testes.firebasestorage.app",
  messagingSenderId: "527901333868",
  appId: "1:527901333868:web:3774bb80584910a8107b49"
};

window.CREDIGESTOR_V26 = Object.freeze({
  version: "26.1.0",
  localStorageKey: "credigestor_v1",
  schemaVersion: 261
});
