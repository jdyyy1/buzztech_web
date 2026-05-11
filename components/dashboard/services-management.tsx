"use client"

import { useEffect, useMemo, useState } from "react"
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore"
import { Plus, Pencil, Trash2, Search, Package } from "lucide-react"
import { toast } from "sonner"

import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { Service } from "@/lib/models"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ServiceRow = Service & { _docId: string }

const num = (v: unknown, fallback = 0): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, ""))
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

const normalizeDoc = (docId: string, data: Record<string, unknown>): ServiceRow => {
  const serviceName = String(data.serviceName ?? data.name ?? "Untitled service")
  return {
    _docId: docId,
    id: String(data.id ?? docId),
    serviceName,
    category: String(data.category ?? ""),
    minPrice: num(data.minPrice),
    maxPrice: num(data.maxPrice),
    description: String(data.description ?? ""),
    iconResName: data.iconResName != null ? String(data.iconResName) : undefined,
    iconUrl: data.iconUrl != null ? String(data.iconUrl) : undefined,
    iconStoragePath: data.iconStoragePath != null ? String(data.iconStoragePath) : undefined,
    iconWebUrl: data.iconWebUrl != null ? String(data.iconWebUrl) : undefined,
    rating: data.rating != null ? num(data.rating) : undefined,
    totalRating: data.totalRating != null ? num(data.totalRating) : undefined,
    projectCount: data.projectCount != null ? num(data.projectCount) : undefined,
  }
}

type FormState = {
  serviceName: string
  category: string
  minPrice: string
  maxPrice: string
  description: string
}

const emptyForm = (): FormState => ({
  serviceName: "",
  category: "",
  minPrice: "",
  maxPrice: "",
  description: "",
})

export function ServicesManagement() {
  const { firebaseUser } = useAuth()
  const [rows, setRows] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [brokenMobileIcons, setBrokenMobileIcons] = useState<Record<string, true>>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [currentIconUrl, setCurrentIconUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveInfo, setSaveInfo] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ServiceRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!db) {
      setLoading(false)
      return
    }

    const unsub = onSnapshot(
      collection(db, "services"),
      (snap) => {
        const list = snap.docs
          .map((d) => normalizeDoc(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => a.serviceName.localeCompare(b.serviceName, undefined, { sensitivity: "base" }))
        setRows(list)
        setLoading(false)
      },
      (err) => {
        console.error(err)
        toast.error(err.message || "Could not load services")
        setLoading(false)
      },
    )

    return () => unsub()
  }, [])

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase()
    if (!t) return rows
    return rows.filter(
      (r) =>
        r.serviceName.toLowerCase().includes(t) ||
        r.category.toLowerCase().includes(t) ||
        r.description.toLowerCase().includes(t),
    )
  }, [rows, search])

  const openCreate = () => {
    setEditingDocId(null)
    setForm(emptyForm())
    setIconFile(null)
    setCurrentIconUrl(null)
    setSaveError(null)
    setSaveInfo(null)
    setDialogOpen(true)
  }

  const openEdit = (row: ServiceRow) => {
    setEditingDocId(row._docId)
    setForm({
      serviceName: row.serviceName,
      category: row.category,
      minPrice: row.minPrice > 0 ? String(row.minPrice) : "",
      maxPrice: row.maxPrice > 0 ? String(row.maxPrice) : "",
      description: row.description,
    })
    setIconFile(null)
    setCurrentIconUrl(row.iconUrl ?? null)
    setSaveError(null)
    setSaveInfo(null)
    setDialogOpen(true)
  }

  const uploadIconIfAny = async (serviceId: string) => {
    if (!iconFile) return undefined

    const token = firebaseUser ? await firebaseUser.getIdToken() : ""
    if (!token) throw new Error("You must be logged in to upload an icon")

    const fd = new FormData()
    fd.append("serviceId", serviceId)
    fd.append("file", iconFile)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    let res: Response
    try {
      res = await fetch("/api/services/icon", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
        signal: controller.signal,
      })
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new Error("Icon upload timed out. Check Firebase Storage config/permissions and try again.")
      }
      throw new Error("Unable to reach upload endpoint. Check your network/server and try again.")
    } finally {
      clearTimeout(timeout)
    }

    const raw = await res.text().catch(() => "")
    let data: any = {}
    try {
      data = raw ? JSON.parse(raw) : {}
    } catch {
      data = {}
    }
    if (!res.ok) throw new Error(data?.error || "Icon upload failed. Check Firebase Storage config.")

    const uploadedUrl = String(data?.iconUrl || "")
    if (!uploadedUrl) throw new Error("Icon upload succeeded but no Firebase URL was returned.")

    return {
      // Keep mobile-loadable URL in iconUrl.
      iconUrl: uploadedUrl,
      iconSignedUrl: String(data?.iconSignedUrl || ""),
      iconGsUrl: String(data?.iconGsUrl || ""),
      iconWebUrl: String(data?.mobileIconUrl || ""),
      iconStoragePath: String(data?.path || ""),
      // Persist filename to services.iconResName as requested.
      iconResName: String(data?.iconResName || iconFile.name || ""),
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveError(null)
    setSaveInfo(null)
    if (!db) {
      toast.error("Firebase is not configured")
      setSaveError("Firebase is not configured")
      return
    }

    const serviceName = form.serviceName.trim()
    if (!serviceName) {
      toast.error("Service name is required")
      setSaveError("Service name is required")
      return
    }

    const minPrice = Math.max(0, num(form.minPrice))
    const maxPrice = Math.max(0, num(form.maxPrice))
    if (maxPrice > 0 && minPrice > maxPrice) {
      toast.error("Minimum price cannot be greater than maximum price")
      setSaveError("Minimum price cannot be greater than maximum price")
      return
    }

    setSaving(true)
    try {
      const payload = {
        serviceName,
        category: form.category.trim(),
        minPrice,
        maxPrice,
        description: form.description.trim(),
      }

      if (editingDocId) {
        const ref = doc(db, "services", editingDocId)
        const uploadedIcon = await uploadIconIfAny(editingDocId)
        await updateDoc(ref, {
          ...payload,
          ...(uploadedIcon
            ? {
                ...(uploadedIcon.iconUrl ? { iconUrl: uploadedIcon.iconUrl } : {}),
                ...(uploadedIcon.iconSignedUrl ? { iconSignedUrl: uploadedIcon.iconSignedUrl } : {}),
                ...(uploadedIcon.iconGsUrl ? { iconGsUrl: uploadedIcon.iconGsUrl } : {}),
                ...(uploadedIcon.iconWebUrl ? { iconWebUrl: uploadedIcon.iconWebUrl } : {}),
                ...(uploadedIcon.iconStoragePath ? { iconStoragePath: uploadedIcon.iconStoragePath } : {}),
                iconResName: uploadedIcon.iconResName,
              }
            : {}),
        })
        toast.success("Service updated")
        setSaveInfo("Service updated successfully.")
      } else {
        const ref = doc(collection(db, "services"))
        const uploadedIcon = await uploadIconIfAny(ref.id)
        await setDoc(ref, {
          id: ref.id,
          ...payload,
          ...(uploadedIcon
            ? {
                ...(uploadedIcon.iconUrl ? { iconUrl: uploadedIcon.iconUrl } : {}),
                ...(uploadedIcon.iconSignedUrl ? { iconSignedUrl: uploadedIcon.iconSignedUrl } : {}),
                ...(uploadedIcon.iconGsUrl ? { iconGsUrl: uploadedIcon.iconGsUrl } : {}),
                ...(uploadedIcon.iconWebUrl ? { iconWebUrl: uploadedIcon.iconWebUrl } : {}),
                ...(uploadedIcon.iconStoragePath ? { iconStoragePath: uploadedIcon.iconStoragePath } : {}),
                iconResName: uploadedIcon.iconResName,
              }
            : {}),
          rating: 0,
          totalRating: 0,
          projectCount: 0,
        })
        toast.success("Service created")
        setSaveInfo("Service created successfully.")
      }
      setDialogOpen(false)
      setForm(emptyForm())
      setEditingDocId(null)
      setIconFile(null)
      setCurrentIconUrl(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Save failed"
      console.error("Service save failed:", err)
      setSaveError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!db || !deleteTarget) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, "services", deleteTarget._docId))
      toast.success("Service deleted")
      setDeleteTarget(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Delete failed"
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  const formatMoney = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const mobileIconSrcFor = (row: ServiceRow) => {
    const raw = String(row.iconResName || "").trim()
    if (!raw) return ""
    // Web can’t “fetch” Android drawables directly; host the mobile icons under /public/mobile-icons/.
    // If the name has an extension, keep it; otherwise default to .png.
    const filename = raw.includes(".") ? raw : `${raw}.png`
    return `/mobile-icons/${filename}`
  }

  if (!db) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Firebase is not configured. Set NEXT_PUBLIC_* env vars to manage services.</p>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6 pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products / services</h1>
          <p className="text-muted-foreground mt-1">
            Same catalog as the mobile app (Firestore <code className="text-xs bg-muted px-1 rounded">services</code>). Create,
            edit, or remove entries for demos and day-to-day management.
          </p>
        </div>
        <Button type="button" className="gap-2 shrink-0" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Add service
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, category, or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-muted-foreground">Loading services…</p>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 font-medium text-muted-foreground">{rows.length === 0 ? "No services yet" : "No matches"}</p>
            {rows.length === 0 && (
              <Button type="button" variant="outline" className="mt-4" onClick={openCreate}>
                Add your first service
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price range</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row._docId}>
                  <TableCell>
                    <div className="flex items-start gap-3">
                      {((row as any).iconWebUrl || row.iconUrl) ? (
                        <img
                          src={String((row as any).iconWebUrl || row.iconUrl)}
                          alt={`${row.serviceName} icon`}
                          className="h-10 w-10 rounded-md object-cover border border-border"
                        />
                      ) : row.iconResName && !brokenMobileIcons[row._docId] ? (
                        <img
                          src={mobileIconSrcFor(row)}
                          alt={`${row.serviceName} icon`}
                          className="h-10 w-10 rounded-md object-cover border border-border bg-muted"
                          onError={() => setBrokenMobileIcons((prev) => ({ ...prev, [row._docId]: true }))}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-muted border border-border flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <div className="font-semibold">{row.serviceName}</div>
                        <p className="text-xs text-muted-foreground line-clamp-2 max-w-md">{row.description || "—"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.category || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.minPrice <= 0 && row.maxPrice <= 0
                      ? "—"
                      : row.maxPrice > 0
                        ? `₱${formatMoney(row.minPrice)} – ₱${formatMoney(row.maxPrice)}`
                        : `From ₱${formatMoney(row.minPrice)}`}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(row)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(row)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingDocId ? "Edit service" : "New service"}</DialogTitle>
              <DialogDescription>
                Fields match the mobile app: prices in PHP, optional icon upload stored in Firebase Storage.
              </DialogDescription>
            </DialogHeader>
            {saveError ? (
              <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {saveError}
              </div>
            ) : null}
            {saveInfo ? (
              <div className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
                {saveInfo}
              </div>
            ) : null}
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="svc-name">Service name</Label>
                <Input
                  id="svc-name"
                  value={form.serviceName}
                  onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))}
                  required
                  placeholder="e.g. Web Development"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="svc-cat">Category</Label>
                <Input
                  id="svc-cat"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Development"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="svc-min">Min price (₱)</Label>
                  <Input
                    id="svc-min"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="decimal"
                    value={form.minPrice}
                    onChange={(e) => setForm((f) => ({ ...f, minPrice: e.target.value.replace(/[^\d]/g, "") }))}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="svc-max">Max price (₱)</Label>
                  <Input
                    id="svc-max"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="decimal"
                    value={form.maxPrice}
                    onChange={(e) => setForm((f) => ({ ...f, maxPrice: e.target.value.replace(/[^\d]/g, "") }))}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="svc-desc">Description</Label>
                <Textarea
                  id="svc-desc"
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Shown to clients in the app"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="svc-icon">Icon upload (optional)</Label>
                {currentIconUrl && (
                  <div className="flex items-center gap-3 rounded-md border border-border p-2">
                    <img src={currentIconUrl} alt="Current service icon" className="h-10 w-10 rounded object-cover" />
                    <span className="text-xs text-muted-foreground">Current icon</span>
                  </div>
                )}
                <Input id="svc-icon" type="file" accept="image/*" onChange={(e) => setIconFile(e.target.files?.[0] ?? null)} />
                {iconFile && <p className="text-xs text-muted-foreground">Selected file: {iconFile.name}</p>}
                <p className="text-xs text-muted-foreground">
                  Upload an image file. It will be saved to Storage and the service will store an{" "}
                  <code className="text-xs bg-muted px-1 rounded">iconUrl</code>.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingDocId ? "Save changes" : "Create service"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this service?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  <span className="font-medium text-foreground">{deleteTarget.serviceName}</span> will be removed from Firestore.
                  Existing bookings are not changed.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
