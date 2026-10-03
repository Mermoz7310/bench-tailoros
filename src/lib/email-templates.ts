export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function invitationEmail(params: { orgName: string; inviterName: string; link: string }) {
  const org = escapeHtml(params.orgName);
  const inviter = escapeHtml(params.inviterName);
  const link = escapeHtml(params.link);
  return {
    subject: `Invitation à rejoindre ${params.orgName}`,
    text: `${params.inviterName} vous invite à rejoindre ${params.orgName}.\n\nAccepter l'invitation : ${params.link}\n\nLe lien expire dans 7 jours.`,
    html: `<p>${inviter} vous invite à rejoindre <strong>${org}</strong>.</p><p><a href="${link}">Accepter l'invitation</a></p><p>Le lien expire dans 7 jours.</p>`,
  };
}
