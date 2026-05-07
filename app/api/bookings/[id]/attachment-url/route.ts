import { NextRequest, NextResponse } from "next/server"
import { adminDb, adminStorage } from "@/lib/firebase-admin"

const toBasename = (value: string) => value.split(/[\\/]/).pop() || value
const ATTACHMENT_HINT_KEYS = ["attach", "file", "pdf", "document", "image", "upload"]
const isBase64Payload = (value: string) => {
  const v = value.trim()
  if (!v || v.length < 64 || v.includes(" ") || v.includes("://")) return false
  return /^[A-Za-z0-9+/=]+$/.test(v)
}

const collectAttachmentLikeStrings = (value: any, keyPath = "", out = new Set<string>()) => {
  if (value == null) return out

  if (typeof value === "string") {
    if (isBase64Payload(value)) return out
    const normalized = keyPath.toLowerCase()
    const looksAttachmentRelated = ATTACHMENT_HINT_KEYS.some((hint) => normalized.includes(hint))
    if (looksAttachmentRelated || value.startsWith("http") || value.includes("/") || /\.[a-z0-9]{2,6}$/i.test(value)) {
      out.add(value)
    }
    return out
  }

  if (Array.isArray(value)) {
    value.forEach((item, idx) => collectAttachmentLikeStrings(item, `${keyPath}[${idx}]`, out))
    return out
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([k, v]) => collectAttachmentLikeStrings(v, keyPath ? `${keyPath}.${k}` : k, out))
  }

  return out
}

const parseStoragePath = (value: string, bucketName: string) => {
  const raw = value.trim()
  if (!raw) return null

  if (raw.startsWith("gs://")) {
    const withoutScheme = raw.replace("gs://", "")
    const firstSlash = withoutScheme.indexOf("/")
    if (firstSlash === -1) return null
    const bucket = withoutScheme.slice(0, firstSlash)
    const path = withoutScheme.slice(firstSlash + 1)
    if (bucket === bucketName && path) return path
    return null
  }

  // Firebase download URL pattern: /o/<encoded_path>?...
  const marker = "/o/"
  const markerIdx = raw.indexOf(marker)
  if (raw.startsWith("http") && markerIdx !== -1) {
    const encoded = raw.slice(markerIdx + marker.length).split("?")[0]
    try {
      const decoded = decodeURIComponent(encoded)
      return decoded || null
    } catch {
      return encoded || null
    }
  }

  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("blob:")) return null

  return raw
}

const getBucketCandidates = () => {
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT

  return Array.from(
    new Set(
      [
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        process.env.FIREBASE_STORAGE_BUCKET,
        projectId ? `${projectId}.appspot.com` : null,
        projectId ? `${projectId}.firebasestorage.app` : null,
      ].filter(Boolean) as string[],
    ),
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: bookingId } = await params
    const { attachment } = await request.json()

    if (!attachment || typeof attachment !== "string") {
      return NextResponse.json({ error: "Missing attachment value" }, { status: 400 })
    }

    const raw = attachment.trim()
    if (!raw) {
      return NextResponse.json({ error: "Invalid attachment value" }, { status: 400 })
    }
    if (isBase64Payload(raw)) {
      return NextResponse.json({ error: "Inline base64 attachments are resolved in the client" }, { status: 400 })
    }

    if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("blob:")) {
      return NextResponse.json({ url: raw })
    }

    const bookingDoc = await adminDb.collection("bookings").doc(bookingId).get()
    if (!bookingDoc.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const bookingData = bookingDoc.data() || {}
    const userId = String(bookingData.userId || "")
    const basename = toBasename(raw)
    const decodedRaw = decodeURIComponent(raw)
    const decodedBase = toBasename(decodedRaw)

    const attachmentValues = Array.from(collectAttachmentLikeStrings(bookingData)).filter((v) => !isBase64Payload(v))
    const candidates = Array.from(
      new Set(
        [
          raw,
          decodedRaw,
          basename,
          decodedBase,
          `bookings/${bookingId}/${basename}`,
          `bookings/${bookingId}/attachments/${basename}`,
          `attachments/${bookingId}/${basename}`,
          `booking_attachments/${bookingId}/${basename}`,
          userId ? `users/${userId}/bookings/${bookingId}/${basename}` : null,
          userId ? `users/${userId}/attachments/${basename}` : null,
          ...attachmentValues,
        ].filter(Boolean) as string[],
      ),
    )

    const searchPrefixes = [
      `bookings/${bookingId}/`,
      `bookings/${bookingId}/attachments/`,
      `attachments/${bookingId}/`,
      userId ? `users/${userId}/` : null,
      "bookings/",
      "attachments/",
      "uploads/",
    ].filter(Boolean) as string[]

    for (const bucketName of getBucketCandidates()) {
      const bucket = adminStorage.bucket(bucketName)

      for (const candidate of candidates) {
        const path = parseStoragePath(candidate, bucketName)
        if (!path) continue

        try {
          const file = bucket.file(path)
          const [exists] = await file.exists()
          if (!exists) continue

          const [url] = await file.getSignedUrl({
            action: "read",
            expires: Date.now() + 1000 * 60 * 60, // 1 hour
          })

          return NextResponse.json({ url, path, bucket: bucketName })
        } catch {
          // Try next candidate path/bucket.
        }
      }

      // Fallback: targeted prefix scan by basename.
      for (const prefix of searchPrefixes) {
        try {
          const [files] = await bucket.getFiles({ prefix, autoPaginate: false, maxResults: 200 })
          const match = files.find((f) => {
            const name = f.name || ""
            const base = toBasename(name)
            return base === basename || base === decodedBase
          })
          if (!match) continue

          const [url] = await match.getSignedUrl({
            action: "read",
            expires: Date.now() + 1000 * 60 * 60,
          })
          return NextResponse.json({ url, path: match.name, bucket: bucketName })
        } catch {
          // Try next prefix/bucket.
        }
      }
    }

    return NextResponse.json({ error: "Attachment file not found in storage" }, { status: 404 })
  } catch (error) {
    console.error("Attachment URL Resolve Error:", error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: "Failed to resolve attachment URL", details: message }, { status: 500 })
  }
}

