from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class ConversationStatus(str, enum.Enum):
    PENDING = "pending"
    TRANSCRIBING = "transcribing"
    DIARIZING = "diarizing"
    EXTRACTING = "extracting"
    COMPLETED = "completed"
    FAILED = "failed"


class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    
    # File information
    google_drive_file_id = Column(String(255))
    original_filename = Column(String(255))
    file_path = Column(String(500))
    duration_seconds = Column(Float)
    
    # Processing status
    status = Column(Enum(ConversationStatus), default=ConversationStatus.PENDING)
    error_message = Column(Text)
    
    # Raw transcription
    raw_transcript = Column(Text)
    
    # Timestamps
    recorded_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    processed_at = Column(DateTime(timezone=True))
    
    # Relationships
    client = relationship("Client", back_populates="conversations")
    segments = relationship("TranscriptSegment", back_populates="conversation", cascade="all, delete-orphan")
    extractions = relationship("MortgageExtraction", back_populates="conversation", cascade="all, delete-orphan")
    action_items = relationship("ActionItem", back_populates="conversation", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Conversation {self.id} - {self.original_filename}>"


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    
    speaker = Column(String(50))  # "zach" or "client"
    start_time = Column(Float)
    end_time = Column(Float)
    text = Column(Text)
    confidence = Column(Float)
    
    # Verification
    is_verified = Column(Integer, default=0)  # 0=unverified, 1=verified
    verified_text = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    conversation = relationship("Conversation", back_populates="segments")
    
    def __repr__(self):
        return f"<TranscriptSegment {self.speaker}: {self.text[:50]}...>"

