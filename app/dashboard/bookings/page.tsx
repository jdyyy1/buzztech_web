"use client"

import { useState, useEffect } from "react"
import { Search, ChevronRight, Filter, Briefcase, User, Clock, AlertCircle, UserCheck, CheckCircle2, Download, X, Calendar, Paperclip } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { db } from "@/lib/firebase"
import { collection, query, onSnapshot, orderBy, doc, getDoc } from "firebase/firestore"
import { Booking, User as UserType } from "@/lib/models"
import { toast } from "sonner"
import {
  getMaxWorkloadCap,
  canDeveloperAcceptNewAssignment,
  serviceMatchesSpecialties,
  activeAssignmentCount,
} from "@/lib/developer-profile"
import { hasDownpaymentPaid, requiredDownpaymentAmount } from "@/lib/booking-payment-rules"
import { getBookingAttachments } from "@/lib/booking-attachments"
import { managementBasePathFromPathname } from "@/lib/management-base-path"
import { BookingAttachmentExplorer } from "@/components/dashboard/booking-attachment-explorer"

const SERVICE_CATEGORIES = [
  "Graphic Design",
  "Web Development",
  "Mobile App",
  "Cybersecurity",
  "UI/UX Design",
  "Network Setup",
  "Database",
]

const getAssignedStaffId = (booking: any): string | null =>
  booking.developerId || booking.developer_id || booking.staffId || booking.assignedStaffId || null

const getAssignedStaffName = (booking: any): string | null =>
  booking.developerName || booking.developer_name || booking.staffName || booking.assignedStaffName || null

export default function BookingsManagementPage() {
  const pathname = usePathname()
  const base = managementBasePathFromPathname(pathname)
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

  const handleExportCSV = () => {
    const headers = ["Booking ID", "Service", "Client Name", "Developer", "Status", "Total Amount", "Paid", "Date"]
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

  const handleCompleteBooking = async (b: Booking) => {
    try {
      const res = await fetch(`/api/bookings/${b.id}/complete`, { method: "POST" })
      let payload: Record<string, unknown> = {}
      try {
        payload = (await res.json()) as Record<string, unknown>
      } catch {
        payload = {}
      }
      if (!res.ok) throw new Error(String(payload.error || payload.message || "Completion failed"))
      toast.success("Booking marked completed")
      const snap = await getDoc(doc(db, "bookings", b.id))
      if (snap.exists()) {
        const updated = { id: snap.id, ...snap.data() } as Booking
        setBookings((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
        setSelectedBooking((prev) => (prev?.id === updated.id ? updated : prev))
      }
      setIsDetailsOpen(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Completion failed")
    }
  }

  const handleAssignStaff = async () => {
    if (!selectedBooking || !selectedStaffId) return
    setAssignError(null)
    if (selectedBooking.status === "CANCELLED") {
      const msg = "Cannot assign a developer to a cancelled booking"
      setAssignError(msg)
      toast.error(msg)
      return
    }
    if (!hasDownpaymentPaid(selectedBooking)) {
      const need = requiredDownpaymentAmount(selectedBooking.totalAmount)
      const msg = `Downpayment required: client must pay at least 20% (₱${need.toLocaleString(undefined, { maximumFractionDigits: 2 })}) before assigning a developer.`
      setAssignError(msg)
      toast.error(msg)
      return
    }
    const pick = staff.find(
      (s: any) => String((s as any).id || (s as any).user_id || (s as any).email || "") === selectedStaffId,
    )
    const maxCap = getMaxWorkloadCap()
    if (
      !canDeveloperAcceptNewAssignment(
        bookings as unknown as Record<string, unknown>[],
        selectedStaffId,
        selectedBooking as unknown as Record<string, unknown>,
        maxCap,
      )
    ) {
      const msg = "This developer is at their maximum workload for active bookings"
      setAssignError(msg)
      toast.error(msg)
      return
    }
    setIsAssigning(true)
    const staffName = pick?.name || "Unknown Developer"
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
          (raw ? `HTTP ${res.status}: ${raw}` : `HTTP ${res.status}: Failed to assign developer`)
        throw new Error(String(message))
      }
      toast.success("Developer assigned successfully")

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
      console.error("Assign developer failed:", error)
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
            <Label className="text-xs font-bold uppercase text-muted-foreground">Developer Assignment</Label>
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
                      <div className="flex justify-between text-sm pt-1">
                        <span>Downpayment (20%):</span>
                        <span className="font-bold">₱{requiredDownpaymentAmount(selectedBooking.totalAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Downpayment status:</span>
                        <span className={hasDownpaymentPaid(selectedBooking) ? "font-bold text-green-700" : "font-bold text-destructive"}>
                          {hasDownpaymentPaid(selectedBooking) ? "Received" : "Not met — assign developer after client pays"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase font-bold">Assigned Developer</Label>
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
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-10 disabled:opacity-60"
                      disabled={!hasDownpaymentPaid(selectedBooking)}
                      title={
                        !hasDownpaymentPaid(selectedBooking)
                          ? "Collect at least 20% downpayment before assigning a developer"
                          : undefined
                      }
                      onClick={() => {
                        setSelectedStaffId(String(getAssignedStaffId(selectedBooking) || ""))
                        setAssignError(null)
                        setIsAssignDialogOpen(true)
                        setIsDetailsOpen(false)
                      }}
                    >
                      {getAssignedStaffId(selectedBooking) ? "Change Developer" : "Assign Developer"}
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

              <BookingAttachmentExplorer booking={selectedBooking as Record<string, unknown>} />

              <DialogFooter>
                {selectedBooking.status === "ACTIVE" && selectedBooking.is_client_approved && selectedBooking.paidAmount >= selectedBooking.totalAmount && (
                   <Button className="bg-green-600 hover:bg-green-700 text-white gap-2 px-8" onClick={() => handleCompleteBooking(selectedBooking)}>
                     <CheckCircle2 className="w-4 h-4" /> FINAL COMPLETION
                   </Button>
                )}
                <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>Close Overview</Button>
              </DialogFooter>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Developer</DialogTitle>
            {selectedBooking ? (
              <DialogDescription>
                Service: <span className="font-semibold text-foreground">{selectedBooking.serviceName}</span>
                {" · "}
                <Link href={`${base}/developers`} className="text-primary underline">
                  Manage profiles
                </Link>
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="py-2 space-y-4">
            {assignError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {assignError}
              </div>
            ) : null}
            {selectedBooking && !hasDownpaymentPaid(selectedBooking) ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Downpayment not received. The client must pay at least 20% of the contract (₱
                {requiredDownpaymentAmount(selectedBooking.totalAmount).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
                ) before you can assign or change a developer.
              </div>
            ) : null}
            {selectedBooking ? (
              <RadioGroup value={selectedStaffId} onValueChange={setSelectedStaffId} className="gap-0">
                <ScrollArea className="h-[min(360px,50vh)] pr-3">
                  {staff.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No developer accounts. Add one under{" "}
                      <Link href={`${base}/users`} className="text-primary underline">
                        Users → Add New Developer
                      </Link>
                      .
                    </p>
                  ) : (
                  <div className="space-y-2">
                    {selectedBooking && !hasDownpaymentPaid(selectedBooking) ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        Assignments are locked until the downpayment is recorded on this booking.
                      </p>
                    ) : (
                    staff.map((s, idx) => {
                      const value = String((s as any).id || (s as any).user_id || (s as any).email || idx)
                      const cap = getMaxWorkloadCap()
                      const load = activeAssignmentCount(
                        bookings as unknown as Record<string, unknown>[],
                        value,
                      )
                      const canPick = canDeveloperAcceptNewAssignment(
                        bookings as unknown as Record<string, unknown>[],
                        value,
                        selectedBooking as unknown as Record<string, unknown>,
                        cap,
                      )
                      const isCurrent = getAssignedStaffId(selectedBooking) === value
                      const specs = Array.isArray((s as any).specialties)
                        ? ((s as any).specialties as string[]).filter((x) => typeof x === "string")
                        : []
                      const svc = selectedBooking.serviceName || ""
                      const key = `${value}-${idx}`
                      const pct = Math.min(100, Math.round((load / cap) * 100))

                      return (
                        <label
                          key={key}
                          htmlFor={`dev-${key}`}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/40 ${
                            !canPick && !isCurrent ? "opacity-60" : ""
                          }`}
                        >
                          <RadioGroupItem
                            value={value}
                            id={`dev-${key}`}
                            className="mt-1"
                            disabled={!canPick && !isCurrent}
                          />
                          <div className="min-w-0 flex-1 space-y-2">
                            <div>
                              <p className="font-semibold leading-tight">{s.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {specs.length ? (
                                specs.map((sp) => {
                                  const hit = serviceMatchesSpecialties(svc, [sp])
                                  return (
                                    <Badge key={sp} variant={hit ? "default" : "outline"} className="text-[10px] font-normal">
                                      {sp}
                                    </Badge>
                                  )
                                })
                              ) : (
                                <span className="text-xs italic text-muted-foreground">No specialties listed</span>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Workload</span>
                                <span className="font-medium tabular-nums">
                                  {load}
                                  {` / ${cap}`}
                                </span>
                              </div>
                              <Progress value={pct} className="h-1.5" />
                              {!canPick && !isCurrent ? (
                                <p className="text-xs font-medium text-destructive">At capacity</p>
                              ) : null}
                              {isCurrent ? (
                                <p className="text-xs font-medium text-green-700">Currently assigned</p>
                              ) : null}
                            </div>
                          </div>
                        </label>
                      )
                    })
                    )}
                  </div>
                  )}
                </ScrollArea>
              </RadioGroup>
            ) : (
              <p className="text-sm text-muted-foreground">Select a booking first.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAssignStaff}
              disabled={
                !selectedStaffId ||
                isAssigning ||
                (selectedBooking ? !hasDownpaymentPaid(selectedBooking) : false)
              }
            >
              {isAssigning ? "Assigning..." : "Assign to Project"}
            </Button>
          </DialogFooter>
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
