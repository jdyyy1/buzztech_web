import { NextRequest, NextResponse } from "next/server"
import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"
import { FIXED_MAX_WORKLOAD, normalizeSpecialties } from "@/lib/developer-profile"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password, role = "staff", specialties: rawSpecialties } = body

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const specialties = normalizeSpecialties(rawSpecialties)

    // 1. Create User in Firebase Authentication
    let userRecord
    try {
      userRecord = await adminAuth.createUser({
        email,
        password,
        displayName: name,
      })
    } catch (authError: any) {
      console.error("Auth Creation Error:", authError)
      return NextResponse.json({ error: authError.message || "Failed to create Auth account" }, { status: 400 })
    }

    // 2. Create User Document in Firestore
    const userData = {
      user_id: userRecord.uid,
      name,
      email,
      role,
      status: "inactive", // Default to inactive until they log in
      created_at: FieldValue.serverTimestamp(),
      last_login: FieldValue.serverTimestamp(),
      password_temp: password, // Keep for fallback login if needed
      specialties,
      maxWorkload: FIXED_MAX_WORKLOAD,
    }

    await adminDb.collection("users").doc(userRecord.uid).set(userData)

    return NextResponse.json({ 
      message: "Developer created successfully in Auth and Firestore",
      uid: userRecord.uid 
    }, { status: 201 })

  } catch (error: any) {
    console.error("General Creation Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
