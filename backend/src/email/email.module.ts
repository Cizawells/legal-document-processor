import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { existsSync } from 'fs';
import { EmailService } from './email.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: () => {
        console.log('📧 Email configuration:');
        console.log(
          '  - SMTP_HOST:',
          process.env.SMTP_HOST || 'smtp.gmail.com',
        );
        console.log('  - SMTP_PORT:', process.env.SMTP_PORT || '587');
        console.log('  - SMTP_SECURE:', process.env.SMTP_SECURE === 'true');
        console.log(
          '  - SMTP_USER:',
          process.env.SMTP_USER ? '***configured***' : 'NOT SET',
        );
        console.log(
          '  - SMTP_PASS:',
          process.env.SMTP_PASS ? '***configured***' : 'NOT SET',
        );
        console.log('  - NODE_ENV:', process.env.NODE_ENV);
        console.log('  - Platform:', process.platform);

        return {
          transport: {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          },
          defaults: {
            from: `"${process.env.SMTP_FROM_NAME || 'LegalRedactor'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
          },
          template: {
            dir: (() => {
              // Try dist folder first (production), then src folder (development)
              const distPath = join(__dirname, 'templates');
              const srcPath = join(process.cwd(), 'src', 'email', 'templates');

              console.log('🔍 Email template path resolution:');
              console.log('  - __dirname:', __dirname);
              console.log('  - process.cwd():', process.cwd());
              console.log('  - distPath:', distPath);
              console.log('  - srcPath:', srcPath);
              console.log('  - distPath exists:', existsSync(distPath));
              console.log('  - srcPath exists:', existsSync(srcPath));

              if (existsSync(distPath)) {
                console.log('✅ Using dist path:', distPath);
                return distPath;
              } else if (existsSync(srcPath)) {
                console.log('✅ Using src path:', srcPath);
                return srcPath;
              } else {
                // Fallback - this will cause an error but with a clear message
                console.error(
                  '❌ Email templates not found in either dist or src directories',
                );
                console.log('  - Checked distPath:', distPath);
                console.log('  - Checked srcPath:', srcPath);
                return srcPath; // Use src path as fallback for development
              }
            })(),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
