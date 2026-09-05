import { describe, expect, it } from 'vitest';
import { renderVerificationEmail } from './email-template';

describe('renderVerificationEmail', () => {
  it('puts the code in both parts', () => {
    const { html, text } = renderVerificationEmail('123456');
    expect(html).toContain('123456');
    expect(text).toContain('123456');
  });

  // The reason the text part exists at all: a plain-text client, a screen
  // reader and a spam filter all read it, and it is not a fallback nobody sees.
  it('says what the code is for in the text part', () => {
    const { text } = renderVerificationEmail('123456');
    expect(text).toMatch(/ten minutes/i);
    expect(text).toMatch(/ignore/i);
  });

  // Email clients strip a <head>, so a style block or a class is a style that
  // silently does not apply. Everything has to be on the element.
  it('carries no style block and no class attributes', () => {
    const { html } = renderVerificationEmail('123456');
    expect(html).not.toMatch(/<style/i);
    expect(html).not.toMatch(/class=/i);
  });

  // `var(--color-brand)` resolves to nothing in a mail client.
  it('uses literal colours rather than CSS variables', () => {
    const { html } = renderVerificationEmail('123456');
    expect(html).not.toContain('var(--');
    expect(html).toContain('#3b6ef5');
  });

  // A transactional mail that somebody asked for thirty seconds ago.
  it('carries no tracking pixel and no unsubscribe link', () => {
    const { html } = renderVerificationEmail('123456');
    expect(html).not.toMatch(/unsubscribe/i);
    expect(html).not.toMatch(/width=["\']?1["\']?\s+height=["\']?1/i);
  });

  // The mail has to survive every image being blocked, which is the default in
  // most clients - so the code can never be one.
  it('renders the code as text rather than an image', () => {
    const { html } = renderVerificationEmail('123456');
    const withoutImages = html.replace(/<img[^>]*>/gi, '');
    expect(withoutImages).toContain('123456');
  });

  it('escapes a code that is not what we generate', () => {
    const { html } = renderVerificationEmail('<script>');
    expect(html).not.toContain('<script>');
  });
});
