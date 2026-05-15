"use client"

import { useState, useEffect } from "react"
import { Search, ChevronRight, UserPlus, Mail, Lock, User as UserIcon, Shield, MapPin, Calendar, Activity } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { db } from "@/lib/firebase"
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { User } from "@/lib/models"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { DEVELOPER_SPECIALTY_OPTIONS } from "@/lib/developer-profile"
import { getUserActivityStatus, toDate } from "@/lib/user-activity-status"

const getStatus = getUserActivityStatus

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [clients, setClients] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  
  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    specialties: [] as string[],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // Listen for users with role 'client'
    const q = query(collection(db, "users"), where("role", "==", "client"))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        ...doc.data(),
        user_id: doc.id
      })) as User[]
      setClients(usersData)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleCreateDeveloper = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch("/api/users/staff/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          specialties: formData.specialties,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create developer")

      toast.success("Developer account created successfully!")
      setIsCreateDialogOpen(false)
      setFormData({ name: "", email: "", password: "", specialties: [] })
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredUsers = clients.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="p-8 space-y-6 pb-24">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">Client Management</h1>
          <p className="text-muted-foreground">View and manage registered clients</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <UserPlus className="w-4 h-4" /> Add New Developer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <form onSubmit={handleCreateDeveloper}>
              <DialogHeader>
                <DialogTitle>Create Developer Account</DialogTitle>
                <DialogDescription>
                  This will create an account in both Firebase Auth and Firestore.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      id="name" 
                      placeholder="John Doe" 
                      className="pl-10" 
                      required 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="staff@buzztech.com" 
                      className="pl-10" 
                      required 
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Specialties</Label>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                    {DEVELOPER_SPECIALTY_OPTIONS.map((opt) => (
                      <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={formData.specialties.includes(opt)}
                          onCheckedChange={() =>
                            setFormData((prev) => ({
                              ...prev,
                              specialties: prev.specialties.includes(opt)
                                ? prev.specialties.filter((x) => x !== opt)
                                : [...prev.specialties, opt],
                            }))
                          }
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="••••••••" 
                      className="pl-10" 
                      required 
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Account"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
        <Input
          placeholder="Search clients by name or email..."
          className="pl-10 py-2 w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
        {loading ? (
          <p className="text-center py-12 text-muted-foreground">Fetching clients...</p>
        ) : filteredUsers.map((user) => {
          const status = getStatus(user)

          return (
            <Card
              key={user.user_id}
              className="p-4 hover:shadow-md transition-all cursor-pointer border-l-4 border-l-transparent hover:border-l-primary"
              onClick={() => setSelectedUser(user)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center overflow-hidden">
                    {user.profile_image ? (
                      <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right hidden md:block">
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Status</p>
                    <div className="flex items-center gap-2 justify-end">
                      <div className={`w-2 h-2 rounded-full ${status === "active" ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                      <span className={`text-sm font-bold capitalize ${status === "active" ? "text-green-600" : "text-muted-foreground"}`}>
                        {status}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* User Details Drawer/Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="sm:max-w-[500px]">
          {selectedUser && (
            <>
              {(() => {
                const memberSince =
                  toDate(selectedUser.created_at) ||
                  toDate((selectedUser as any).createdAt) ||
                  toDate((selectedUser as any).member_since) ||
                  toDate((selectedUser as any).memberSince)
                const lastActive =
                  toDate(selectedUser.last_login) ||
                  toDate((selectedUser as any).lastLogin) ||
                  toDate((selectedUser as any).last_active) ||
                  toDate((selectedUser as any).lastActive)
                const status = getStatus(selectedUser)

                return (
                  <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-2xl">
                  <UserIcon className="w-6 h-6 text-primary" /> Profile Details
                </DialogTitle>
              </DialogHeader>
              <div className="py-6 space-y-6">
                <div className="flex items-center gap-4 p-4 bg-accent/30 rounded-xl">
                   <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center overflow-hidden border-2 border-primary/20">
                      {selectedUser.profile_image ? (
                        <img src={selectedUser.profile_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-10 h-10 text-muted-foreground" />
                      )}
                   </div>
                   <div>
                     <h3 className="text-xl font-bold">{selectedUser.name}</h3>
                     <Badge variant={status === "active" ? "default" : "secondary"} className="mt-1">
                       {status.toUpperCase()}
                     </Badge>
                     <p className="text-xs text-muted-foreground mt-1 italic">ID: {selectedUser.user_id}</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email
                    </p>
                    <p className="text-sm font-medium break-all">{selectedUser.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Role
                    </p>
                    <p className="text-sm font-medium capitalize">{selectedUser.role}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Member Since
                    </p>
                    <p className="text-sm font-medium">
                      {memberSince ? memberSince.toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                      <Activity className="w-3 h-3" /> Last Active
                    </p>
                    <p className="text-sm font-medium">
                      {lastActive ? lastActive.toLocaleString() : "N/A"}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Account Actions</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-orange-600 border-orange-200 hover:bg-orange-50">
                      Suspend Account
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-destructive border-red-200 hover:bg-red-50">
                      Delete Data
                    </Button>
                  </div>
                </div>
              </div>
                  </>
                )
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
