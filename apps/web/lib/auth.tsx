"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type Auth, type User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { ensureProfile } from "@hisabkitaab/shared/data";
import { firebaseConfigured, getFirebase } from "./firebase";

type AuthState =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "signedOut"; auth: Auth; db: Firestore }
  | { status: "signedIn"; auth: Auth; db: Firestore; user: User };

const AuthContext = createContext<AuthState>({ status: "loading" });

/** Tracks the Firebase session. Firebase persists it in the browser, so users stay logged in. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    firebaseConfigured ? { status: "loading" } : { status: "unconfigured" },
  );

  useEffect(() => {
    if (!firebaseConfigured) return;
    const { auth, db } = getFirebase();
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        setState({ status: "signedIn", auth, db, user });
        void ensureProfile(db, user).catch(() => undefined);
      } else {
        setState({ status: "signedOut", auth, db });
      }
    });
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
