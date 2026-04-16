"use client"

import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar } from "recharts"
import { Users, Briefcase, TrendingUp, BarChart3 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"

// Original mock data
const statData = [
  { label: "Total Users", value: "1,247", change: "+12% this week", icon: Users, color: "bg-blue-50" },
  { label: "Active Projects", value: "89", change: "+6% this week", icon: Briefcase, color: "bg-amber-50" },
]

const revenueData = [
  { label: "Commission", value: "₱45,890", change: "+11%", color: "bg-green-100 text-green-700" },
  { label: "AI Revenue", value: "₱12,340", change: "This month", color: "bg-amber-100 text-amber-700" },
]

const monthlyData = [
  { month: "Jan", value: 15000 },
  { month: "Feb", value: 18000 },
  { month: "Mar", value: 20000 },
  { month: "Apr", value: 22000 },
  { month: "May", value: 25000 },
  { month: "Jun", value: 24000 },
]

const breakdownData = [
  { name: "Design", value: 24405, fill: "var(--color-chart-1)" },
  { name: "Development", value: 13767, fill: "var(--color-chart-2)" },
  { name: "Consulting", value: 6883, fill: "var(--color-chart-3)" },
  { name: "Ad Revenue", value: 2295, fill: "var(--color-chart-4)" },
]

export default function SuperAdminDashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [userCount, setUserCount] = useState<number | null>(null)
  const [userCountError, setUserCountError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && (!user || user.role !== "superadmin")) {
      router.push("/dashboard")
      return
    }

    const load = async () => {
      try {
        const res = await fetch("/api/users/count")
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load user count")
        setUserCount(data.count)
      } catch (e) {
        setUserCountError(e instanceof Error ? e.message : "Unknown error")
      }
    }
    load()
  }, [user, loading, router])

  if (loading || !user || user.role !== "superadmin") {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Superadmin Dashboard</h1>
        <p className="text-muted-foreground mt-2">BUZZ TECH Management</p>
      </div>

      {/* Stats Grid - 1:1 Replica */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[{ label: "Total Users", value: userCount?.toLocaleString() ?? "—", change: userCountError ? userCountError : "+12% this week", icon: Users, color: "bg-blue-50" }, ...statData.filter((s) => s.label !== "Total Users")].map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-2">{stat.value}</p>
                  <p className="text-xs text-success mt-2">↑ {stat.change}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6 text-muted-foreground" />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Revenue Overview - 1:1 Replica */}
      <div>
        <h2 className="text-xl font-bold mb-4">Revenue Overview</h2>
        <div className="grid grid-cols-2 gap-4">
          {revenueData.map((item) => (
            <Card key={item.label} className={`p-6 ${item.color}`}>
              <p className="text-sm opacity-75">{item.label}</p>
              <p className="text-2xl font-bold mt-2">{item.value}</p>
              <p className="text-xs opacity-60 mt-2">{item.change}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Monthly Revenue Trend - 1:1 Replica */}
      <Card className="p-6">
        <h2 className="text-lg font-bold mb-6">Monthly Revenue Trend</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="var(--color-accent)" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Additional Analytics from Revenue Page */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Revenue Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={breakdownData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="var(--color-chart-1)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Monthly Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="var(--color-accent)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}
