from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
import os
import aiofiles
from datetime import datetime

from app.database import get_db
from app.models.conversation import Conversation, TranscriptSegment, ConversationStatus
from app.schemas.conversation import (
    ConversationCreate,
    ConversationResponse,
    ConversationListResponse,
    TranscriptSegmentResponse,
    TranscriptSegmentUpdate,
)
from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    conversation_data: ConversationCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new conversation record."""
    conversation = Conversation(**conversation_data.model_dump())
    db.add(conversation)
    await db.commit()
    
    # Reload with segments relationship to avoid lazy loading issues
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.segments))
        .where(Conversation.id == conversation.id)
    )
    conversation = result.scalar_one()
    return conversation


@router.post("/upload", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def upload_audio(
    file: UploadFile = File(...),
    client_id: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """Upload an audio file and create a conversation record."""
    print(f"📁 Upload request - client_id: {client_id}, filename: {file.filename}")
    # Validate file type
    if not file.filename.endswith(('.mp3', '.wav', '.m4a', '.ogg')):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Supported formats: mp3, wav, m4a, ogg"
        )
    
    # Create upload directory if it doesn't exist
    upload_dir = settings.upload_dir
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"{timestamp}_{file.filename}"
    file_path = os.path.join(upload_dir, safe_filename)
    
    # Save file asynchronously
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    # Create conversation record
    conversation = Conversation(
        client_id=client_id,
        original_filename=file.filename,
        file_path=file_path,
        status=ConversationStatus.PENDING
    )
    db.add(conversation)
    await db.commit()
    
    # Reload with segments relationship to avoid lazy loading issues
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.segments))
        .where(Conversation.id == conversation.id)
    )
    conversation = result.scalar_one()
    
    return conversation


@router.get("", response_model=List[ConversationListResponse])
async def list_conversations(
    skip: int = 0,
    limit: int = 100,
    status: Optional[ConversationStatus] = None,
    client_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all conversations with optional filtering."""
    query = select(Conversation)
    
    if status:
        query = query.where(Conversation.status == status)
    if client_id:
        query = query.where(Conversation.client_id == client_id)
    
    query = query.offset(skip).limit(limit).order_by(Conversation.created_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific conversation with all segments."""
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.segments))
        .where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return conversation


@router.get("/{conversation_id}/segments", response_model=List[TranscriptSegmentResponse])
async def get_conversation_segments(
    conversation_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get all transcript segments for a conversation."""
    result = await db.execute(
        select(TranscriptSegment)
        .where(TranscriptSegment.conversation_id == conversation_id)
        .order_by(TranscriptSegment.start_time)
    )
    return result.scalars().all()


@router.patch("/{conversation_id}/segments/{segment_id}", response_model=TranscriptSegmentResponse)
async def update_segment(
    conversation_id: int,
    segment_id: int,
    segment_data: TranscriptSegmentUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a transcript segment (for verification/correction)."""
    result = await db.execute(
        select(TranscriptSegment)
        .where(
            TranscriptSegment.id == segment_id,
            TranscriptSegment.conversation_id == conversation_id
        )
    )
    segment = result.scalar_one_or_none()
    
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    update_data = segment_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(segment, field, value)
    
    await db.commit()
    await db.refresh(segment)
    return segment


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a conversation and its associated data."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Delete the audio file if it exists
    if conversation.file_path and os.path.exists(conversation.file_path):
        try:
            os.remove(conversation.file_path)
        except Exception as e:
            print(f"Warning: Could not delete file {conversation.file_path}: {e}")
    
    await db.delete(conversation)
    await db.commit()

