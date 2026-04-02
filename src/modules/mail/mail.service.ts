// src/modules/mail/mail.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('MAIL_HOST') || 'localhost',
      port: Number(this.configService.get('MAIL_PORT')) || 1025,
      auth: {
        user: this.configService.get('MAIL_USER'),
        pass: this.configService.get('MAIL_PASS'),
      },
    });
  }

  async sendPasswordResetEmail(email: string, token: string, name: string) {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    const mailOptions = {
      from: '"League Pro Support" <noreply@leaguepro.com>',
      to: email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 40px; border-radius: 10px;">
          <h2 style="color: #1e293b; font-weight: 900; text-transform: uppercase; letter-spacing: -0.025em;">Reset Your Password ⚽</h2>
          <p style="color: #64748b; font-size: 16px; line-height: 1.6;">Hello ${name},</p>
          <p style="color: #64748b; font-size: 16px; line-height: 1.6;">We received a request to reset your password. Click the button below to choose a new one:</p>
          <div style="text-align: center; margin: 40px 0;">
            <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; text-transform: uppercase; font-size: 14px; letter-spacing: 0.1em; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.4);">Reset Password</a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; line-height: 1.6;">If you didn't request this, you can safely ignore this email. This link will expire in 1 hour.</p>
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 40px 0;">
          <p style="color: #cbd5e1; font-size: 10px; text-align: center; text-transform: uppercase; letter-spacing: 0.2em;">League Pro Management System</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Reset email sent to: ${email}`);
    } catch (error) {
      console.error('Error sending email:', error);
      // In production, we might want to throw a custom exception
    }
  }
}
