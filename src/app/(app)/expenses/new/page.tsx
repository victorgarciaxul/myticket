'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { calculateCO2 } from '@/lib/co2'
import { ExpenseType, TransportMedium, TYPE_TO_MEDIUM, TRANSPORT_TYPES, TRANSPORT_SUB_LABELS } from '@/types'
import { Upload, Sparkles, AlertCircle, X, Plus, Trash2, ChevronDown } from 'lucide-react'

const INPUT = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"

type Category = 'food' | 'transport' | 'accommodation' | 'other'

interface Leg { from: string; to: string; km: string }

interface ReceiptFile {
  file: File
  preview: string | null
  aiData: { establishment?: string; date?: string; amount?: number } | null
  loading: boolean
}

const CATEGORIES: { key: Category; label: string; icon: string; desc: string }[] = [
  { key: 'food', label: 'Alimentación / Dieta', icon: '🍽️', desc: 'Comidas, dietas, avituallamiento' },
  { key: 'transport', label: 'Transporte', icon: '🚆', desc: 'Tren, avión, coche, taxi...' },
  { key: 'accommodation', label: 'Alojamiento', icon: '🏨', desc: 'Hotel, apartamento, hostal' },
  { key: 'other', label: 'Otros', icon: '📦', desc: 'Aparcamiento, materiales, etc.' },
]

function NewExpenseForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project')
  const supabase = createClient()

  const [category, setCategory] = useState<Category | null>(null)
  const [transportType, setTransportType] = useState<ExpenseType | null>(null)
  const [showTransportMenu, setShowTransportMenu] = useState(false)

  const todayISO = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(todayISO)
  const [dateTouched, setDateTouched] = useState(false)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [projectTag, setProjectTag] = useState('')
  const [tripReason, setTripReason] = useState('')
  const [legs, setLegs] = useState<Leg[]>([{ from: '', to: '', km: '' }])
  const [receipts, setReceipts] = useState<ReceiptFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isTransport = category === 'transport'
  const expenseType: ExpenseType | null = isTransport ? transportType : category as ExpenseType | null
  const medium: TransportMedium | undefined = expenseType ? TYPE_TO_MEDIUM[expenseType] : undefined
  const totalKm = legs.reduce((s, l) => s + (parseFloat(l.km) || 0), 0)
  const co2 = medium && totalKm > 0 ? calculateCO2(medium, totalKm) : 0

  function addLeg() { setLegs(prev => [...prev, { from: '', to: '', km: '' }]) }
  function removeLeg(i: number) { setLegs(prev => prev.filter((_, idx) => idx !== i)) }
  function updateLeg(i: number, field: keyof Leg, val: string) {
    setLegs(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))
  }

  async function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    for (const file of files) {
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      setReceipts(prev => [...prev, { file, preview, aiData: null, loading: true }])
      if (file.type.startsWith('image/')) {
        const formData = new FormData()
        formData.append('file', file)
        try {
          const res = await fetch('/api/extract-receipt', { method: 'POST', body: formData })
          if (res.ok) {
            const data = await res.json()
            setReceipts(prev => prev.map(r => r.file === file ? { ...r, aiData: data, loading: false } : r))
            if (data.date && !dateTouched) setDate(data.date)
            if (data.amount && !amount) setAmount(String(data.amount))
            if (data.establishment && !description) setDescription(data.establishment)
          }
        } catch {}
      }
      setReceipts(prev => prev.map(r => r.file === file ? { ...r, loading: false } : r))
    }
    e.target.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!expenseType) { setError('Selecciona el tipo de gasto.'); return }
    if (!projectId) { setError('No se ha especificado el proyecto.'); return }
    if (isTransport && totalKm === 0) { setError('Introduce los kilómetros del trayecto.'); return }
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    // Bucket privado: guardamos la RUTA del objeto, no una URL pública.
    // La ruta empieza por el user.id para cumplir la política RLS de storage.
    const uploadedPaths: string[] = []
    for (const r of receipts) {
      const ext = r.file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('receipts').upload(path, r.file)
      if (uploadError) { setError('Error subiendo ticket: ' + uploadError.message); setLoading(false); return }
      uploadedPaths.push(path)
    }

    const co2_kg = medium && totalKm > 0 ? calculateCO2(medium, totalKm) : null

    // Serializar tramos en description si hay más de uno
    const legsDesc = legs.length > 1
      ? legs.filter(l => l.km).map((l, i) => `Tramo ${i + 1}: ${l.from || '—'} → ${l.to || '—'} (${l.km} km)`).join(' | ')
      : legs[0] && (legs[0].from || legs[0].to) ? `${legs[0].from || '—'} → ${legs[0].to || '—'}` : description

    const { error: insertError } = await supabase.from('expenses').insert({
      project_id: projectId,
      user_id: user.id,
      type: expenseType,
      date,
      amount: amount ? parseFloat(amount) : null,
      currency: 'EUR',
      description: legsDesc || description,
      project_tag: projectTag || null,
      trip_reason: tripReason,
      receipt_url: uploadedPaths[0] ?? null,
      receipt_urls: uploadedPaths,
      ai_data: receipts.find(r => r.aiData)?.aiData ?? null,
      transport_medium: medium ?? null,
      km: totalKm || null,
      co2_kg,
    })

    if (insertError) { setError(insertError.message); setLoading(false); return }
    router.push(`/projects/${projectId}`)
  }

  return (
    <div className="px-8 py-10 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Nuevo gasto</h1>
        <p className="text-gray-500 mt-1">Completa los datos del gasto para añadirlo al proyecto</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Categoría ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Tipo de gasto <span className="text-red-400">*</span></h2>
          <div className="grid grid-cols-2 gap-2.5">
            {CATEGORIES.map(({ key, label, icon, desc }) => (
              <button key={key} type="button"
                onClick={() => { setCategory(key); if (key !== 'transport') setTransportType(null) }}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  category === key
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}>
                <span className="text-xl mb-1 block">{icon}</span>
                <p className={`text-sm font-semibold ${category === key ? 'text-indigo-700' : 'text-gray-800'}`}>{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </button>
            ))}
          </div>

          {/* Sub-selector de transporte */}
          {category === 'transport' && (
            <div className="mt-4 relative">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Medio de transporte <span className="text-red-400">*</span></label>
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

        {/* ── Tramos (solo transporte) ── */}
        {isTransport && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Tramos del recorrido</h2>
                <p className="text-xs text-gray-400 mt-0.5">Introduce el total de km real. No se asume ida y vuelta automáticamente.</p>
              </div>
              {co2 > 0 && (
                <span className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-full">
                  🌿 {co2.toFixed(3)} kg CO₂
                </span>
              )}
            </div>

            <div className="space-y-3">
              {legs.map((leg, i) => (
                <div key={i} className="flex gap-2 items-center">
                  {legs.length > 1 && (
                    <span className="text-[11px] font-bold text-gray-400 w-14 flex-shrink-0">Tramo {i + 1}</span>
                  )}
                  <input type="text" value={leg.from} onChange={e => updateLeg(i, 'from', e.target.value)}
                    placeholder="Origen" className={INPUT} />
                  <span className="text-gray-300 flex-shrink-0">→</span>
                  <input type="text" value={leg.to} onChange={e => updateLeg(i, 'to', e.target.value)}
                    placeholder="Destino" className={INPUT} />
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <input type="number" step="0.1" min="0" value={leg.km} onChange={e => updateLeg(i, 'km', e.target.value)}
                      placeholder="Km" required className="w-20 px-2.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center" />
                    <span className="text-xs text-gray-400">km</span>
                  </div>
                  {legs.length > 1 && (
                    <button type="button" onClick={() => removeLeg(i)}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {totalKm > 0 && legs.length > 1 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                <span className="text-sm font-semibold text-gray-700">Total: {totalKm.toFixed(1)} km</span>
              </div>
            )}

            <button type="button" onClick={addLeg}
              className="mt-3 flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              <Plus className="h-3.5 w-3.5" /> Añadir tramo
            </button>
          </div>
        )}

        {/* ── Datos del gasto ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Datos del gasto</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha <span className="text-red-400">*</span></label>
              <input type="date" value={date} onChange={e => { setDate(e.target.value); setDateTouched(true) }} required className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Importe (€) {!isTransport && <span className="text-red-400">*</span>}
                {isTransport && <span className="text-gray-400">(opcional si solo hay km)</span>}
              </label>
              <input type="number" step="0.01" min="0" value={amount}
                onChange={e => setAmount(e.target.value)}
                required={!isTransport} placeholder="0.00" className={INPUT} />
            </div>
          </div>

          {!isTransport && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Descripción / Establecimiento</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Ej: Restaurante La Fábrica, Hotel NH..." className={INPUT} />
            </div>
          )}

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
        </div>

        {/* ── Tickets ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-gray-900">
                Tickets / Comprobantes
                {!isTransport && <span className="text-red-400 ml-1">*</span>}
              </h2>
              {isTransport && (
                <p className="text-xs text-gray-400 mt-0.5">Opcional para gastos de transporte con km registrados</p>
              )}
            </div>
          </div>

          {receipts.length > 0 && (
            <div className="space-y-2 mb-3">
              {receipts.map((r, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                  {r.preview && <img src={r.preview} alt="" className="w-10 h-10 object-cover rounded-lg border border-indigo-200 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-indigo-800 truncate">{r.file.name}</p>
                    {r.loading && <p className="text-xs text-indigo-500 flex items-center gap-1"><Sparkles className="h-3 w-3 animate-pulse" /> Extrayendo datos...</p>}
                    {r.aiData && !r.loading && <p className="text-xs text-indigo-500">✨ {r.aiData.establishment || 'Datos extraídos'}{r.aiData.amount ? ` · ${r.aiData.amount}€` : ''}</p>}
                  </div>
                  <button type="button" onClick={() => setReceipts(prev => prev.filter((_, i) => i !== idx))}
                    className="text-gray-400 hover:text-red-500 flex-shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all">
            <Upload className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">{receipts.length === 0 ? 'Subir ticket(s)' : 'Añadir más tickets'}</span>
            <span className="text-xs text-gray-400">· JPG, PNG o PDF</span>
            <input type="file" accept="image/*,.pdf" multiple onChange={handleFilesChange} className="hidden" />
          </label>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" loading={loading} disabled={!category || (isTransport && !transportType)}>
            Guardar gasto
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function NewExpensePage() {
  return <Suspense><NewExpenseForm /></Suspense>
}
