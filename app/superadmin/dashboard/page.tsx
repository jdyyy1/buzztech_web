"use client"

import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell } from "recharts"
import { Users, Briefcase, TrendingUp, BarChart3, CheckCircle, Clock } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"

type RevenuePoint = { period: string; value: number }
type NamedValue = { name: string; value: number }
type RevenueFilter = "monthly" | "quarterly" | "yearly"
type AnalyticsPayload = {
  clients: { active: number; inactive: number; total: number }
  revenue: {
    daily: number
    monthly: number
    quarterly: number
    yearly: number
    monthlyTrend: { month: string; value: number }[]
    yearlyBreakdown: RevenuePoint[]
    monthlyBreakdown: RevenuePoint[]
    quarterlyBreakdown: RevenuePoint[]
  }
  projects: {
    total: number
    completed: number
    successRate: string
    servicePopularity: NamedValue[]
    staffWorkload: NamedValue[]
  }
}

const SERVICE_COLORS: Record<string, string> = {
  "Database Design": "#ef4444",
  "Web Development": "#3b82f6",
  "Mobile App Development": "#10b981",
  "UI/UX Design": "#f59e0b",
}

const FALLBACK_SERVICE_COLORS = ["#8b5cf6", "#06b6d4", "#f97316", "#84cc16", "#ec4899"]
const CLIENT_ACTIVITY_COLORS = {
  active: "#16a34a",
  inactive: "#94a3b8",
}

export default function SuperAdminDashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revenueFilter, setRevenueFilter] = useState<RevenueFilter>("monthly")
  const [periodFilter, setPeriodFilter] = useState<string>("all")

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

  const yearlyBreakdown = analytics?.revenue.yearlyBreakdown || []
  const monthlyBreakdown = analytics?.revenue.monthlyBreakdown || []
  const quarterlyBreakdown = analytics?.revenue.quarterlyBreakdown || []
  const revenueLabel = revenueFilter.charAt(0).toUpperCase() + revenueFilter.slice(1)
  const serviceData = analytics?.projects.servicePopularity || []
  const getServiceColor = (serviceName: string, index: number) =>
    SERVICE_COLORS[serviceName] || FALLBACK_SERVICE_COLORS[index % FALLBACK_SERVICE_COLORS.length]

  const monthlyOptions = useMemo(
    () => [
      { value: "01", label: "January" },
      { value: "02", label: "February" },
      { value: "03", label: "March" },
      { value: "04", label: "April" },
      { value: "05", label: "May" },
      { value: "06", label: "June" },
      { value: "07", label: "July" },
      { value: "08", label: "August" },
      { value: "09", label: "September" },
      { value: "10", label: "October" },
      { value: "11", label: "November" },
      { value: "12", label: "December" },
    ],
    [],
  )

  useEffect(() => {
    setPeriodFilter("all")
  }, [revenueFilter])

  const periodOptions = useMemo(() => {
    if (revenueFilter === "yearly") {
      return yearlyBreakdown.map((item) => ({ value: String(item.period), label: String(item.period) }))
    }

    if (revenueFilter === "monthly") {
      return monthlyOptions
    }

    return quarterlyBreakdown.map((item) => ({ value: item.period, label: item.period.replace("-", " ") }))
  }, [revenueFilter, yearlyBreakdown, quarterlyBreakdown, monthlyOptions])

  const revenueChartData = useMemo(() => {
    if (revenueFilter === "yearly") {
      if (periodFilter === "all") return yearlyBreakdown
      return monthlyBreakdown
        .filter((item) => item.period.startsWith(`${periodFilter}-`))
        .map((item) => {
          const monthPart = item.period.split("-")[1]
          const monthName = monthlyOptions.find((m) => m.value === monthPart)?.label.slice(0, 3) || monthPart
          return { period: monthName, value: item.value }
        })
    }

    if (revenueFilter === "monthly") {
      if (periodFilter === "all") {
        const totalsByMonth: Record<string, number> = {}
        monthlyBreakdown.forEach((item) => {
          const monthPart = item.period.split("-")[1]
          totalsByMonth[monthPart] = (totalsByMonth[monthPart] || 0) + item.value
        })

        return monthlyOptions.map((month) => ({
          period: month.label.slice(0, 3),
          value: totalsByMonth[month.value] || 0,
        }))
      }

      return monthlyBreakdown
        .filter((item) => item.period.endsWith(`-${periodFilter}`))
        .map((item) => ({
          period: `${monthlyOptions.find((month) => month.value === periodFilter)?.label || "Month"} ${item.period.split("-")[0]}`,
          value: item.value,
        }))
    }

    if (periodFilter === "all") return quarterlyBreakdown
    return quarterlyBreakdown.filter((item) => item.period === periodFilter)
  }, [revenueFilter, periodFilter, yearlyBreakdown, monthlyBreakdown, quarterlyBreakdown, monthlyOptions])

  const normalizedRevenueChartData = useMemo(() => {
    if (revenueChartData.length > 0) return revenueChartData

    if (revenueFilter === "yearly") {
      return [{ period: periodFilter === "all" ? String(new Date().getFullYear()) : periodFilter, value: 0 }]
    }

    if (revenueFilter === "monthly") {
      if (periodFilter === "all") return [{ period: "Jan", value: 0 }]
      const monthLabel = monthlyOptions.find((month) => month.value === periodFilter)?.label || "January"
      return [{ period: `${monthLabel} ${new Date().getFullYear()}`, value: 0 }]
    }

    return [{ period: periodFilter === "all" ? `${new Date().getFullYear()}-Q1` : periodFilter, value: 0 }]
  }, [revenueChartData, revenueFilter, periodFilter, monthlyOptions])

  const hasRevenueValues = normalizedRevenueChartData.some((point) => point.value > 0)
  const revenueYAxisTicks = hasRevenueValues ? undefined : [0, 1000, 2000, 3000]
  const revenueYAxisDomain: [number, number | "auto"] = hasRevenueValues ? [0, "auto"] : [0, 3000]
  const formatRevenueTick = (value: number) => (value >= 1000 ? `₱${value / 1000}k` : `₱${value}`)

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
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Quarterly Revenue</p>
              <p className="text-2xl font-bold mt-2">₱{(analytics?.revenue.quarterly || 0).toLocaleString()}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Monthly Revenue Trend */}
        <Card className="p-6 h-full flex flex-col min-h-[390px]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Sales Revenue ({revenueLabel})</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={revenueFilter} onValueChange={(value: RevenueFilter) => setRevenueFilter(value)}>
                <SelectTrigger className="h-9 w-[150px]">
                  <SelectValue placeholder="View by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>

              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="h-9 w-[170px]">
                  <SelectValue placeholder="All periods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {periodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="h-[300px] flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={normalizedRevenueChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="period" />
                <YAxis ticks={revenueYAxisTicks} domain={revenueYAxisDomain} tickFormatter={formatRevenueTick} />
                <Tooltip formatter={(val) => `₱${val.toLocaleString()}`} />
                <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Client Status Breakdown */}
        <Card className="p-6 h-full flex flex-col min-h-[390px]">
          <h2 className="text-lg font-bold mb-6">Client Activity</h2>
          <div className="h-[300px] flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={clientData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  minAngle={8}
                  dataKey="value"
                >
                  {clientData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 ? CLIENT_ACTIVITY_COLORS.active : CLIENT_ACTIVITY_COLORS.inactive}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLIENT_ACTIVITY_COLORS.active }} />
              <span className="text-xs">Active ({analytics?.clients.active})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLIENT_ACTIVITY_COLORS.inactive }} />
              <span className="text-xs">Inactive ({analytics?.clients.inactive})</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Most Popular Services */}
        <Card className="p-6 h-full flex flex-col">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" /> Popular Services
          </h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serviceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {serviceData.map((service, index) => (
                    <Cell key={`service-cell-${service.name}-${index}`} fill={getServiceColor(service.name, index)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 max-h-[140px] overflow-y-auto pr-1">
            {serviceData.map((service, index) => (
              <div key={`service-legend-${service.name}-${index}`} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: getServiceColor(service.name, index) }} />
                  <span>{service.name}</span>
                </div>
                <span className="text-muted-foreground">{service.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Staff Workload */}
        <Card className="p-6 h-full flex flex-col">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Active Staff Workload
          </h2>
          <div className="space-y-4 flex-1">
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
              <div className="flex h-full min-h-[220px] items-center justify-center">
                <p className="text-center text-muted-foreground">No active assignments</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
