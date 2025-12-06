"use client"

import { useState } from "react"
import { Search, ChevronRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const users = [
  {
    id: 1,
    name: "John Lapas",
    email: "john.lapas@mail.com",
    communications: 5,
    projects: 12,
    status: "Active",
    statusColor: "bg-green-100 text-green-700",
  },
  {
    id: 2,
    name: "Dos Trigin",
    email: "dos.trigin@mail.com",
    communications: 3,
    projects: 8,
    status: "Inactive",
    statusColor: "bg-red-100 text-red-700",
  },
  {
    id: 3,
    name: "Edmon Garcia",
    email: "edmon.garcia@mail.com",
    communications: 8,
    projects: 16,
    status: "Active",
    statusColor: "bg-green-100 text-green-700",
  },
  {
    id: 4,
    name: "Miko Hedking",
    email: "miko.h@mail.com",
    communications: 2,
    projects: 4,
    status: "Inactive",
    statusColor: "bg-red-100 text-red-700",
  },
]

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground">Manage and view user accounts</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
        <Input
          placeholder="Search users..."
          className="pl-10 py-2 w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {filteredUsers.map((user) => (
          <Card key={user.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{user.name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <div className="flex gap-6 mt-2 text-xs">
                  <span className="text-muted-foreground">
                    Communications: <span className="font-semibold">{user.communications}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Projects: <span className="font-semibold">{user.projects}</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${user.statusColor}`}>
                  {user.status}
                </span>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
