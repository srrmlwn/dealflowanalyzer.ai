# Deal Flow Analyzer

A real estate investment analysis tool that downloads property listings from Zillow API, calculates investment metrics, and provides a web interface for analysis.

## Project Structure

```
dealflowanalyzer/
├── backend/           # Node.js API server
├── frontend/          # Next.js web application
├── shared/           # Shared types and utilities
├── config/           # Configuration files
├── data/             # Data storage (JSON files)
└── specs/            # Project specifications
```

## Phase 1 Setup Complete ✅

The foundation has been set up with:
- TypeScript project structure
- Backend (Node.js + Express)
- Frontend (Next.js + TypeScript)
- Shared types and validation schemas
- Configuration system with Zod validation
- Sample configuration files

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp env.template .env
   # Edit .env with your RapidAPI key
   ```

3. **Start development servers:**
   ```bash
   npm run dev
   ```

This will start:
- Backend API server on http://localhost:8000
- Frontend web app on http://localhost:8001

### Configuration

Edit the configuration files in the `config/` directory:

- `config/buybox.json` - Geographic and property filters
- `config/financial.json` - Financial assumptions and calculations

## API Endpoints

- `GET /health` - Health check
- `GET /api/config` - Get current configuration

## Next Steps

Phase 1 is complete! Ready to move on to:
- Phase 2: Data Collection & Processing (Zillow API integration)
- Phase 3: Financial Analysis Engine
- Phase 4: Automation & Scheduling

## Development

### Backend
```bash
cd backend
npm run dev    # Start development server
npm run build  # Build for production
npm test       # Run tests
npm run lint   # Run linter
```

### Frontend
```bash
cd frontend
npm run dev    # Start development server
npm run build  # Build for production
npm run lint   # Run linter
```

### Shared
```bash
cd shared
npm run build  # Build shared types
npm run lint   # Run linter
```

## Configuration Schema

The application uses Zod schemas for type-safe configuration:

- **BuyboxConfig**: Geographic scope, property filters
- **FinancialConfig**: Mortgage, operating expenses, appreciation assumptions
- **Property**: Zillow API property data structure
- **AnalysisResult**: Calculated financial metrics

## Environment Variables

Required environment variables:
- `RAPIDAPI_KEY` - Your RapidAPI key for Zillow API
- `PORT` - Backend server port (default: 8000)
- `NODE_ENV` - Environment (development/production)

See `env.template` for all available options.
