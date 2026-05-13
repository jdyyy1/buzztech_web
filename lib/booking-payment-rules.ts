/**
 * Minimum share of contract value required before a developer may be assigned (matches mobile rule: 20%).
 */
export const DOWNPAYMENT_RATIO = 0.2

export function requiredDownpaymentAmount(totalAmount: number): number {
  const t = Number(totalAmount)
  if (!Number.isFinite(t) || t <= 0) return 0
  return Math.ceil(t * DOWNPAYMENT_RATIO * 100) / 100
}

export function hasDownpaymentPaid(booking: {
  paidAmount?: number
  totalAmount?: number
}): boolean {
  const total = Number(booking.totalAmount)
  const paid = Number(booking.paidAmount)
  if (!Number.isFinite(paid) || paid < 0) return false
  if (!Number.isFinite(total) || total <= 0) return paid > 0
  return paid + 1e-6 >= total * DOWNPAYMENT_RATIO
}

export type AuditSettlementKind = "fully_paid" | "downpayment_met" | "below_downpayment" | "unknown"

export function getAuditPaymentSettlement(row: {
  amount?: number
  totalAmount?: number
  balanceDue?: number
}): { kind: AuditSettlementKind; label: string; hint: string } {
  const total = Number(row.totalAmount)
  const balanceRaw = row.balanceDue
  const hasBalance =
    balanceRaw !== undefined &&
    balanceRaw !== null &&
    balanceRaw !== "" &&
    Number.isFinite(Number(balanceRaw))
  const balance = hasBalance ? Number(balanceRaw) : NaN
  const amount = Number(row.amount)
  const amt = Number.isFinite(amount) && amount >= 0 ? amount : 0

  if (!Number.isFinite(total) || total <= 0) {
    if (hasBalance && balance <= 0.01) {
      return { kind: "fully_paid", label: "Fully paid", hint: "No balance due on record" }
    }
    return { kind: "unknown", label: "Unknown", hint: "Set contract total on payments to classify" }
  }

  const paidTowardContract = hasBalance && Number.isFinite(balance) ? total - balance : amt
  const due = hasBalance && Number.isFinite(balance) ? Math.max(0, balance) : Math.max(0, total - amt)

  if (due <= 0.01 || paidTowardContract + 1e-6 >= total - 0.01) {
    return { kind: "fully_paid", label: "Fully paid", hint: "Contract settled" }
  }

  const minDown = total * DOWNPAYMENT_RATIO
  if (paidTowardContract + 1e-6 >= minDown) {
    return {
      kind: "downpayment_met",
      label: "Downpayment paid",
      hint: `₱${due.toLocaleString(undefined, { maximumFractionDigits: 2 })} balance remaining`,
    }
  }

  return {
    kind: "below_downpayment",
    label: "Balance remaining",
    hint: `Less than 20% paid — need ₱${requiredDownpaymentAmount(total).toLocaleString(undefined, { maximumFractionDigits: 2 })} minimum`,
  }
}
