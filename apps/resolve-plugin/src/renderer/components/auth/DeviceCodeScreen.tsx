import { useEffect, useCallback } from "react";
import { useAuthStore } from "../../stores/auth-store";

declare global {
  interface Window {
    api?: {
      auth: {
        startSignIn: () => Promise<{
          userCode: string;
          deviceCode: string;
          verificationUri: string;
          expiresIn: number;
          interval: number;
        }>;
        getCurrentUser: () => Promise<{
          id: string;
          email: string;
          name?: string;
        } | null>;
        signOut: () => Promise<void>;
      };
    };
  }
}

export default function DeviceCodeScreen() {
  const {
    status,
    userCode,
    verificationUri,
    error,
    setDeviceCode,
    setError,
    setChecking,
  } = useAuthStore();

  const handleSignIn = useCallback(async () => {
    setChecking();
    try {
      const info = await window.api?.auth.startSignIn();
      if (info) {
        setDeviceCode(info);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    }
  }, [setChecking, setDeviceCode, setError]);

  useEffect(() => {
    if (status === "unauthenticated") {
      // Auto-start on mount
    }
  }, [status]);

  if (status === "checking") {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-100">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-600 border-t-white" />
          <p className="mt-4 text-sm text-neutral-400">
            Checking authentication…
          </p>
        </div>
      </div>
    );
  }

  if (status === "awaiting-code" && userCode) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-100">
        <div className="mx-auto max-w-sm text-center">
          <h1 className="text-xl font-semibold">Sign in to PIECE</h1>
          <p className="mt-4 text-sm text-neutral-400">
            Go to the URL below and enter this code:
          </p>
          <div className="mt-4 rounded-lg bg-neutral-800 px-6 py-4">
            <span className="font-mono text-3xl font-bold tracking-widest text-white">
              {userCode}
            </span>
          </div>
          {verificationUri && (
            <p className="mt-4 text-xs text-neutral-500 break-all">
              {verificationUri}
            </p>
          )}
          <p className="mt-6 text-xs text-neutral-600">
            Waiting for authorization…
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-100">
        <div className="text-center">
          <p className="text-sm text-red-400">
            {error || "Something went wrong"}
          </p>
          <button
            type="button"
            onClick={handleSignIn}
            className="mt-4 rounded bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // unauthenticated
  return (
    <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-100">
      <div className="text-center">
        <h1 className="text-xl font-semibold">PIECE Studio</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Sign in to connect your PIECE account
        </p>
        <button
          type="button"
          onClick={handleSignIn}
          className="mt-6 rounded bg-white px-6 py-2.5 text-sm font-medium text-black hover:bg-neutral-200"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
