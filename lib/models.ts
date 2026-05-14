export interface User {
  user_id: string
  name: string
  email: string
  password_hash?: string
  password_temp?: string
  role: "admin" | "staff" | "client" | "superadmin"
  profile_image?: string
  status: "active" | "inactive" | "suspended"
  created_at: Date
  last_login: Date
  /** Service categories this developer is strong in (admin-managed). */
  specialties?: string[]
  /** Updated while the user has an open web/mobile session (for realtime presence). */
  presenceAt?: unknown
}

export interface Booking {
  id: string
  userId: string
  serviceId: string
  serviceName: string
  developerId?: string // This is where assigned staff ID goes
  developerName?: string
  totalAmount: number
  paidAmount: number
  status: "PENDING" | "ACTIVE" | "COMPLETED" | "CANCELLED"
  bookingDate: any // Firestore Timestamp
  completionDate?: any // Firestore Timestamp
  description: string
  timeline?: string
  budget?: string
  submission_urls?: string[]
  is_client_approved?: boolean
  /** 0–100 progress the assigned developer reports on this booking. */
  developerProgressPercent?: number
  /** After the developer submits deliverables, workload counts ignore this booking until withdrawn. */
  developerSubmittedWork?: boolean
  developerSubmittedAt?: unknown
  /** Developer UIDs who expressed interest on an open (unassigned) request. */
  interestedDeveloperIds?: string[]
  interestedDeveloperMeta?: Record<string, { developerName?: string; expressedAt?: unknown }>
}

export interface Payment {
  id: string
  paymentId: string
  bookingId: string
  userId: string
  projectName: string
  amount: number
  totalAmount: number
  status: string
  createdAt: any // Firestore Timestamp
  balanceDue: number
}

export interface Service {
  id: string
  name: string
  description: string
  price: number
  duration: number
  status: "active" | "inactive"
}
