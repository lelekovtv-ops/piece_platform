"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCollaboration } from "@/hooks/useCollaboration";
import { useAuthStore } from "@/lib/auth/auth-store";
import { isPublicRoute } from "@/lib/auth/public-routes";
import { onAuthMessage, broadcastLogout } from "@/lib/auth/auth-channel";

const DEV_EMAIL = process.env.NEXT_PUBLIC_DEV_EMAIL;
const DEV_PASSWORD = process.env.NEXT_PUBLIC_DEV_PASSWORD;
const HAS_DEV_CREDENTIALS =
  process.env.NODE_ENV === "development" && !!DEV_EMAIL && !!DEV_PASSWORD;

function CollaborationBridge() {
  useCollaboration();
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const pathname = usePathname();
  const router = useRouter();
  const devLoginAttempted = useRef(false);
  const [devLoginPending, setDevLoginPending] = useState(HAS_DEV_CREDENTIALS);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isLoading || isAuthenticated || devLoginAttempted.current) return;
    if (HAS_DEV_CREDENTIALS) {
      devLoginAttempted.current = true;
      login(DEV_EMAIL!, DEV_PASSWORD!)
        .catch(() => {})
        .finally(() => setDevLoginPending(false));
    } else {
      setDevLoginPending(false);
    }
  }, [isLoading, isAuthenticated, login]);

  useEffect(() => {
    return onAuthMessage((msg) => {
      if (msg.type === "logout") {
        useAuthStore
          .getState()
          .logout()
          .then(() => {
            router.replace("/login");
          });
      } else if (msg.type === "login") {
        initialize();
      }
    });
  }, [initialize, router]);

  useEffect(() => {
    if (isLoading || devLoginPending) return;

    if (!isAuthenticated && !isPublicRoute(pathname)) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }

    if (isAuthenticated && pathname === "/login") {
      router.replace("/projects");
    }
  }, [isLoading, isAuthenticated, pathname, router, devLoginPending]);

  if (isLoading || devLoginPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0E0D0C]">
        <div className="text-sm text-white/30">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated && !isPublicRoute(pathname)) {
    return null;
  }

  return (
    <>
      <CollaborationBridge />
      {children}
    </>
  );
}
