import admin from 'firebase-admin';

let isFirebaseInitialized = false;

try {
  // Option A: Path to service account key JSON file via environment variable
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
    isFirebaseInitialized = true;
    console.log("Firebase Admin initialized via GOOGLE_APPLICATION_CREDENTIALS.");
  } 
  // Option B: Stringified JSON of the service account loaded from `.env`
  else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    isFirebaseInitialized = true;
    console.log("Firebase Admin initialized via FIREBASE_SERVICE_ACCOUNT string.");
  } 
  else {
    console.warn("⚠️ Firebase Admin SDK is NOT fully configured.");
    console.warn("You need to provide a Service Account Key from Firebase Console to use Social Auth.");
  }
} catch (error) {
  console.error("Firebase Admin initialization failed:", error);
}

export { admin, isFirebaseInitialized };
