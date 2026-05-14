import type { NextRequest } from "next/server"
import { adminAuth, adminDb } from "@/lib/firebase-admin"

/** Firebase UID + display name for users with role `staff` (developers in the product UI). */
export async function requireStaffDeveloper(request: NextRequest): Promise<{ uid: string; name: string }> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || ""
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1] || request.cookies.get("__session")?.value
  if (!token) throw new Error("Missing auth token")

  const decoded = await adminAuth.verifyIdToken(token)
  const uid = decoded.uid

  let userSnap = await adminDb.collection("users").doc(uid).get()
  let data = userSnap.exists ? userSnap.data() : undefined
  if (!data) {
    const q = await adminDb.collection("users").where("user_id", "==", uid).limit(1).get()
    if (!q.empty) {
      userSnap = q.docs[0]
      data = userSnap.data()
    }
  }

  const role = String(data?.role || "").toLowerCase()
  if (role !== "staff") {
    throw new Error("Only developer accounts can perform this action")
  }

  const name = String(data?.name || decoded.email || "Developer").trim() || "Developer"
  return { uid, name }
}
