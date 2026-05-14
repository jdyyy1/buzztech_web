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
    const { uid } = await requireStaffDeveloper(request)
    const { id } = await context.params
    const bookingId = String(id || "").trim()

    const ref = adminDb.collection("bookings").doc(bookingId)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }
    const data = snap.data() || {}

    if (bookingAssignedDeveloperId(data) !== uid) {
      return NextResponse.json({ error: "You are not assigned to this booking" }, { status: 403 })
    }
    if (data.developerSubmittedWork !== true) {
      return NextResponse.json({ error: "There is no submitted work to cancel" }, { status: 409 })
    }
    if (String(data.status) !== "COMPLETED" && String(data.status) !== "ACTIVE") {
      return NextResponse.json({ error: "This booking cannot be reverted from submission" }, { status: 409 })
    }
    if (data.is_client_approved === true) {
      return NextResponse.json(
        { error: "Cannot cancel submission after the client has approved it" },
        { status: 409 },
      )
    }

    const maxCap = getMaxWorkloadCap()
    const assignedSnap = await adminDb.collection("bookings").where("developerId", "==", uid).get()
    const bookingsForCap = assignedSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const load = activeAssignmentCount(bookingsForCap, uid)
    if (load >= maxCap) {
      return NextResponse.json(
        {
          error: `You are at maximum workload (${maxCap} active or pending bookings). Cancelling this submission would put the booking back in your active queue and exceed your limit, so it is not allowed.`,
        },
        { status: 403 },
      )
    }

    await ref.update({
      submission_urls: [],
      developerSubmittedWork: false,
      developerSubmittedAt: FieldValue.delete(),
      developer_submitted_work: false,
      developer_submitted_at: FieldValue.delete(),
      status: "ACTIVE",
      completionDate: FieldValue.delete(),
    })

    return NextResponse.json({ message: "Submission cancelled. You can edit progress and submit again." })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to cancel submission"
    const is401 =
      message.includes("Missing auth") ||
      message.includes("Only developer accounts") ||
      message.includes("Decoding Firebase ID token")
    return NextResponse.json({ error: message }, { status: is401 ? 401 : 500 })
  }
}
