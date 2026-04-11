import { authFetch } from "@/lib/auth/auth-fetch";

export async function verifyDeviceCode(
  userCode: string,
): Promise<{ appId: string; approved: boolean }> {
  const res = await authFetch("/v1/auth/device-code/verify", {
    method: "POST",
    body: JSON.stringify({ userCode }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      data.message || data.error || "Failed to verify device code",
    );
  }

  return res.json();
}
