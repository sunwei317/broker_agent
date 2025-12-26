from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.conversation import ConversationStatus


class ConversationCreate(BaseModel):
    client_id: Optional[int] = None
    google_drive_file_id: Optional[str] = None
    recorded_at: Optional[datetime] = None


class TranscriptSegmentResponse(BaseModel):
    id: int
    speaker: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    text: Optional[str] = None
    confidence: Optional[float] = None
    is_verified: int = 0
    verified_text: Optional[str] = None
    
    class Config:
        from_attributes = True


class TranscriptSegmentUpdate(BaseModel):
    speaker: Optional[str] = None
    text: Optional[str] = None
    is_verified: Optional[int] = None
    verified_text: Optional[str] = None


class ConversationResponse(BaseModel):
    id: int
    client_id: Optional[int] = None
    google_drive_file_id: Optional[str] = None
    original_filename: Optional[str] = None
    file_path: Optional[str] = None
    duration_seconds: Optional[float] = None
    status: ConversationStatus
    error_message: Optional[str] = None
    raw_transcript: Optional[str] = None
    recorded_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    segments: List[TranscriptSegmentResponse] = []
    
    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    id: int
    client_id: Optional[int] = None
    original_filename: Optional[str] = None
    duration_seconds: Optional[float] = None
    status: ConversationStatus
    recorded_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

