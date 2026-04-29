import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

export async function GET() {
  try {
    const staffSnapshot = await adminDb.collection("users")
      .where("role", "==", "staff")
      .where("status", "==", "active")
      .get()
    
    const staff = staffSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    return NextResponse.json(staff)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 })
  }
}
