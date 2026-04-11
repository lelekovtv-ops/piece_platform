"use client";

import { useState, useRef, useEffect } from "react";
import { verifyDeviceCode } from "@/lib/api/device-auth";
import { useAuthStore } from "@/lib/auth/auth-store";
import { CheckCircle2, XCircle, Loader2, Monitor } from "lucide-react";

type Status = "idle" | "submitting" | "success" | "error";

function formatCodeInput(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
}

export default function DeviceCodeCard() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [appId, setAppId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCodeInput(e.target.value);
    setCode(formatted);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const clean = code.replace("-", "");
    if (clean.length !== 8) {
      setError("Please enter a complete 8-character code");
      return;
    }

    setStatus("submitting");
    setError("");

    try {
      const result = await verifyDeviceCode(code);
      setAppId(result.appId);
      setStatus("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      setStatus("error");
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-white/10 bg-white/3 p-8 backdrop-blur-xl shadow-2xl">
        <div className="mb-6 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/10">
            <Monitor className="h-7 w-7 text-amber-400" />
          </div>
        </div>

        {status === "success" ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-emerald-400" />
            <h2 className="mb-2 text-xl font-semibold text-white">
              Device Authorized
            </h2>
            <p className="text-sm text-neutral-400">
              {appId === "piece-studio"
                ? "PIECE Studio has been connected. You can return to DaVinci Resolve."
                : "Device has been authorized. You can close this tab."}
            </p>
          </div>
        ) : (
          <>
            <h2 className="mb-2 text-center text-xl font-semibold text-white">
              Connect Device
            </h2>
            <p className="mb-6 text-center text-sm text-neutral-400">
              Enter the code shown in PIECE Studio
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  ref={inputRef}
                  type="text"
                  value={code}
                  onChange={handleChange}
                  placeholder="XXXX-XXXX"
                  maxLength={9}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center font-mono text-2xl tracking-[0.2em] text-white placeholder-neutral-600 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  <XCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  status === "submitting" || code.replace("-", "").length !== 8
                }
                className="w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-medium text-black transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {status === "submitting" ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </span>
                ) : status === "error" ? (
                  "Try Again"
                ) : (
                  "Authorize Device"
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
