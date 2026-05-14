import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"
import { requireStaffDeveloper } from "@/lib/booking-developer-auth"
import { bookingAssignedDeveloperId, developerSubmittedWorkReleased } from "@/lib/developer-profile"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireStaffDeveloper(request)
    const { submissionUrls } = await request.json()
    const { id } = await context.params
    const bookingId = String(id || "").trim()

    if (!submissionUrls || !Array.isArray(submissionUrls)) {
      return NextResponse.json({ error: "Invalid submission data" }, { status: 400 })
    }
    const urls = submissionUrls
      .filter((u: unknown) => typeof u === "string" && String(u).trim().length > 0)
      .map((u: string) => String(u).trim())
    if (urls.length === 0) {
      return NextResponse.json({ error: "Provide at least one submission URL" }, { status: 400 })
    }

    const bookingRef = adminDb.collection("bookings").doc(bookingId)
    const bookingDoc = await bookingRef.get()
    if (!bookingDoc.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }
    const bookingData = bookingDoc.data() || {}

    if (bookingAssignedDeveloperId(bookingData) !== uid) {
      return NextResponse.json({ error: "Only the assigned developer can submit work" }, { status: 403 })
    }
    if (String(bookingData.status) !== "ACTIVE") {
      return NextResponse.json({ error: "Booking must be active to submit work" }, { status: 409 })
    }
    if (developerSubmittedWorkReleased(bookingData)) {
      return NextResponse.json(
        { error: "Work already submitted. Cancel submission first to submit again." },
        { status: 409 },
      )
    }

    const savedProgress = Math.round(
      Number(bookingData.developerProgressPercent ?? bookingData.developer_progress_percent ?? 0),
    )
    if (savedProgress < 100) {
      return NextResponse.json(
        { error: "Set and save project progress to 100% before you can submit work." },
        { status: 409 },
      )
    }

    await bookingRef.update({
      submission_urls: urls,
      developerSubmittedWork: true,
      developerSubmittedAt: FieldValue.serverTimestamp(),
      developer_submitted_work: true,
      developer_submitted_at: FieldValue.serverTimestamp(),
      developerProgressPercent: 100,
      developer_progress_percent: 100,
      status: "COMPLETED",
      completionDate: FieldValue.serverTimestamp(),
    })

    const notification = {
      userId: bookingData.userId,
      message: `Your developer submitted deliverables for ${bookingData.serviceName || "your booking"}. Please review and approve.`,
      isRead: false,
      timestamp: FieldValue.serverTimestamp(),
      type: "SUBMISSION",
      bookingId,
    }
    await adminDb.collection("notifications").add(notification)

    return NextResponse.json({ message: "Submission successful" })
  } catch (error) {
    console.error("Submission Error:", error)
    const message = error instanceof Error ? error.message : "Failed to submit work"
    const is401 =
      message.includes("Missing auth") ||
      message.includes("Only developer accounts") ||
      message.includes("Decoding Firebase ID token")
    return NextResponse.json({ error: message }, { status: is401 ? 401 : 500 })
  }
}
