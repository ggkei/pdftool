"use client";

import type { ReactNode } from "react";
import { UserProvider } from "./UserContext";
import { LoginModal } from "./LoginModal";

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      {children}
      <LoginModal />
    </UserProvider>
  );
}
