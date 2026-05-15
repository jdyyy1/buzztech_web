"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore"
import { Code2, Pencil } from "lucide-react"
import { toast } from "sonner"

import { db } from "@/lib/firebase"
import { Booking, User } from "@/lib/models"
import { DEVELOPER_SPECIALTY_OPTIONS, FIXED_MAX_WORKLOAD, activeAssignmentCount } from "@/lib/developer-profile"
import { managementBasePathFromPathname } from "@/lib/management-base-path"
import { getDeveloperPresenceStatus } from "@/lib/user-activity-status"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type DevRow = User & { id?: string }

export default function DevelopersPage() {
  const pathname = usePathname()
  const base = managementBasePathFromPathname(pathname)
  const [developers, setDevelopers] = useState<DevRow[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<DevRow | null>(null)
  const [editSpecialties, setEditSpecialties] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const uq = query(collection(db, "users"), where("role", "==", "staff"))
    const unsubUsers = onSnapshot(uq, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as DevRow[]
      setDevelopers(rows)
      setLoading(false)
    })

    const bq = query(collection(db, "bookings"), orderBy("bookingDate", "desc"))
    const unsubBookings = onSnapshot(bq, (snap) => {
      setBookings(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Booking[],
      )
    })

    return () => {
      unsubUsers()
      unsubBookings()
    }
  }, [])

  const rows = useMemo(() => {
    const cap = FIXED_MAX_WORKLOAD
    return developers.map((d) => {
      const uid = String(d.id || d.user_id || "")
      const load = activeAssignmentCount(bookings as unknown as Record<string, unknown>[], uid)
      const pct = Math.min(100, Math.round((load / cap) * 100))
      return { dev: d, uid, load, pct }
    })
  }, [developers, bookings])

  const openEdit = (d: DevRow) => {
    setEditing(d)
    const spec = Array.isArray(d.specialties) ? d.specialties.filter((s) => typeof s === "string") : []
    setEditSpecialties(DEVELOPER_SPECIALTY_OPTIONS.filter((o) => spec.includes(o)))
    setEditOpen(true)
  }

  const toggleEditSpecialty = (opt: string) => {
    setEditSpecialties((prev) => (prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]))
  }

  const saveEdit = async () => {
    if (!editing) return
    const uid = String(editing.id || editing.user_id || "").trim()
    if (!uid) return

    setSaving(true)
    try {
      const res = await fetch(`/api/users/staff/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specialties: editSpecialties }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Update failed")
      toast.success("Developer profile saved")
      setEditOpen(false)
      setEditing(null)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 space-y-6 pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Code2 className="w-8 h-8 text-primary" />
            Developers
          </h1>
          <p className="text-muted-foreground mt-1">
            Each developer can have up to <span className="font-semibold text-foreground">{FIXED_MAX_WORKLOAD}</span>{" "}
            active or pending bookings. <span className="font-medium text-foreground">Active</span> means their
            session is currently using the web or mobile app (live presence); otherwise they show as Inactive. New
            accounts:{" "}
            <Link href={`${base}/users`} className="text-primary underline font-medium">
              Users → Add New Developer
            </Link>
            .
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground font-medium">Loading developers…</div>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No developer accounts yet.</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map(({ dev, uid, load, pct }) => {
            const specs = Array.isArray(dev.specialties) ? dev.specialties : []
            const live = getDeveloperPresenceStatus(dev as Record<string, unknown>)
            return (
              <Card key={uid} className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold leading-tight">{dev.name || "Unnamed"}</p>
                    <p className="truncate text-sm text-muted-foreground">{dev.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge
                      variant={live === "active" ? "default" : live === "suspended" ? "destructive" : "secondary"}
                      className="whitespace-nowrap uppercase tracking-wide"
                    >
                      {live === "active" ? "Active" : live === "suspended" ? "Suspended" : "Inactive"}
                    </Badge>
                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => openEdit(dev)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Specialties</p>
                  {specs.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {specs.map((s) => (
                        <Badge key={s} variant="secondary">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">None set — edit to add specialties.</p>
                  )}
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold uppercase text-muted-foreground mb-2">
                    <span>Workload</span>
                    <span className="tabular-nums">
                      {load} / {FIXED_MAX_WORKLOAD}
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Counts bookings in <span className="font-medium">Pending</span> or <span className="font-medium">Active</span>{" "}
                    assigned to this developer.
                  </p>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit developer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Specialties</Label>
              <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                {DEVELOPER_SPECIALTY_OPTIONS.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={editSpecialties.includes(opt)} onCheckedChange={() => toggleEditSpecialty(opt)} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveEdit} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
