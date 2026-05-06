"use client"

import { useState, useEffect } from "react"
import { Clock, Send, FileText, ExternalLink } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth-context"
import { db } from "@/lib/firebase"
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { Booking } from "@/lib/models"
import { toast } from "sonner"

export default function StaffTasksPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<"available" | "my-tasks">("my-tasks")
  const [availableRequests, setAvailableRequests] = useState<Booking[]>([])
  const [myTasks, setMyTasks] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  // Submission State
  const [selectedTask, setSelectedTask] = useState<Booking | null>(null)
  const [submissionUrl, setSubmissionUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false)

  useEffect(() => {
    if (!user || !db) {
      setLoading(false)
      return
    }

    const staffId = user.user_id || user.id
    if (!staffId) {
      setLoading(false)
      toast.error("Unable to load tasks. Missing user ID.")
      return
    }

    // Available Requests (PENDING and no developerId)
    const availableQuery = query(
      collection(db, "bookings"), 
      where("status", "==", "PENDING"),
      where("developerId", "==", null)
    )
    
    // My Tasks (Assigned to me and not COMPLETED/CANCELLED)
    const tasksQuery = query(
      collection(db, "bookings"),
      where("developerId", "==", staffId)
    )

    const unsubAvailable = onSnapshot(availableQuery, (snapshot) => {
      setAvailableRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[])
    })

    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      setMyTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[])
      setLoading(false)
    })

    return () => {
      unsubAvailable()
      unsubTasks()
    }
  }, [user])

  const handleSubmitWork = async () => {
    if (!selectedTask || !submissionUrl) return
    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/bookings/${selectedTask.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionUrls: [submissionUrl] })
      })

      if (!res.ok) throw new Error("Submission failed")
      
      toast.success("Work submitted successfully!")
      setIsSubmitDialogOpen(false)
      setSubmissionUrl("")
      setSelectedTask(null)
    } catch (error) {
      toast.error("Failed to submit work")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Tasks & Requests</h1>
        <p className="text-muted-foreground">Manage your work and handle new service requests</p>
      </div>

      <div className="flex gap-4 border-b border-border pb-px">
        <button
          onClick={() => setActiveTab("my-tasks")}
          className={`pb-4 px-2 font-medium text-sm transition-colors relative ${
            activeTab === "my-tasks" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          My Active Tasks ({myTasks.filter(t => t.status === "ACTIVE").length})
          {activeTab === "my-tasks" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button
          onClick={() => setActiveTab("available")}
          className={`pb-4 px-2 font-medium text-sm transition-colors relative ${
            activeTab === "available" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Available Requests ({availableRequests.length})
          {activeTab === "available" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <p className="text-center py-12 text-muted-foreground">Loading tasks...</p>
        ) : activeTab === "available" ? (
          availableRequests.length > 0 ? (
            availableRequests.map((req) => (
              <Card key={req.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">{req.serviceName}</h3>
                      <Badge variant="outline">{req.id.slice(0, 8)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{req.description}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground pt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Requested
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Budget: ₱{req.totalAmount}
                      </span>
                    </div>
                  </div>
                  <Button className="bg-primary hover:bg-primary/90">
                    Express Interest
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
          myTasks.length > 0 ? (
            myTasks.map((task) => (
              <Card key={task.id} className={`p-6 border-l-4 ${task.status === 'COMPLETED' ? 'border-l-green-500 opacity-80' : 'border-l-primary'}`}>
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{task.serviceName}</h3>
                        <Badge variant={task.status === "COMPLETED" ? "default" : "secondary"}>
                          {task.status}
                        </Badge>
                        {task.is_client_approved && (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">CLIENT APPROVED</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">ID: {task.id.slice(0, 8)}</p>
                    </div>
                    <div className="flex gap-2">
                      {task.status === "ACTIVE" && (
                        <Button 
                          size="sm" 
                          className="gap-2"
                          onClick={() => {
                            setSelectedTask(task)
                            setIsSubmitDialogOpen(true)
                          }}
                        >
                          <Send className="w-4 h-4" /> Submit Work
                        </Button>
                      )}
                      {task.submission_urls && task.submission_urls.length > 0 && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={task.submission_urls[0]} target="_blank" rel="noreferrer" className="gap-2">
                            <ExternalLink className="w-4 h-4" /> View Submission
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="bg-accent/50 p-3 rounded text-sm italic">
                    {task.description}
                  </div>
                  {task.is_client_approved && task.paidAmount < task.totalAmount && (
                    <div className="text-xs text-orange-600 font-bold flex items-center gap-1 bg-orange-50 p-2 rounded">
                      <Clock className="w-3 h-3" /> Waiting for final payment (₱{task.totalAmount - task.paidAmount} remaining)
                    </div>
                  )}
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              You don't have any tasks assigned.
            </div>
          )
        )}
      </div>

      <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Project Work</DialogTitle>
            <DialogDescription>
              Provide the link to your prototype, draft, or completed files. 
              The client will be notified to review and approve.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-bold">Submission Link (Google Drive, Figma, GitHub, etc.)</p>
              <Input 
                placeholder="https://..." 
                value={submissionUrl}
                onChange={(e) => setSubmissionUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubmitDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitWork} disabled={!submissionUrl || isSubmitting}>
              {isSubmitting ? "Submitting..." : "Send to Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
