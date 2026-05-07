import { NextRequest, NextResponse } from "next/server"
import { adminDb, adminStorage } from "@/lib/firebase-admin"

const ATTACHMENT_HINT_KEYS = ["attach", "file", "pdf", "document", "image", "upload"]
const isBase64Payload = (value: string) => {
  const v = value.trim()
  if (!v || v.length < 64 || v.includes(" ") || v.includes("://")) return false
  return /^[A-Za-z0-9+/=]+$/.test(v)
}

const toBasename = (value: string) => value.split(/[\\/]/).pop() || value

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: bookingId } = await params
    const requestedAttachment = request.nextUrl.searchParams.get("attachment") || ""

    const bookingDoc = await adminDb.collection("bookings").doc(bookingId).get()
    if (!bookingDoc.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const bookingData = bookingDoc.data() || {}
    const userId = String(bookingData.userId || "")
    const detectedAttachmentValues = Array.from(collectAttachmentLikeStrings(bookingData)).filter((v) => !isBase64Payload(v))
    const base = requestedAttachment ? toBasename(requestedAttachment) : ""

    const candidates = Array.from(
      new Set(
        [
          requestedAttachment || null,
          requestedAttachment ? decodeURIComponent(requestedAttachment) : null,
          base || null,
          requestedAttachment ? `bookings/${bookingId}/${base}` : null,
          requestedAttachment ? `bookings/${bookingId}/attachments/${base}` : null,
          requestedAttachment ? `attachments/${bookingId}/${base}` : null,
          requestedAttachment ? `booking_attachments/${bookingId}/${base}` : null,
          requestedAttachment && userId ? `users/${userId}/bookings/${bookingId}/${base}` : null,
          requestedAttachment && userId ? `users/${userId}/attachments/${base}` : null,
          ...detectedAttachmentValues,
        ].filter(Boolean) as string[],
      ),
    )

    const bucketCandidates = getBucketCandidates()
    const candidateChecks: Array<{ bucket: string; input: string; parsedPath: string | null; exists: boolean; error?: string }> = []
    for (const bucketName of bucketCandidates) {
      const bucket = adminStorage.bucket(bucketName)

      for (const candidate of candidates) {
        const parsedPath = parseStoragePath(candidate, bucketName)
        if (!parsedPath) {
          candidateChecks.push({ bucket: bucketName, input: candidate, parsedPath: null, exists: false })
          continue
        }

        try {
          const file = bucket.file(parsedPath)
          const [exists] = await file.exists()
          candidateChecks.push({ bucket: bucketName, input: candidate, parsedPath, exists })
        } catch (e: any) {
          candidateChecks.push({
            bucket: bucketName,
            input: candidate,
            parsedPath,
            exists: false,
            error: e?.message || "unknown bucket/file check error",
          })
        }
      }
    }

    const searchPrefixes = [
      `bookings/${bookingId}/`,
      `bookings/${bookingId}/attachments/`,
      `attachments/${bookingId}/`,
      userId ? `users/${userId}/` : null,
      "bookings/",
      "attachments/",
      "uploads/",
    ].filter(Boolean) as string[]

    const prefixSamples: Record<string, Record<string, string[] | { error: string }>> = {}
    for (const bucketName of bucketCandidates) {
      const bucket = adminStorage.bucket(bucketName)
      prefixSamples[bucketName] = {}
      for (const prefix of searchPrefixes) {
        try {
          const [files] = await bucket.getFiles({ prefix, autoPaginate: false, maxResults: 25 })
          prefixSamples[bucketName][prefix] = files.map((f) => f.name)
        } catch (e: any) {
          prefixSamples[bucketName][prefix] = { error: e?.message || "failed to list prefix" }
        }
      }
    }

    return NextResponse.json({
      bookingId,
      bucketCandidates,
      requestedAttachment: requestedAttachment || null,
      detectedAttachmentValues,
      candidateChecks,
      prefixSamples,
    })
  } catch (error) {
    console.error("Attachment Debug Error:", error)
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      {
        error: "Failed to debug attachment resolution",
        details: message,
        stack: process.env.NODE_ENV !== "production" ? stack : undefined,
      },
      { status: 500 },
    )
  }
}

