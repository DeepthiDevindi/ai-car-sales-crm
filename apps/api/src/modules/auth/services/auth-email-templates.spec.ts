import { describe, expect, it } from 'vitest';
import { renderAuthEmailTemplate } from './auth-email-templates.js';

describe('authentication email templates', () => {
  it('renders text and HTML and escapes links in HTML attributes', () => {
    const template = renderAuthEmailTemplate(
      'employee invitation',
      'https://example.test/accept?token=a&next=<unsafe>',
    );

    expect(template.subject).toContain('invited');
    expect(template.text).toContain('token=a&next=<unsafe>');
    expect(template.html).toContain('token=a&amp;next=&lt;unsafe&gt;');
  });
});
