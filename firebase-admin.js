const admin = require('firebase-admin');

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://app-convites-linkedin-default-rtdb.firebaseio.com'
});

const db = admin.database();

// Timeout para evitar hang
db.ref('.info/connected').on('value', snap => {
  if (snap.val() === true) {
    console.log('✅ Firebase conectado!');
  } else {
    console.error('❌ Firebase desconectado!');
  }
});

module.exports = db;
