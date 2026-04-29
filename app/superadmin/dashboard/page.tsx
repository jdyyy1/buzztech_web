"use client"

import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell } from "recharts"
import { Users, Briefcase, TrendingUp, BarChart3, CheckCircle, Clock } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"

const COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)"]

export default function SuperAdminDashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [analytics, setAnalytics] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && (!user || user.role !== "superadmin")) {
      router.push("/dashboard")
      return
    }

    const loadAnalytics = async () => {
      try {
        const res = await fetch("/api/analytics/superadmin")
        if (!res.ok) throw new Error("Failed to load analytics")
        const data = await res.json()
        setAnalytics(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error")
      }
    }
    loadAnalytics()
  }, [user, loading, router])

  if (loading || !user || user.role !== "superadmin") {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive font-bold">Error: {error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-primary underline">Try again</button>
      </div>
    )
  }

  const clientData = [
    { name: "Active", value: analytics?.clients.active || 0 },
    { name: "Inactive", value: analytics?.clients.inactive || 0 },
  ]

  return (
    <div className="p-8 space-y-8 pb-16">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Superadmin Dashboard</h1>
          <p className="text-muted-foreground mt-2">Platform-wide Revenue & Performance Analytics</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-muted-foreground">System Status</p>
          <div className="flex items-center gap-2 text-green-500 justify-end">
            <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
            <span className="text-xs font-bold uppercase">Live</span>
          </div>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Daily Revenue</p>
              <p className="text-2xl font-bold mt-2">₱{(analytics?.revenue.daily || 0).toLocaleString()}</p>
            </div>
            <div className="p-2 rounded-lg bg-green-50">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Monthly Revenue</p>
              <p className="text-2xl font-bold mt-2">₱{(analytics?.revenue.monthly || 0).toLocaleString()}</p>
            </div>
            <div className="p-2 rounded-lg bg-blue-50">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Total Clients</p>
              <p className="text-2xl font-bold mt-2">{analytics?.clients.total || 0}</p>
            </div>
            <div className="p-2 rounded-lg bg-purple-50">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Success Rate</p>
              <p className="text-2xl font-bold mt-2">{analytics?.projects.successRate || 0}%</p>
            </div>
            <div className="p-2 rounded-lg bg-orange-50">
              <CheckCircle className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue Trend */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-lg font-bold mb-6">Revenue Trend (Month-to-Month)</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.revenue.monthlyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(val) => `₱${val/1000}k`} />
                <Tooltip formatter={(val) => `₱${val.toLocaleString()}`} />
                <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Client Status Breakdown */}
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-6">Client Activity</h2>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={clientData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {clientData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? "var(--color-primary)" : "var(--color-muted)"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-xs">Active ({analytics?.clients.active})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted" />
              <span className="text-xs">Inactive ({analytics?.clients.inactive})</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Popular Services */}
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" /> Popular Services
          </h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.projects.servicePopularity || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Staff Workload */}
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Active Staff Workload
          </h2>
          <div className="space-y-4">
            {(analytics?.projects.staffWorkload || []).length > 0 ? (
              analytics?.projects.staffWorkload.map((staff: any, idx: number) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{staff.name}</span>
                    <span className="text-muted-foreground">{staff.value} active tasks</span>
                  </div>
                  <div className="h-2 bg-accent rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all" 
                      style={{ width: `${Math.min((staff.value / 10) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-12">No active assignments</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
