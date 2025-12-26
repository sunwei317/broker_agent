from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api import api_router
from app.database import init_db
from app.config import get_settings

# Import models so they register with Base.metadata before init_db()
from app.models import (  # noqa: F401
    Client,
    Conversation,
    TranscriptSegment,
    MortgageExtraction,
    ActionItem,
    DocumentChecklist,
    DocumentItem,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    await init_db()
    yield


app = FastAPI(
    title="Broker Agent API",
    redirect_slashes=False,
    description="""
    Mortgage Broker Assistant API for processing client conversations.
    
    ## Features
    
    - **Google Drive Integration**: Import MP3 files from Google Drive
    - **ASR Transcription**: Convert audio to text using OpenAI Whisper
    - **Speaker Diarization**: Separate broker vs client speech
    - **Mortgage Entity Recognition**: Extract loan details, property info, etc.
    - **Action Item Extraction**: Identify documents needed and next steps
    - **Email Generation**: Create personalized follow-up emails
    - **Document Checklist**: Generate client-specific document requirements
    """,
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Broker Agent API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

