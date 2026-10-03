import "server-only";
import { serverEnv } from "@/lib/env";

export type Email = { to: string; subject: string; html: string; text: string };

/**
 * Envoi d'e-mails transactionnels. Avec RESEND_API_KEY : envoi réel via l'API Resend.
 * Sans clé (dev, CI) : l'e-mail est seulement affiché dans les logs, jamais envoyé.
 */
export async function sendEmail(email: Email): Promise<{ delivered: boolean }> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    console.info(`[email:dev] à=${email.to} sujet="${email.subject}"\n${email.text}`);
    return { delivered: false };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: email.to, subject: email.subject, html: email.html, text: email.text }),
  });
  if (!res.ok) {
    console.error(`[email] échec d'envoi (${res.status})`);
    return { delivered: false };
  }
  return { delivered: true };
}
