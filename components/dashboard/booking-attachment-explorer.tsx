"use client"

import { useCallback, useEffect, useState } from "react"
import { Paperclip } from "lucide-react"
import { toast } from "sonner"

import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getBookingAttachments, type BookingAttachment } from "@/lib/booking-attachments"

type BookingLike = Record<string, unknown> & { id?: string }

export function BookingAttachmentExplorer({ booking }: { booking: BookingLike | null | undefined }) {
  const bookingId = booking?.id != null ? String(booking.id) : ""
  const [resolvedAttachmentUrls, setResolvedAttachmentUrls] = useState<Record<string, string>>({})
  const [isAttachmentPreviewOpen, setIsAttachmentPreviewOpen] = useState(false)
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState("")
  const [attachmentPreviewMime, setAttachmentPreviewMime] = useState("")
  const [attachmentPreviewLabel, setAttachmentPreviewLabel] = useState("")

  const attachments = booking ? getBookingAttachments(booking) : []

  useEffect(() => {
    setResolvedAttachmentUrls({})
    if (!booking || !bookingId) {
      return
    }

    const list = getBookingAttachments(booking)
    const unresolved = list.filter((file) => !file.href)
    if (unresolved.length === 0) return

    let cancelled = false

    const resolveUrls = async () => {
      const entries = await Promise.all(
        unresolved.map(async (file) => {
          try {
            const res = await fetch(`/api/bookings/${bookingId}/attachment-url`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ attachment: file.raw }),
            })
            if (!res.ok) return [file.raw, ""]
            const data = await res.json()
            return [file.raw, typeof data?.url === "string" ? data.url : ""]
          } catch {
            return [file.raw, ""]
          }
        }),
      )

      if (cancelled) return
      setResolvedAttachmentUrls((prev) => {
        const next = { ...prev }
        entries.forEach(([raw, url]) => {
          if (url) next[String(raw)] = String(url)
        })
        return next
      })
    }

    resolveUrls()
    return () => {
      cancelled = true
    }
  }, [booking, bookingId])

  const openResolvedAttachment = useCallback(
    async (file: BookingAttachment) => {
      if (!booking || !bookingId) return

      const showPreview = (url: string, mime: string, label: string) => {
        setAttachmentPreviewUrl(url)
        setAttachmentPreviewMime(mime)
        setAttachmentPreviewLabel(label)
        setIsAttachmentPreviewOpen(true)
      }

      const inferMime = (url: string, fallbackName?: string) => {
        if (url.startsWith("data:")) {
          const match = url.match(/^data:([^;]+);base64,/i)
          if (match?.[1]) return match[1]
        }

        const lowerUrl = url.toLowerCase().split("?")[0]
        const lowerName = String(fallbackName || "").toLowerCase()
        const combined = `${lowerUrl} ${lowerName}`
        if (combined.includes(".jpg") || combined.includes(".jpeg")) return "image/jpeg"
        if (combined.includes(".png")) return "image/png"
        if (combined.includes(".gif")) return "image/gif"
        if (combined.includes(".webp")) return "image/webp"
        if (combined.includes(".pdf")) return "application/pdf"
        return "application/octet-stream"
      }

      const openUrl = (url: string) => {
        const label = file.label || "Attachment"
        const mime = inferMime(url, `${file.label} ${file.raw}`)

        if (url.startsWith("data:")) {
          try {
            const [, payload] = url.split(",", 2)
            const metaMatch = url.match(/^data:([^;]+);base64$/i)
            const detectedFromPayload = (() => {
              const head = (payload || "").slice(0, 16)
              if (head.startsWith("/9j/")) return "image/jpeg"
              if (head.startsWith("iVBOR")) return "image/png"
              if (head.startsWith("R0lGOD")) return "image/gif"
              if (head.startsWith("JVBER")) return "application/pdf"
              return ""
            })()
            const metaMime = metaMatch?.[1] || ""
            const decodedMime =
              !metaMime || metaMime === "application/octet-stream"
                ? detectedFromPayload || mime
                : metaMime
            const binary = atob(payload || "")
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
            const blobUrl = URL.createObjectURL(new Blob([bytes], { type: decodedMime }))
            showPreview(blobUrl, decodedMime, label)
            return true
          } catch (e) {
            console.error("Attachment open (data url) failed:", e)
            toast.error("Failed to decode inline attachment")
            return false
          }
        }

        if (mime.startsWith("image/") || mime === "application/pdf") {
          showPreview(url, mime, label)
          return true
        }

        const opened = window.open(url, "_blank", "noopener,noreferrer")
        if (!opened) {
          toast.error("Popup blocked while opening attachment")
          return false
        }
        return true
      }

      const findInlineDataUrl = (value: unknown): string | null => {
        const isBase64 = (v: string) => /^[A-Za-z0-9+/=_-]+$/.test(v) && v.length >= 64
        const isMime = (v: string) => /^[a-z]+\/[a-z0-9.+-]+$/i.test(v)

        let mime: string | null = null
        let base64: string | null = null
        let dataUrl: string | null = null

        const walk = (node: unknown, key = "") => {
          if (base64 || dataUrl) return
          if (node == null) return
          if (typeof node === "string") {
            const s = node.trim()
            if (!s) return
            if (s.startsWith("data:")) {
              dataUrl = s
              return
            }
            if (!mime && isMime(s)) {
              mime = s
              return
            }
            const lowerKey = key.toLowerCase()
            const isDataLikeKey =
              lowerKey.includes("base64") || lowerKey.includes("data") || lowerKey.includes("content")
            if (isBase64(s) || isDataLikeKey) {
              base64 = s
            }
            return
          }
          if (Array.isArray(node)) {
            node.forEach((item, idx) => walk(item, `${key}[${idx}]`))
            return
          }
          if (typeof node === "object") {
            Object.entries(node as object).forEach(([k, v]) => walk(v, key ? `${key}.${k}` : k))
          }
        }

        walk(value)
        if (dataUrl) return dataUrl
        if (!base64) return null
        return `data:${mime || "application/octet-stream"};base64,${base64}`
      }

      const directUrl = file.href || resolvedAttachmentUrls[file.raw]
      if (directUrl) {
        openUrl(directUrl)
        return
      }

      const looksLikeFilename = /\.[a-z0-9]{2,6}$/i.test(file.raw)
      if (looksLikeFilename) {
        const allAttachments = getBookingAttachments(booking)
        const inlineMatch = allAttachments.find((item) => {
          const href = item.href || resolvedAttachmentUrls[item.raw]
          return typeof href === "string" && href.startsWith("data:")
        })
        if (inlineMatch?.href) {
          openUrl(inlineMatch.href)
          return
        }
        const inlineFromBooking = findInlineDataUrl(booking)
        if (inlineFromBooking) {
          openUrl(inlineFromBooking)
          return
        }
      }

      try {
        const res = await fetch(`/api/bookings/${bookingId}/attachment-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attachment: file.raw }),
        })
        if (!res.ok) {
          toast.error("Unable to open attachment")
          return
        }
        const data = await res.json()
        if (typeof data?.url === "string" && data.url) {
          setResolvedAttachmentUrls((prev) => ({ ...prev, [file.raw]: data.url }))
          openUrl(data.url)
          return
        }
        toast.error("Unable to open attachment")
      } catch {
        toast.error("Unable to open attachment")
      }
    },
    [booking, bookingId, resolvedAttachmentUrls],
  )

  if (!booking || !bookingId) return null

  return (
    <>
      <div className="py-2">
        <Label className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" /> Client attachments
        </Label>
        {attachments.length > 0 ? (
          <div className="mt-2 space-y-2">
            {attachments.map((file, idx) => (
              <button
                key={`${file.raw}-${idx}`}
                type="button"
                onClick={() => void openResolvedAttachment(file)}
                className="block w-full break-all text-left text-sm text-primary hover:underline"
              >
                {file.label || `Attachment ${idx + 1}`} — View
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No attachments uploaded.</p>
        )}
      </div>

      <Dialog
        open={isAttachmentPreviewOpen}
        onOpenChange={(open) => {
          setIsAttachmentPreviewOpen(open)
          if (!open) {
            setAttachmentPreviewUrl("")
            setAttachmentPreviewMime("")
            setAttachmentPreviewLabel("")
          }
        }}
      >
        <DialogContent className="h-[80vh] max-w-[900px] overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>{attachmentPreviewLabel || "Attachment preview"}</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 items-center justify-center bg-black/95">
            {attachmentPreviewUrl ? (
              attachmentPreviewMime.startsWith("image/") ? (
                <img
                  src={attachmentPreviewUrl}
                  alt={attachmentPreviewLabel || "Attachment"}
                  className="max-h-full max-w-full object-contain"
                />
              ) : attachmentPreviewMime === "application/pdf" ? (
                <iframe
                  src={attachmentPreviewUrl}
                  title={attachmentPreviewLabel || "Attachment preview"}
                  className="h-[min(72vh,800px)] w-full border-0"
                />
              ) : (
                <a
                  href={attachmentPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary underline"
                >
                  Open attachment in new tab
                </a>
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
