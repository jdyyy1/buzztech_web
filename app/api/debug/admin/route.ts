import { NextResponse } from "next/server"
import { adminStorage } from "@/lib/firebase-admin"

export async function GET() {
  const hasClientEmail = !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const hasPrivateKey = !!process.env.FIREBASE_ADMIN_PRIVATE_KEY
  const googleCredsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || null
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT || null
  const configuredBucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    null

  const bucketCandidates = Array.from(
    new Set(
      [
        configuredBucket,
        projectId ? `${projectId}.appspot.com` : null,
        projectId ? `${projectId}.firebasestorage.app` : null,
      ].filter(Boolean) as string[],
    ),
  )

  const bucketChecks: Array<{ bucket: string; ok: boolean; error?: string }> = []
  for (const bucketName of bucketCandidates) {
    try {
      const bucket = adminStorage.bucket(bucketName)
      await bucket.getFiles({ autoPaginate: false, maxResults: 1 })
      bucketChecks.push({ bucket: bucketName, ok: true })
    } catch (e: any) {
      bucketChecks.push({ bucket: bucketName, ok: false, error: e?.message || "bucket check failed" })
    }
  }

  return NextResponse.json({
    hasServiceAccountEnv: hasClientEmail && hasPrivateKey,
    hasGoogleApplicationCredentials: !!googleCredsPath,
    googleApplicationCredentialsPath: googleCredsPath ? "set" : null,
    detectedProjectId: projectId,
    configuredStorageBucket: configuredBucket,
    bucketCandidates,
    bucketChecks,
  })
}
