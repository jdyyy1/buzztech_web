import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import {
  bookingAssignedDeveloperId,
  developerSubmittedWorkReleased,
} from "@/lib/developer-profile"

export async function GET() {
  try {
    // 1. Fetch Client Counts
    const usersSnapshot = await adminDb.collection("users").where("role", "==", "client").get()
    let activeClients = 0
    let inactiveClients = 0
    const THIRTY_MINUTES_MS = 30 * 60 * 1000
    const activeThreshold = Date.now() - THIRTY_MINUTES_MS
    
    usersSnapshot.forEach((doc) => {
      const data = doc.data()
      const normalizedStatus = String(data.status || "").toLowerCase()
      const lastSeenDate =
        data.last_login?.toDate?.() ||
        data.lastLogin?.toDate?.() ||
        data.last_active?.toDate?.() ||
        data.lastActive?.toDate?.() ||
        null
      const hasRecentActivity = lastSeenDate ? lastSeenDate.getTime() >= activeThreshold : false
      const isSuspended = normalizedStatus === "suspended"
      const isActive = !isSuspended && hasRecentActivity

      if (isActive) activeClients++
      else inactiveClients++
    })

    // 2. Fetch Payments for Revenue Analytics
    const paymentsSnapshot = await adminDb.collection("payments").get()
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const today = new Date(currentYear, currentMonth, now.getDate()).getTime()
    const thisMonth = new Date(currentYear, currentMonth, 1).getTime()
    const thisYear = new Date(currentYear, 0, 1).getTime()
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3
    const thisQuarter = new Date(currentYear, quarterStartMonth, 1).getTime()

    let dailyRevenue = 0
    let monthlyRevenue = 0
    let quarterlyRevenue = 0
    let yearlyRevenue = 0
    const monthlyTrend: Record<string, number> = {}
    const revenueByYear: Record<number, number> = {}
    const revenueByMonth: Record<string, number> = {}
    const revenueByQuarter: Record<string, number> = {}

    paymentsSnapshot.forEach((doc) => {
      const data = doc.data()
      const createdAt = data.createdAt?.toDate() || new Date()
      const time = createdAt.getTime()
      const amount = data.amount || 0
      const year = createdAt.getFullYear()
      const month = createdAt.getMonth()
      const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`
      const quarter = Math.floor(month / 3) + 1
      const quarterKey = `${year}-Q${quarter}`

      if (time >= today) dailyRevenue += amount
      if (time >= thisMonth) monthlyRevenue += amount
      if (time >= thisQuarter) quarterlyRevenue += amount
      if (time >= thisYear) yearlyRevenue += amount

      const shortMonth = createdAt.toLocaleString("default", { month: "short" })
      monthlyTrend[shortMonth] = (monthlyTrend[shortMonth] || 0) + amount
      revenueByYear[year] = (revenueByYear[year] || 0) + amount
      revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + amount
      revenueByQuarter[quarterKey] = (revenueByQuarter[quarterKey] || 0) + amount
    })

    // 3. Project Success Rate (Completed vs Total)
    const bookingsSnapshot = await adminDb.collection("bookings").get()
    let totalBookings = 0
    let completedBookings = 0
    const servicePopularity: Record<string, number> = {}
    /** Per developer UID — same rules as in-app workload (PENDING + ACTIVE, not released after submit). */
    const developerWorkloadByUid: Record<string, { name: string; value: number }> = {}

    bookingsSnapshot.forEach((doc) => {
      const data = doc.data()
      totalBookings++
      if (data.status === "COMPLETED") completedBookings++

      const service = data.serviceName || "Unknown"
      servicePopularity[service] = (servicePopularity[service] || 0) + 1

      const devId = bookingAssignedDeveloperId(data)
      const st = String(data.status || "")
      if (
        devId &&
        (st === "PENDING" || st === "ACTIVE") &&
        !developerSubmittedWorkReleased(data)
      ) {
        const name = String(data.developerName || "Unknown")
        const cur = developerWorkloadByUid[devId] ?? { name, value: 0 }
        cur.value += 1
        if (data.developerName) cur.name = String(data.developerName)
        developerWorkloadByUid[devId] = cur
      }
    })

    const successRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0

    return NextResponse.json({
      clients: {
        active: activeClients,
        inactive: inactiveClients,
        total: activeClients + inactiveClients
      },
      revenue: {
        daily: dailyRevenue,
        monthly: monthlyRevenue,
        quarterly: quarterlyRevenue,
        yearly: yearlyRevenue,
        monthlyTrend: Object.entries(monthlyTrend).map(([month, value]) => ({ month, value })),
        yearlyBreakdown: Object.entries(revenueByYear)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([year, value]) => ({ period: year, value })),
        monthlyBreakdown: Object.entries(revenueByMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([period, value]) => ({ period, value })),
        quarterlyBreakdown: Object.entries(revenueByQuarter)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([period, value]) => ({ period, value })),
      },
      projects: {
        total: totalBookings,
        completed: completedBookings,
        successRate: successRate.toFixed(1),
        servicePopularity: Object.entries(servicePopularity).map(([name, value]) => ({ name, value })),
        developerWorkload: Object.values(developerWorkloadByUid).map(({ name, value }) => ({ name, value })),
      }
    })
  } catch (error) {
    console.error("Analytics Error:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}
