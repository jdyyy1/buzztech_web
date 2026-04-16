import { NextResponse } from "next/server"

export async function GET() {
  const hasClientEmail = !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const hasPrivateKey = !!process.env.FIREBASE_ADMIN_PRIVATE_KEY
  const googleCredsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || null
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT || null

  return NextResponse.json({
    hasServiceAccountEnv: hasClientEmail && hasPrivateKey,
    hasGoogleApplicationCredentials: !!googleCredsPath,
    googleApplicationCredentialsPath: googleCredsPath ? "set" : null,
    detectedProjectId: projectId,
  })
}
