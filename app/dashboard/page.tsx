"use client"

import { useEffect, useState } from "react"
import { Users, Briefcase, ArrowRight, Settings, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { db } from "@/lib/firebase"
import { collection, onSnapshot, query, where } from "firebase/firestore"

const quickActions = [
  { title: "Manage Users", description: "View and edit user accounts", icon: Users, href: "/dashboard/users" },
  { title: "Manage Services", description: "View and edit service listings", icon: Briefcase, href: "/dashboard/settings" },
  { title: "System Settings", description: "Configure system parameters", icon: Settings, href: "/dashboard/settings" },
]

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [showWelcome, setShowWelcome] = useState(true)
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0)

  const getDisplayName = () => {
    if (!user) return ""
    if (user.role === "admin") return "Admin"
    
    const fullName = user.name || ""
    return fullName.split(" ")[0]
  }

  const getQuickActions = () => {
    if (user?.role === "staff") {
      return [
        { title: "My Tasks", description: "View your active and pending tasks", icon: Briefcase, href: "/dashboard/tasks" },
        { title: "System Alerts", description: "Check system updates and notices", icon: Settings, href: "/dashboard/settings" },
      ]
    }
    
    if (user?.role === "admin" || user?.role === "superadmin") {
      return [
        { title: "Manage Users", description: "View and edit user accounts", icon: Users, href: "/dashboard/users" },
        { title: "Manage Bookings", description: "Handle pending and active bookings", icon: Briefcase, href: "/dashboard/bookings" },
        { title: "System Settings", description: "Configure system parameters", icon: Settings, href: "/dashboard/settings" },
      ]
    }
    
    return quickActions
  }

  const actions = getQuickActions()
  const quickActionsGridClass = actions.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"

  useEffect(() => {
    // Staff dashboard only: show alert if there are pending unassigned bookings.
    if (!user || user.role !== "staff" || !db) return

    const q = query(
      collection(db, "bookings"),
      where("status", "==", "PENDING"),
      where("developerId", "==", null),
    )

    const unsub = onSnapshot(q, (snapshot) => {
      setPendingBookingsCount(snapshot.size)
    })

    return () => unsub()
  }, [user])

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Management Dashboard</h1>
          <p className="text-muted-foreground mt-2">BUZZ TECH Management System</p>
        </div>
        {user?.role === "superadmin" && (
          <button 
            onClick={() => router.push("/superadmin/dashboard")}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold shadow-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            GO TO SUPERADMIN <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {showWelcome && (
        <div className="bg-accent/30 p-6 rounded-xl border border-border relative group">
          <button 
            onClick={() => setShowWelcome(false)}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold mb-2">Welcome back, {getDisplayName()}!</h2>
          <p className="text-sm text-muted-foreground pr-8">
            You are logged in as <span className="font-bold text-foreground uppercase">{user?.role}</span>.
            {user?.role === "staff" ? " Check your tasks and pending requests below." : " Use the quick actions below or the sidebar to manage the platform."}
          </p>
        </div>
      )}

      {/* Role-specific stats/notifications */}
      {user?.role === "staff" && pendingBookingsCount > 0 && (
        <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3 text-primary">
            <div className="bg-primary/20 p-2 rounded-full">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">New Request Alert!</p>
              <p className="text-xs opacity-80">There are pending bookings available for handling.</p>
            </div>
          </div>
          <button 
            onClick={() => router.push("/dashboard/tasks")}
            className="text-xs font-bold hover:underline"
          >
            VIEW ALL
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className={`grid grid-cols-1 md:grid-cols-2 ${quickActionsGridClass} gap-4`}>
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <Card 
                key={action.title} 
                className="p-4 hover:shadow-md transition-shadow cursor-pointer border-2 hover:border-primary/50"
                onClick={() => router.push(action.href)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{action.title}</p>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <Card className="p-6 border-dashed border-2">
        <div className="text-center py-8">
          <p className="text-muted-foreground font-medium">No recent notifications</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Updates and alerts will appear here</p>
        </div>
      </Card>
    </div>
  )
}
