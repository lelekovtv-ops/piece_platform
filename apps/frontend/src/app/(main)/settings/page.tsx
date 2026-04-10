"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Lock,
  Eye,
  EyeOff,
  Monitor,
  Smartphone,
  Tablet,
  X,
  LogOut,
  Users,
  Link2,
  Copy,
  Check,
  Trash2,
  Plus,
  ChevronDown,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth/auth-store";
import { authFetch, getCurrentTeamId } from "@/lib/auth/auth-fetch";

interface Session {
  id: string;
  deviceInfo: { browser: string; os: string; deviceType: string };
  ip: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent?: boolean;
}
interface TeamMember {
  userId: string;
  role: string;
  joinedAt: string;
  name?: string;
  email?: string;
}

interface TeamInvite {
  id: string;
  token: string;
  role: string;
  createdBy: string;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-[#D4A853]/15 text-[#D4A853]",
  admin: "bg-purple-500/15 text-purple-400",
  manager: "bg-blue-500/15 text-blue-400",
};
function DeviceIcon({ type }: { type: string }) {
  if (type === "mobile")
    return <Smartphone size={14} className="text-white/40" />;
  if (type === "tablet") return <Tablet size={14} className="text-white/40" />;
  return <Monitor size={14} className="text-white/40" />;
}

function formatRelativeTime(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  if (ms < 60_000) return "Just now";
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86400_000) return `${Math.floor(ms / 3600_000)}h ago`;
  return `${Math.floor(ms / 86400_000)}d ago`;
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionAction, setSessionAction] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [inviteRole, setInviteRole] = useState<"admin" | "manager">("manager");
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [inviteCreating, setInviteCreating] = useState(false);
  const fetchSessions = useCallback(async () => {
    try {
      const res = await authFetch("/v1/auth/sessions");
      if (res.ok) {
        const json = await res.json();
        setSessions(json.data || []);
      }
    } catch {
      // Session loading is non-critical
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);
  const teamId = getCurrentTeamId();

  const fetchTeamData = useCallback(async () => {
    if (!teamId) return;
    try {
      const [membersRes, invitesRes] = await Promise.all([
        authFetch(`/v1/teams/${teamId}/members`),
        authFetch(`/v1/teams/${teamId}/invites`),
      ]);
      if (membersRes.ok) {
        const json = await membersRes.json();
        setMembers(json.data || []);
      }
      if (invitesRes.ok) {
        const json = await invitesRes.json();
        setInvites(json.data || []);
      }
    } catch {
      // Team data loading is non-critical
    } finally {
      setTeamLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  async function handleCreateInvite() {
    if (!teamId) return;
    setInviteCreating(true);
    try {
      const res = await authFetch(`/v1/teams/${teamId}/invites`, {
        method: "POST",
        body: JSON.stringify({ role: inviteRole }),
      });
      if (res.ok) {
        const invite = await res.json();
        setInvites((prev) => [...prev, invite]);
      }
    } finally {
      setInviteCreating(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    if (!teamId) return;
    const res = await authFetch(`/v1/teams/${teamId}/invites/${inviteId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!teamId) return;
    const res = await authFetch(`/v1/teams/${teamId}/members/${userId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    }
  }

  function getInviteLink(token: string) {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/auth/accept-invite/${token}`;
  }

  async function handleCopyLink(token: string) {
    await navigator.clipboard.writeText(getInviteLink(token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }
  async function handleRevokeSession(sessionId: string) {
    setSessionAction(sessionId);
    try {
      const res = await authFetch(`/v1/auth/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    } finally {
      setSessionAction(null);
    }
  }

  async function handleRevokeAll() {
    setSessionAction("all");
    try {
      const res = await authFetch("/v1/auth/sessions", { method: "DELETE" });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.isCurrent));
      }
    } finally {
      setSessionAction(null);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (newPassword !== confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match" });
      return;
    }

    if (newPassword.length < 8) {
      setStatus({
        type: "error",
        message: "Password must be at least 8 characters",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await authFetch("/v1/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to change password");
      }

      setStatus({ type: "success", message: "Password changed successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0F0E0D] text-[#E7E3DC]">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <button
          onClick={() => router.back()}
          className="mb-8 flex items-center gap-2 text-[13px] text-white/40 transition-colors hover:text-white/60"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <h1 className="mb-8 text-[20px] font-semibold tracking-tight">
          Settings
        </h1>
        <section className="mb-10 rounded-xl border border-white/8 bg-white/[0.02] p-6">
          <h2 className="mb-4 text-[14px] font-medium text-white/60">
            Account
          </h2>
          <div className="space-y-3">
            <div>
              <span className="text-[12px] text-white/30">Email</span>
              <p className="text-[14px]">{user?.email}</p>
            </div>
            <div>
              <span className="text-[12px] text-white/30">Name</span>
              <p className="text-[14px]">{user?.name || "—"}</p>
            </div>
          </div>
        </section>
        <section className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
          <div className="mb-4 flex items-center gap-2">
            <Lock size={15} className="text-white/40" />
            <h2 className="text-[14px] font-medium text-white/60">
              Change Password
            </h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="mb-1 block text-[12px] text-white/30">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-[#E7E3DC] outline-none transition-colors focus:border-[#D4A853]/40"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 transition-colors hover:text-white/40"
                >
                  {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[12px] text-white/30">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-[#E7E3DC] outline-none transition-colors focus:border-[#D4A853]/40"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 transition-colors hover:text-white/40"
                >
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[12px] text-white/30">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-[#E7E3DC] outline-none transition-colors focus:border-[#D4A853]/40"
              />
            </div>

            {status && (
              <p
                className={`text-[12px] ${status.type === "success" ? "text-emerald-400" : "text-red-400"}`}
              >
                {status.message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#D4A853]/20 px-4 py-2 text-[13px] font-medium text-[#D4A853] transition-colors hover:bg-[#D4A853]/30 disabled:opacity-40"
            >
              {loading ? "Saving..." : "Change Password"}
            </button>
          </form>
        </section>
        <section className="mt-10 rounded-xl border border-white/8 bg-white/[0.02] p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor size={15} className="text-white/40" />
              <h2 className="text-[14px] font-medium text-white/60">
                Active Sessions
              </h2>
            </div>
            {sessions.length > 1 && (
              <button
                onClick={handleRevokeAll}
                disabled={sessionAction === "all"}
                className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-[12px] font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-40"
              >
                <LogOut size={12} />
                {sessionAction === "all" ? "Revoking..." : "Revoke All Others"}
              </button>
            )}
          </div>

          {sessionsLoading ? (
            <p className="text-[13px] text-white/20">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="text-[13px] text-white/30">No active sessions</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border border-white/6 bg-white/[0.015] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <DeviceIcon type={session.deviceInfo.deviceType} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-[#E7E3DC]">
                          {session.deviceInfo.browser}
                        </span>
                        <span className="text-[11px] text-white/20">
                          {session.deviceInfo.os}
                        </span>
                        {session.isCurrent && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/20">
                        <span>{session.ip}</span>
                        <span>·</span>
                        <span>{formatRelativeTime(session.lastActiveAt)}</span>
                      </div>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <button
                      onClick={() => handleRevokeSession(session.id)}
                      disabled={sessionAction === session.id}
                      className="rounded-lg p-1.5 text-white/20 transition-colors hover:bg-white/5 hover:text-red-400 disabled:opacity-40"
                      title="Revoke session"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
        {/* Team Section */}
        <section className="mt-10 rounded-xl border border-white/8 bg-white/[0.02] p-6">
          <div className="mb-4 flex items-center gap-2">
            <Users size={15} className="text-white/40" />
            <h2 className="text-[14px] font-medium text-white/60">Team</h2>
          </div>

          {teamLoading ? (
            <p className="text-[13px] text-white/20">Loading team...</p>
          ) : (
            <>
              {/* Members list */}
              <div className="mb-6">
                <h3 className="mb-3 text-[12px] font-medium uppercase tracking-wider text-white/30">
                  Members
                </h3>
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between rounded-lg border border-white/6 bg-white/[0.015] px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-[11px] font-medium text-white/40">
                          {(member.email || member.userId)
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <div>
                          <span className="text-[13px] text-[#E7E3DC]">
                            {member.email || member.userId}
                          </span>
                          <span
                            className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[member.role] || "bg-white/5 text-white/40"}`}
                          >
                            {member.role}
                          </span>
                          {member.userId === user?.id && (
                            <span className="ml-1 text-[10px] text-white/20">
                              (you)
                            </span>
                          )}
                        </div>
                      </div>
                      {member.role !== "owner" &&
                        member.userId !== user?.id && (
                          <button
                            onClick={() => handleRemoveMember(member.userId)}
                            className="rounded-lg p-1.5 text-white/20 transition-colors hover:bg-white/5 hover:text-red-400"
                            title="Remove member"
                          >
                            <X size={14} />
                          </button>
                        )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Invite links section */}
              <div>
                <h3 className="mb-3 text-[12px] font-medium uppercase tracking-wider text-white/30">
                  Invite Links
                </h3>

                {/* Create invite control */}
                <div className="mb-4 flex items-center gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-[#E7E3DC] transition-colors hover:border-white/20"
                    >
                      {inviteRole}
                      <ChevronDown size={12} className="text-white/30" />
                    </button>
                    {showRoleDropdown && (
                      <div className="absolute left-0 top-full z-10 mt-1 rounded-lg border border-white/10 bg-[#1A1918] py-1 shadow-xl">
                        {(["manager", "admin"] as const).map((role) => (
                          <button
                            key={role}
                            onClick={() => {
                              setInviteRole(role);
                              setShowRoleDropdown(false);
                            }}
                            className="block w-full px-4 py-1.5 text-left text-[12px] text-[#E7E3DC] transition-colors hover:bg-white/5"
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleCreateInvite}
                    disabled={inviteCreating}
                    className="flex items-center gap-1.5 rounded-lg bg-[#D4A853]/20 px-3 py-1.5 text-[12px] font-medium text-[#D4A853] transition-colors hover:bg-[#D4A853]/30 disabled:opacity-40"
                  >
                    <Plus size={12} />
                    {inviteCreating ? "Creating..." : "Create Link"}
                  </button>
                </div>

                {/* Invite list */}
                {invites.length === 0 ? (
                  <p className="text-[12px] text-white/20">
                    No active invite links
                  </p>
                ) : (
                  <div className="space-y-2">
                    {invites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between rounded-lg border border-white/6 bg-white/[0.015] px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <Link2 size={14} className="text-white/30" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[12px] text-white/40">
                                ...{invite.token.slice(-8)}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[invite.role] || "bg-white/5 text-white/40"}`}
                              >
                                {invite.role}
                              </span>
                            </div>
                            <span className="text-[10px] text-white/15">
                              {formatRelativeTime(invite.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopyLink(invite.token)}
                            className="rounded-lg p-1.5 text-white/20 transition-colors hover:bg-white/5 hover:text-[#D4A853]"
                            title="Copy invite link"
                          >
                            {copiedToken === invite.token ? (
                              <Check size={14} className="text-emerald-400" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => handleRevokeInvite(invite.id)}
                            className="rounded-lg p-1.5 text-white/20 transition-colors hover:bg-white/5 hover:text-red-400"
                            title="Revoke invite"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>{" "}
      </div>
    </div>
  );
}
