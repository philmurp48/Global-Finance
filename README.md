# Global Finance - Management Reporting Platform

A comprehensive management reporting and analytics platform built with Next.js, featuring dynamic Excel data integration, scenario modeling, and operational performance tracking.

## Features

### 📊 Executive Summary
- Dynamic KPI tiles generated from uploaded Excel data
- **AI-powered search functionality** - Powered by OpenAI GPT for flexible natural language queries
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
- **AI Integration**: OpenAI GPT-4 (for intelligent search and analysis)
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

3. Configure environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:

**Required for AI-powered search:**
```
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

**Required for data storage (choose one):**

For **Vercel Blob** (recommended for Vercel deployments):
```
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

For **Upstash Redis**:
```
KV_REST_API_URL=your_upstash_redis_url
KV_REST_API_TOKEN=your_upstash_redis_token
```

For **Vercel KV**:
```
KV_REST_API_URL=your_vercel_kv_url
KV_REST_API_TOKEN=your_vercel_kv_token
```

**Note:** If none of the above are configured, the app will use in-memory storage (DEV ONLY - data is lost on server restart).

**Optional (for other features):**
```
OPENAI_API_KEY=your_openai_api_key_here
```

Get your OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3002](http://localhost:3002) in your browser

## Project Structure

```
Global Finance/
├── app/
│   ├── api/
│   │   ├── excel-data/      # API routes for Excel data management
│   │   └── ai-search/       # OpenAI API integration for AI search
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

### AI-Powered Search
- Natural language query processing using Google Gemini AI
- Intelligent analysis of Excel data to answer complex business questions
- Handles queries like "What Cost Center has the best Margin %", comparisons, trends, and more
- Deterministic aggregation for common finance queries (revenue, expense, margin, margin%)
- Rate limiting and response caching for optimal performance
- Graceful error handling for quota/rate limit scenarios
- Available in both the Executive Summary page and header search bar
- Requires `GEMINI_API_KEY` environment variable to be set

### Error Handling
- Comprehensive error handling throughout the application
- Graceful fallbacks to default data when Excel data is unavailable
- Detailed error logging for debugging
- Graceful handling of Gemini API quota/rate limit errors with user-friendly messages

## AI-Powered Search Setup

### Local Development

1. Get your Google Gemini API key:
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Sign in with your Google account
   - Click "Create API Key"
   - Copy the generated API key

2. Add to `.env.local`:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   
   **Note:** For local development, the app will use in-memory storage. Uploaded datasets will be lost on server restart. For persistent storage, configure one of the storage options in the environment variables section above.

3. Restart the development server:
   ```bash
   npm run dev
   ```

4. Upload your Excel data:
   - Navigate to the Data Upload page
   - Upload your Excel file
   - The uploadId will be stored in localStorage automatically

5. Test the search functionality:
   - Use the search bar in the header or on the Executive Summary page
   - Try queries like:
     - "What is our total revenue in 2024Q1?"
     - "Which cost center has the best margin?"
     - "Show me the margin percentage for the latest quarter"
     - "Compare revenue and expenses by geography"

### Vercel Deployment

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add a new variable:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: Your Gemini API key
   - **Environment**: Production, Preview, and Development (select all)
4. Redeploy your application

### Testing

The AI search includes:
- **Rate limiting**: 10 requests per minute per IP (in-memory for dev)
- **Response caching**: 5-minute cache to minimize API calls
- **Deterministic aggregation**: Pre-calculated values for revenue, expense, margin queries
- **Error handling**: Graceful messages for quota/rate limit errors

To test:
1. Ensure `GEMINI_API_KEY` is set in `.env.local`
2. Start the dev server: `npm run dev`
3. Navigate to any page (except home) and use the header search bar
4. Submit a query and verify the AI response appears in the modal

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
