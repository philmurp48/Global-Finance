# Global Finance - Management Reporting Platform

A comprehensive management reporting and analytics platform built with Next.js, featuring dynamic Excel data integration, scenario modeling, and operational performance tracking.

## Features

### 📊 Executive Summary
- Dynamic KPI tiles generated from uploaded Excel data
- AI-powered search functionality
- Personalized insights based on data metrics
- Real-time data visualization

### 🔄 Scenario Modeling
- Excel-driven adjustment levers extracted from driver tree
- Performance Driver Tree visualization
- Natural language scenario description
- P&L impact calculations
- What-if analysis capabilities

### 📈 Operational Performance
- Manufacturing metrics (OEE, Production Volume, Quality Rate)
- Supply chain metrics (Inventory Turns, On-Time Delivery)
- Digital transformation metrics
- Excel data-driven performance tracking

### 📤 Data Upload
- Excel file upload and parsing
- Driver Tree structure extraction
- Accounting and Rate Facts processing
- Product dimension mapping

## Technology Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Charts**: Recharts
- **UI Components**: Radix UI
- **Excel Processing**: xlsx
- **Data Storage**: Supabase / Vercel KV / In-memory fallback

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd "Global Finance"
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3002](http://localhost:3002) in your browser

## Project Structure

```
Global Finance/
├── app/
│   ├── api/
│   │   └── excel-data/      # API routes for Excel data management
│   ├── data-upload/         # Excel upload page
│   ├── operational-performance/  # Operational metrics page
│   ├── scenario-modeling/    # Scenario modeling page
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Executive Summary page
│   └── ...
├── components/
│   ├── ExcelUpload.tsx      # Excel upload component
│   └── DisclaimerModal.tsx # Disclaimer modal
├── lib/
│   ├── excel-parser.ts      # Excel file parsing logic
│   ├── excel-metrics.ts     # Metrics extraction utilities
│   ├── db.ts                # Database integration
│   └── ...
└── ...
```

## Excel File Format

The platform expects Excel files with the following sheets:

1. **Driver Tree**: Hierarchical structure with levels (Level 1, Level 2, etc.)
2. **Accounting Fact**: Period data with accounting amounts
3. **Rate Fact** or **Fee Rate Fact**: Rate data for percentage-based metrics
4. **Product DIM** (optional): Product dimension mapping

## Features in Detail

### Dynamic Data Integration
- All pages automatically update when a new Excel file is uploaded
- Metrics are extracted and calculated from the driver tree structure
- Real-time data synchronization across all views

### Scenario Modeling
- Automatic lever extraction from Level 5 (leaf) nodes
- Scenario generation based on top drivers
- Natural language parsing for scenario descriptions
- Comprehensive P&L impact analysis

### Error Handling
- Comprehensive error handling throughout the application
- Graceful fallbacks to default data when Excel data is unavailable
- Detailed error logging for debugging

## Development

### Available Scripts

- `npm run dev` - Start development server on port 3002
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## License

Private - Accenture Internal Use

## Author

Built for Accenture Management Reporting Platform
