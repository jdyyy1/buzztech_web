import { NextRequest, NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { adminDb } from "@/lib/firebase-admin"
import { requireStaffDeveloper } from "@/lib/booking-developer-auth"
import {
  activeAssignmentCount,
  bookingAssignedDeveloperId,
  getMaxWorkloadCap,
} from "@/lib/developer-profile"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { uid: staffId, name: staffName } = await requireStaffDeveloper(request)
    const { id } = await context.params
    const bookingId = String(id || "").trim()
    if (!bookingId) {
      return NextResponse.json({ error: "Missing booking id" }, { status: 400 })
    }

    const bookingRef = adminDb.collection("bookings").doc(bookingId)
    const bookingSnap = await bookingRef.get()
    if (!bookingSnap.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const bookingData = bookingSnap.data() || {}
    if (String(bookingData.status || "") !== "PENDING") {
      return NextResponse.json({ error: "This booking is no longer available for interest" }, { status: 409 })
    }
    if (bookingAssignedDeveloperId(bookingData) != null) {
      return NextResponse.json({ error: "This booking has already been assigned" }, { status: 409 })
    }

    const maxCap = getMaxWorkloadCap()
    const assignedSnap = await adminDb.collection("bookings").where("developerId", "==", staffId).get()
    const bookingsForCap = assignedSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const load = activeAssignmentCount(bookingsForCap, staffId)
    if (load >= maxCap) {
      return NextResponse.json(
        {
          error: `You are at the maximum workload (${maxCap} active or pending bookings). You cannot express interest until capacity frees up.`,
        },
        { status: 403 },
      )
    }

    let alreadyInterested = false
    let serviceName = "Service request"

    try {
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(bookingRef)
        if (!snap.exists) throw new Error("NOT_FOUND")
        const data = snap.data() || {}

        if (String(data.status || "") !== "PENDING") {
          throw new Error("UNAVAILABLE")
        }
        if (bookingAssignedDeveloperId(data) != null) {
          throw new Error("ASSIGNED")
        }

        serviceName = String(data.serviceName || "Service request")
        const existing = Array.isArray(data.interestedDeveloperIds)
          ? (data.interestedDeveloperIds as unknown[]).map(String)
          : []
        alreadyInterested = existing.includes(staffId)

        if (alreadyInterested) return

        const prevMeta =
          typeof data.interestedDeveloperMeta === "object" && data.interestedDeveloperMeta
            ? { ...(data.interestedDeveloperMeta as Record<string, unknown>) }
            : {}

        tx.update(bookingRef, {
          interestedDeveloperIds: FieldValue.arrayUnion(staffId),
          interestedDeveloperMeta: {
            ...prevMeta,
            [staffId]: {
              developerName: staffName,
              expressedAt: FieldValue.serverTimestamp(),
            },
          },
        })
      })
    } catch (e) {
      const m = e instanceof Error ? e.message : ""
      if (m === "NOT_FOUND") {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 })
      }
      if (m === "UNAVAILABLE") {
        return NextResponse.json({ error: "This booking is no longer available for interest" }, { status: 409 })
      }
      if (m === "ASSIGNED") {
        return NextResponse.json({ error: "This booking has already been assigned" }, { status: 409 })
      }
      throw e
    }

    if (alreadyInterested) {
      return NextResponse.json({
        ok: true,
        alreadyInterested: true,
        message: "You have already expressed interest in this request.",
      })
    }

    try {
      const adminsSnap = await adminDb.collection("users").where("role", "in", ["admin", "superadmin"]).get()
      const bookingSnap2 = await bookingRef.get()
      const sn = String(bookingSnap2.data()?.serviceName || serviceName)
      const writes = adminsSnap.docs.map((doc) =>
        adminDb.collection("notifications").add({
          userId: doc.id,
          message: `${staffName} expressed interest in an open request: ${sn} (booking ${bookingId.slice(0, 8)}…).`,
          isRead: false,
          timestamp: FieldValue.serverTimestamp(),
          type: "BOOKING_INTEREST",
          bookingId,
          developerId: staffId,
          developerName: staffName,
        }),
      )
      await Promise.allSettled(writes)
    } catch (notifyErr) {
      console.warn("Interest notification write failed:", notifyErr)
    }

    return NextResponse.json({
      ok: true,
      alreadyInterested: false,
      message: "Interest sent. Admins have been notified.",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to express interest"
    const unauthorized = message.includes("Missing auth") || message.includes("Only developer")
    return NextResponse.json({ error: message }, { status: unauthorized ? 401 : 500 })
  }
}
