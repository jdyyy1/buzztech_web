"use client"

import { useState, useEffect } from "react"
import { Search, ChevronRight, Filter, Briefcase, User, Clock, AlertCircle, UserCheck, CheckCircle2, Download, X, Calendar, Paperclip } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { db } from "@/lib/firebase"
import { collection, query, onSnapshot, orderBy, doc, getDoc } from "firebase/firestore"
import { Booking, User as UserType } from "@/lib/models"
import { toast } from "sonner"

const SERVICE_CATEGORIES = ["Graphic Design", "Web Development", "Mobile App", "Cybersecurity", "UI/UX Design", "Network Setup"]

const getAssignedStaffId = (booking: any): string | null =>
  booking.developerId || booking.developer_id || booking.staffId || booking.assignedStaffId || null

const getAssignedStaffName = (booking: any): string | null =>
  booking.developerName || booking.developer_name || booking.staffName || booking.assignedStaffName || null

type BookingAttachment = {
  label: string
  raw: string
  href?: string
}

const getBookingAttachments = (booking: any): BookingAttachment[] => {
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

  const addAttachment = (rawValue: any, preferredLabel?: string) => {
    if (rawValue == null) return

    // Direct URL/path string.
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

    // Common attachment object shapes.
    const possibleHref =
      rawValue.url ||
      rawValue.uri ||
      rawValue.src ||
      rawValue.link ||
      rawValue.attachment ||
      rawValue.attachmentUrl ||
      rawValue.attachmentURL ||
      rawValue.downloadURL ||
      rawValue.downloadUrl ||
      rawValue.download_url ||
      rawValue.fileUrl ||
      rawValue.fileURL ||
      rawValue.file_url ||
      rawValue.fileAttachment ||
      rawValue.file_attachment ||
      rawValue.fullPath ||
      rawValue.path

    const possibleLabel =
      rawValue.name ||
      rawValue.fileName ||
      rawValue.filename ||
      rawValue.originalName ||
      rawValue.title

    if (typeof possibleHref === "string" && possibleHref.trim() && isViewableHref(possibleHref)) {
      const href = possibleHref.trim()
      const key = href
      attachments.set(key, {
        label: String(toReadableLabel(href, possibleLabel)),
        raw: href,
        href: isDirectlyOpenable(href) ? href : undefined,
      })
    }
  }

  const walkAttachmentValue = (value: any, keyHint?: string) => {
    if (value == null) return

    if (Array.isArray(value)) {
      value.forEach((item) => walkAttachmentValue(item, keyHint))
      return
    }

    if (typeof value === "object") {
      addAttachment(value, keyHint)
      Object.values(value).forEach((child) => walkAttachmentValue(child, keyHint))
      return
    }

    addAttachment(value, keyHint)
  }

  for (const key of preferredKeys) {
    walkAttachmentValue(booking[key], key)
  }

  // Fallback scan for any attachment-like fields, including nested objects/arrays.
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

export default function BookingsManagementPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [staff, setStaff] = useState<UserType[]>([])
  const [userMap, setUserMap] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  
  // Filter States
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [assignmentFilter, setAssignmentFilter] = useState("ALL")
  
  // UI States
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string>("")
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [resolvedAttachmentUrls, setResolvedAttachmentUrls] = useState<Record<string, string>>({})
  const [isAttachmentPreviewOpen, setIsAttachmentPreviewOpen] = useState(false)
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState("")
  const [attachmentPreviewLabel, setAttachmentPreviewLabel] = useState("")
  const [attachmentPreviewMime, setAttachmentPreviewMime] = useState("")

  useEffect(() => {
    const q = query(collection(db, "bookings"), orderBy("bookingDate", "desc"))
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Booking[]
      setBookings(bookingsData)
      
      // Fetch user names for all bookings
      const uniqueUserIds = Array.from(new Set(bookingsData.map(b => b.userId)))
      const names: Record<string, string> = { ...userMap }
      
      for (const uid of uniqueUserIds) {
        if (!names[uid]) {
          const userDoc = await getDoc(doc(db, "users", uid))
          if (userDoc.exists()) {
            names[uid] = userDoc.data().name
          } else {
            names[uid] = "Unknown Client"
          }
        }
      }
      setUserMap(names)
      setLoading(false)
    })

    fetch("/api/users/staff")
      .then((res) => res.json())
      .then((data) =>
        setStaff((Array.isArray(data) ? data : []).filter((u: any) => String(u?.role || "").toLowerCase() === "staff")),
      )

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!selectedBooking || !isDetailsOpen) {
      setResolvedAttachmentUrls({})
      return
    }

    const attachments = getBookingAttachments(selectedBooking)
    const unresolved = attachments.filter((file) => !file.href)
    if (unresolved.length === 0) return

    let cancelled = false

    const resolveUrls = async () => {
      const entries = await Promise.all(
        unresolved.map(async (file) => {
          try {
            const res = await fetch(`/api/bookings/${selectedBooking.id}/attachment-url`, {
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
  }, [selectedBooking, isDetailsOpen])

  const openResolvedAttachment = async (file: BookingAttachment) => {
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
          const [meta, payload] = url.split(",", 2)
          const mimeMatch = meta.match(/^data:([^;]+);base64$/i)
          const detectedFromPayload = (() => {
            const head = (payload || "").slice(0, 16)
            if (head.startsWith("/9j/")) return "image/jpeg"
            if (head.startsWith("iVBOR")) return "image/png"
            if (head.startsWith("R0lGOD")) return "image/gif"
            if (head.startsWith("JVBER")) return "application/pdf"
            return ""
          })()
          const metaMime = mimeMatch?.[1] || ""
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

    const findInlineDataUrl = (value: any): string | null => {
      const isBase64 = (v: string) => /^[A-Za-z0-9+/=_-]+$/.test(v) && v.length >= 64
      const isMime = (v: string) => /^[a-z]+\/[a-z0-9.+-]+$/i.test(v)

      let mime: string | null = null
      let base64: string | null = null
      let dataUrl: string | null = null

      const walk = (node: any, key = "") => {
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
          Object.entries(node).forEach(([k, v]) => walk(v, key ? `${key}.${k}` : k))
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
    if (!selectedBooking) return

    const looksLikeFilename = /\.[a-z0-9]{2,6}$/i.test(file.raw)
    if (looksLikeFilename) {
      const allAttachments = getBookingAttachments(selectedBooking)
      const inlineMatch = allAttachments.find((item) => {
        const href = item.href || resolvedAttachmentUrls[item.raw]
        return typeof href === "string" && href.startsWith("data:")
      })
      if (inlineMatch?.href) {
        openUrl(inlineMatch.href)
        return
      }
      const inlineFromBooking = findInlineDataUrl(selectedBooking)
      if (inlineFromBooking) {
        openUrl(inlineFromBooking)
        return
      }
    }

    try {
      const res = await fetch(`/api/bookings/${selectedBooking.id}/attachment-url`, {
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
  }

  const handleExportCSV = () => {
    const headers = ["Booking ID", "Service", "Client Name", "Staff", "Status", "Total Amount", "Paid", "Date"]
    const rows = bookings.map(b => [
      b.id,
      b.serviceName,
      userMap[b.userId] || b.userId,
      b.developerName || "Unassigned",
      b.status,
      b.totalAmount,
      b.paidAmount,
      b.bookingDate?.toDate ? b.bookingDate.toDate().toLocaleDateString() : "N/A"
    ])

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `BuzzTech_Bookings_Backup_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Export successful!")
  }

  const handleAssignStaff = async () => {
    if (!selectedBooking || !selectedStaffId) return
    setAssignError(null)
    if (selectedBooking.status === "CANCELLED") {
      const msg = "Cannot assign a specialist to a cancelled booking"
      setAssignError(msg)
      toast.error(msg)
      return
    }
    setIsAssigning(true)
    const staffMember = staff.find(
      (s: any) => String((s as any).id || (s as any).user_id || (s as any).email || "") === selectedStaffId,
    )
    const staffName = staffMember?.name || "Unknown Staff"
    try {
      const res = await fetch(`/api/bookings/${selectedBooking.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: selectedStaffId, staffName })
      })
      if (!res.ok) {
        const raw = await res.text().catch(() => "")
        let payload: any = null
        try {
          payload = raw ? JSON.parse(raw) : null
        } catch {
          payload = null
        }
        const message =
          payload?.error ||
          payload?.message ||
          (raw ? `HTTP ${res.status}: ${raw}` : `HTTP ${res.status}: Failed to assign staff`)
        throw new Error(String(message))
      }
      toast.success("Staff assigned successfully")

      // Optimistically update local state so "Handling By" reflects instantly.
      setBookings(prev =>
        prev.map(b => (b.id === selectedBooking.id ? { ...b, status: "ACTIVE" } : b)),
      )

      // Then re-fetch from Firestore to ensure the UI matches the canonical stored fields.
      const updatedSnap = await getDoc(doc(db, "bookings", selectedBooking.id))
      if (updatedSnap.exists()) {
        const updatedData = updatedSnap.data() as any
        const updated = { id: updatedSnap.id, ...updatedData } as Booking

        setBookings(prev => prev.map(b => (b.id === updated.id ? updated : b)))
        setSelectedBooking(updated)
      } else {
        // Fallback to optimistic display if the doc disappears.
        setSelectedBooking(prev =>
          prev && prev.id === selectedBooking.id
            ? {
                ...prev,
                developerId: selectedStaffId,
                developerName: staffName,
                developer_id: selectedStaffId,
                developer_name: staffName,
                assignedStaffId: selectedStaffId,
                assignedStaffName: staffName,
                status: "ACTIVE",
              }
            : prev,
        )
      }

      setIsAssignDialogOpen(false)
      setSelectedStaffId("")
    } catch (error: any) {
      const msg = error?.message || "Assignment failed"
      setAssignError(msg)
      console.error("Assign specialist failed:", error)
      toast.error(msg)
    } finally {
      setIsAssigning(false)
    }
  }

  const filteredBookings = bookings.filter(b => {
    const matchesSearch = b.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         b.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (userMap[b.userId] || "").toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "ALL" || b.status === statusFilter
    const matchesCategory = categoryFilter === "ALL" || b.serviceName.includes(categoryFilter)
    const assignedStaffId = getAssignedStaffId(b)
    const matchesAssignment = assignmentFilter === "ALL" ||
                             (assignmentFilter === "ASSIGNED" ? !!assignedStaffId : !assignedStaffId)

    return matchesSearch && matchesStatus && matchesCategory && matchesAssignment
  })

  return (
    <div className="p-8 space-y-6 pb-24">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">Bookings Management</h1>
          <p className="text-muted-foreground italic">Track, filter, and finalize service requests</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} className="gap-2">
            <Download className="w-4 h-4" /> Export Backup
          </Button>
        </div>
      </div>

      {/* Advanced Filters */}
      <Card className="p-4 bg-accent/10 border-dashed">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="ID or Client Name" className="pl-8 h-9 text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {SERVICE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Staff Assignment</Label>
            <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Any Assignment</SelectItem>
                <SelectItem value="ASSIGNED">Assigned Only</SelectItem>
                <SelectItem value="UNASSIGNED">Unassigned Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-20 animate-pulse text-muted-foreground font-bold">SYNCING WITH FIRESTORE...</div>
        ) : filteredBookings.map((booking) => (
          (() => {
            const assignedStaffId = getAssignedStaffId(booking)
            const assignedStaffName = getAssignedStaffName(booking)
            const attachments = getBookingAttachments(booking)

            return (
          <Card 
            key={booking.id} 
            className="p-4 hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-transparent hover:border-l-primary group"
            onClick={() => { setSelectedBooking(booking); setIsDetailsOpen(true); }}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-lg">{userMap[booking.userId] || "Loading..."}</p>
                    <Badge variant="outline" className={booking.status === 'PENDING' ? 'bg-yellow-50 text-yellow-700' : 'bg-blue-50'}>{booking.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">ID: {booking.id.slice(0, 8)}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Service</p>
                  <p className="text-sm font-semibold flex items-center gap-1"><Briefcase className="w-3 h-3 text-primary" /> {booking.serviceName}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Handling By</p>
                  <p className={`text-sm font-bold ${!assignedStaffId ? 'text-orange-500 italic' : ''}`}>
                    {assignedStaffName || (assignedStaffId ? `Assigned (${assignedStaffId.slice(0, 8)}...)` : "Unassigned")}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Revenue</p>
                  <p className="text-sm font-black">₱{booking.paidAmount.toLocaleString()} / ₱{booking.totalAmount.toLocaleString()}</p>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground mr-4">
                <Paperclip className="w-3.5 h-3.5" />
                <span>{attachments.length}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
            )
          })()
        ))}
      </div>

      {/* Booking Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          {selectedBooking && (
            <>
              {(() => {
                const attachments = getBookingAttachments(selectedBooking)

                return (
                  <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                  <FileText className="w-6 h-6 text-primary" /> Booking Overview
                </DialogTitle>
                <DialogDescription className="font-mono text-xs">Full UID: {selectedBooking.id}</DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-2 gap-6 py-6 border-y border-dashed">
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase font-bold">Client Information</Label>
                    <p className="font-bold text-lg">{userMap[selectedBooking.userId]}</p>
                    <p className="text-xs text-muted-foreground italic">ID: {selectedBooking.userId}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase font-bold">Service Category</Label>
                    <p className="font-semibold text-primary">{selectedBooking.serviceName}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase font-bold">Booking Date</Label>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Calendar className="w-4 h-4" /> 
                      {selectedBooking.bookingDate?.toDate ? selectedBooking.bookingDate.toDate().toLocaleString() : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 bg-accent/30 p-4 rounded-xl">
                   <div>
                    <Label className="text-xs text-muted-foreground uppercase font-bold">Financial Summary</Label>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-sm"><span>Total Contract:</span> <span className="font-bold">₱{selectedBooking.totalAmount.toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm"><span>Total Paid:</span> <span className="font-bold text-green-600">₱{selectedBooking.paidAmount.toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm border-t pt-1 mt-1"><span>Balance:</span> <span className="font-bold text-destructive">₱{(selectedBooking.totalAmount - selectedBooking.paidAmount).toLocaleString()}</span></div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase font-bold">Assigned Staff</Label>
                    {selectedBooking.status === "CANCELLED" && !getAssignedStaffId(selectedBooking) ? (
                      <p className="font-bold text-destructive">Not allowed (booking cancelled)</p>
                    ) : getAssignedStaffId(selectedBooking) ? (
                      <p className="font-bold flex items-center gap-2 text-green-700">
                        <UserCheck className="w-4 h-4" />{" "}
                        {getAssignedStaffName(selectedBooking) || `Assigned (${String(getAssignedStaffId(selectedBooking) || "").slice(0, 8)}...)`}
                      </p>
                    ) : (
                      <p className="font-bold text-orange-500 italic">Unassigned</p>
                    )}
                  </div>
                  {selectedBooking.status !== "CANCELLED" ? (
                    <Button
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-10"
                      onClick={() => {
                        setSelectedStaffId(String(getAssignedStaffId(selectedBooking) || ""))
                        setAssignError(null)
                        setIsAssignDialogOpen(true)
                        setIsDetailsOpen(false)
                      }}
                    >
                      {getAssignedStaffId(selectedBooking) ? "Change Specialist" : "Assign Specialist"}
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="py-4">
                <Label className="text-xs text-muted-foreground uppercase font-bold">Project Description</Label>
                <div className="mt-2 p-3 bg-white border rounded-lg text-sm italic min-h-[60px]">
                  {selectedBooking.description || "No description provided."}
                </div>
              </div>

              <div className="py-2">
                <Label className="text-xs text-muted-foreground uppercase font-bold flex items-center gap-2">
                  <Paperclip className="w-3.5 h-3.5" /> Attachments
                </Label>
                {attachments.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {attachments.map((file, idx) => (
                      <button
                        key={`${file.raw}-${idx}`}
                        type="button"
                        onClick={() => openResolvedAttachment(file)}
                        className="block text-sm text-primary hover:underline break-all text-left"
                      >
                        {file.label || `Attachment ${idx + 1}`} - View Attachment
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No attachments uploaded.</p>
                )}
              </div>

              <DialogFooter>
                {selectedBooking.status === "ACTIVE" && selectedBooking.is_client_approved && selectedBooking.paidAmount >= selectedBooking.totalAmount && (
                   <Button className="bg-green-600 hover:bg-green-700 text-white gap-2 px-8" onClick={() => handleCompleteBooking(selectedBooking)}>
                     <CheckCircle2 className="w-4 h-4" /> FINAL COMPLETION
                   </Button>
                )}
                <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>Close Overview</Button>
              </DialogFooter>
                  </>
                )
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Shared Assignment Dialog */}
      <Dialog
        open={isAssignDialogOpen}
        onOpenChange={(open) => {
          setIsAssignDialogOpen(open)
          if (!open) setAssignError(null)
        }}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Staff Member</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            {assignError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {assignError}
              </div>
            ) : null}
            <Select onValueChange={setSelectedStaffId} value={selectedStaffId}>
              <SelectTrigger><SelectValue placeholder="Choose a specialist..." /></SelectTrigger>
              <SelectContent>
                {staff.map((s, idx) => {
                  const value = (s as any).id || (s as any).user_id || (s as any).email || String(idx)
                  const key = `${value}-${idx}`
                  return (
                    <SelectItem key={key} value={String(value)}>
                      {s.name} ({s.email})
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignStaff} disabled={!selectedStaffId || isAssigning}>{isAssigning ? "Assigning..." : "Assign to Project"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        <DialogContent className="sm:max-w-[900px] h-[80vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{attachmentPreviewLabel || "Attachment Preview"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-black/95 flex items-center justify-center">
            {attachmentPreviewUrl ? (
              attachmentPreviewMime.startsWith("image/") ? (
                <img
                  src={attachmentPreviewUrl}
                  alt={attachmentPreviewLabel || "Attachment"}
                  className="max-w-full max-h-full object-contain"
                />
              ) : attachmentPreviewMime === "application/pdf" ? (
                <iframe
                  src={attachmentPreviewUrl}
                  title={attachmentPreviewLabel || "Attachment Preview"}
                  className="w-full h-full border-0"
                />
              ) : (
                <a
                  href={attachmentPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline text-sm"
                >
                  Open attachment in new tab
                </a>
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FileText(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  )
}
