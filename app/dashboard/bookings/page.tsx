"use client"

import { useState, useEffect } from "react"
import { Search, ChevronRight, Filter, Briefcase, User, Clock, AlertCircle, UserCheck, CheckCircle2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { collection, query, onSnapshot, orderBy } from "firebase/firestore"
import { Booking, User as UserType } from "@/lib/models"
import { toast } from "sonner"

export default function BookingsManagementPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [staff, setStaff] = useState<UserType[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  
  // Assignment State
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string>("")
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)

  useEffect(() => {
    const q = query(collection(db, "bookings"), orderBy("bookingDate", "desc"))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Booking[]
      setBookings(bookingsData)
      setLoading(false)
    })

    // Fetch staff
    fetch("/api/users/staff")
      .then(res => res.json())
      .then(data => setStaff(data))

    return () => unsubscribe()
  }, [])

  const handleAssignStaff = async () => {
    if (!selectedBooking || !selectedStaffId) return
    
    setIsAssigning(true)
    const staffMember = staff.find(s => s.user_id === selectedStaffId)
    
    try {
      const res = await fetch(`/api/bookings/${selectedBooking.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          staffId: selectedStaffId, 
          staffName: staffMember?.name || "Unknown Staff"
        })
      })

      if (!res.ok) throw new Error("Failed to assign staff")
      
      toast.success("Staff assigned successfully")
      setIsAssignDialogOpen(false)
      setSelectedBooking(null)
      setSelectedStaffId("")
    } catch (error) {
      toast.error("Failed to assign staff")
    } finally {
      setIsAssigning(false)
    }
  }

  const handleCompleteBooking = async (booking: Booking) => {
    try {
      const res = await fetch(`/api/bookings/${booking.id}/complete`, {
        method: "POST"
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to complete booking")
      
      toast.success("Booking completed successfully!")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete booking")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-100 text-yellow-700 border-yellow-200"
      case "ACTIVE": return "bg-blue-100 text-blue-700 border-blue-200"
      case "COMPLETED": return "bg-green-100 text-green-700 border-green-200"
      case "CANCELLED": return "bg-red-100 text-red-700 border-red-200"
      default: return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

  const filteredBookings = bookings.filter(b => 
    b.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.userId.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">Bookings Management</h1>
          <p className="text-muted-foreground">Monitor and handle all service bookings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" /> Filter
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
        <Input
          placeholder="Search bookings..."
          className="pl-10 py-2 w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-center py-12 text-muted-foreground">Loading bookings...</p>
        ) : filteredBookings.map((booking) => (
          <Card key={booking.id} className="p-4 hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-lg">{booking.id.slice(0, 8)}</p>
                    <Badge variant="outline" className={getStatusColor(booking.status)}>
                      {booking.status}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-primary flex items-center gap-1">
                    <Briefcase className="w-3 h-3" /> {booking.serviceName}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Client ID</p>
                  <p className="text-sm flex items-center gap-1 font-medium">
                    <User className="w-3 h-3" /> {booking.userId.slice(0, 12)}...
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Assigned Staff</p>
                  {booking.developerId ? (
                    <p className="text-sm flex items-center gap-1 font-medium">
                      <UserCheck className="w-3 h-3 text-green-500" /> {booking.developerName}
                    </p>
                  ) : (
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="h-auto p-0 text-orange-500 font-bold italic"
                      onClick={() => {
                        setSelectedBooking(booking)
                        setIsAssignDialogOpen(true)
                      }}
                    >
                      Assign Staff Member
                    </Button>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Payment Status</p>
                  <div className="flex flex-col">
                    <p className="text-sm font-bold">₱{booking.paidAmount} / ₱{booking.totalAmount}</p>
                    <div className="w-full bg-accent h-1.5 rounded-full mt-1 overflow-hidden">
                      <div 
                        className="bg-primary h-full transition-all" 
                        style={{ width: `${(booking.paidAmount / booking.totalAmount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 ml-4">
                {booking.status === "ACTIVE" && booking.is_client_approved && booking.paidAmount >= booking.totalAmount && (
                   <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700 text-white gap-2 shadow-lg"
                    onClick={() => handleCompleteBooking(booking)}
                   >
                     <CheckCircle2 className="w-4 h-4" /> Complete Request
                   </Button>
                )}
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Staff Member</DialogTitle>
            <DialogDescription>
              Choose an available staff member to handle this service request. 
              The staff will be notified immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-bold">Select Staff</p>
              <Select onValueChange={setSelectedStaffId} value={selectedStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a member..." />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      {s.name} ({s.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignStaff} disabled={!selectedStaffId || isAssigning}>
              {isAssigning ? "Assigning..." : "Confirm Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="flex items-center gap-4 text-xs text-muted-foreground bg-accent/20 p-4 rounded-lg">
        <AlertCircle className="w-4 h-4" />
        <p>A booking becomes <span className="font-bold">ACTIVE</span> only after it is assigned to a staff and has at least 20% downpayment.</p>
      </div>
    </div>
  )
}
