/**
 * Email Service
 *
 * Handles sending emails for password resets, notifications, etc.
 * Uses nodemailer with configurable SMTP settings.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5000';

class EmailService {
  private transporter: Transporter | null = null;
  private configured = false;

  constructor() {
    this.configure();
  }

  private configure() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: { user, pass },
      });
      this.configured = true;
      console.log('[EmailService] Configured with SMTP:', host);
    } else {
      console.log('[EmailService] Not configured - missing SMTP settings');
      console.log('[EmailService] Set SMTP_HOST, SMTP_USER, SMTP_PASS to enable emails');
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    displayName?: string
  ): Promise<boolean> {
    if (!this.transporter) {
      console.log('[EmailService] Cannot send email - not configured');
      console.log('[EmailService] Reset token for', email, ':', resetToken);
      return false;
    }

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@escrowservice.com';
    const platformName = process.env.PLATFORM_NAME || 'EscrowService';

    const mailOptions = {
      from: `"${platformName}" <${fromEmail}>`,
      to: email,
      subject: `Reset your ${platformName} password`,
      text: `
Hi ${displayName || 'there'},

You requested a password reset for your ${platformName} account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

- The ${platformName} Team
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; }
    .footer { margin-top: 40px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Reset Your Password</h2>
    <p>Hi ${displayName || 'there'},</p>
    <p>You requested a password reset for your ${platformName} account.</p>
    <p>Click the button below to reset your password:</p>
    <p style="margin: 30px 0;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #2563eb;">${resetUrl}</p>
    <p><strong>This link will expire in 1 hour.</strong></p>
    <p>If you didn't request this, you can safely ignore this email.</p>
    <div class="footer">
      <p>- The ${platformName} Team</p>
    </div>
  </div>
</body>
</html>
      `.trim(),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('[EmailService] Password reset email sent to:', email);
      return true;
    } catch (error) {
      console.error('[EmailService] Failed to send email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
