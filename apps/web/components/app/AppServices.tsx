"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Auth, User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import type { MessageService } from "@hisabkitaab/shared";
import { useWebMessageService } from "@/lib/messaging";

interface AppServices {
  auth: Auth;
  db: Firestore;
  user: User;
  uid: string;
  messages: MessageService;
}

const ServicesContext = createContext<AppServices | null>(null);

export function AppServicesProvider({
  auth,
  db,
  user,
  children,
}: {
  auth: Auth;
  db: Firestore;
  user: User;
  children: ReactNode;
}) {
  const messages = useWebMessageService(auth, db, user.uid);
  return (
    <ServicesContext.Provider value={{ auth, db, user, uid: user.uid, messages }}>{children}</ServicesContext.Provider>
  );
}

export function useServices(): AppServices {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error("useServices must be used inside <AppServicesProvider>");
  return ctx;
}
