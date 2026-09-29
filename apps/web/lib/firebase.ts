"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { browserLocalPersistence, connectAuthEmulator, getAuth, setPersistence, type Auth } from "firebase/auth";
import { FIRESTORE_DATABASE_ID } from "@hisabkitaab/shared";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

export const usingEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || (usingEmulator ? "demo-key" : ""),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || (usingEmulator ? "demo-hisabkitaab" : ""),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || undefined,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || undefined,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

interface FirebaseClients {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let clients: FirebaseClients | null = null;

/**
 * Lazily creates the Firebase clients in the browser.
 * Firestore keeps an IndexedDB cache so the app opens instantly on slow
 * networks and keeps working offline; writes sync when back online.
 */
export function getFirebase(): FirebaseClients {
  if (clients) return clients;
  if (typeof window === "undefined") throw new Error("getFirebase() must only be called in the browser");
  if (!firebaseConfigured) throw new Error("Firebase is not configured. See apps/web/.env.example");

  const app = getApps().length ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  void setPersistence(auth, browserLocalPersistence);

  let db: Firestore;
  try {
    db = initializeFirestore(
      app,
      { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
      FIRESTORE_DATABASE_ID,
    );
  } catch {
    // Private browsing or unsupported IndexedDB: fall back to memory.
    db = initializeFirestore(app, { localCache: memoryLocalCache() }, FIRESTORE_DATABASE_ID);
  }

  if (usingEmulator) {
    const host = window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname;
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
  }

  clients = { app, auth, db };
  return clients;
}
