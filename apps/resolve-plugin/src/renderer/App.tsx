import { useEffect } from "react";
import { useAuthStore } from "./stores/auth-store";
import { useLicenseStore } from "./stores/license-store";
import DeviceCodeScreen from "./components/auth/DeviceCodeScreen";
import UpgradeScreen from "./components/license/UpgradeScreen";

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-100">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-600 border-t-white" />
        <p className="mt-4 text-sm text-neutral-400">Loading…</p>
      </div>
    </div>
  );
}

function MainScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-100">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">PIECE Studio</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Connected to DaVinci Resolve
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const authStatus = useAuthStore((s) => s.status);
  const { hasLicense, loading: licenseLoading } = useLicenseStore();

  useEffect(() => {
    async function init() {
      try {
        const user = await window.api?.auth.getCurrentUser();
        if (user) {
          useAuthStore.getState().setUser(user);
          const license = await window.api?.license.check();
          if (license) {
            useLicenseStore.getState().setLicense(license);
          }
        } else {
          useAuthStore.getState().setUnauthenticated();
          useLicenseStore.getState().setLicense({
            hasLicense: false,
            tier: null,
            expiresAt: null,
            stale: false,
          });
        }
      } catch {
        useAuthStore.getState().setUnauthenticated();
      }
    }
    init();
  }, []);

  if (authStatus === "checking") {
    return <LoadingScreen />;
  }

  if (authStatus !== "authenticated") {
    return <DeviceCodeScreen />;
  }

  if (licenseLoading) {
    return <LoadingScreen />;
  }

  if (!hasLicense) {
    return <UpgradeScreen />;
  }

  return <MainScreen />;
}
