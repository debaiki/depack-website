// DEPACK careers form — Vercel serverless function (Resend, with CV attachment).
// Env: RESEND_API_KEY (required), MAIL_FROM (optional once domain verified).

const TO = ['info@depack.co', 'mohamed.debaiky@depack.co'];
const FROM_MAIN = () => process.env.MAIL_FROM || 'DEPACK <noreply@depack.co>';
const FROM_SANDBOX = 'DEPACK Website <onboarding@resend.dev>';
const MAX_FILE = 3.5 * 1024 * 1024; // decoded bytes; Vercel body limit is 4.5MB
const OK_EXT = /\.(pdf|doc|docx)$/i;
const esc = s => String(s || '').slice(0, 2000)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CONFIRM = {
  en: {
    subject: 'We received your application — DEPACK',
    title: 'Thank you — your application is in.',
    body: 'We have received your CV and contact details. Our team reviews every application and will reach out if there is a match.',
    footer: 'DEPACK for Advanced Packages S.A.E. · 10th of Ramadan City, Egypt · www.depack.co',
  },
  fr: {
    subject: 'Candidature bien reçue — DEPACK',
    title: 'Merci — votre candidature est bien reçue.',
    body: "Nous avons bien reçu votre CV et vos coordonnées. Notre équipe examine chaque candidature et vous contactera si votre profil correspond.",
    footer: 'DEPACK for Advanced Packages S.A.E. · 10ᵉ de Ramadan, Égypte · www.depack.co',
  },
  ar: {
    subject: 'استلمنا طلب التوظيف — ديباك',
    title: 'شكرًا لك — استلمنا طلبك.',
    body: 'استلمنا سيرتك الذاتية وبيانات التواصل. يراجع فريقنا كل طلب وسنتواصل معك إذا توفر الشاغر المناسب.',
    footer: 'ديباك للعبوات المتطورة ش.م.م · مدينة العاشر من رمضان، مصر · www.depack.co',
  },
};

const confirmHtml = (c, name) => `
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

export const config = { api: { bodyParser: { sizeLimit: '4.5mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });

  const b = req.body || {};
  if (b.website) return res.status(200).json({ ok: true }); // honeypot

  const name = String(b.name || '').trim().slice(0, 200);
  const email = String(b.email || '').trim().slice(0, 200);
  const phone = String(b.phone || '').trim().slice(0, 60);
  const position = String(b.position || '').trim().slice(0, 200);
  const message = String(b.message || '').trim().slice(0, 4000);
  const file = b.file || {};
  const fname = String(file.name || '').slice(0, 200);
  const fdata = String(file.data || '');

  if (!name || !phone || !position || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }
  if (!fname || !fdata || !OK_EXT.test(fname)) {
    return res.status(400).json({ ok: false, error: 'cv-required' });
  }
  if (fdata.length * 0.75 > MAX_FILE) {
    return res.status(400).json({ ok: false, error: 'cv-too-large' });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ ok: false, error: 'not-configured' });
  }

  const html = `
    <h2 style="font-family:sans-serif">Job application — depack.co</h2>
    <table style="font-family:sans-serif;font-size:14px" cellpadding="4">
      <tr><td><b>Name</b></td><td>${esc(name)}</td></tr>
      <tr><td><b>Email</b></td><td>${esc(email)}</td></tr>
      <tr><td><b>Phone</b></td><td>${esc(phone)}</td></tr>
      <tr><td><b>Position</b></td><td>${esc(position)}</td></tr>
      <tr><td><b>Language</b></td><td>${esc(b.lang)}</td></tr>
      <tr><td><b>CV</b></td><td>${esc(fname)} (attached)</td></tr>
    </table>
    ${message ? `<p style="font-family:sans-serif;font-size:14px;white-space:pre-wrap">${esc(message)}</p>` : ''}`;

  const subject = `Job application — ${name} (${position.slice(0, 100)})`;
  const send = (from, to) => resend({ from, to, reply_to: email, subject, html, attachments: [{ filename: fname, content: fdata }] });

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

  try {
    const c = CONFIRM[b.lang] || CONFIRM.en;
    const cr = await resend({ from: FROM_MAIN(), to: [email], subject: c.subject, html: confirmHtml(c, name) });
    if (!cr.ok) console.warn('careers confirmation skipped', cr.status);
  } catch (e) { console.warn('careers confirmation error', e.message); }

  return res.status(200).json({ ok: true, ...(mode ? { mode } : {}) });
}
