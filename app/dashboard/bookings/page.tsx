"use client"

import { useState, useEffect } from "react"
import { Search, ChevronRight, Filter, Briefcase, User, Clock, AlertCircle, UserCheck, CheckCircle2, Download, X, Calendar } from "lucide-react"
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

    fetch("/api/users/staff").then(res => res.json()).then(data => setStaff(data))

    return () => unsubscribe()
  }, [])

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
    if (selectedBooking.status === "CANCELLED") {
      toast.error("Cannot assign a specialist to a cancelled booking")
      return
    }
    setIsAssigning(true)
    const staffMember = staff.find(s => s.user_id === selectedStaffId)
    try {
      const res = await fetch(`/api/bookings/${selectedBooking.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: selectedStaffId, staffName: staffMember?.name || "Unknown Staff" })
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error || "Failed to assign staff")
      }
      toast.success("Staff assigned successfully")
      setIsAssignDialogOpen(false)
      setSelectedStaffId("")
    } catch (error: any) {
      toast.error(error?.message || "Assignment failed")
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
    const matchesAssignment = assignmentFilter === "ALL" || 
                             (assignmentFilter === "ASSIGNED" ? !!b.developerId : !b.developerId)

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
                  <p className={`text-sm font-bold ${!booking.developerId ? 'text-orange-500 italic' : ''}`}>
                    {booking.developerName || "Unassigned"}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Revenue</p>
                  <p className="text-sm font-black">₱{booking.paidAmount.toLocaleString()} / ₱{booking.totalAmount.toLocaleString()}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
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
                    </div>
                  </div>
                  {!selectedBooking.developerId && selectedBooking.status !== "CANCELLED" ? (
                    <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-10" onClick={() => { setIsAssignDialogOpen(true); setIsDetailsOpen(false); }}>
                       Assign Specialist
                    </Button>
                  ) : (
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase font-bold">Assigned Staff</Label>
                      {selectedBooking.status === "CANCELLED" && !selectedBooking.developerId ? (
                        <p className="font-bold text-destructive">Not allowed (booking cancelled)</p>
                      ) : (
                        <p className="font-bold flex items-center gap-2 text-green-700">
                          <UserCheck className="w-4 h-4" /> {selectedBooking.developerName}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="py-4">
                <Label className="text-xs text-muted-foreground uppercase font-bold">Project Description</Label>
                <div className="mt-2 p-3 bg-white border rounded-lg text-sm italic min-h-[60px]">
                  {selectedBooking.description || "No description provided."}
                </div>
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
          )}
        </DialogContent>
      </Dialog>

      {/* Shared Assignment Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Staff Member</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <Select onValueChange={setSelectedStaffId} value={selectedStaffId}>
              <SelectTrigger><SelectValue placeholder="Choose a specialist..." /></SelectTrigger>
              <SelectContent>
                {staff.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.name} ({s.email})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignStaff} disabled={!selectedStaffId || isAssigning}>{isAssigning ? "Assigning..." : "Assign to Project"}</Button>
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
