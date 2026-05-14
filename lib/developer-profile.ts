/** Categories used for developer specialties and admin filters. */
export const DEVELOPER_SPECIALTY_OPTIONS = [
  "Graphic Design",
  "Web Development",
  "Mobile App",
  "Cybersecurity",
  "UI/UX Design",
  "Network Setup",
  "Database",
] as const

export type DeveloperSpecialtyOption = (typeof DEVELOPER_SPECIALTY_OPTIONS)[number]

const SPECIALTY_SET = new Set<string>(DEVELOPER_SPECIALTY_OPTIONS as unknown as string[])

/** Fixed platform cap: each developer may have at most this many PENDING+ACTIVE bookings (not editable by admins). */
export const FIXED_MAX_WORKLOAD = 2

/** @deprecated Use {@link FIXED_MAX_WORKLOAD}; kept for import stability. */
export const DEFAULT_MAX_WORKLOAD = FIXED_MAX_WORKLOAD

export function normalizeSpecialties(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (const item of input) {
    const s = typeof item === "string" ? item.trim() : ""
    if (s && SPECIALTY_SET.has(s) && !out.includes(s)) out.push(s)
  }
  return out
}

/** Always returns the fixed workload cap (stored `maxWorkload` on users is ignored). */
export function getMaxWorkloadCap(_user?: Record<string, unknown> | null): number {
  return FIXED_MAX_WORKLOAD
}

export function bookingAssignedDeveloperId(booking: Record<string, unknown> | null | undefined): string | null {
  if (!booking) return null
  const b = booking as Record<string, unknown>
  const id =
    (b.developerId as string) ||
    (b.developer_id as string) ||
    (b.staffId as string) ||
    (b.assignedStaffId as string) ||
    null
  return id ? String(id) : null
}

/** When true, the developer has submitted work; they are off active workload until submission is withdrawn. */
export function developerSubmittedWorkReleased(booking: Record<string, unknown> | null | undefined): boolean {
  if (!booking) return false
  const v = booking.developerSubmittedWork ?? (booking as { developer_submitted_work?: unknown }).developer_submitted_work
  return v === true || v === "true"
}

export function activeAssignmentCount(
  bookings: Array<{ id?: string; status?: string; [key: string]: unknown }>,
  developerId: string,
): number {
  const id = String(developerId)
  return bookings.filter((b) => {
    if (b.status !== "PENDING" && b.status !== "ACTIVE") return false
    if (developerSubmittedWorkReleased(b)) return false
    return bookingAssignedDeveloperId(b) === id
  }).length
}

export function serviceMatchesSpecialties(serviceName: string, specialties: string[]): boolean {
  if (!specialties.length) return false
  const s = serviceName.toLowerCase().trim()
  return specialties.some((sp) => {
    const t = sp.toLowerCase().trim()
    return t.length > 0 && (s.includes(t) || t.includes(s))
  })
}

export function canDeveloperAcceptNewAssignment(
  bookings: Array<{ id?: string; status?: string; [key: string]: unknown }>,
  developerId: string,
  booking: { id?: string; status?: string; [key: string]: unknown } | null,
  maxCap: number,
): boolean {
  if (!booking) return true
  const current = bookingAssignedDeveloperId(booking)
  if (current === developerId) return true
  const n = activeAssignmentCount(bookings, developerId)
  return n < maxCap
}
