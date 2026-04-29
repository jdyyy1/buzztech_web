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

    // Update booking with assigned staff
    await adminDb.collection("bookings").document(bookingId).update({
      developerId: staffId,
      developerName: staffName,
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
