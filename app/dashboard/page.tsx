"use client"

import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { TrendingUp, Users, Briefcase, ArrowRight, BarChart3 } from "lucide-react"
import { Card } from "@/components/ui/card"

// Mock data
const statData = [
  { label: "Total Users", value: "1,247", change: "+12% this week", icon: Users, color: "bg-blue-50" },
  { label: "Active Projects", value: "89", change: "+6% this week", icon: Briefcase, color: "bg-amber-50" },
]

const revenueData = [
  { label: "Commission", value: "₱45,890", change: "+11%", color: "bg-green-100 text-green-700" },
  { label: "AI Revenue", value: "₱12,340", change: "This month", color: "bg-amber-100 text-amber-700" },
]

const quickActions = [
  { title: "Manage Users", description: "View and edit user accounts", icon: Users },
  { title: "Manage Services", description: "View and edit user accounts", icon: Briefcase },
  { title: "Commission Management", description: "Track and manage commissions", icon: TrendingUp },
  { title: "Analytics", description: "View detailed reports", icon: BarChart3 },
]

const monthlyData = [
  { month: "Jan", value: 15000 },
  { month: "Feb", value: 18000 },
  { month: "Mar", value: 20000 },
  { month: "Apr", value: 22000 },
  { month: "May", value: 25000 },
  { month: "Jun", value: 24000 },
]

export default function DashboardPage() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">BUZZ TECH Management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {statData.map((stat) => {
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

      {/* Revenue Overview */}
      <div>
        <h2 className="text-xl font-bold mb-4">Revenue Overview</h2>
        <div className="grid grid-cols-2 gap-4">
          {revenueData.map((item) => (
            <Card key={item.label} className={`p-6 ${item.color.replace("text-", "text-")}`}>
              <p className="text-sm opacity-75">{item.label}</p>
              <p className="text-2xl font-bold mt-2">{item.value}</p>
              <p className="text-xs opacity-60 mt-2">{item.change}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="space-y-3">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Card key={action.title} className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-accent">
                      <Icon className="w-6 h-6 text-accent-foreground" />
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

      {/* Chart */}
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
    </div>
  )
}
