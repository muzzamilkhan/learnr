import 'server-only';

import { renderVerificationEmail } from '@/lib/email-template';

/**
 * The one place this app sends mail from.
 *
 * A seam rather than a spread: one function, so the provider is swappable
 * without anything above it knowing who sends the mail. That matters more than
 * usual here, because the AWS migration may later replace Resend with SES and
 * this is the whole of what would change.
 *
 * **Best-effort in the same sense the play writes are**, with one difference
 * that matters: the caller is told whether it worked. A code that was never
 * sent leaves a grown-up staring at an empty inbox, so the screen says the mail
 * could not be sent rather than telling them to check their spam folder.
 */

const ENDPOINT = 'https://api.resend.com/emails';

export const isEmailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendVerificationCode(to: string, code: string): Promise<boolean> {
  if (!isEmailConfigured) {
    console.error('Cannot send a verification code: no mail provider is configured');
    return false;
  }

  try {
    const { html, text } = renderVerificationEmail(code);
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to,
        subject: `${code} is your LearnR code`,
        // The code is in the subject as well as the body, so it can be read off
        // a notification without opening anything.
        html,
        text,
      }),
    });

    if (!response.ok) {
      console.error('Failed to send a verification code', response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Failed to send a verification code', error);
    return false;
  }
}
