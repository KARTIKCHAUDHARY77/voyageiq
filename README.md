# VoyageIQ AI 🚢

## Intelligent Vessel Performance Monitoring & Voyage Optimization Platform

> A production-grade maritime intelligence SaaS platform for shipping companies, charterers, vessel operators, technical managers, and ship masters.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11+-blue)](https://python.org)
[![React](https://img.shields.io/badge/React-18+-61DAFB)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://typescriptlang.org)
[![Flask](https://img.shields.io/badge/Flask-3.0+-green)](https://flask.palletsprojects.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED)](https://docker.com)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Demo Credentials](#demo-credentials)

---

## 🌊 Overview

VoyageIQ AI combines maritime domain expertise with modern AI/ML capabilities to deliver:

| Module | Description |
|--------|-------------|
| **Vessel Performance Monitoring** | Real-time KPI tracking, health scores, and compliance analysis |
| **Voyage Optimization** | Multi-criteria route planning with weather intelligence |
| **Fuel Analytics Center** | Consumption tracking, efficiency analysis, AI insights |
| **Smart Claim Detector** | Automated detection of speed loss, excess consumption, underperformance |
| **Weather Impact Engine** | Beaufort scale analysis, speed/fuel penalty calculation |
| **AI Maritime Copilot** | GPT-powered Q&A with vessel context awareness |
| **Report Parser** | Automatic extraction from PDF, Excel, CSV noon reports |
| **Report Generation** | Professional PDF/Excel/CSV voyage reports |

---

## ✨ Features

### 🎯 Executive Dashboard
- 8 animated KPI cards with real-time data
- Fleet Health Score (0-100) with grade breakdown
- Interactive voyage map with vessel tracks
- Live fuel trend charts
- Critical claim alerts

### 🚢 Vessel Performance Engine
- Speed Variance (Actual vs Warranted)
- Consumption Variance (Actual vs Charter Party)
- Fuel Efficiency (Distance / Fuel Consumed)
- Performance Compliance %
- AI Vessel Health Score with recommendations

### ⚠️ Smart Claim Detector
- Automated detection algorithms for:
  - Speed loss below charter party speed
  - Excess fuel consumption
  - Overall underperformance
- Commercial impact estimation in USD
- Claim lifecycle management (Open → Resolved)

### ⛽ Fuel Analytics Center
- Daily/weekly/monthly consumption trends
- Engine vs AE vs Boiler breakdown
- ROB (Remaining on Board) trend
- AI-generated insights per period
- Weather impact quantification

### 🗺️ Route Optimization
- 4 route variants: Optimal, Fastest, Eco-Friendly, Safest
- Haversine great-circle distance calculation
- Weather risk zones with color coding
- Interactive fuel savings simulator
- ETA prediction

### 🤖 AI Maritime Copilot
- OpenAI GPT-4o-mini integration
- Intelligent fallback with rule-based responses
- Context-aware using vessel/voyage data
- Handles: fuel analysis, performance, route recommendations, claims

### 📄 Report Parser
- Auto-extract from PDF, Excel, CSV noon reports
- 50+ column name mappings
- PDF regex patterns for maritime data
- Preview before confirming import

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Framer Motion |
| **Maps** | Leaflet.js, React-Leaflet |
| **Charts** | Chart.js, Recharts |
| **Backend** | Python Flask 3.0 |
| **Database** | PostgreSQL 16 |
| **ORM** | SQLAlchemy 2.0 |
| **Auth** | JWT (Flask-JWT-Extended) |
| **AI/ML** | OpenAI GPT-4o-mini, Scikit-learn |
| **Analytics** | Pandas, NumPy |
| **Reports** | ReportLab (PDF), openpyxl (Excel) |
| **File Parsing** | pdfplumber, pandas |
| **Container** | Docker, Docker Compose |

---

## 🏗️ Architecture

```
voyageiq/
├── frontend/                    # React + TypeScript + Tailwind
│   ├── src/
│   │   ├── pages/              # Page components
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── VesselsPage.tsx
│   │   │   ├── VoyagesPage.tsx
│   │   │   ├── FuelAnalyticsPage.tsx
│   │   │   ├── VoyageOptimizerPage.tsx
│   │   │   ├── ClaimDetectorPage.tsx
│   │   │   ├── AICopilotPage.tsx
│   │   │   ├── ReportsPage.tsx
│   │   │   └── LoginPage.tsx
│   │   ├── components/         # Reusable components
│   │   │   ├── ui/             # KPICard, HealthGauge, ClaimAlert, Map, Charts
│   │   │   └── layout/         # Sidebar, Header
│   │   ├── services/           # API service layer (axios)
│   │   ├── store/              # Zustand state management
│   │   └── types/              # TypeScript interfaces
│   ├── Dockerfile
│   └── nginx.conf
│
├── backend/                    # Python Flask API
│   ├── app/
│   │   ├── __init__.py        # App factory
│   │   ├── models.py          # SQLAlchemy ORM
│   │   ├── extensions.py      # Flask extensions
│   │   ├── routes/            # API blueprints
│   │   │   ├── auth.py
│   │   │   ├── vessels.py
│   │   │   ├── voyages.py
│   │   │   ├── analytics.py
│   │   │   ├── claims.py
│   │   │   ├── optimization.py
│   │   │   ├── weather.py
│   │   │   ├── copilot.py
│   │   │   ├── uploads.py
│   │   │   └── reports.py
│   │   └── utils/
│   │       └── seed_data.py   # Demo data generator
│   ├── config.py
│   ├── run.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── database/
│   └── schema.sql             # Complete PostgreSQL schema
│
├── docker-compose.yml          # Full stack orchestration
├── .env.example
└── README.md
```

---

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone and navigate
git clone https://github.com/yourusername/voyageiq.git
cd voyageiq

# Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY (optional)

# Start everything
docker-compose up -d

# Access:
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000/api
# API Health: http://localhost:5000/api/health
```

### Option 2: Manual Development Setup

```bash
# 1. Start PostgreSQL
createdb voyageiq_db
createuser voyageiq
psql voyageiq_db < database/schema.sql

# 2. Backend
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp ../.env.example .env
flask run --port 5000

# 3. Frontend
cd frontend
npm install
npm run dev
```

---

## ⚙️ Installation

### Prerequisites

- Docker & Docker Compose (for containerized setup)
- OR:
  - Python 3.11+
  - Node.js 20+
  - PostgreSQL 16+

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SECRET_KEY` | Flask secret key | ✅ |
| `JWT_SECRET_KEY` | JWT signing key | ✅ |
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `OPENAI_API_KEY` | OpenAI API key for AI Copilot | Optional |
| `FLASK_ENV` | `development` or `production` | Optional |

> **Note**: Without `OPENAI_API_KEY`, the AI Copilot uses intelligent rule-based responses that cover all common maritime queries.

---

## 📡 API Documentation

### Authentication

```http
POST /api/auth/login
Content-Type: application/json

{"email": "admin@voyageiq.com", "password": "password123"}
```

Returns: `{"access_token": "...", "user": {...}}`

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics/dashboard` | Executive KPIs |
| `GET` | `/api/vessels` | List all vessels |
| `GET` | `/api/vessels/:id/health` | AI health score |
| `GET` | `/api/voyages` | List voyages |
| `GET` | `/api/voyages/:id/performance` | Voyage performance |
| `GET` | `/api/claims` | List claims |
| `GET` | `/api/claims/detect/:voyage_id` | Run claim detection |
| `POST` | `/api/optimization/route` | Generate optimized routes |
| `POST` | `/api/optimization/fuel-simulator` | Fuel savings calculator |
| `GET` | `/api/weather/current?lat=&lon=` | Current weather |
| `POST` | `/api/copilot/chat` | AI Copilot chat |
| `POST` | `/api/uploads/report` | Upload noon report |
| `GET` | `/api/reports/generate/:id?format=pdf` | Generate report |

---

## 🐳 Deployment

### Render Deployment

1. **Database**: Create PostgreSQL on Render (or use Supabase)
2. **Backend**: Deploy as Web Service
   ```
   Build: pip install -r requirements.txt
   Start: gunicorn --bind 0.0.0.0:$PORT run:app
   ```
3. **Frontend**: Deploy as Static Site
   ```
   Build: npm run build
   Publish: dist/
   ```

### Docker on VPS

```bash
# Pull and run
docker-compose -f docker-compose.yml up -d

# View logs
docker-compose logs -f backend
```

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@voyageiq.com | password123 |
| **Captain** | captain@oceancargo.com | password123 |
| **Analyst** | analyst@oceancargo.com | password123 |

### Demo Data Included
- 4 vessels (Bulk Carrier, Container Ship, VLCC Tanker, LNG Carrier)
- 3 active voyages with realistic routes
- 60 noon reports with weather, fuel, navigation data
- Multiple claims with financial impact analysis
- 60+ days of fuel analytics

---

## 📊 Sample Data Routes

| Vessel | Route | Cargo |
|--------|-------|-------|
| MV Pacific Star | Singapore → Rotterdam | Iron Ore (75,000 MT) |
| MV Atlantic Pioneer | Shanghai → Los Angeles | Electronics (45,000 MT) |
| MT Ocean Titan | Ras Tanura → Ulsan | Crude Oil (280,000 MT) |

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'Add your feature'`
4. Push: `git push origin feature/your-feature`
5. Submit Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🌟 Acknowledgments

Inspired by leading maritime analytics platforms:
- MarineTraffic, Veson Nautical, Dataloy, Windward, FleetMon, StormGeo

---

*Built with ❤️ for the maritime industry*
