"use client"

import { Suspense, useState, useEffect, useMemo, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Clock, Send, FileText, ExternalLink, Eye, Undo2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BookingAttachmentExplorer } from "@/components/dashboard/booking-attachment-explorer"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth-context"
import { db } from "@/lib/firebase"
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { Slider } from "@/components/ui/slider"
import { Booking } from "@/lib/models"
import { activeAssignmentCount, getMaxWorkloadCap, bookingAssignedDeveloperId, developerSubmittedWorkReleased } from "@/lib/developer-profile"
import { toast } from "sonner"

function StaffTasksPageInner() {
  const searchParams = useSearchParams()
  const { user, firebaseUser } = useAuth()
  const [activeTab, setActiveTab] = useState<"available" | "my-tasks">("my-tasks")
  const [availableRequests, setAvailableRequests] = useState<Booking[]>([])
  const [myTasks, setMyTasks] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedTask, setSelectedTask] = useState<Booking | null>(null)
  const [submissionUrl, setSubmissionUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false)
  const [progressDraft, setProgressDraft] = useState<Record<string, number>>({})
  const [savingProgressId, setSavingProgressId] = useState<string | null>(null)
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)
  const [requestDetailBooking, setRequestDetailBooking] = useState<Booking | null>(null)
  const [expressingBookingId, setExpressingBookingId] = useState<string | null>(null)

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "available") setActiveTab("available")
    else if (tab === "my-tasks") setActiveTab("my-tasks")
  }, [searchParams])

  useEffect(() => {
    if (!user || !db) {
      setLoading(false)
      return
    }

    const staffId = firebaseUser?.uid || user.user_id || (user as any).id
    if (!staffId) {
      setLoading(false)
      toast.error("Unable to load tasks. Missing user ID.")
      return
    }

    const availableQuery = query(
      collection(db, "bookings"),
      where("status", "==", "PENDING"),
      where("developerId", "==", null),
    )

    const tasksQuery = query(collection(db, "bookings"), where("developerId", "==", staffId))

    const unsubAvailable = onSnapshot(availableQuery, (snapshot) => {
      setAvailableRequests(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Booking[])
    })

    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      setMyTasks(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Booking[])
      setLoading(false)
    })

    return () => {
      unsubAvailable()
      unsubTasks()
    }
  }, [user, firebaseUser])

  const staffId = useMemo(
    () => String(firebaseUser?.uid || user?.user_id || (user as { id?: string } | null)?.id || ""),
    [firebaseUser, user],
  )

  const workloadCap = getMaxWorkloadCap()
  const currentWorkload = useMemo(
    () => (staffId ? activeAssignmentCount(myTasks as { status?: string }[], staffId) : 0),
    [myTasks, staffId],
  )
  const workloadAtMax = staffId.length > 0 && currentWorkload >= workloadCap

  const submitDialogBooking = useMemo(() => {
    if (!selectedTask) return null
    return myTasks.find((t) => t.id === selectedTask.id) ?? selectedTask
  }, [selectedTask, myTasks])

  const canConfirmSubmit =
    !!submitDialogBooking &&
    submitDialogBooking.status === "ACTIVE" &&
    Math.min(100, Math.max(0, Math.round(Number(submitDialogBooking.developerProgressPercent ?? 0)))) >= 100

  const handleExpressInterest = useCallback(
    async (booking: Booking) => {
      if (!firebaseUser) {
        toast.error("You must be signed in.")
        return
      }
      if (workloadAtMax) {
        toast.error(`You are at maximum workload (${workloadCap} pending or active bookings).`)
        return
      }
      setExpressingBookingId(booking.id)
      try {
        const token = await firebaseUser.getIdToken()
        const res = await fetch(`/api/bookings/${booking.id}/express-interest`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
        let data: { error?: string; message?: string; alreadyInterested?: boolean } = {}
        try {
          data = (await res.json()) as typeof data
        } catch {
          data = {}
        }
        if (!res.ok) {
          throw new Error(data.error || "Could not record interest")
        }
        toast.success(data.message || "Interest recorded.")
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Could not record interest")
      } finally {
        setExpressingBookingId(null)
      }
    },
    [firebaseUser, workloadAtMax, workloadCap],
  )

  const getProgressValue = useCallback((task: Booking) => {
    const d = progressDraft[task.id]
    if (d !== undefined) return d
    return Math.min(100, Math.max(0, Math.round(Number(task.developerProgressPercent ?? 0))))
  }, [progressDraft])

  const handleSaveProgress = useCallback(
    async (task: Booking) => {
      if (!firebaseUser) {
        toast.error("You must be signed in.")
        return
      }
      if (developerSubmittedWorkReleased(task as unknown as Record<string, unknown>)) {
        toast.error("Cancel your submission first to change progress.")
        return
      }
      const progress = getProgressValue(task)
      setSavingProgressId(task.id)
      try {
        const token = await firebaseUser.getIdToken()
        const res = await fetch(`/api/bookings/${task.id}/developer-progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ progress }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error((data as { error?: string }).error || "Could not save progress")
        toast.success("Progress saved")
        setProgressDraft((prev) => {
          const next = { ...prev }
          delete next[task.id]
          return next
        })
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Could not save progress")
      } finally {
        setSavingProgressId(null)
      }
    },
    [firebaseUser, getProgressValue],
  )

  const handleWithdrawSubmission = useCallback(
    async (task: Booking) => {
      if (!firebaseUser) {
        toast.error("You must be signed in.")
        return
      }
      if (!window.confirm("Cancel this submission? Deliverable links will be cleared and the booking will count toward your workload again.")) {
        return
      }
      setWithdrawingId(task.id)
      try {
        const token = await firebaseUser.getIdToken()
        const res = await fetch(`/api/bookings/${task.id}/withdraw-submission`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error((data as { error?: string }).error || "Could not cancel submission")
        toast.success("Submission cancelled")
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Could not cancel submission")
      } finally {
        setWithdrawingId(null)
      }
    },
    [firebaseUser],
  )

  const handleSubmitWork = async () => {
    if (!selectedTask || !submissionUrl || !firebaseUser || !canConfirmSubmit) return
    setIsSubmitting(true)

    try {
      const token = await firebaseUser.getIdToken()
      const res = await fetch(`/api/bookings/${selectedTask.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ submissionUrls: [submissionUrl] }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error || "Submission failed")

      toast.success("Work submitted. Booking marked completed and removed from your active workload.")
      setIsSubmitDialogOpen(false)
      setSubmissionUrl("")
      setSelectedTask(null)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to submit work")
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
          type="button"
          onClick={() => setActiveTab("my-tasks")}
          className={`relative px-2 pb-4 text-sm font-medium transition-colors ${
            activeTab === "my-tasks" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          My Active Tasks (
          {myTasks.filter(
            (t) => t.status === "ACTIVE" && !developerSubmittedWorkReleased(t as unknown as Record<string, unknown>),
          ).length}
          )
          {activeTab === "my-tasks" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("available")}
          className={`relative px-2 pb-4 text-sm font-medium transition-colors ${
            activeTab === "available" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Available Requests ({availableRequests.length})
          {activeTab === "available" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
      </div>

      {activeTab === "available" && staffId && workloadAtMax ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Your workload is at the maximum ({currentWorkload}/{workloadCap} pending or active bookings). You cannot
          express interest on open requests until an assignment is completed or handed off.
        </div>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <p className="py-12 text-center text-muted-foreground">Loading tasks...</p>
        ) : activeTab === "available" ? (
          availableRequests.length > 0 ? (
            availableRequests.map((req) => (
              <Card key={req.id} className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold">{req.serviceName}</h3>
                      <Badge variant="outline">{req.id.slice(0, 8)}</Badge>
                    </div>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{req.description || "No description provided."}</p>
                    <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Requested
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Budget: ₱{req.totalAmount}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setRequestDetailBooking(req)}>
                      <Eye className="h-4 w-4" /> View details
                    </Button>
                    {(() => {
                      const alreadyInterested = Boolean(staffId && req.interestedDeveloperIds?.includes(staffId))
                      const busy = expressingBookingId === req.id
                      return (
                        <Button
                          type="button"
                          className="bg-primary hover:bg-primary/90"
                          disabled={
                            !staffId || workloadAtMax || alreadyInterested || busy
                          }
                          title={
                            workloadAtMax
                              ? `At maximum workload (${workloadCap} pending or active bookings)`
                              : alreadyInterested
                                ? "You already expressed interest in this request"
                                : undefined
                          }
                          onClick={() => void handleExpressInterest(req)}
                        >
                          {busy ? "Sending…" : alreadyInterested ? "Interest recorded" : "Express interest"}
                        </Button>
                      )
                    })()}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="rounded-xl border-2 border-dashed py-12 text-center text-muted-foreground">
              No available requests at the moment.
            </div>
          )
        ) : myTasks.length > 0 ? (
          myTasks.map((task) => {
            const submitted = developerSubmittedWorkReleased(task as unknown as Record<string, unknown>)
            const progressVal = getProgressValue(task)
            const savedProgress = Math.min(100, Math.max(0, Math.round(Number(task.developerProgressPercent ?? 0))))
            const canSubmitWork = task.status === "ACTIVE" && !submitted && savedProgress >= 100
            const dirty =
              progressDraft[task.id] !== undefined &&
              progressDraft[task.id] !== Math.min(100, Math.max(0, Math.round(Number(task.developerProgressPercent ?? 0))))

            return (
            <Card
              key={task.id}
              className={`border-l-4 p-6 ${
                task.status === "COMPLETED" ? "border-l-green-500 opacity-80" : "border-l-primary"
              }`}
            >
              <div className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold">{task.serviceName}</h3>
                      <Badge variant={task.status === "COMPLETED" ? "default" : "secondary"}>{task.status}</Badge>
                      {submitted && task.status === "COMPLETED" && !task.is_client_approved ? (
                        <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">AWAITING CLIENT REVIEW</Badge>
                      ) : null}
                      {task.is_client_approved && (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">CLIENT APPROVED</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">ID: {task.id.slice(0, 8)}</p>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{task.description || "No description provided."}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setRequestDetailBooking(task)}>
                      <Eye className="h-4 w-4" /> View details
                    </Button>
                    {task.status === "ACTIVE" && !submitted && (
                      <Button
                        type="button"
                        size="sm"
                        className="gap-2"
                        disabled={!canSubmitWork}
                        title={
                          !canSubmitWork
                            ? "Save progress at 100% before you can submit work"
                            : undefined
                        }
                        onClick={() => {
                          setSelectedTask(task)
                          setIsSubmitDialogOpen(true)
                        }}
                      >
                        <Send className="h-4 w-4" /> Submit work
                      </Button>
                    )}
                    {(task.status === "COMPLETED" || task.status === "ACTIVE") &&
                    submitted &&
                    !task.is_client_approved ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
                        disabled={withdrawingId === task.id || workloadAtMax}
                        title={
                          workloadAtMax
                            ? `At maximum workload (${workloadCap} active or pending). You cannot cancel this submission — it would reopen the booking and exceed your limit.`
                            : undefined
                        }
                        onClick={() => void handleWithdrawSubmission(task)}
                      >
                        <Undo2 className="h-4 w-4" />
                        {withdrawingId === task.id ? "Cancelling…" : "Cancel submission"}
                      </Button>
                    ) : null}
                    {task.submission_urls && task.submission_urls.length > 0 && (
                      <>
                        {task.submission_urls.map((url, i) => (
                          <Button key={`${task.id}-sub-${i}`} variant="outline" size="sm" asChild>
                            <a href={url} target="_blank" rel="noreferrer" className="gap-2">
                              <ExternalLink className="h-4 w-4" />
                              {task.submission_urls!.length > 1 ? `Deliverable ${i + 1}` : "View deliverable"}
                            </a>
                          </Button>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {task.status === "ACTIVE" ? (
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Project progress</Label>
                      <span className="text-sm font-bold tabular-nums">{progressVal}%</span>
                    </div>
                    <Slider
                      value={[progressVal]}
                      max={100}
                      step={1}
                      disabled={savingProgressId === task.id}
                      onValueChange={([v]) =>
                        setProgressDraft((prev) => ({
                          ...prev,
                          [task.id]: Math.min(100, Math.max(0, Math.round(v))),
                        }))
                      }
                    />
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!dirty || savingProgressId === task.id}
                        onClick={() => void handleSaveProgress(task)}
                      >
                        {savingProgressId === task.id ? "Saving…" : "Save progress"}
                      </Button>
                      {savedProgress < 100 ? (
                        <p className="text-xs text-muted-foreground">Submit work unlocks at 100% (saved).</p>
                      ) : (
                        <p className="text-xs text-green-700 font-medium">Ready to submit deliverables.</p>
                      )}
                    </div>
                  </div>
                ) : null}

                {task.is_client_approved && task.paidAmount < task.totalAmount && (
                  <div className="flex items-center gap-1 rounded bg-orange-50 p-2 text-xs font-bold text-orange-600">
                    <Clock className="h-3 w-3" /> Waiting for final payment (₱{task.totalAmount - task.paidAmount}{" "}
                    remaining)
                  </div>
                )}
              </div>
            </Card>
            )
          })
        ) : (
          <div className="rounded-xl border-2 border-dashed py-12 text-center text-muted-foreground">
            You don&apos;t have any tasks assigned.
          </div>
        )}
      </div>

      <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Project Work</DialogTitle>
            <DialogDescription>
              You can submit only after <span className="font-semibold text-foreground">saved</span> project progress is
              100%. Submitting marks the booking <span className="font-semibold text-foreground">completed</span> and
              sends the client your deliverable link for review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!canConfirmSubmit ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Close this dialog, set progress to 100%, click <strong>Save progress</strong>, then try again.
              </div>
            ) : null}
            <div className="space-y-2">
              <p className="text-sm font-bold">Submission Link (Google Drive, Figma, GitHub, etc.)</p>
              <Input placeholder="https://..." value={submissionUrl} onChange={(e) => setSubmissionUrl(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubmitDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleSubmitWork()}
              disabled={!submissionUrl || isSubmitting || !canConfirmSubmit}
            >
              {isSubmitting ? "Submitting..." : "Send to Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!requestDetailBooking}
        onOpenChange={(open) => {
          if (!open) setRequestDetailBooking(null)
        }}
      >
        <DialogContent className="max-h-[min(90vh,800px)] max-w-2xl overflow-y-auto">
          {requestDetailBooking ? (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{requestDetailBooking.serviceName}</DialogTitle>
                <DialogDescription className="font-mono text-xs">Booking ID: {requestDetailBooking.id}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{requestDetailBooking.status}</Badge>
                  <span>
                    Contract: ₱{Number(requestDetailBooking.totalAmount || 0).toLocaleString()} · Paid: ₱
                    {Number(requestDetailBooking.paidAmount || 0).toLocaleString()}
                  </span>
                </div>

                <div>
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Service request description</Label>
                  <div className="mt-2 min-h-[80px] rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                    {requestDetailBooking.description?.trim() ? requestDetailBooking.description : "No description provided."}
                  </div>
                </div>

                {(requestDetailBooking as Booking & { timeline?: string }).timeline ? (
                  <div>
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Timeline / schedule</Label>
                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      {(requestDetailBooking as Booking & { timeline?: string }).timeline}
                    </p>
                  </div>
                ) : null}

                {(requestDetailBooking as Booking & { budget?: string }).budget ? (
                  <div>
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Budget notes</Label>
                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      {(requestDetailBooking as Booking & { budget?: string }).budget}
                    </p>
                  </div>
                ) : null}

                <BookingAttachmentExplorer booking={requestDetailBooking as unknown as Record<string, unknown>} />

                {requestDetailBooking.submission_urls && requestDetailBooking.submission_urls.length > 0 ? (
                  <div>
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Submitted deliverables (you)</Label>
                    <ul className="mt-2 space-y-2">
                      {requestDetailBooking.submission_urls.map((url, i) => (
                        <li key={`${requestDetailBooking.id}-dlg-${i}`}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 break-all text-sm text-primary underline"
                          >
                            <ExternalLink className="h-4 w-4 shrink-0" />
                            {requestDetailBooking.submission_urls!.length > 1 ? `Link ${i + 1}` : "Open deliverable link"}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <DialogFooter className="flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                {requestDetailBooking.status === "PENDING" && bookingAssignedDeveloperId(requestDetailBooking) == null ? (
                  <Button
                    type="button"
                    className="bg-primary hover:bg-primary/90 sm:order-1"
                    disabled={
                      !staffId ||
                      workloadAtMax ||
                      Boolean(staffId && requestDetailBooking.interestedDeveloperIds?.includes(staffId)) ||
                      expressingBookingId === requestDetailBooking.id
                    }
                    title={
                      workloadAtMax
                        ? `At maximum workload (${workloadCap} pending or active bookings)`
                        : staffId && requestDetailBooking.interestedDeveloperIds?.includes(staffId)
                          ? "You already expressed interest"
                          : undefined
                    }
                    onClick={() => void handleExpressInterest(requestDetailBooking)}
                  >
                    {expressingBookingId === requestDetailBooking.id
                      ? "Sending…"
                      : staffId && requestDetailBooking.interestedDeveloperIds?.includes(staffId)
                        ? "Interest recorded"
                        : "Express interest"}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={() => setRequestDetailBooking(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function StaffTasksPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-6">
          <p className="py-12 text-center text-muted-foreground">Loading tasks…</p>
        </div>
      }
    >
      <StaffTasksPageInner />
    </Suspense>
  )
}
