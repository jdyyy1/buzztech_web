import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

export async function GET() {
  try {
    // 1. Fetch Client Counts
    const usersSnapshot = await adminDb.collection("users").where("role", "==", "client").get()
    let activeClients = 0
    let inactiveClients = 0
    
    usersSnapshot.forEach(doc => {
      const data = doc.data()
      if (data.status === "active") activeClients++
      else inactiveClients++
    })

    // 2. Fetch Payments for Revenue Analytics
    const paymentsSnapshot = await adminDb.collection("payments").get()
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const thisYear = new Date(now.getFullYear(), 0, 1).getTime()

    let dailyRevenue = 0
    let monthlyRevenue = 0
    let yearlyRevenue = 0
    const monthlyTrend: Record<string, number> = {}

    paymentsSnapshot.forEach(doc => {
      const data = doc.data()
      const createdAt = data.createdAt?.toDate() || new Date()
      const time = createdAt.getTime()
      const amount = data.amount || 0

      if (time >= today) dailyRevenue += amount
      if (time >= thisMonth) monthlyRevenue += amount
      if (time >= thisYear) yearlyRevenue += amount

      const monthKey = createdAt.toLocaleString('default', { month: 'short' })
      monthlyTrend[monthKey] = (monthlyTrend[monthKey] || 0) + amount
    })

    // 3. Project Success Rate (Completed vs Total)
    const bookingsSnapshot = await adminDb.collection("bookings").get()
    let totalBookings = 0
    let completedBookings = 0
    const servicePopularity: Record<string, number> = {}
    const staffWorkload: Record<string, number> = {}

    bookingsSnapshot.forEach(doc => {
      const data = doc.data()
      totalBookings++
      if (data.status === "COMPLETED") completedBookings++
      
      const service = data.serviceName || "Unknown"
      servicePopularity[service] = (servicePopularity[service] || 0) + 1

      if (data.developerId && data.status === "ACTIVE") {
        staffWorkload[data.developerName || "Unknown"] = (staffWorkload[data.developerName || "Unknown"] || 0) + 1
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
        yearly: yearlyRevenue,
        monthlyTrend: Object.entries(monthlyTrend).map(([month, value]) => ({ month, value }))
      },
      projects: {
        total: totalBookings,
        completed: completedBookings,
        successRate: successRate.toFixed(1),
        servicePopularity: Object.entries(servicePopularity).map(([name, value]) => ({ name, value })),
        staffWorkload: Object.entries(staffWorkload).map(([name, value]) => ({ name, value }))
      }
    })
  } catch (error) {
    console.error("Analytics Error:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}
