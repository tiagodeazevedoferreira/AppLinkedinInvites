// Topo do firebase-admin.js (SUBSTITUA COMPLETO)
const admin = require('firebase-admin');

// Fix private key pra GitHub secrets (multi-linha → string única)
const privateKey = process.env.FIREBASEPRIVATEKEY
  ? process.env.FIREBASEPRIVATEKEY.replace(/\\n/g, '\n')
  : '';

const serviceAccount = {
  projectId: process.env.FIREBASEPROJECTID,
  privateKey: privateKey,
  clientEmail: process.env.FIREBASECLIENTEMAIL
};

console.log('🔍 Firebase config:', {
  projectId: serviceAccount.projectId ? 'OK' : 'MISSING',
  privateKey: privateKey.includes('BEGIN PRIVATE KEY') ? 'OK' : 'INVALID',
  clientEmail: serviceAccount.clientEmail ? 'OK' : 'MISSING'
});

if (!serviceAccount.projectId || !privateKey.includes('PRIVATE KEY')) {
  console.error('❌ Firebase secrets inválidos!');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://app-convites-linkedin-default-rtdb.firebaseio.com/'
});

const db = admin.database();
db.ref('.info/connected').on('value', snap => {
  console.log('Firebase:', snap.val() ? '✅ Conectado' : '❌ Desconectado');
});

module.exports = db;
