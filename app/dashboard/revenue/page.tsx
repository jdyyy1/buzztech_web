"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { Card } from "@/components/ui/card"

const revenueStats = [
  { label: "Total Commission", value: "₱45,890", change: "+11%", icon: "₱" },
  { label: "All Revenue", value: "₱2,295", change: "This month" },
  { label: "Avg/Project", value: "₱12,450", change: "Average" },
]

const trendData = [
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

export default function RevenuePage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Revenue Analytics</h1>
        <p className="text-muted-foreground">Track and manage revenue data</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {revenueStats.map((stat) => (
          <Card key={stat.label} className="p-6">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold mt-2">{stat.value}</p>
            <p className="text-xs text-success mt-2">{stat.change}</p>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="var(--color-accent)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

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
      </div>

      {/* Monthly Comparison */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Monthly Comparison</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="var(--color-accent)" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}
