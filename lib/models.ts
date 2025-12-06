export interface User {
  user_id: string
  name: string
  email: string
  password_hash: string
  role: "admin" | "staff" | "client"
  profile_image?: string
  status: "active" | "inactive" | "suspended"
  created_at: Date
  last_login: Date
}

export interface Employee {
  id: string
  name: string
  email: string
  phone: string
  role: string
  status: "active" | "inactive"
  created_at: Date
}

export interface Booking {
  id: string
  user_id: string
  service_id: string
  employee_id: string
  start_time: Date
  end_time: Date
  status: "pending" | "confirmed" | "completed" | "cancelled"
  created_at: Date
}

export interface Payment {
  id: string
  booking_id: string
  amount: number
  status: "pending" | "completed" | "failed"
  payment_method: string
  created_at: Date
}

export interface Service {
  id: string
  name: string
  description: string
  price: number
  duration: number
  status: "active" | "inactive"
}
