'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { calculateCO2 } from '@/lib/co2'
import {
  ExpenseType, TransportMedium, TYPE_TO_MEDIUM, TRANSPORT_TYPES,
  TRANSPORT_SUB_LABELS, EXPENSE_TYPE_LABELS,
} from '@/types'
import { X, AlertCircle, ChevronDown } from 'lucide-react'

const INPUT = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"

type Category = 'food' | 'transport' | 'accommodation' | 'other'

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'food', label: 'Alimentación / Dieta', icon: '🍽️' },
  { key: 'transport', label: 'Transporte', icon: '🚆' },
  { key: 'accommodation', label: 'Alojamiento', icon: '🏨' },
  { key: 'other', label: 'Otros', icon: '📦' },
]

function typeToCategory(type: ExpenseType): Category {
  if (type.startsWith('transport_')) return 'transport'
  if (type === 'food' || type === 'accommodation') return type
  return 'other'
}

export function EditExpenseModal({ expense, onClose, onSaved }: {
  expense: any
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()

  const [category, setCategory] = useState<Category>(typeToCategory(expense.type))
  const [transportType, setTransportType] = useState<ExpenseType | null>(
    expense.type.startsWith('transport_') ? expense.type : null
  )
  const [showTransportMenu, setShowTransportMenu] = useState(false)
  const [date, setDate] = useState(expense.date)
  const [amount, setAmount] = useState(expense.amount != null ? String(expense.amount) : '')
  const [description, setDescription] = useState(expense.description ?? '')
  const [projectTag, setProjectTag] = useState(expense.project_tag ?? '')
  const [tripReason, setTripReason] = useState(expense.trip_reason ?? '')
  const [km, setKm] = useState(expense.km != null ? String(expense.km) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isTransport = category === 'transport'
  const expenseType: ExpenseType | null = isTransport ? transportType : category as ExpenseType
  const medium: TransportMedium | undefined = expenseType ? TYPE_TO_MEDIUM[expenseType] : undefined
  const kmNum = parseFloat(km) || 0
  const co2 = medium && kmNum > 0 ? calculateCO2(medium, kmNum) : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!expenseType) { setError('Selecciona el tipo de gasto.'); return }
    if (isTransport && kmNum === 0 && !amount) { setError('Introduce los kilómetros o el importe.'); return }
    setLoading(true)
    setError(null)

    const co2_kg = medium && kmNum > 0 ? calculateCO2(medium, kmNum) : null

    const { error: updateError } = await supabase.from('expenses').update({
      type: expenseType,
      date,
      amount: amount ? parseFloat(amount) : null,
      description,
      project_tag: projectTag || null,
      trip_reason: tripReason,
      transport_medium: medium ?? null,
      km: kmNum || null,
      co2_kg,
    }).eq('id', expense.id)

    if (updateError) { setError(updateError.message); setLoading(false); return }
    setLoading(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900">Editar gasto</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de gasto <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(({ key, label, icon }) => (
                <button key={key} type="button"
                  onClick={() => { setCategory(key); if (key !== 'transport') setTransportType(null) }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    category === key ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}>
                  <span className="text-base mr-1.5">{icon}</span>
                  <span className={`text-sm font-medium ${category === key ? 'text-indigo-700' : 'text-gray-800'}`}>{label}</span>
                </button>
              ))}
            </div>

            {isTransport && (
              <div className="mt-3 relative">
                <button type="button" onClick={() => setShowTransportMenu(v => !v)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 border-2 rounded-xl text-sm transition-all ${
                    transportType ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium' : 'border-gray-200 text-gray-400'
                  }`}>
                  <span>{transportType ? TRANSPORT_SUB_LABELS[transportType] : 'Selecciona el medio...'}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showTransportMenu ? 'rotate-180' : ''}`} />
                </button>
                {showTransportMenu && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {TRANSPORT_TYPES.map(t => (
                      <button key={t} type="button"
                        onClick={() => { setTransportType(t); setShowTransportMenu(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${
                          transportType === t ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'
                        }`}>
                        {TRANSPORT_SUB_LABELS[t]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha <span className="text-red-400">*</span></label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Importe (€)</label>
              <input type="number" step="0.01" min="0" value={amount}
                onChange={e => setAmount(e.target.value)} placeholder="0.00" className={INPUT} />
            </div>
          </div>

          {isTransport && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Kilómetros {co2 > 0 && (
                  <span className="ml-2 text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
                    🌿 {co2.toFixed(3)} kg CO₂
                  </span>
                )}
              </label>
              <input type="number" step="0.1" min="0" value={km}
                onChange={e => setKm(e.target.value)} placeholder="0" className={INPUT} />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Descripción / Establecimiento</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Ej: Restaurante La Fábrica, Hotel NH..." className={INPUT} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Motivo del desplazamiento / gasto <span className="text-red-400">*</span></label>
            <input type="text" value={tripReason} onChange={e => setTripReason(e.target.value)} required
              placeholder="Ej: Reunión con cliente, jornada de formación, evento..." className={INPUT} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Proyecto / Cliente</label>
            <input type="text" value={projectTag} onChange={e => setProjectTag(e.target.value)}
              placeholder="Ej: Proyecto XUL, Cliente ABC..." className={INPUT} />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}
        </form>

        <div className="flex-shrink-0 border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={loading}>Guardar cambios</Button>
        </div>
      </div>
    </div>
  )
}
