import { NextRequest, NextResponse } from "next/server"
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase-admin"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"

const isPrivilegedRole = (role: unknown) => {
  const r = String(role || "").toLowerCase()
  return r === "admin" || r === "superadmin"
}

async function requireAdmin(request: NextRequest): Promise<void> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || ""
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1] || request.cookies.get("__session")?.value
  if (!token) throw new Error("Missing auth token")

  const decoded = await adminAuth.verifyIdToken(token)
  const uid = decoded.uid

  const userSnap = await adminDb.collection("users").doc(uid).get()
  let role = userSnap.exists ? (userSnap.data() as any)?.role : undefined
  // Some projects store UID in users.user_id with non-UID doc IDs.
  if (!role) {
    const q = await adminDb.collection("users").where("user_id", "==", uid).limit(1).get()
    if (!q.empty) role = (q.docs[0].data() as any)?.role
  }
  if (!isPrivilegedRole(role)) throw new Error("Unauthorized")
}

const sanitizeFilename = (name: string) =>
  name
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 120) || "icon"

const normalizeBucketName = (value: string) =>
  value
    .trim()
    .replace(/^gs:\/\//i, "")
    .replace(/^https?:\/\/storage\.googleapis\.com\//i, "")
    .replace(/\/+$/, "")

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const form = await request.formData()
    const serviceId = String(form.get("serviceId") || "").trim()
    const file = form.get("file")

    if (!serviceId) return NextResponse.json({ error: "Missing serviceId" }, { status: 400 })
    if (!file || typeof (file as any).arrayBuffer !== "function") {
      return NextResponse.json({ error: "Missing or invalid file" }, { status: 400 })
    }

    const uploadFile = file as File
    const bytes = Buffer.from(await uploadFile.arrayBuffer())
    const contentType = uploadFile.type || "application/octet-stream"
    const safeName = sanitizeFilename(uploadFile.name || "icon")

    // Always mirror upload into the web's static mobile icon folder.
    const mobileIconsDir = path.join(process.cwd(), "public", "mobile-icons")
    await mkdir(mobileIconsDir, { recursive: true })
    await writeFile(path.join(mobileIconsDir, safeName), bytes)
    const mobileIconUrl = `/mobile-icons/${encodeURIComponent(safeName)}`
    const mobileIconAbsoluteUrl = `${request.nextUrl.origin}${mobileIconUrl}`

    const configuredBucket = normalizeBucketName(
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || "",
    )
    const projectId =
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      ""
    const adminConfiguredBucket = normalizeBucketName(String((adminStorage as any)?.app?.options?.storageBucket || ""))
    const bucketCandidates = Array.from(
      new Set(
        [
          configuredBucket,
          adminConfiguredBucket,
          projectId ? `${projectId}.appspot.com` : "",
          projectId ? `${projectId}.firebasestorage.app` : "",
        ].filter(Boolean),
      ),
    )

    if (bucketCandidates.length === 0) {
      return NextResponse.json({
        // Fallback: still return a resolvable URL for uploaded icon.
        iconUrl: mobileIconAbsoluteUrl,
        iconWebUrl: mobileIconUrl,
        iconResName: safeName,
        path: `public/mobile-icons/${safeName}`,
        bucket: "",
        warning: "Firebase Storage bucket is not configured. Saved icon as web URL fallback.",
      })
    }

    const objectPath = `service-icons/${serviceId}/${Date.now()}-${safeName}`
    const downloadToken = randomUUID()
    let bucketName = ""
    let signedUrl = ""
    let lastError: unknown = null

    for (const candidate of bucketCandidates) {
      try {
        const bucket = adminStorage.bucket(candidate)
        const object = bucket.file(objectPath)

        await object.save(bytes, {
          resumable: false,
          metadata: {
            contentType,
            cacheControl: "public, max-age=31536000, immutable",
            metadata: {
              firebaseStorageDownloadTokens: downloadToken,
            },
          },
        })

        ;[signedUrl] = await object.getSignedUrl({
          action: "read",
          expires: "03-01-2500",
        })

        bucketName = candidate
        break
      } catch (err) {
        lastError = err
      }
    }

    if (!bucketName) {
      const message = lastError instanceof Error ? lastError.message : "Unknown storage error"
      return NextResponse.json({
        // Fallback to URL mode when Firebase Storage upload fails.
        iconUrl: mobileIconAbsoluteUrl,
        iconWebUrl: mobileIconUrl,
        iconResName: safeName,
        path: `public/mobile-icons/${safeName}`,
        bucket: "",
        warning: `Firebase Storage upload failed (${message}). Saved icon as web URL fallback.`,
      })
    }

    const encodedObjectPath = encodeURIComponent(objectPath)
    const firebaseDownloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedObjectPath}?alt=media&token=${downloadToken}`
    const gsUrl = `gs://${bucketName}/${objectPath}`

    return NextResponse.json({
      // Real Firebase URLs/paths for cross-platform clients.
      iconUrl: firebaseDownloadUrl,
      iconSignedUrl: signedUrl,
      iconGsUrl: gsUrl,
      mobileIconUrl,
      iconWebUrl: mobileIconUrl,
      iconResName: safeName,
      path: objectPath,
      bucket: bucketName,
    })
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Upload failed"
    const status =
      msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("missing auth token") ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

