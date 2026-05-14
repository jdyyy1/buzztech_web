import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { requireStaffDeveloper } from "@/lib/booking-developer-auth"
import { bookingAssignedDeveloperId, developerSubmittedWorkReleased } from "@/lib/developer-profile"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireStaffDeveloper(request)
    const { id } = await context.params
    const bookingId = String(id || "").trim()
    const body = await request.json().catch(() => ({}))
    const raw = body?.progress ?? body?.percent
    const progress = Math.round(Number(raw))
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      return NextResponse.json({ error: "progress must be a number from 0 to 100" }, { status: 400 })
    }

    const ref = adminDb.collection("bookings").doc(bookingId)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }
    const data = snap.data() || {}

    if (bookingAssignedDeveloperId(data) !== uid) {
      return NextResponse.json({ error: "You are not assigned to this booking" }, { status: 403 })
    }
    if (String(data.status) !== "ACTIVE") {
      return NextResponse.json({ error: "Progress can only be updated on active bookings" }, { status: 409 })
    }
    if (developerSubmittedWorkReleased(data)) {
      return NextResponse.json(
        { error: "Withdraw your submission first if you need to change progress" },
        { status: 409 },
      )
    }

    await ref.update({
      developerProgressPercent: progress,
      developer_progress_percent: progress,
    })

    return NextResponse.json({ message: "Progress saved", developerProgressPercent: progress })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save progress"
    const is401 =
      message.includes("Missing auth") ||
      message.includes("Only developer accounts") ||
      message.includes("Decoding Firebase ID token")
    return NextResponse.json({ error: message }, { status: is401 ? 401 : 500 })
  }
}
