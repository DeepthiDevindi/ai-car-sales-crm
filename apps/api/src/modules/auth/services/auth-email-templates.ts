export type AuthEmailKind = 'email verification' | 'password reset' | 'employee invitation';

const content: Record<AuthEmailKind, { subject: string; action: string }> = {
  'email verification': {
    subject: 'Verify your AI Car Sales CRM email address',
    action: 'Verify email address',
  },
  'password reset': {
    subject: 'Reset your AI Car Sales CRM password',
    action: 'Reset password',
  },
  'employee invitation': {
    subject: 'You are invited to join a dealership on AI Car Sales CRM',
    action: 'Accept invitation',
  },
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll("'", '&#39;');
}

export function renderAuthEmailTemplate(kind: AuthEmailKind, link: string) {
  const template = content[kind];
  const escapedLink = escapeHtml(link);
  return {
    subject: template.subject,
    text: `${template.action}\n\nContinue securely: ${link}\n\nIf you did not request this, you can ignore this message.`,
    html: `<p>${template.action}</p><p><a href="${escapedLink}">${template.action}</a></p><p>If you did not request this, you can ignore this message.</p>`,
  };
}
