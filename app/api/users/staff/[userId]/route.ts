import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { normalizeSpecialties } from "@/lib/developer-profile"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await context.params
    const uid = String(userId || "").trim()
    if (!uid) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 })
    }

    const body = await request.json()
    const { specialties: rawSpecialties } = body

    const userRef = adminDb.collection("users").doc(uid)
    const snap = await userRef.get()
    if (!snap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    const data = snap.data()
    if (String(data?.role || "").toLowerCase() !== "staff") {
      return NextResponse.json({ error: "Only developer (staff) profiles can be updated here" }, { status: 403 })
    }

    if (rawSpecialties === undefined) {
      return NextResponse.json({ error: "specialties is required" }, { status: 400 })
    }

    await userRef.update({
      specialties: normalizeSpecialties(rawSpecialties),
    })
    const next = await userRef.get()
    return NextResponse.json({ message: "Developer profile updated", user: { id: next.id, ...next.data() } })
  } catch (error) {
    console.error("PATCH staff profile error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
