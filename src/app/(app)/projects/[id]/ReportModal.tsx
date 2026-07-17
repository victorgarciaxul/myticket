'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import {
  X, Sparkles, Printer, Send, CheckCircle, ChevronRight,
  Leaf, ShieldCheck, Paperclip, ExternalLink, AlertCircle, RefreshCw,
} from 'lucide-react'
import { EXPENSE_TYPE_LABELS } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCO2 } from '@/lib/co2'
import { signWithAutoFirma, parseCertDN, type SignatureResult } from '@/lib/autofirma'
import { ReceiptLink } from '@/components/ReceiptLink'

type Step = 'generate' | 'review' | 'sign' | 'done'

interface ReportData {
  project: any
  profile: any
  expenses: Array<{ date: string; concepto: string; amount: number; km?: number }>
  total: number
  resumen: string
  generatedAt: string
}

const STEPS: { key: Step; label: string }[] = [
  { key: 'generate', label: 'Generar' },
  { key: 'review', label: 'Revisar' },
  { key: 'sign', label: 'Firmar' },
  { key: 'done', label: 'Enviado' },
]

export function ReportModal({ project, expenses, profile, onClose }: {
  project: any
  expenses: any[]
  profile: any
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>('generate')
  const [generating, setGenerating] = useState(false)
  const [signing, setSigning] = useState(false)
  const [sending, setSending] = useState(false)
  const [data, setData] = useState<ReportData | null>(null)
  const [sigResult, setSigResult] = useState<SignatureResult | null>(null)
  const [signError, setSignError] = useState<{ code: string; msg: string; url?: string } | null>(null)

  const supabase = createClient()
  const totalAmount = expenses.reduce((s, e) => s + (e.amount ?? 0), 0)
  const totalCO2 = expenses.reduce((s, e) => s + (e.co2_kg ?? 0), 0)
  const currentIdx = STEPS.findIndex(s => s.key === step)

  async function generate() {
    setGenerating(true)
    const res = await fetch('/api/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, expenses, profile }),
    })
    const json = await res.json()
    setData(json.structured)
    setGenerating(false)
    setStep('review')
  }

  async function handleSign() {
    if (!data) return
    setSignError(null)
    setSigning(true)
    try {
      const docText = buildDocumentText(data, totalCO2)
      const result = await signWithAutoFirma(docText)
      setSigResult(result)
      setStep('sign')
    } catch (err: any) {
      setSignError({ code: err.code ?? 'unknown', msg: err.message ?? 'Error desconocido', url: err.url })
    } finally {
      setSigning(false)
    }
  }

  async function sendToAdmin() {
    if (!data || !sigResult) return
    setSending(true)

    const attachments = expenses.flatMap((e: any) => {
      const urls: string[] = []
      if (e.receipt_url) urls.push(e.receipt_url)
      if (Array.isArray(e.receipt_urls)) urls.push(...e.receipt_urls.filter((u: string) => u && u !== e.receipt_url))
      return urls.map((url: string) => ({ expenseId: e.id, type: e.type, date: e.date, url }))
    })

    const { name, dni } = parseCertDN(sigResult.signerName)
    const reportContent = JSON.stringify({
      ...data,
      attachments,
      signature: {
        signerName: name || profile.full_name,
        dni,
        signingTime: sigResult.signingTime,
        certificate: sigResult.certificate,
        signatureB64: sigResult.signature,
      },
    })

    await supabase.from('projects')
      .update({ status: 'submitted', report_content: reportContent } as any)
      .eq('id', project.id)

    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
    if (admins) {
      await supabase.from('notifications').insert(
        admins.map((a: any) => ({
          user_id: a.id, project_id: project.id, type: 'submitted',
          message: `Nota de gastos firmada digitalmente: ${project.name}`, read: false,
        }))
      )
    }
    // Notificación por email (Edge Function protegida: requiere JWT válido)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-submission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify({
          projectName: project.name,
          userName: profile.full_name,
          userEmail: profile.email,
          totalAmount: data.total,
          expenseCount: expenses.length,
          projectId: project.id,
        }),
      })
    } catch (_) {}

    setSending(false)
    setStep('done')
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">

        {/* Stepper */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300 mx-0.5" />}
                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all ${
                  step === s.key ? 'bg-indigo-100 text-indigo-700'
                  : i < currentIdx ? 'text-indigo-400' : 'text-gray-300'
                }`}>
                  {i < currentIdx
                    ? <CheckCircle className="h-3.5 w-3.5 text-indigo-400" />
                    : <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">{i + 1}</span>
                  }
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">

          {/* ── GENERATE ── */}
          {step === 'generate' && (
            <div className="flex flex-col items-center justify-center py-16 px-8">
              {generating ? (
                <>
                  <div className="w-12 h-12 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-5" />
                  <p className="text-gray-700 font-semibold">Generando nota de gastos...</p>
                  <p className="text-sm text-gray-400 mt-1">Groq está procesando {expenses.length} gastos</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5">
                    <Sparkles className="h-8 w-8 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Nota de Gastos</h3>
                  <p className="text-gray-500 text-sm text-center max-w-sm mb-8">
                    Genera el documento oficial del proyecto <strong className="text-gray-700">{project.name}</strong>.
                    Después lo revisarás y firmarás con tu <strong className="text-gray-700">certificado electrónico</strong>.
                  </p>
                  <div className="bg-gray-50 rounded-xl p-5 w-full max-w-sm mb-8 space-y-2.5">
                    <Row label="Gastos" value={String(expenses.length)} />
                    <Row label="Importe total" value={`${totalAmount.toFixed(2)} €`} />
                    {totalCO2 > 0 && <Row label="Huella CO₂" value={formatCO2(totalCO2)} green />}
                  </div>
                  <Button onClick={generate} size="lg">
                    <Sparkles className="h-4 w-4" /> Generar documento
                  </Button>
                </>
              )}
            </div>
          )}

          {/* ── REVIEW ── */}
          {step === 'review' && data && (
            <div className="p-6">
              <ExpenseDocument data={data} totalCO2={totalCO2} rawExpenses={expenses} />
            </div>
          )}

          {/* ── SIGN (preview with signature) ── */}
          {step === 'sign' && data && sigResult && (
            <div className="p-6">
              <ExpenseDocument data={data} totalCO2={totalCO2} rawExpenses={expenses} signature={sigResult} />
            </div>
          )}

          {/* ── DONE ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-16 px-8">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mb-5">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">¡Enviado correctamente!</h3>
              <p className="text-gray-500 text-sm text-center max-w-sm">
                La nota de gastos firmada digitalmente ha sido enviada a administración.
                Recibirás una notificación cuando sea revisada y aprobada.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 px-6 py-5 bg-gray-50/50">

          {step === 'review' && (
            <div className="space-y-3">
              {/* AutoFirma info / error */}
              {signError ? (
                <SignErrorBanner error={signError} onRetry={handleSign} retrying={signing} />
              ) : (
                <div className="flex items-center gap-2 text-xs text-gray-400 bg-white border border-gray-100 rounded-xl px-4 py-3">
                  <ShieldCheck className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                  <span>
                    Se firmará con tu <strong className="text-gray-600">certificado electrónico</strong> a través de
                    AutoFirma. El certificado se detecta automáticamente.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors border border-gray-200 rounded-lg px-3 py-2 bg-white">
                  <Printer className="h-3.5 w-3.5" /> Imprimir
                </button>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={generate} loading={generating}>Regenerar</Button>
                  <Button onClick={handleSign} loading={signing} size="sm">
                    <ShieldCheck className="h-4 w-4" />
                    {signing ? 'Esperando AutoFirma...' : 'Firmar con AutoFirma'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 'sign' && sigResult && (
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs text-gray-500 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                  <p className="font-semibold text-gray-700">Firmado correctamente con certificado electrónico</p>
                </div>
                <p className="pl-5">{sigResult.signerName} · {format(new Date(sigResult.signingTime), "d MMM yyyy HH:mm", { locale: es })}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setSigResult(null); setSignError(null); setStep('review') }}>
                  Volver
                </Button>
                <Button onClick={sendToAdmin} loading={sending}>
                  <Send className="h-4 w-4" /> Enviar a administración
                </Button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={onClose}>Cerrar</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Error banner ──────────────────────────────────────── */
function SignErrorBanner({ error, onRetry, retrying }: {
  error: { code: string; msg: string; url?: string }
  onRetry: () => void
  retrying: boolean
}) {
  if (error.code === 'not_running') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">AutoFirma no detectado</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Abre la aplicación <strong>AutoFirma</strong> en tu ordenador y vuelve a intentarlo.
              Si no la tienes instalada, descárgala en{' '}
              <a href="https://firmaelectronica.gob.es/Home/Descargas.html" target="_blank" rel="noopener noreferrer"
                className="underline font-medium">firmaelectronica.gob.es</a>.
            </p>
          </div>
          <button onClick={onRetry} disabled={retrying}
            className="flex items-center gap-1.5 text-xs font-medium text-amber-700 border border-amber-300 bg-amber-100 hover:bg-amber-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 flex-shrink-0">
            <RefreshCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} />
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (error.code === 'ssl_untrusted') {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-800">Certificado SSL de AutoFirma no aceptado</p>
            <p className="text-xs text-orange-600 mt-1">
              Abre este enlace en una pestaña nueva, acepta el certificado autofirmado y vuelve aquí:
            </p>
            {error.url && (
              <a href={error.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-xs text-orange-700 underline font-medium">
                <ExternalLink className="h-3 w-3" /> {error.url}
              </a>
            )}
          </div>
          <button onClick={onRetry} disabled={retrying}
            className="flex items-center gap-1.5 text-xs font-medium text-orange-700 border border-orange-300 bg-orange-100 hover:bg-orange-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 flex-shrink-0">
            <RefreshCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} />
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (error.code === 'cancelled') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3">
        <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <p className="text-sm text-gray-600 flex-1">Firma cancelada. Pulsa "Firmar con AutoFirma" para volver a intentarlo.</p>
        <button onClick={onRetry} disabled={retrying}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-300 bg-white hover:bg-gray-100 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 flex-shrink-0">
          <RefreshCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} />
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
      <p className="text-sm text-red-700 flex-1">{error.msg}</p>
      <button onClick={onRetry} disabled={retrying}
        className="flex items-center gap-1.5 text-xs font-medium text-red-600 border border-red-300 bg-red-100 hover:bg-red-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 flex-shrink-0">
        <RefreshCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} />
        Reintentar
      </button>
    </div>
  )
}

/* ─── Document renderer ─────────────────────────────────── */
function ExpenseDocument({ data, totalCO2, rawExpenses = [], signature }: {
  data: ReportData
  totalCO2: number
  rawExpenses?: any[]
  signature?: SignatureResult
}) {
  const { project, profile, expenses, total, resumen } = data
  const { name: signerName, dni } = signature ? parseCertDN(signature.signerName) : { name: '', dni: '' }

  const eventDate = expenses.length > 0
    ? format(new Date(expenses[0].date), "d 'de' MMMM yyyy", { locale: es })
    : format(new Date(project.created_at), "d 'de' MMMM yyyy", { locale: es })

  const emptyRows = Math.max(0, 6 - expenses.length)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-sm font-sans">

      {/* ── Cabecera ── */}
      <div className="bg-gray-900 text-white px-8 py-6 flex items-start justify-between">
        <div>
          <img src="/logo-xul.svg" alt="XUL" className="h-7 object-contain mb-4" />
          <p className="font-bold text-sm text-white">IMAGINE COMUNICACIÓN ANDALUZA (B-14591945)</p>
          <p className="text-xs text-gray-400 mt-0.5">C/ Zamorano Nº 3 · 14.001 Córdoba</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Nota de Gastos</p>
          <p className="text-base font-bold mt-1 text-white">
            {format(new Date(), "d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
      </div>

      {/* ── Datos empleado ── */}
      <div className="grid grid-cols-2 border-b border-gray-100">
        <Cell label="Nombre" value={signerName || profile.full_name} />
        <Cell label="DNI / NIE" value={
          dni || (signature ? '—' : <span className="text-gray-300 italic text-xs">Pendiente de firma</span>)
        } />
        <Cell label="Evento, Lugar y Fecha" value={`${project.name} · ${eventDate}`} wide />
        <Cell label="Proyecto" value={project.description || project.name} />
        <Cell label="Email" value={profile.email} />
      </div>

      {/* ── Tabla gastos ── */}
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider w-28">Fecha</th>
            <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Concepto</th>
            <th className="px-5 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider w-32">Importe</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e, i) => (
            <tr key={i} className="border-b border-gray-50">
              <td className="px-5 py-3.5 text-gray-400 text-xs tabular-nums">{format(new Date(e.date), 'd/M/yyyy')}</td>
              <td className="px-5 py-3.5 text-gray-800">{e.concepto}</td>
              <td className="px-5 py-3.5 text-right font-semibold text-gray-900 tabular-nums">
                {e.amount > 0 ? `${e.amount.toFixed(2)} €` : e.km ? `${e.km} km` : '—'}
              </td>
            </tr>
          ))}
          {Array.from({ length: emptyRows }).map((_, i) => (
            <tr key={`e${i}`} className="border-b border-gray-50">
              <td className="px-5 py-3.5 text-gray-100 text-xs">—</td>
              <td className="px-5 py-3.5" /><td className="px-5 py-3.5" />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-900">
            <td colSpan={2} className="px-5 py-4 text-sm font-bold text-white uppercase tracking-wide">Total a abonar</td>
            <td className="px-5 py-4 text-right text-xl font-black text-white tabular-nums">{total.toFixed(2)} €</td>
          </tr>
        </tfoot>
      </table>

      {/* ── CO₂ + Observaciones ── */}
      <div className={`grid gap-4 px-6 py-5 bg-gray-50 border-t border-gray-100 ${totalCO2 > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {totalCO2 > 0 && (
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
            <p className="text-[11px] font-bold text-teal-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Leaf className="h-3.5 w-3.5" /> Huella de carbono (B Corp)
            </p>
            <p className="text-3xl font-black text-teal-800">{formatCO2(totalCO2)}</p>
            <p className="text-xs text-teal-500 mt-1">Calculado según estándares de movilidad sostenible</p>
          </div>
        )}
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Observaciones</p>
          {resumen && <p className="text-sm text-gray-700 leading-relaxed mb-3">{resumen}</p>}
          <div className="text-xs text-gray-400 space-y-1">
            <p>· Si el concepto es kilometraje, indica el lugar de origen y destino y el total de kms (i/v). El importe a abonar es de 0,262 €/km.</p>
            <p>· Si el concepto es taxi, indica el origen y el destino.</p>
            <p>· Los tickets justificativos están adjuntados digitalmente en el sistema MyTicket.</p>
          </div>
        </div>
      </div>

      {/* ── Tickets adjuntos ── */}
      {(() => {
        const attachments = rawExpenses.flatMap((e: any) => {
          const urls: string[] = []
          if (e.receipt_url) urls.push(e.receipt_url)
          if (Array.isArray(e.receipt_urls)) urls.push(...e.receipt_urls.filter((u: string) => u && u !== e.receipt_url))
          return urls.map((url: string, idx: number) => ({
            label: `${EXPENSE_TYPE_LABELS[e.type as keyof typeof EXPENSE_TYPE_LABELS] ?? e.type} · ${format(new Date(e.date), 'd/M/yyyy')}${urls.length > 1 ? ` (${idx + 1})` : ''}`,
            url,
          }))
        })
        if (attachments.length === 0) return null
        return (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" /> Tickets adjuntos ({attachments.length})
            </p>
            <div className="grid grid-cols-2 gap-2">
              {attachments.map((a, i) => (
                <ReceiptLink key={i} pathOrUrl={a.url}
                  className="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-100 rounded-lg px-3 py-2 hover:border-indigo-300 transition-colors cursor-pointer">
                  <Paperclip className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{a.label}</span>
                  <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-50 ml-auto" />
                </ReceiptLink>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── Firma ── */}
      <div className="px-6 py-5 border-t border-gray-200">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Firma</p>
        {signature ? (
          <div className="flex items-start gap-8">
            <div className="border-2 border-gray-800 rounded-xl p-4 bg-white min-w-[200px]">
              <p className="text-xl font-black text-gray-900 tracking-tight leading-tight">
                {(signerName || profile.full_name).toUpperCase()}
              </p>
              {dni && <p className="text-sm text-gray-500 font-mono mt-1">{dni}</p>}
            </div>
            <div className="border-l-2 border-gray-200 pl-6 text-xs text-gray-500 space-y-1 pt-1">
              <p className="font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                Firmado digitalmente por
              </p>
              <p>{signerName || profile.full_name}</p>
              {dni && <p>DNI/NIE: {dni}</p>}
              <p>Fecha: {format(new Date(signature.signingTime), 'yyyy.MM.dd')}</p>
              <p>Hora: {format(new Date(signature.signingTime), "HH:mm:ss")} +02'00'</p>
            </div>
          </div>
        ) : (
          <div className="h-20 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center">
            <p className="text-sm text-gray-300 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Pendiente de firma con certificado electrónico
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Helpers ───────────────────────────────────────────── */
function Cell({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`px-5 py-3.5 border-b border-r border-gray-100 last:border-r-0 ${wide ? 'col-span-2' : ''}`}>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function Row({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <strong className={green ? 'text-teal-700' : 'text-gray-900'}>{value}</strong>
    </div>
  )
}

function buildDocumentText(data: ReportData, totalCO2: number): string {
  const { project, profile, expenses, total, resumen } = data
  return [
    'NOTA DE GASTOS — IMAGINE COMUNICACIÓN ANDALUZA (B-14591945)',
    `Fecha: ${format(new Date(), "d 'de' MMMM yyyy", { locale: es })}`,
    '',
    `Nombre: ${profile.full_name}`,
    `Email: ${profile.email}`,
    `Proyecto: ${project.name}`,
    '',
    'GASTOS:',
    ...expenses.map(e =>
      `  ${format(new Date(e.date), 'd/M/yyyy')} | ${e.concepto} | ${e.amount > 0 ? e.amount.toFixed(2) + ' €' : e.km + ' km'}`
    ),
    '',
    `TOTAL: ${total.toFixed(2)} €`,
    totalCO2 > 0 ? `CO₂: ${formatCO2(totalCO2)}` : '',
    '',
    `Observaciones: ${resumen}`,
  ].filter(Boolean).join('\n')
}
