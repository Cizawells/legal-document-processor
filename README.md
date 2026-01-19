# Legal Document Processor

Microservices-based document processing platform with PDF redaction, format conversion, and manipulation capabilities.

![screenshot](docs/screenshot.PNG)

## 🏗️ Architecture

**Frontend** (Next.js) → **API Gateway** (NestJS) → **PDF Service** (FastAPI + PyMuPDF)

- **Next.js**: User interface, file uploads, job status tracking
- **NestJS**: Authentication, business logic, job orchestration
- **FastAPI**: PDF processing operations (redaction, conversion, splitting)

### Why This Stack?

- **Separation of concerns**: Auth/business logic separate from heavy PDF ops
- **Performance**: FastAPI + PyMuPDF handles 100+ page PDFs efficiently
- **Scalability**: PDF service can scale independently
- **Type safety**: TypeScript across frontend/backend gateway

## ✨ Features

- **Secure redaction** with pattern matching (SSN, emails, custom terms)
- **Format conversion**: PDF → Word/PowerPoint with layout preservation
- **Document operations**: Split, merge, batch processing
- **Real-time progress**: WebSocket updates for long operations
- **Role-based access**: Multi-tenant architecture

## 🛠️ Tech Stack

### Frontend

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- React Query for state

### Backend Gateway (NestJS)

- NestJS + TypeScript
- PostgreSQL + Prisma
- JWT authentication

### PDF Service (FastAPI)

- FastAPI + Python
- PyMuPDF (fitz) for PDF ops
- Async processing
- RESTful API

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- PostgreSQL
- Redis (for queues)

### Using Docker (Easiest)

```bash
# Clone
git clone [url]

# Copy environment files
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
cp pdf-service/.env.example pdf-service/.env

# Start all services
docker-compose up
```

Frontend: http://localhost:3000
NestJS API: http://localhost:4000
PDF Service: http://localhost:8000

### Manual Setup

**1. Frontend**

```bash
cd frontend
npm install
npm run dev
```

**2. Backend**

```bash
cd backend
npm install
npx prisma migrate dev
npm run start:dev
```

**3. PDF Service**

```bash
cd pdf-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## 📊 Service Communication Flow

```
User uploads PDF
    ↓
Next.js → NestJS (validates, creates job)
    ↓
NestJS → Bull Queue → Background worker
    ↓
Worker → FastAPI (POST /redact or /convert)
    ↓
FastAPI → PyMuPDF processing
    ↓
Returns processed file → NestJS → S3/Storage
    ↓
WebSocket update → Next.js → User
```

## 🎯 Technical Highlights

### Challenge: Large PDF Memory Issues

**Solution**: Streaming between services

- NestJS streams upload to FastAPI
- FastAPI processes in chunks
- Result: 2GB PDFs process without OOM

### Challenge: Concurrent Processing

**Solution**: Queue-based architecture

- Bull Queue in NestJS
- Dedicated workers per job type
- FastAPI handles 10+ concurrent operations

### Challenge: Format Conversion Accuracy

**Solution**: Multi-pass parsing

- Extract text with coordinates
- Detect structure (tables, headers)
- Rebuild in target format
- Achieved 94% accuracy

## 📁 Repository Structure

- **/frontend**: Next.js application ([details](frontend/README.md))
- **/backend**: NestJS API gateway ([details](backend/README.md))
- **/pdf-service**: FastAPI PDF processor ([details](pdf-service/README.md))
- **/docs**: Architecture diagrams and documentation

## 🔐 Environment Variables

See individual service `.env.example` files for full details.

Key variables:

- `DATABASE_URL`: PostgreSQL connection
- `REDIS_URL`: Queue connection
- `PDF_SERVICE_URL`: FastAPI endpoint (default: http://localhost:8000)
- `JWT_SECRET`: Auth token secret

## 🚧 What I'd Improve

- Add OCR for scanned documents
- Implement webhook notifications for job completion
- Add Redis caching for repeated operations
- Create admin dashboard for job monitoring
- Add comprehensive E2E tests

<!-- ## 📸 Screenshots

[Add 2-3 screenshots] -->

## 📝 License

MIT
