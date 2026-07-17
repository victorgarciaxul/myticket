import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const NOTIFY_EMAILS = ['inmaosuna@xul.es', 'silviamunoz@xul.es']
const FROM_EMAIL = 'MyTicket <noreply@xul.es>'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const { projectName, userName, userEmail, totalAmount, expenseCount, projectId } = await req.json()

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, sans-serif; background: #f7f8fa; margin: 0; padding: 32px; }
  .card { background: white; border-radius: 16px; max-width: 520px; margin: 0 auto; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .header { background: #111827; padding: 28px 32px; }
  .header img { height: 28px; }
  .body { padding: 32px; }
  .badge { display: inline-block; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 99px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: .05em; }
  h2 { margin: 0 0 8px; font-size: 20px; color: #111827; }
  p { margin: 0 0 20px; color: #6b7280; font-size: 14px; line-height: 1.6; }
  .info { background: #f9fafb; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; }
  .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
  .info-row:last-child { margin-bottom: 0; }
  .info-label { color: #9ca3af; }
  .info-value { color: #111827; font-weight: 600; }
  .btn { display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; }
  .footer { border-top: 1px solid #f3f4f6; padding: 20px 32px; font-size: 12px; color: #9ca3af; }
</style></head>
<body>
  <div class="card">
    <div class="header">
      <span style="font-size:18px;font-weight:800;color:white;letter-spacing:-.02em">MyTicket</span>
    </div>
    <div class="body">
      <div class="badge">⏳ Pendiente de revisión</div>
      <h2>Nueva nota de gastos recibida</h2>
      <p><strong>${userName}</strong> ha enviado una nota de gastos firmada digitalmente y está pendiente de tu revisión.</p>
      <div class="info">
        <div class="info-row"><span class="info-label">Empleado</span><span class="info-value">${userName}</span></div>
        <div class="info-row"><span class="info-label">Email</span><span class="info-value">${userEmail}</span></div>
        <div class="info-row"><span class="info-label">Proyecto</span><span class="info-value">${projectName}</span></div>
        <div class="info-row"><span class="info-label">Gastos</span><span class="info-value">${expenseCount} ticket${expenseCount !== 1 ? 's' : ''}</span></div>
        <div class="info-row"><span class="info-label">Importe total</span><span class="info-value">${Number(totalAmount).toFixed(2)} €</span></div>
      </div>
      <a href="https://myticket.xul.es/admin/projects/${projectId}" class="btn">Revisar nota de gastos →</a>
    </div>
    <div class="footer">MyTicket · Imagine Comunicación Andaluza · Córdoba</div>
  </div>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: NOTIFY_EMAILS,
        subject: `📋 Nueva nota de gastos: ${projectName} — ${userName}`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return new Response(JSON.stringify({ error: err }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
