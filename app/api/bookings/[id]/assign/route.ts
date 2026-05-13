import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"
import {
  bookingAssignedDeveloperId,
  getMaxWorkloadCap,
  canDeveloperAcceptNewAssignment,
} from "@/lib/developer-profile"
import { hasDownpaymentPaid } from "@/lib/booking-payment-rules"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { staffId, staffName } = await request.json()
    const { id } = await context.params
    const bookingId = String(id || "").trim()

    if (!bookingId) {
      return NextResponse.json({ error: "Missing booking id in route params" }, { status: 400 })
    }

    if (!staffId || !staffName) {
      return NextResponse.json({ error: "Missing staff info" }, { status: 400 })
    }

    const bookingRef = adminDb.collection("bookings").doc(bookingId)
    const bookingSnap = await bookingRef.get()

    if (!bookingSnap.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const bookingData = bookingSnap.data() || {}
    if (bookingData?.status === "CANCELLED") {
      return NextResponse.json({ error: "Cancelled bookings cannot be assigned" }, { status: 409 })
    }

    const alreadyThisDeveloper = bookingAssignedDeveloperId(bookingData) === staffId
    if (!alreadyThisDeveloper) {
      if (!hasDownpaymentPaid(bookingData as { paidAmount?: number; totalAmount?: number })) {
        return NextResponse.json(
          {
            error:
              "Downpayment not received: the client must pay at least 20% of the contract before a developer can be assigned.",
          },
          { status: 403 },
        )
      }
      const maxCap = getMaxWorkloadCap()
      const assignedSnap = await adminDb.collection("bookings").where("developerId", "==", staffId).get()
      const bookingsForCap = assignedSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const bookingPayload = { id: bookingSnap.id, ...bookingData }
      if (!canDeveloperAcceptNewAssignment(bookingsForCap, staffId, bookingPayload, maxCap)) {
        return NextResponse.json(
          { error: "This developer is at their maximum workload for active bookings" },
          { status: 409 },
        )
      }
    }

    // Update booking with assigned staff
    await bookingRef.update({
      developerId: staffId,
      developerName: staffName,
      // Keep legacy aliases in sync for older UI/query paths.
      developer_id: staffId,
      developer_name: staffName,
      assignedStaffId: staffId,
      assignedStaffName: staffName,
      status: "ACTIVE" // Move to active when assigned
    })

    // Notify the staff member, but do not fail assignment if notification write errors.
    try {
      const notification = {
        userId: staffId,
        message: `You have been assigned to a new booking: ${bookingId}`,
        isRead: false,
        timestamp: FieldValue.serverTimestamp(),
        type: "ASSIGNMENT",
        bookingId: bookingId
      }
      await adminDb.collection("notifications").add(notification)
    } catch (notifyErr) {
      console.warn("Assignment notification write failed:", notifyErr)
    }

    return NextResponse.json({ message: "Staff assigned successfully" })
  } catch (error) {
    console.error("Assignment Error:", error)
    const message = error instanceof Error ? error.message : "Failed to assign staff"
    return NextResponse.json(
      { error: message, debug: String(error) },
      { status: 500 },
    )
  }
}
