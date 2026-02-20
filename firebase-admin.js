require('dotenv').config();  // ← ADICIONE ESSA LINHA PRIMEIRA!

const admin = require('firebase-admin');
const serviceAccount = {
  projectId: process.env.FIREBASEPROJECTID,
  privateKey: (process.env.FIREBASEPRIVATEKEY || '').replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASECLIENTEMAIL
};

if (!serviceAccount.projectId) {
  console.error('❌ FIREBASEPROJECTID não encontrado! Use .env');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://app-convites-linkedin-default-rtdb.firebaseio.com/'
});

const db = admin.database();

// Teste conexão
db.ref('.info/connected').on('value', (snap) => {
  if (snap.val() === true) {
    console.log('✅ Firebase conectado!');
  } else {
    console.error('❌ Firebase desconectado!');
  }
});

module.exports = db;
