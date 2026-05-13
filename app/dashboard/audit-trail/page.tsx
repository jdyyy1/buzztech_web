"use client"

import { useEffect, useMemo, useState } from "react"
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore"
import { Printer, ScrollText } from "lucide-react"

import { db } from "@/lib/firebase"
import { toDate } from "@/lib/user-activity-status"
import { getAuditPaymentSettlement } from "@/lib/booking-payment-rules"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type PaymentRow = {
  id: string
  paymentId?: string
  bookingId?: string
  userId?: string
  projectName?: string
  amount?: number
  totalAmount?: number
  status?: string
  balanceDue?: number
  createdAt?: unknown
  created_at?: unknown
}

function formatWhen(row: PaymentRow): string {
  const d = toDate(row.createdAt) || toDate(row.created_at)
  if (!d) return "—"
  return d.toLocaleString()
}

export default function AuditTrailPage() {
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [clientNames, setClientNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!db) {
      setLoading(false)
      setError("Database not configured")
      return
    }

    const unsub = onSnapshot(
      collection(db, "payments"),
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PaymentRow[]
        next.sort((a, b) => {
          const ta = (toDate(a.createdAt) || toDate(a.created_at) || new Date(0)).getTime()
          const tb = (toDate(b.createdAt) || toDate(b.created_at) || new Date(0)).getTime()
          return tb - ta
        })
        setRows(next)
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error("payments listener", err)
        setError("Unable to load transaction history. Check Firestore rules and indexes.")
        setLoading(false)
      },
    )

    return () => unsub()
  }, [])

  useEffect(() => {
    if (!db || rows.length === 0) return
    const ids = [...new Set(rows.map((r) => r.userId).filter(Boolean) as string[])]
    if (ids.length === 0) return
    let cancelled = false
    ;(async () => {
      const additions: Record<string, string> = {}
      for (const uid of ids) {
        if (cancelled) return
        try {
          const snap = await getDoc(doc(db, "users", uid))
          additions[uid] = snap.exists() ? String(snap.data()?.name || "Unknown client") : "Unknown client"
        } catch {
          additions[uid] = "—"
        }
      }
      if (!cancelled) {
        setClientNames((prev) => ({ ...prev, ...additions }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [rows])

  const printTitle = useMemo(() => `BuzzTech — Transaction history — ${new Date().toLocaleString()}`, [])

  return (
    <div className="space-y-6 p-8 pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Audit trail</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold">
            <ScrollText className="h-8 w-8 text-primary" />
            Transaction history
          </h1>
          <p className="mt-1 text-muted-foreground">
            All payment records from Firestore. <span className="font-medium text-foreground">Status</span> reflects
            whether the contract is fully paid, the 20% downpayment is met with a balance left, or payment is still
            below the downpayment. Print or save as PDF from the print dialog.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button type="button" variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print log
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</Card>
      ) : null}

      <Card className="overflow-hidden print:shadow-none">
        <div className="hidden print:block print:border-b print:px-3 print:py-2 print:text-sm">{printTitle}</div>
        {loading ? (
          <p className="p-8 text-center text-muted-foreground">Loading transactions…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">No payment transactions found.</p>
        ) : (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="border-b bg-muted/50 print:bg-white">
                <tr>
                  <th className="whitespace-nowrap px-3 py-3 font-semibold">Date / time</th>
                  <th className="whitespace-nowrap px-3 py-3 font-semibold">Transaction ID</th>
                  <th className="whitespace-nowrap px-3 py-3 font-semibold">Booking ID</th>
                  <th className="min-w-[140px] px-3 py-3 font-semibold">Client name</th>
                  <th className="min-w-[140px] px-3 py-3 font-semibold">Project</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Amount</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Contract total</th>
                  <th className="min-w-[160px] px-3 py-3 font-semibold">Status</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">Balance due</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const settlement = getAuditPaymentSettlement(r)
                  const statusBadge =
                    settlement.kind === "fully_paid" ? (
                      <Badge
                        className="border-0 bg-green-600 font-normal text-white hover:bg-green-600"
                        title={settlement.hint}
                      >
                        {settlement.label}
                      </Badge>
                    ) : settlement.kind === "downpayment_met" ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500/60 bg-amber-50 font-normal text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                        title={settlement.hint}
                      >
                        {settlement.label}
                      </Badge>
                    ) : settlement.kind === "below_downpayment" ? (
                      <Badge variant="destructive" className="font-normal" title={settlement.hint}>
                        {settlement.label}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="font-normal" title={settlement.hint}>
                        {settlement.label}
                      </Badge>
                    )

                  const uid = r.userId || ""
                  const clientLabel = uid ? clientNames[uid] || "…" : "—"

                  return (
                  <tr key={r.id} className="border-b border-border/80 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 align-top text-muted-foreground">{formatWhen(r)}</td>
                    <td className="max-w-[140px] truncate px-3 py-2 align-top font-mono text-xs">{r.paymentId || r.id}</td>
                    <td className="max-w-[120px] truncate px-3 py-2 align-top font-mono text-xs">{r.bookingId || "—"}</td>
                    <td className="max-w-[180px] truncate px-3 py-2 align-top font-medium" title={uid || undefined}>
                      {clientLabel}
                    </td>
                    <td className="px-3 py-2 align-top">{r.projectName || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 align-top text-right tabular-nums">
                      ₱{Number(r.amount ?? 0).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top text-right tabular-nums">
                      ₱{Number(r.totalAmount ?? 0).toLocaleString()}
                    </td>
                    <td className="max-w-[220px] px-3 py-2 align-top">
                      <div className="flex flex-col gap-1">
                        {statusBadge}
                        <span className="text-[11px] leading-snug text-muted-foreground">{settlement.hint}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top text-right tabular-nums">
                      ₱{Number(r.balanceDue ?? 0).toLocaleString()}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
