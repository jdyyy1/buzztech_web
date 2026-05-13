export type BookingAttachment = {
  label: string
  raw: string
  href?: string
}

/** Collect client-uploaded files / URLs from a booking document (Firestore shapes vary). */
export function getBookingAttachments(booking: Record<string, unknown> | null | undefined): BookingAttachment[] {
  if (!booking) return []

  const attachments = new Map<string, BookingAttachment>()
  const inlinePayloads: Array<{ data: string; mime?: string; label?: string }> = []
  const preferredKeys = [
    "attachmentUrls",
    "attachments",
    "fileattachments",
    "fileAttachments",
    "files",
    "fileUrls",
    "file_urls",
    "pdfUrls",
    "pdfUrl",
    "documentUrls",
    "documents",
  ]

  const toReadableLabel = (href: string, fallback?: string) => {
    const fromHref = href.split("?")[0].split("#")[0].split("/").pop()
    return (fromHref && fromHref.trim()) || (fallback && fallback.trim()) || "Attachment"
  }

  const isViewableHref = (value: string) => {
    const v = value.trim()
    if (v.startsWith("data:")) return true
    const looksLikeFilePath = v.includes("/") && /\.[a-z0-9]{2,6}($|\?)/i.test(v)
    const looksLikeFilename = !v.includes(" ") && /\.[a-z0-9]{2,6}$/i.test(v)
    return (
      v.startsWith("http://") ||
      v.startsWith("https://") ||
      v.startsWith("gs://") ||
      v.startsWith("blob:") ||
      looksLikeFilePath ||
      looksLikeFilename
    )
  }

  const isBase64Payload = (value: string) => {
    const v = value.trim()
    if (!v || v.length < 64 || v.includes(" ") || v.includes("://")) return false
    return /^[A-Za-z0-9+/=]+$/.test(v)
  }

  const isMimeType = (value: string) => /^[a-z]+\/[a-z0-9.+-]+$/i.test(value.trim())

  const isDirectlyOpenable = (href: string) =>
    href.startsWith("http://") || href.startsWith("https://") || href.startsWith("blob:") || href.startsWith("data:")

  const addAttachment = (rawValue: unknown, preferredLabel?: string) => {
    if (rawValue == null) return

    if (typeof rawValue === "string") {
      const value = rawValue.trim()
      if (!value) return
      if (isBase64Payload(value)) {
        inlinePayloads.push({ data: value, label: preferredLabel })
        return
      }
      if (isMimeType(value)) {
        const last = inlinePayloads[inlinePayloads.length - 1]
        if (last && !last.mime) last.mime = value
        return
      }
      if (!isViewableHref(value)) return
      const key = value
      attachments.set(key, {
        label: toReadableLabel(value, preferredLabel),
        raw: value,
        href: isDirectlyOpenable(value) ? value : undefined,
      })
      return
    }

    if (typeof rawValue !== "object") return

    const obj = rawValue as Record<string, unknown>
    const possibleHref =
      obj.url ||
      obj.uri ||
      obj.src ||
      obj.link ||
      obj.attachment ||
      obj.attachmentUrl ||
      obj.attachmentURL ||
      obj.downloadURL ||
      obj.downloadUrl ||
      obj.download_url ||
      obj.fileUrl ||
      obj.fileURL ||
      obj.file_url ||
      obj.fileAttachment ||
      obj.file_attachment ||
      obj.fullPath ||
      obj.path

    const possibleLabel =
      obj.name ||
      obj.fileName ||
      obj.filename ||
      obj.originalName ||
      obj.title

    if (typeof possibleHref === "string" && possibleHref.trim() && isViewableHref(possibleHref)) {
      const href = possibleHref.trim()
      const key = href
      attachments.set(key, {
        label: String(toReadableLabel(href, typeof possibleLabel === "string" ? possibleLabel : undefined)),
        raw: href,
        href: isDirectlyOpenable(href) ? href : undefined,
      })
    }
  }

  const walkAttachmentValue = (value: unknown, keyHint?: string) => {
    if (value == null) return

    if (Array.isArray(value)) {
      value.forEach((item) => walkAttachmentValue(item, keyHint))
      return
    }

    if (typeof value === "object") {
      addAttachment(value, keyHint)
      Object.values(value as object).forEach((child) => walkAttachmentValue(child, keyHint))
      return
    }

    addAttachment(value, keyHint)
  }

  for (const key of preferredKeys) {
    walkAttachmentValue(booking[key], key)
  }

  Object.entries(booking).forEach(([key, value]) => {
    const normalized = key.toLowerCase()
    const looksLikeAttachmentField =
      normalized.includes("attach") ||
      normalized.includes("file") ||
      normalized.includes("pdf") ||
      normalized.includes("document")

    if (!looksLikeAttachmentField) return
    walkAttachmentValue(value, key)
  })

  inlinePayloads.forEach((item, idx) => {
    const mime = item.mime || "application/octet-stream"
    const href = `data:${mime};base64,${item.data}`
    const fallbackLabel = mime.startsWith("image/") ? `Image ${idx + 1}` : `Attachment ${idx + 1}`
    attachments.set(href, {
      label: toReadableLabel(item.label || "", fallbackLabel),
      raw: href,
      href,
    })
  })

  return Array.from(attachments.values())
}
