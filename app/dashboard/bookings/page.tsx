"use client"

import { useState } from "react"
import { Search, ChevronRight, Filter, MoreVertical, Briefcase, User, Clock, AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const mockBookings = [
  {
    id: "B001",
    serviceName: "Laptop Repair",
    clientName: "Alice Johnson",
    staffName: "Pending Assignment",
    date: "2026-04-18",
    status: "PENDING",
    price: 1500,
    paid: 300,
  },
  {
    id: "B002",
    serviceName: "Network Setup",
    clientName: "Bob Smith",
    staffName: "Pending Assignment",
    date: "2026-04-19",
    status: "PENDING",
    price: 5000,
    paid: 1000,
  },
  {
    id: "B003",
    serviceName: "Virus Removal",
    clientName: "Charlie Brown",
    staffName: "John Staff",
    date: "2026-04-17",
    status: "ACTIVE",
    price: 800,
    paid: 800,
  },
]

export default function BookingsManagementPage() {
  const [searchTerm, setSearchTerm] = useState("")

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-100 text-yellow-700 border-yellow-200"
      case "ACTIVE": return "bg-blue-100 text-blue-700 border-blue-200"
      case "COMPLETED": return "bg-green-100 text-green-700 border-green-200"
      case "CANCELLED": return "bg-red-100 text-red-700 border-red-200"
      default: return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

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
          <Button className="bg-primary hover:bg-primary/90">
            Create Booking
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
        <Input
          placeholder="Search by ID, client or service..."
          className="pl-10 py-2 w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Bookings List */}
      <div className="space-y-3">
        {mockBookings.map((booking) => (
          <Card key={booking.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer group">
            <div className="flex items-center justify-between">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-lg">{booking.id}</p>
                    <Badge variant="outline" className={getStatusColor(booking.status)}>
                      {booking.status}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-primary flex items-center gap-1">
                    <Briefcase className="w-3 h-3" /> {booking.serviceName}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Client</p>
                  <p className="text-sm flex items-center gap-1 font-medium">
                    <User className="w-3 h-3" /> {booking.clientName}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Assigned Staff</p>
                  <p className={`text-sm flex items-center gap-1 font-medium ${booking.staffName === 'Pending Assignment' ? 'text-orange-500 italic' : ''}`}>
                    <User className="w-3 h-3" /> {booking.staffName}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Payment</p>
                  <div className="flex flex-col">
                    <p className="text-sm font-bold">₱{booking.paid} / ₱{booking.price}</p>
                    <div className="w-full bg-accent h-1.5 rounded-full mt-1 overflow-hidden">
                      <div 
                        className="bg-primary h-full" 
                        style={{ width: `${(booking.paid / booking.price) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <Button variant="ghost" size="icon" className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="w-5 h-5" />
                </Button>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </Card>
        ))}
      </div>
      
      {/* Legend / Info */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground bg-accent/20 p-4 rounded-lg">
        <AlertCircle className="w-4 h-4" />
        <p>Bookings marked as <span className="font-bold">PENDING</span> need staff assignment or initial payment validation.</p>
      </div>
    </div>
  )
}
