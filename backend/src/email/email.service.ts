import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

export interface WelcomeEmailData {
  name: string;
  email: string;
  loginUrl?: string;
}

export interface UpgradeEmailData {
  name: string;
  email: string;
  planName: string;
  features: string[];
  dashboardUrl?: string;
}

export interface PasswordResetEmailData {
  name: string;
  email: string;
  resetUrl: string;
  expiresIn?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailerService: MailerService) {}

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to: data.email,
        subject: 'Welcome to LegalRedactor - Your Account is Ready!',
        template: 'welcome',
        context: {
          name: data.name,
          email: data.email,
          loginUrl: data.loginUrl || `${process.env.FRONTEND_URL}/signin`,
          dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
          supportEmail:
            process.env.SUPPORT_EMAIL || 'support@legalredactor.com',
          year: new Date().getFullYear(),
        },
      });

      this.logger.log(`Welcome email sent successfully to ${data.email}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${data.email}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Send upgrade confirmation email
   */
  async sendUpgradeEmail(data: UpgradeEmailData): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to: data.email,
        subject: `Welcome to ${data.planName} - Your Premium Features Are Active!`,
        template: 'upgrade',
        context: {
          name: data.name,
          email: data.email,
          planName: data.planName,
          features: data.features,
          dashboardUrl:
            data.dashboardUrl || `${process.env.FRONTEND_URL}/dashboard`,
          billingUrl: `${process.env.FRONTEND_URL}/settings/billing`,
          supportEmail:
            process.env.SUPPORT_EMAIL || 'support@legalredactor.com',
          year: new Date().getFullYear(),
        },
      });

      this.logger.log(
        `Upgrade email sent successfully to ${data.email} for plan: ${data.planName}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send upgrade email to ${data.email}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to: data.email,
        subject: 'Reset Your LegalRedactor Password',
        template: 'password-reset',
        context: {
          name: data.name,
          email: data.email,
          resetUrl: data.resetUrl,
          expiresIn: data.expiresIn || '1 hour',
          supportEmail:
            process.env.SUPPORT_EMAIL || 'support@legalredactor.com',
          year: new Date().getFullYear(),
        },
      });

      this.logger.log(
        `Password reset email sent successfully to ${data.email}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${data.email}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Send custom email with template
   */
  async sendCustomEmail(
    to: string,
    subject: string,
    template: string,
    context: any,
  ): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        template,
        context: {
          ...context,
          supportEmail:
            process.env.SUPPORT_EMAIL || 'support@legalredactor.com',
          year: new Date().getFullYear(),
        },
      });

      this.logger.log(
        `Custom email sent successfully to ${to} with template: ${template}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to send custom email to ${to}:`, error);
      return false;
    }
  }

  /**
   * Send plain text email (fallback)
   */
  async sendPlainEmail(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        text,
        html,
      });

      this.logger.log(`Plain email sent successfully to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send plain email to ${to}:`, error);
      return false;
    }
  }
}
