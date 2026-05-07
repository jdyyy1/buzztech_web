import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { staffId, staffName } = await request.json()
    const bookingId = params.id

    if (!staffId || !staffName) {
      return NextResponse.json({ error: "Missing staff info" }, { status: 400 })
    }

    const bookingRef = adminDb.collection("bookings").doc(bookingId)
    const bookingSnap = await bookingRef.get()

    if (!bookingSnap.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const bookingData = bookingSnap.data()
    if (bookingData?.status === "CANCELLED") {
      return NextResponse.json({ error: "Cancelled bookings cannot be assigned" }, { status: 409 })
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

    // Notify the staff member
    const notification = {
      userId: staffId,
      message: `You have been assigned to a new booking: ${bookingId}`,
      isRead: false,
      timestamp: FieldValue.serverTimestamp(),
      type: "ASSIGNMENT",
      bookingId: bookingId
    }
    await adminDb.collection("notifications").add(notification)

    return NextResponse.json({ message: "Staff assigned successfully" })
  } catch (error) {
    console.error("Assignment Error:", error)
    return NextResponse.json({ error: "Failed to assign staff" }, { status: 500 })
  }
}
