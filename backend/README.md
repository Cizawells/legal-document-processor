# NestJS Backend Gateway

Authentication, Payments subscription management, and API gateway for the document processor.

## Responsibilities

- User authentication (JWT)
- File upload handling
- File download handling
- PDF service orchestration
- Rate limiting
- Payments subscriptions with Lemonsqueezy

## Key Endpoints

- `POST /auth/login`
- `POST /documents/upload`
- `POST /documents/:id/redact`
- `GET /jobs/:id/status`

## Tech

- NestJS + TypeScript
- PostgreSQL + Prisma
- Passport JWT
- Cloudfare R2

## Run

```bash
npm install
npx prisma migrate dev
npm run start:dev
```
