import jwt from "jsonwebtoken"
import { query } from "./db.js"

export interface TokenPayload {
  userId: string
  email: string
  sub?: string
}

function getPublicKey(): string {
  const base64 = process.env.JWT_PUBLIC_KEY_BASE64
  if (base64) {
    return Buffer.from(base64, "base64").toString("utf-8")
  }
  const secret = process.env.JWT_SECRET || "dev_jwt_secret_change_in_production"
  return secret
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const publicKey = getPublicKey()
    const isRSA = publicKey.includes("BEGIN")
    const decoded = jwt.verify(token, publicKey, {
      algorithms: isRSA ? ["RS256"] : ["HS256"],
    }) as TokenPayload

    const userId = decoded.userId || decoded.sub || ""
    const email = decoded.email || ""
    if (!userId) return null
    return { userId, email }
  } catch {
    return null
  }
}

export function signToken(payload: TokenPayload): string {
  const secret = process.env.JWT_SECRET || "dev_jwt_secret_change_in_production"
  return jwt.sign(payload, secret, { expiresIn: "7d" })
}

export async function getUserProjectRole(
  userId: string,
  projectId: string,
): Promise<"owner" | "editor" | "viewer" | null> {
  const memberResult = await query<{ role: string }>(
    `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId],
  )
  if (memberResult.rows[0]) {
    return memberResult.rows[0].role as "owner" | "editor" | "viewer"
  }

  const ownerResult = await query<{ id: string }>(
    `SELECT id FROM projects WHERE id = $1 AND owner_id = $2`,
    [projectId, userId],
  )
  if (ownerResult.rows[0]) {
    return "owner"
  }

  return null
}

export async function canWrite(userId: string, projectId: string): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId)
  return role === "owner" || role === "editor"
}
