"use client"

import { useState } from "react"
import { Briefcase, CheckCircle2, Clock, MessageSquare, Send } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"

const mockRequests = [
  {
    id: "B001",
    serviceName: "Laptop Repair",
    clientName: "Alice Johnson",
    date: "2026-04-18",
    status: "pending",
    description: "Screen flickering issue on Dell XPS 13.",
  },
  {
    id: "B002",
    serviceName: "Network Setup",
    clientName: "Bob Smith",
    date: "2026-04-19",
    status: "pending",
    description: "New office WiFi and Ethernet cabling setup.",
  },
]

const mockMyTasks = [
  {
    id: "B003",
    serviceName: "Virus Removal",
    clientName: "Charlie Brown",
    date: "2026-04-17",
    status: "active",
    description: "Malware infection on Windows 11 PC.",
  },
]

export default function StaffTasksPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<"available" | "my-tasks">("available")

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Tasks & Requests</h1>
        <p className="text-muted-foreground">Manage your work and handle new service requests</p>
      </div>

      <div className="flex gap-4 border-b border-border pb-px">
        <button
          onClick={() => setActiveTab("available")}
          className={`pb-4 px-2 font-medium text-sm transition-colors relative ${
            activeTab === "available" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Available Requests
          {activeTab === "available" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button
          onClick={() => setActiveTab("my-tasks")}
          className={`pb-4 px-2 font-medium text-sm transition-colors relative ${
            activeTab === "my-tasks" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          My Active Tasks
          {activeTab === "my-tasks" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
      </div>

      <div className="space-y-4">
        {activeTab === "available" ? (
          mockRequests.length > 0 ? (
            mockRequests.map((req) => (
              <Card key={req.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">{req.serviceName}</h3>
                      <Badge variant="outline">{req.id}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{req.description}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground pt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {req.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3 h-3" /> Client: {req.clientName}
                      </span>
                    </div>
                  </div>
                  <Button className="bg-primary hover:bg-primary/90">
                    Accept Request
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              No available requests at the moment.
            </div>
          )
        ) : (
          mockMyTasks.length > 0 ? (
            mockMyTasks.map((task) => (
              <Card key={task.id} className="p-6 border-l-4 border-l-primary">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{task.serviceName}</h3>
                        <Badge className="bg-primary/20 text-primary hover:bg-primary/20">ACTIVE</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Client: {task.clientName} | ID: {task.id}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-2">
                        <MessageSquare className="w-4 h-4" /> Chat
                      </Button>
                      <Button size="sm" className="gap-2">
                        <Send className="w-4 h-4" /> Submit Work
                      </Button>
                    </div>
                  </div>
                  <div className="bg-accent/50 p-3 rounded text-sm italic">
                    {task.description}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              You don't have any active tasks.
            </div>
          )
        )}
      </div>
    </div>
  )
}
