"use client"

import type React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutGrid, Users, BarChart3, Settings, LogOut, ShieldAlert, Briefcase } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, logout } = useAuth()

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
    ...(user?.role === "admin" || user?.role === "superadmin"
      ? [
          { href: "/dashboard/users", label: "Users", icon: Users },
          { href: "/dashboard/bookings", label: "Bookings", icon: BarChart3 },
        ]
      : []),
    ...(user?.role === "staff" || user?.role === "superadmin"
      ? [{ href: "/dashboard/tasks", label: "My Tasks", icon: Briefcase }]
      : []),
    ...(user?.role === "superadmin" ? [{ href: "/superadmin/dashboard", label: "Superadmin", icon: ShieldAlert }] : []),
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
  ]

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!user || (user.role !== "admin" && user.role !== "staff" && user.role !== "superadmin")) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive mb-4">Unauthorized access</p>
          <button onClick={() => router.push("/login")} className="text-primary hover:underline">
            Return to login
          </button>
        </div>
      </div>
    )
  }

  const handleLogout = async () => {
    try {
      await logout()
      router.push("/login")
    } catch (err) {
      console.error("Logout error:", err)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 border-r border-border bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-bold text-sidebar-foreground italic uppercase tracking-wider">Management Panel</h1>
          <p className="text-sm text-sidebar-foreground/60 mt-1">BUZZ TECH Internal</p>
          <p className="text-xs text-sidebar-foreground/50 mt-3">{user.name}</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
