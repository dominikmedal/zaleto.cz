import 'server-only'
import nodemailer from 'nodemailer'

export interface Mail { subject: string; html: string; text?: string; replyTo?: string }

const recipients = () => (process.env.REPORT_TO || '').split(',').map(s => s.trim()).filter(Boolean)

/** Je nastavené SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS) a příjemce (REPORT_TO)? */
export function mailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && recipients().length)
}

/** Odešle e-mail správci přes SMTP (nodemailer). Vyhodí chybu, když odeslání selže. */
export async function sendMail(m: Mail): Promise<void> {
  if (!mailConfigured()) throw new Error('Není nastaveno SMTP_HOST / SMTP_USER / SMTP_PASS / REPORT_TO')
  const port = parseInt(process.env.SMTP_PORT || '587')
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })
  await transport.sendMail({
    // Seznam i většina SMTP povolí jen odesílatele shodného s přihlášeným účtem
    from: process.env.SMTP_FROM || process.env.REPORT_FROM || process.env.SMTP_USER,
    to: recipients(),
    subject: m.subject,
    html: m.html,
    text: m.text,
    replyTo: m.replyTo,
  })
}
