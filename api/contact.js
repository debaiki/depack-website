// DEPACK contact form — Vercel serverless function.
// Sends enquiries via Resend (https://resend.com) to DEPACK sales.
// Requires env var RESEND_API_KEY (Vercel → Project → Settings → Environment Variables).

const TO = ['info@depack.co', 'mohamed.debaiky@depack.co'];
const esc = s => String(s || '').slice(0, 2000)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });

  const b = req.body || {};
  // Honeypot: real users never fill this field.
  if (b.website) return res.status(200).json({ ok: true });

  const name = String(b.name || '').trim().slice(0, 200);
  const email = String(b.email || '').trim().slice(0, 200);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ ok: false, error: 'not-configured' });
  }

  const html = `
    <h2 style="font-family:sans-serif">New enquiry — depack.co</h2>
    <table style="font-family:sans-serif;font-size:14px" cellpadding="4">
      <tr><td><b>Name</b></td><td>${esc(name)}</td></tr>
      <tr><td><b>Company</b></td><td>${esc(b.company)}</td></tr>
      <tr><td><b>Email</b></td><td>${esc(email)}</td></tr>
      <tr><td><b>Phone</b></td><td>${esc(b.phone)}</td></tr>
      <tr><td><b>Language</b></td><td>${esc(b.lang)}</td></tr>
    </table>
    <p style="font-family:sans-serif;font-size:14px;white-space:pre-wrap">${esc(b.message)}</p>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'DEPACK Website <onboarding@resend.dev>',
      to: TO,
      reply_to: email,
      subject: `Packaging enquiry — ${name}${b.company ? ' (' + String(b.company).slice(0, 100) + ')' : ''}`,
      html,
    }),
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    console.error('resend failed', r.status, detail.slice(0, 300));
    return res.status(502).json({ ok: false, error: 'send-failed' });
  }
  return res.status(200).json({ ok: true });
}
