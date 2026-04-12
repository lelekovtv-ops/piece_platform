"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/auth/auth-fetch";
import { useAuthStore } from "@/lib/auth/auth-store";
import { Check, AlertCircle, Loader2 } from "lucide-react";

type Status = "loading" | "success" | "already_member" | "error";

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const token = params.token as string;

  const [status, setStatus] = useState<Status>("loading");
  const [teamName, setTeamName] = useState("");
  const [role, setRole] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token || !user) return;

    async function accept() {
      try {
        const res = await authFetch(`/v1/auth/accept-invite/${token}`, {
          method: "POST",
        });
        const data = await res.json();

        if (res.ok) {
          setTeamName(data.team?.name || "");
          setRole(data.role || "");
          setStatus("success");
          setTimeout(() => router.push("/home"), 3000);
        } else if (res.status === 409) {
          setStatus("already_member");
          setTimeout(() => router.push("/home"), 3000);
        } else {
          setErrorMessage(data.message || "Invalid invite link");
          setStatus("error");
        }
      } catch {
        setErrorMessage("Something went wrong");
        setStatus("error");
      }
    }

    accept();
  }, [token, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F0E0D] text-[#E7E3DC]">
      <div className="w-full max-w-sm rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center">
        {status === "loading" && (
          <>
            <Loader2
              size={32}
              className="mx-auto mb-4 animate-spin text-[#D4A853]"
            />
            <h1 className="text-[16px] font-semibold">Joining team...</h1>
            <p className="mt-2 text-[13px] text-white/40">Please wait</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
              <Check size={24} className="text-emerald-400" />
            </div>
            <h1 className="text-[16px] font-semibold">Joined {teamName}!</h1>
            <p className="mt-2 text-[13px] text-white/40">
              You joined as <span className="text-[#D4A853]">{role}</span>
            </p>
            <p className="mt-4 text-[11px] text-white/20">Redirecting...</p>
          </>
        )}

        {status === "already_member" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15">
              <Check size={24} className="text-blue-400" />
            </div>
            <h1 className="text-[16px] font-semibold">Already a member</h1>
            <p className="mt-2 text-[13px] text-white/40">
              You are already part of this team
            </p>
            <p className="mt-4 text-[11px] text-white/20">Redirecting...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
              <AlertCircle size={24} className="text-red-400" />
            </div>
            <h1 className="text-[16px] font-semibold">Invalid invite</h1>
            <p className="mt-2 text-[13px] text-white/40">{errorMessage}</p>
            <button
              onClick={() => router.push("/home")}
              className="mt-6 rounded-lg bg-[#D4A853]/20 px-4 py-2 text-[13px] font-medium text-[#D4A853] transition-colors hover:bg-[#D4A853]/30"
            >
              Go to Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
