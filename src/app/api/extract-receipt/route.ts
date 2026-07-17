import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file || !file.type.startsWith('image/')) return NextResponse.json({})

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
            {
              type: 'text',
              text: `Eres un experto en lectura de tickets y facturas simplificadas españolas. Lee esta imagen con mucho cuidado.

REGLA MÁS IMPORTANTE — EL TOTAL:
- Busca la línea que diga exactamente "TOTAL", "TOTAL EUROS", "IMPORTE TOTAL" o "A PAGAR".
- El número que aparece justo a la derecha de esa palabra es el importe correcto.
- IGNORA completamente las líneas de desglose de IVA que aparecen DESPUÉS del TOTAL (ej: "10,00% sobre 13,55  1,35"). Esas líneas son el IVA incluido, NO el total.
- El total es SIEMPRE el número más grande y aparece ANTES del desglose de IVA.
- Ejemplo: si ves "TOTAL  14,90" y luego "10,00% sobre 13,55  1,35", el amount es 14.90.

FECHA: busca en formato DD-MM-YYYY o DD/MM/YYYY y conviértela a YYYY-MM-DD.

ESTABLECIMIENTO: el nombre del bar, restaurante o empresa que aparece en la cabecera.

Responde ÚNICAMENTE con JSON sin texto extra ni markdown:
{"establishment":"nombre","date":"YYYY-MM-DD","amount":0.00}

Omite un campo si no lo ves con claridad. Nunca inventes datos.`,
            },
          ],
        },
      ],
    })

    const text = response.choices[0]?.message?.content ?? ''
    console.log('Groq raw response:', text)

    const match = text.match(/\{[\s\S]*?\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      // Normalizar amount: quitar símbolos de moneda y convertir coma a punto
      if (typeof parsed.amount === 'string') {
        parsed.amount = parseFloat(parsed.amount.replace(/[€$£\s]/g, '').replace(',', '.'))
      }
      return NextResponse.json(parsed)
    }
    return NextResponse.json({})
  } catch (err) {
    console.error('Groq extraction error:', err)
    return NextResponse.json({})
  }
}
