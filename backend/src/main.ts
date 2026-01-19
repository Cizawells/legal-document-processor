// src/main.ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';
import * as cookieParser from 'cookie-parser';
import { GuestSessionMiddleware } from './guest-session/guest-session.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enable raw body for Stripe webhooks
  });

  // CORS for cookie-based auth
  const origins = process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(',').map((s) => s.trim())
    : [
        'http://localhost:3000',
        'http://localhost:7000',
        'https://pdf-merger-backed.onrender.com', // Add your production backend URL
        'https://pdf-merger-frontend-smoky.vercel.app',
        'https://www.legalredactor.com',
      ];

  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'stripe-signature',
      'X-User-Id',
      'X-User-Email',
      'x-signature',
      'X-Signature',
    ],
  });

  // Use JSON parser for all routes except LemonSqueezy webhook
  app.use((req, res, next) => {
    if (req.originalUrl === '/api/lemonsqueezy/webhook') {
      next();
    } else {
      json()(req, res, next);
    }
  });

  // Enable cookie parser
  app.use(cookieParser());

  // Enable validation pipes
  app.useGlobalPipes(new ValidationPipe());

  // Set global prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 5000;
  await app.listen(port);

  console.log(`🚀 PDF Merger API is running on: http://localhost:${port}`);
  console.log(`📚 Available endpoints:`);
  console.log(`   POST /api/upload/pdf - Upload PDF files`);
  console.log(`   POST /api/merge - Merge PDF files`);
  console.log(`   GET  /api/merge/download/:fileName - Download merged PDF`);
}

bootstrap();
