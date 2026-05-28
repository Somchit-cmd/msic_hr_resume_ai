# ResumeScreen AI

AI-powered resume screening tool for HR professionals. Upload resumes (PDF/DOCX), compare against job descriptions, and get structured audit reports with scoring and recommendations.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-6-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8)

## Features

- **AI Resume Analysis** — Upload PDF/DOCX resumes and get detailed analysis with scoring (1-10), pros/cons, red flags, and hire recommendations
- **Structured Job Descriptions** — Create JDs with job title, department, experience level, salary range, skills tags, and more
- **JD Templates** — Save, load, and reuse job description templates
- **Candidate Directory** — Browse and search all screened candidates by name, department, and job title
- **Multi-AI Provider Support** — Use built-in free Z-AI, or connect your own OpenAI, Anthropic, Google, or custom API key
- **Authentication** — Secure login/register with NextAuth.js (JWT sessions)
- **Currency Support** — Salary ranges in LAK, USD, THB, CNY
- **Responsive Design** — Works on desktop and mobile

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: PostgreSQL (Neon) via Prisma ORM
- **Authentication**: NextAuth.js v4
- **AI**: Z-AI SDK (free) / OpenAI / Anthropic / Google Gemini
- **File Processing**: pdf2json (PDF), mammoth (DOCX)

## Getting Started

### Prerequisites

- Node.js 20+ or Bun
- PostgreSQL database (recommended: [Neon](https://neon.tech))

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/resumescreen-ai.git
cd resumescreen-ai
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
NEXTAUTH_SECRET=your-random-secret-key
NEXTAUTH_URL=http://localhost:3000
```

### 3. Setup Database

```bash
npx prisma db push
```

### 4. Seed Admin User (Optional)

```bash
npx prisma db seed
# Or manually:
npm run seed
```

Default credentials: `admin@resumescreen.ai` / `admin123`

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Netlify

### 1. Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/resumescreen-ai.git
git push -u origin main
```

### 2. Connect to Netlify

1. Go to [netlify.com](https://netlify.com) and sign up/log in
2. Click **"Add new site"** → **"Import an existing project"**
3. Connect your GitHub account and select the `resumescreen-ai` repo
4. Netlify will auto-detect the `netlify.toml` configuration
5. Add environment variables in **Site settings → Environment variables**:
   - `DATABASE_URL` — Your Neon PostgreSQL connection string
   - `NEXTAUTH_SECRET` — A random secret key (generate with `openssl rand -base64 32`)
   - `NEXTAUTH_URL` — Your Netlify site URL (e.g., `https://your-app.netlify.app`)
6. Click **Deploy site**

### 3. Seed the Database

After the first deploy, run the seed script locally (it connects to the same Neon DB):

```bash
DATABASE_URL="your-neon-connection-string" npm run seed
```

## Project Structure

```
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── (auth)/            # Auth pages (login, register)
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # NextAuth endpoints
│   │   │   ├── candidates/    # Candidate CRUD
│   │   │   ├── templates/     # JD Template CRUD
│   │   │   ├── upload/        # Resume upload & analysis
│   │   │   └── ai-settings/   # AI model configuration
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Main dashboard
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── auth-guard.tsx     # Route protection
│   │   └── auth-provider.tsx  # Session provider
│   ├── hooks/                 # Custom React hooks
│   └── lib/
│       ├── ai-analyzer.ts     # Multi-provider AI analysis
│       ├── auth.ts            # NextAuth config
│       ├── db.ts              # Prisma client
│       └── file-processor.ts  # PDF/DOCX extraction
├── netlify.toml               # Netlify deployment config
└── .env.example               # Environment variable template
```

## AI Providers

| Provider | Model Options | API Key Required |
|----------|--------------|-----------------|
| Z-AI (Free) | Built-in | No |
| Z-AI (API Key) | Custom key | Yes |
| OpenAI | GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo | Yes |
| Anthropic | Claude Sonnet 4, Claude 3.5 Sonnet/Haiku, Claude 3 Opus | Yes |
| Google | Gemini 2.5 Flash/Pro, Gemini 2.0 Flash | Yes |
| Custom | Any OpenAI-compatible endpoint | Yes |

## License

MIT
