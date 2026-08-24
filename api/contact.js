// DEPACK contact form — Vercel serverless function (Resend).
// Env: RESEND_API_KEY (required), MAIL_FROM (optional, e.g. "DEPACK <noreply@depack.co>" once domain is verified).

const TO = ['info@depack.co', 'mohamed.debaiky@depack.co'];
const FROM_MAIN = () => process.env.MAIL_FROM || 'DEPACK <noreply@depack.co>';
const FROM_SANDBOX = 'DEPACK Website <onboarding@resend.dev>';
const esc = s => String(s || '').slice(0, 2000)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CONFIRM = {
  en: {
    subject: 'We received your enquiry — DEPACK',
    title: 'Thank you — we have your enquiry.',
    body: 'Our team has received your message and will get back to you shortly, usually within one business day.',
    footer: 'DEPACK for Advanced Packages S.A.E. · 10th of Ramadan City, Egypt · www.depack.co',
  },
  fr: {
    subject: 'Nous avons bien reçu votre demande — DEPACK',
    title: 'Merci — votre demande est bien reçue.',
    body: "Notre équipe a bien reçu votre message et vous répondra rapidement, en général sous un jour ouvré.",
    footer: 'DEPACK for Advanced Packages S.A.E. · 10ᵉ de Ramadan, Égypte · www.depack.co',
  },
  ar: {
    subject: 'استلمنا رسالتك — ديباك',
    title: 'شكرًا لك — استلمنا رسالتك.',
    body: 'استلم فريقنا رسالتك وسيتواصل معك قريبًا، عادةً خلال يوم عمل واحد.',
    footer: 'ديباك للعبوات المتطورة ش.م.م · مدينة العاشر من رمضان، مصر · www.depack.co',
  },
};

export const confirmHtml = (c, name) => `
  <div style="font-family:sans-serif;max-width:560px;margin:auto">
    <div style="background:#0B1B4A;color:#fff;padding:20px 26px;border-radius:12px 12px 0 0">
      <div style="font-size:20px;font-weight:800;letter-spacing:-0.5px">Depack</div>
    </div>
    <div style="border:1px solid #e3e6ef;border-top:0;padding:26px;border-radius:0 0 12px 12px">
      <h2 style="margin:0 0 10px;font-size:19px;color:#0B1024">${c.title}</h2>
      <p style="margin:0 0 6px;font-size:14px;color:#3a4160">${esc(name)},</p>
      <p style="margin:0;font-size:14px;color:#3a4160;line-height:1.6">${c.body}</p>
      <p style="margin:22px 0 0;font-size:12px;color:#8a90a6">${c.footer}</p>
    </div>
  </div>`;

const resend = payload => fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });

  const b = req.body || {};
  if (b.website) return res.status(200).json({ ok: true }); // honeypot

  const name = String(b.name || '').trim().slice(0, 200);
  const email = String(b.email || '').trim().slice(0, 200);
  const company = String(b.company || '').trim().slice(0, 200);
  const phone = String(b.phone || '').trim().slice(0, 60);
  const message = String(b.message || '').trim().slice(0, 4000);
  if (!name || !company || !phone || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ ok: false, error: 'not-configured' });
  }

  const html = `
    <h2 style="font-family:sans-serif">New enquiry — depack.co</h2>
    <table style="font-family:sans-serif;font-size:14px" cellpadding="4">
      <tr><td><b>Name</b></td><td>${esc(name)}</td></tr>
      <tr><td><b>Company</b></td><td>${esc(company)}</td></tr>
      <tr><td><b>Email</b></td><td>${esc(email)}</td></tr>
      <tr><td><b>Phone</b></td><td>${esc(phone)}</td></tr>
      <tr><td><b>Language</b></td><td>${esc(b.lang)}</td></tr>
    </table>
    <p style="font-family:sans-serif;font-size:14px;white-space:pre-wrap">${esc(message)}</p>`;

  const subject = `Packaging enquiry — ${name} (${company.slice(0, 100)})`;
  const send = (from, to) => resend({ from, to, reply_to: email, subject, html });

  // Self-activating sender chain:
  // 1. noreply@depack.co to all recipients  — works once the domain is verified in Resend
  // 2. sandbox sender to all recipients     — pre-verification
  // 3. sandbox sender to the account owner  — Resend test-mode restriction
  let r = await send(FROM_MAIN(), TO);
  let mode;
  if (!r.ok) {
    console.warn('verified-domain send unavailable', r.status, (await r.text().catch(() => '')).slice(0, 200));
    r = await send(FROM_SANDBOX, TO);
    mode = 'sandbox';
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('sandbox send failed', r.status, detail.slice(0, 300));
      const m = detail.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g);
      const owner = (m || []).find(a => !a.includes('resend.dev'));
      if (owner) {
        r = await send(FROM_SANDBOX, [owner]);
        if (r.ok) mode = 'test-fallback';
        else console.error('owner fallback failed', r.status, await r.text().catch(() => ''));
      }
      if (!r.ok) return res.status(502).json({ ok: false, error: 'send-failed' });
    }
  }

  // Confirmation email to the enquirer. Delivers once the domain is verified
  // (MAIL_FROM set to noreply@depack.co); in test mode Resend rejects it — ignore.
  try {
    const c = CONFIRM[b.lang] || CONFIRM.en;
    const cr = await resend({ from: FROM_MAIN(), to: [email], subject: c.subject, html: confirmHtml(c, name) });
    if (!cr.ok) console.warn('confirmation skipped', cr.status);
  } catch (e) { console.warn('confirmation error', e.message); }

  return res.status(200).json({ ok: true, ...(mode ? { mode } : {}) });
}
