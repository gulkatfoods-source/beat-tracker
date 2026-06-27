import * as admin from 'firebase-admin';

let initializationError: Error | null = null;
const isConfigured = !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);

if (!admin.apps.length) {
  if (isConfigured) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    } catch (error) {
      initializationError = error instanceof Error ? error : new Error(String(error));
    }
  }
}

export const getDb = (): admin.firestore.Firestore => {
  if (initializationError) throw new Error(`Firebase init failed: ${initializationError.message}`);
  if (!admin.apps.length) throw new Error('Firebase not configured.');
  return admin.firestore();
};
