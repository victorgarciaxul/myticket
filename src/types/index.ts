export type UserRole = 'user' | 'admin'

export type ProjectStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'signed'

export type ExpenseType =
  | 'food'
  | 'transport_train'
  | 'transport_bus'
  | 'transport_taxi'
  | 'transport_car_own'
  | 'transport_car_shared'
  | 'transport_plane'
  | 'accommodation'
  | 'other'

export type TransportMedium = 'train' | 'bus' | 'taxi' | 'car_own' | 'car_shared' | 'plane' | 'bike'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  must_change_password?: boolean
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  status: ProjectStatus
  created_at: string
  updated_at: string
  profile?: Profile
  expenses?: Expense[]
}

export interface Expense {
  id: string
  project_id: string
  user_id: string
  type: ExpenseType
  date: string
  amount: number
  currency: string
  description: string
  project_tag: string | null
  trip_reason: string
  receipt_url: string | null
  ai_data: AiExtractedData | null
  // transport fields
  transport_medium: TransportMedium | null
  km: number | null
  co2_kg: number | null
  created_at: string
}

export interface AiExtractedData {
  establishment?: string
  date?: string
  amount?: number
  confidence?: number
}

export interface Notification {
  id: string
  user_id: string
  project_id: string
  type: 'submitted' | 'approved' | 'rejected'
  read: boolean
  message: string
  created_at: string
  project?: Project
}

// CO2 emission factors kg per km per person
export const CO2_FACTORS: Record<TransportMedium, number> = {
  train: 0.025,
  car_own: 0.150,
  car_shared: 0.150,
  taxi: 0.150,
  plane: 0.250,
  bus: 0.030,
  bike: 0,
}

export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  food: 'Alimentación / Dieta',
  transport_train: 'Transporte — Tren',
  transport_bus: 'Transporte — Autobús',
  transport_taxi: 'Transporte — Taxi / Cabify',
  transport_car_own: 'Transporte — Vehículo propio',
  transport_car_shared: 'Transporte — Vehículo compartido',
  transport_plane: 'Transporte — Avión',
  accommodation: 'Alojamiento',
  other: 'Otros',
}

export const TRANSPORT_TYPES: ExpenseType[] = [
  'transport_train', 'transport_bus', 'transport_taxi',
  'transport_car_own', 'transport_car_shared', 'transport_plane',
]

export const TRANSPORT_SUB_LABELS: Record<string, string> = {
  transport_train: 'Tren',
  transport_bus: 'Autobús',
  transport_taxi: 'Taxi / Cabify',
  transport_car_own: 'Vehículo propio',
  transport_car_shared: 'Vehículo compartido',
  transport_plane: 'Avión',
}

export const TYPE_TO_MEDIUM: Partial<Record<ExpenseType, TransportMedium>> = {
  transport_train: 'train',
  transport_bus: 'bus',
  transport_taxi: 'taxi',
  transport_car_own: 'car_own',
  transport_car_shared: 'car_shared',
  transport_plane: 'plane',
}

export const TRANSPORT_MEDIUM_LABELS: Record<TransportMedium, string> = {
  plane: 'Avión',
  car_own: 'Coche propio',
  car_shared: 'Coche compartido',
  train: 'Tren',
  bus: 'Autobús',
  taxi: 'Taxi / Cabify',
  bike: 'Bicicleta',
}
