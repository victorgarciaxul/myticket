import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { EXPENSE_TYPE_LABELS } from '@/types'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  const { project, expenses, profile } = await req.json()

  const expenseLines = expenses.map((e: any) => {
    const label = EXPENSE_TYPE_LABELS[e.type as keyof typeof EXPENSE_TYPE_LABELS] ?? e.type
    let concepto = label
    if (e.type === 'transport_car_own' && e.km) {
      concepto = `Desplazamiento en coche propio${e.trip_reason ? ` — ${e.trip_reason}` : ''} ${e.km} km`
    } else if (e.establishment) {
      concepto = `${label} — ${e.establishment}`
    } else if (e.trip_reason) {
      concepto = `${label} — ${e.trip_reason}`
    }
    return { date: e.date, concepto, amount: e.amount ?? 0, km: e.km }
  })

  const total = expenses.reduce((s: number, e: any) => s + (e.amount ?? 0), 0)

  const obs = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{
      role: 'user',
      content: `Eres un asistente administrativo. Resume en 2-3 líneas concisas los gastos del siguiente proyecto para el campo "Observaciones" de una nota de gastos corporativa. Sé breve y profesional. Sin bullet points ni markdown.

Proyecto: ${project.name}
Descripción: ${project.description ?? ''}
Gastos: ${expenseLines.map((e: any) => `${e.concepto} (${e.amount ? e.amount + '€' : e.km + ' km'})`).join(', ')}`,
    }],
    max_tokens: 150,
  })

  const resumen = obs.choices[0]?.message?.content?.trim() ?? ''

  return NextResponse.json({
    structured: { project, profile, expenses: expenseLines, total, resumen, generatedAt: new Date().toISOString() }
  })
}
