import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

export async function GET() {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: "Server database not available" }, { status: 500 })
    }
    // Count users where role is not admin, staff, or superadmin
    const snapshot = await adminDb
      .collection("users")
      .where("role", "not-in", ["admin", "staff", "superadmin"]) // excludes internal roles
      .count()
      .get()
    return NextResponse.json({ count: snapshot.data().count })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
