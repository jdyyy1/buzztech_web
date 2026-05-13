/** Normalize Firestore / JSON date fields to a JS Date. */
export function toDate(value: unknown): Date | null {
  if (value == null) return null

  if (value instanceof Date) return value
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    try {
      const d = (value as { toDate: () => Date }).toDate()
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null
    } catch {
      return null
    }
  }

  if (typeof value === "number") {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value
    const parsed = new Date(ms)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (typeof value === "string") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

const THIRTY_MINUTES_MS = 30 * 60 * 1000

/** How recently `presenceAt` must be updated to count as actively using the app (web/mobile). ~2× heartbeat interval. */
export const PRESENCE_ACTIVE_MS = 60_000

/**
 * Presence for developers: "active" only while the app is in use (see `presenceAt` heartbeat).
 * Does not use last-login windows.
 */
export function getDeveloperPresenceStatus(user: Record<string, unknown>): "active" | "inactive" | "suspended" {
  const rawStatus = String(user.status || user.accountStatus || "").toLowerCase()
  if (rawStatus === "suspended") return "suspended"

  const presence = toDate(user.presenceAt) || toDate(user.presence_at)
  if (presence) {
    return Date.now() - presence.getTime() <= PRESENCE_ACTIVE_MS ? "active" : "inactive"
  }

  return "inactive"
}

/**
 * Activity status for clients (e.g. Users list): suspended from profile; otherwise last seen within 30 minutes
 * from login/activity fields, or persisted status fallback.
 */
export function getUserActivityStatus(user: Record<string, unknown>): "active" | "inactive" | "suspended" {
  const rawStatus = String(user.status || user.accountStatus || "").toLowerCase()
  if (rawStatus === "suspended") return "suspended"

  const lastSeen =
    toDate(user.last_login) ||
    toDate(user.lastLogin) ||
    toDate(user.last_active) ||
    toDate(user.lastActive)

  if (lastSeen) {
    return Date.now() - lastSeen.getTime() <= THIRTY_MINUTES_MS ? "active" : "inactive"
  }

  if (rawStatus === "active" || rawStatus === "inactive") return rawStatus

  return "inactive"
}
