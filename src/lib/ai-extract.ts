import Anthropic from '@anthropic-ai/sdk'
import { AiExtractedData } from '@/types'

const client = new Anthropic()

export async function extractReceiptData(base64Image: string, mimeType: string): Promise<AiExtractedData> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64Image },
          },
          {
            type: 'text',
            text: 'Analiza este ticket/recibo y extrae: establecimiento, fecha (formato YYYY-MM-DD), importe total en euros. Responde SOLO con JSON: {"establishment":"...","date":"...","amount":0.00,"confidence":0.9}',
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as AiExtractedData
  } catch {}
  return {}
}
