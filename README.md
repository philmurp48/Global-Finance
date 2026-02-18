# Global Finance

A streamlined management reporting platform with AI-powered insights, scenario modeling, and operational performance tracking.

## Features

### 1. Executive Summary
- Personalized dashboard with user profile picture
- AI-powered search functionality
- Personalized metric tiles showing key business insights
- Real-time data visualization

### 2. Scenario Modeling
- Interactive adjustment levers for what-if analysis
- Performance Driver Tree visualization (from uploaded Excel data)
- Natural language scenario description input
- P&L impact calculations
- Real-time scenario analysis

### 3. Operational Performance
- Manufacturing performance metrics
- Plant performance tracking
- Supply chain metrics
- Digital & innovation KPIs
- Operational efficiency drivers

### 4. Data Upload
- Excel file upload interface
- Supports Driver Tree, Accounting Fact, Rate Fact, and Product DIM sheets
- Shared data across all pages
- Real-time data synchronization

## Getting Started

### Prerequisites
- Node.js >= 18.0.0
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3002](http://localhost:3002) in your browser

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
Global Finance/
├── app/
│   ├── page.tsx                    # Executive Summary
│   ├── scenario-modeling/          # Scenario Modeling page
│   ├── operational-performance/   # Operational Performance page
│   ├── data-upload/                # Data Upload page
│   ├── api/excel-data/             # API route for Excel data
│   ├── layout.tsx                  # Root layout
│   ├── layout-wrapper.tsx          # Layout wrapper
│   ├── management-layout.tsx       # Management layout with sidebar
│   └── globals.css                 # Global styles
├── components/
│   └── ExcelUpload.tsx             # Excel upload component
├── lib/
│   ├── excel-parser.ts             # Excel parsing logic
│   └── db.ts                       # Database integration
└── public/                         # Static assets
```

## Excel File Format

The application expects an Excel file with the following sheets:

1. **Driver Tree** - Hierarchical structure of performance drivers with levels
2. **Accounting Fact** - Accounting amounts by driver and period
3. **Rate Fact** or **Fee Rate Fact** - Rate data by driver and period
4. **Product DIM** (optional) - Product dimension data

## Technology Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Radix UI** - UI components
- **xlsx** - Excel file parsing
- **Lucide React** - Icons

## Notes

- The application runs on port 3002 (different from the original project on 3001)
- All pages pull data from the uploaded Excel file
- Data is shared across all pages via API routes
- The Performance Driver Tree appears in Scenario Modeling when Excel data is uploaded

