import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { submissionUrls } = await request.json()
    const bookingId = params.id

    if (!submissionUrls || !Array.isArray(submissionUrls)) {
      return NextResponse.json({ error: "Invalid submission data" }, { status: 400 })
    }

    // Get the booking to find the userId (client)
    const bookingDoc = await adminDb.collection("bookings").document(bookingId).get()
    if (!bookingDoc.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }
    const bookingData = bookingDoc.data()

    // Update booking with submissions
    await adminDb.collection("bookings").document(bookingId).update({
      submission_urls: submissionUrls,
      // Keep it ACTIVE until approved and paid
    })

    // Notify the Client (Mobile App)
    const notification = {
      userId: bookingData?.userId,
      message: `Staff has submitted prototypes for your booking: ${bookingData?.serviceName}. Please review and approve.`,
      isRead: false,
      timestamp: FieldValue.serverTimestamp(),
      type: "SUBMISSION",
      bookingId: bookingId
    }
    await adminDb.collection("notifications").add(notification)

    return NextResponse.json({ message: "Submission successful" })
  } catch (error) {
    console.error("Submission Error:", error)
    return NextResponse.json({ error: "Failed to submit work" }, { status: 500 })
  }
}
