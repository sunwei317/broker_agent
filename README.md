# Broker Agent MVP

A comprehensive mortgage broker assistant that processes client conversations using AI to extract loan details, action items, and generate follow-up communications.

## 🚀 Features

- **Google Drive Integration**: Automatically import MP3 files from Google Drive
- **ASR Transcription**: Convert audio conversations to text using OpenAI Whisper
- **Speaker Diarization**: Separate broker vs. client speech segments
- **Mortgage Entity Recognition**: Extract loan amounts, rates, property types using Gemini AI
- **Action Item Extraction**: Identify documents needed, next steps, and commitments
- **Email Generation**: Create personalized follow-up emails
- **Verification Dashboard**: Review and correct AI extractions
- **Document Checklist System**: Track client-specific document requirements

## 📋 Tech Stack

- **Backend**: FastAPI (Python) with async SQLAlchemy
- **Frontend**: React + TypeScript + Tailwind CSS
- **Database**: MySQL 8.0
- **AI Services**: OpenAI Whisper API, Google Gemini AI
- **Containerization**: Docker & Docker Compose

## 🏗️ Project Structure

```
broker_agent/
├── backend/
│   ├── app/
│   │   ├── api/           # REST API endpoints
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic & AI integrations
│   │   ├── config.py      # Configuration management
│   │   ├── database.py    # Database connection
│   │   └── main.py        # FastAPI application
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   └── App.tsx        # Main application
│   ├── Dockerfile
│   └── package.json
├── database/
│   └── init.sql           # Database initialization
├── docker-compose.yml
└── README.md
```

## 🛠️ Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- Python 3.11+ (for local development)

### Environment Variables

Create a `.env` file in the project root:

```env
# Required API Keys
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key

# Google Drive (optional)
GOOGLE_DRIVE_FOLDER_ID=your_google_drive_folder_id
```

### Using Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Local Development

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your settings

# Run the server
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## 📡 API Endpoints

### Clients
- `GET /api/v1/clients` - List all clients
- `POST /api/v1/clients` - Create a new client
- `GET /api/v1/clients/{id}` - Get client details
- `PATCH /api/v1/clients/{id}` - Update client
- `DELETE /api/v1/clients/{id}` - Delete client

### Conversations
- `GET /api/v1/conversations` - List all conversations
- `POST /api/v1/conversations/upload` - Upload audio file
- `GET /api/v1/conversations/{id}` - Get conversation details
- `GET /api/v1/conversations/{id}/segments` - Get transcript segments
- `PATCH /api/v1/conversations/{id}/segments/{segment_id}` - Update segment

### Processing
- `POST /api/v1/processing/conversations/{id}/process` - Start processing
- `POST /api/v1/processing/conversations/{id}/generate-email` - Generate follow-up email
- `GET /api/v1/processing/google-drive/files` - List Google Drive files
- `POST /api/v1/processing/google-drive/import/{file_id}` - Import from Drive

### Extractions
- `GET /api/v1/extractions/mortgage` - List mortgage extractions
- `PATCH /api/v1/extractions/mortgage/{id}` - Update/verify extraction
- `GET /api/v1/extractions/actions` - List action items
- `PATCH /api/v1/extractions/actions/{id}` - Update action item

### Documents
- `GET /api/v1/documents/checklists` - List document checklists
- `POST /api/v1/documents/checklists` - Create checklist
- `PATCH /api/v1/documents/items/{id}` - Update document status
- `GET /api/v1/documents/loan-types` - Get default documents by loan type

## 🔐 Google Drive Setup

1. Create a Google Cloud Project
2. Enable the Google Drive API
3. Create a Service Account
4. Download the JSON credentials file
5. Place it at `backend/credentials/google_service_account.json`
6. Share your Google Drive folder with the service account email

## 🎯 Processing Pipeline

1. **Upload/Import**: Audio file is uploaded or imported from Google Drive
2. **Transcription**: OpenAI Whisper converts audio to text
3. **Diarization**: Speakers are identified and separated
4. **Extraction**: Gemini AI extracts mortgage entities and action items
5. **Verification**: Zach reviews and corrects extractions in the dashboard
6. **Email Generation**: AI generates personalized follow-up email

## 📊 Database Schema

### Core Tables
- `clients` - Client information
- `conversations` - Audio recordings and processing status
- `transcript_segments` - Individual speech segments with speaker labels
- `mortgage_extractions` - Extracted loan and property details
- `action_items` - Tasks and commitments from conversations
- `document_checklists` - Client document requirements
- `document_items` - Individual document tracking

## 🔧 Configuration

### Backend Configuration (`backend/app/config.py`)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL connection string | Required |
| `OPENAI_API_KEY` | OpenAI API key for Whisper | Required |
| `GEMINI_API_KEY` | Google Gemini API key | Required |
| `GOOGLE_DRIVE_CREDENTIALS_PATH` | Path to service account JSON | Optional |
| `GOOGLE_DRIVE_FOLDER_ID` | Folder ID to monitor | Optional |
| `DEBUG` | Enable debug mode | `true` |

## 🚧 Roadmap

- [ ] Real-time processing status via WebSocket
- [ ] Batch processing for multiple files
- [ ] Custom email templates
- [ ] Integration with CRM systems
- [ ] Mobile-responsive optimizations
- [ ] Export to PDF/Excel
- [ ] Multi-language support

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

