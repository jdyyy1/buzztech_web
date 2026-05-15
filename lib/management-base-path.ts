/**
 * Admin tooling is mounted under `/dashboard` (admin) or `/superadmin` (superadmin).
 * Use this so links from shared pages stay in the same area the user is browsing.
 */
export type ManagementBasePath = "/dashboard" | "/superadmin"

export function managementBasePathFromPathname(pathname: string | null | undefined): ManagementBasePath {
  const p = pathname || ""
  if (p.startsWith("/superadmin")) return "/superadmin"
  return "/dashboard"
}
