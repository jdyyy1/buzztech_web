import { type NextRequest, NextResponse } from "next/server"
import admin from "firebase-admin"

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("__session")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(token)
    const userId = decodedToken.uid

    const body = await request.json()
    const { action, data } = body

    const db = admin.firestore()

    switch (action) {
      case "updateProfile": {
        const { name } = data
        if (!name || name.trim().length === 0) {
          return NextResponse.json({ error: "Invalid name" }, { status: 400 })
        }
        
        await db.collection("users").doc(userId).update({
          name: name.trim(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        
        return NextResponse.json({ success: true, message: "Profile updated" })
      }

      case "updateNotifications": {
        const { notifications } = data
        
        await db.collection("users").doc(userId).collection("preferences").doc("settings").set(
          { notifications, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        )
        
        return NextResponse.json({ success: true, message: "Notifications updated" })
      }

      case "toggle2FA": {
        const { enabled } = data
        
        await db.collection("users").doc(userId).collection("preferences").doc("settings").set(
          { 
            twoFactorEnabled: enabled,
            updatedAt: admin.firestore.FieldValue.serverTimestamp() 
          },
          { merge: true }
        )
        
        return NextResponse.json({ success: true, message: `Two-factor authentication ${enabled ? "enabled" : "disabled"}` })
      }

      case "generateApiKey": {
        const keyId = Math.random().toString(36).substring(2, 15)
        
        await db.collection("users").doc(userId).collection("apiKeys").doc(keyId).set({
          id: keyId,
          name: "New API Key",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastUsedAt: null,
          status: "active",
        })
        
        return NextResponse.json({ 
          success: true, 
          message: "API key generated",
          keyId 
        })
      }

      case "revokeApiKey": {
        const { keyId } = data
        
        await db.collection("users").doc(userId).collection("apiKeys").doc(keyId).delete()
        
        return NextResponse.json({ success: true, message: "API key revoked" })
      }

      case "logActivity": {
        const { action: activityAction } = data
        
        await db.collection("users").doc(userId).collection("activityLogs").add({
          action: activityAction,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        })
        
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (error: any) {
    console.error("Settings update error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update settings" },
      { status: error.code === "auth/invalid-id-token" ? 401 : 500 }
    )
  }
}
