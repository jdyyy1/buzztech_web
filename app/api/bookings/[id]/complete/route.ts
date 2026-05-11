import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const bookingId = id

    // Get the booking
    const bookingDoc = await adminDb.collection("bookings").document(bookingId).get()
    if (!bookingDoc.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }
    const bookingData = bookingDoc.data()

    // VALIDATION: Check if approved and paid in full
    const isApproved = bookingData?.is_client_approved === true
    const isPaidInFull = (bookingData?.paidAmount || 0) >= (bookingData?.totalAmount || 0)

    if (!isApproved) {
      return NextResponse.json({ error: "Booking must be approved by client first" }, { status: 400 })
    }

    if (!isPaidInFull) {
      const remaining = (bookingData?.totalAmount || 0) - (bookingData?.paidAmount || 0)
      return NextResponse.json({ 
        error: `Booking must be paid in full. Remaining balance: ₱${remaining}` 
      }, { status: 400 })
    }

    // Mark as COMPLETED
    await adminDb.collection("bookings").document(bookingId).update({
      status: "COMPLETED",
      completionDate: FieldValue.serverTimestamp()
    })

    // Notify the Client (Mobile App)
    const notification = {
      userId: bookingData?.userId,
      message: `Your project ${bookingData?.serviceName} has been officially completed! Thank you for using BuzzTech.`,
      isRead: false,
      timestamp: FieldValue.serverTimestamp(),
      type: "COMPLETED",
      bookingId: bookingId
    }
    await adminDb.collection("notifications").add(notification)

    return NextResponse.json({ message: "Booking completed successfully" })
  } catch (error) {
    console.error("Completion Error:", error)
    return NextResponse.json({ error: "Failed to complete booking" }, { status: 500 })
  }
}
