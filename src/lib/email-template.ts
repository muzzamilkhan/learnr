/**
 * The verification code email, built and tested as a pure string function.
 *
 * This is the half of "send a mail" that can be unit-tested: given a code, what
 * goes out. `src/server/email.ts` keeps the one `fetch` against Resend, which has
 * no test of its own because it is a call to a third party - this module is why
 * that call can stay untested without the wording going unchecked.
 *
 * Every constraint below looks like a mistake to a reader who has only written
 * for browsers, and every one of them is deliberate:
 *
 * - **No `<style>` block and no `class` attribute.** Gmail strips much of a
 *   `<head>` on the way in, so a rule declared there - or a class meant to be
 *   matched against one - silently does not apply. Every style lives on the
 *   element it affects, as a `style="..."` attribute.
 * - **Literal hex, never a CSS variable.** `var(--color-brand)` means nothing
 *   outside a browser that runs this app's own stylesheet; a mail client has no
 *   idea what `--color-brand` is and drops the declaration. The palette is
 *   copied from `src/app/globals.css` as literal values.
 * - **Tables for layout, not flex or grid.** Outlook does not render its HTML
 *   mail through a browser engine at all - it hands the document to Word, which
 *   supports neither. A table is the one layout primitive every client agrees
 *   on.
 * - **No image is load-bearing.** Most clients block remote images until the
 *   reader asks for them, so anything a reader needs to act on a code has to
 *   survive every image being blocked. The wordmark is spelled out as live text
 *   rather than shipped as a picture of the logo, and the code itself is never
 *   rendered as an image - it is large, spaced, selectable text.
 * - **No dark-mode media query.** The app's own pages commit to one palette, and
 *   support for `prefers-color-scheme` inside mail clients is patchy enough that
 *   a half-applied dark variant - a dark background behind text that stayed dark
 *   ink - reads worse than a light mail everywhere.
 * - **No tracking pixel, no unsubscribe link, no marketing copy.** This is a
 *   transactional mail sent because somebody asked for a code thirty seconds
 *   ago, not a campaign.
 */

const INK = '#1b2430';
const INK_SOFT = '#5b6b7f';
const PAPER = '#f7f9fc';
const CARD = '#ffffff';
const BRAND = '#3b6ef5';
const BRAND_SOFT = '#e5edff';
const LINE = '#dfe6ef';
// The logo palette is scoped, on the web, to the two screens someone is
// choosing on. A sign-up mail is one of those moments, so one accent from it is
// allowed here - the body text and the code panel stay on --color-brand.
const GRAPE = '#6c4de0';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderVerificationEmail(code: string): { html: string; text: string } {
  const safeCode = escapeHtml(code);

  const text = [
    `Your LearnR code is ${code}.`,
    '',
    'Type it into the page you left open. It stops working in ten minutes.',
    '',
    "If you didn't ask for this, you can ignore it - nothing has changed.",
  ].join('\n');

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAPER};margin:0;padding:0;width:100%;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:${CARD};border:1px solid ${LINE};border-radius:12px;">
        <tr>
          <td style="padding:32px 32px 8px 32px;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:${GRAPE};">Learn<span style="color:${BRAND};">R</span></span>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${INK};">
            Here is your sign-in code.
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_SOFT};border-radius:8px;">
              <tr>
                <td align="center" style="padding:20px 16px;font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:bold;letter-spacing:8px;color:${BRAND};">
                  ${safeCode}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${INK};">
            Type it into the page you left open. It stops working in ten minutes.
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 32px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:${INK_SOFT};">
            If you didn't ask for this, you can ignore it - nothing has changed.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

  return { html, text };
}
