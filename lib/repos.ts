import {getDb} from './firebase-admin';
import type {Outlet, OutletVisit} from './types';

const isConfigured = !!(
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
);

async function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), ms)),
  ]);
}

export const repos = {
  outlets: {
    async list(): Promise<Outlet[]> {
      if (!isConfigured) return [];
      try {
        const db = getDb();
        const snap = await withTimeout(db.collection('outlets').get());
        return snap.docs.map((d) => ({id: d.id, ...d.data()} as Outlet));
      } catch { return []; }
    },

    async getById(id: string): Promise<Outlet | null> {
      if (!isConfigured) return null;
      try {
        const db = getDb();
        const doc = await withTimeout(db.collection('outlets').doc(id).get());
        if (!doc.exists) return null;
        return {id: doc.id, ...doc.data()} as Outlet;
      } catch { return null; }
    },

    async create(data: Omit<Outlet, 'id'>): Promise<Outlet> {
      const db = getDb();
      const now = new Date().toISOString();
      const ref = db.collection('outlets').doc();
      const outlet: Outlet = {id: ref.id, ...data, createdAt: now, updatedAt: now};
      await ref.set(outlet);
      return outlet;
    },

    async update(id: string, data: Partial<Outlet>): Promise<void> {
      const db = getDb();
      await db.collection('outlets').doc(id).update({...data, updatedAt: new Date().toISOString()});
    },

    async delete(id: string): Promise<void> {
      const db = getDb();
      await db.collection('outlets').doc(id).delete();
    },

    async listByBeat(beat: string): Promise<Outlet[]> {
      if (!isConfigured) return [];
      try {
        const db = getDb();
        const snap = await withTimeout(db.collection('outlets').where('beat', '==', beat).get());
        return snap.docs.map((d) => ({id: d.id, ...d.data()} as Outlet));
      } catch { return []; }
    },

    async listBeats(): Promise<string[]> {
      if (!isConfigured) return [];
      try {
        const db = getDb();
        const snap = await withTimeout(db.collection('outlets').get());
        const beats = new Set<string>();
        snap.docs.forEach((d) => { const b = d.data().beat; if (b) beats.add(b as string); });
        return Array.from(beats).sort();
      } catch { return []; }
    },

    async addVisit(id: string, visit: OutletVisit): Promise<void> {
      const db = getDb();
      const doc = await db.collection('outlets').doc(id).get();
      const existing: OutletVisit[] = doc.exists ? (doc.data()?.visitLog ?? []) : [];
      await db.collection('outlets').doc(id).update({
        visitLog: [...existing, visit],
        lastVisited: visit.date,
        updatedAt: new Date().toISOString(),
      });
    },
  },
};
