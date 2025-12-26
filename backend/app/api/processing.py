from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Dict, Any
from datetime import datetime

from app.database import get_db, AsyncSessionLocal
from app.models.conversation import Conversation, TranscriptSegment, ConversationStatus
from app.models.extraction import MortgageExtraction, ActionItem
from app.models.client import Client
from app.services.google_drive import google_drive_service
from app.services.transcription import transcription_service
from app.services.diarization import diarization_service
from app.services.extraction import extraction_service
from app.services.email_generator import email_generator_service
from app.config import get_settings

router = APIRouter()
settings = get_settings()


async def process_conversation_task(conversation_id: int):
    """
    Background task to process a conversation through the full pipeline:
    1. Transcription (ASR)
    2. Speaker diarization
    3. Entity extraction
    4. Action item extraction
    """
    async with AsyncSessionLocal() as db:
        try:
            # Get the conversation
            result = await db.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()
            
            if not conversation:
                return
            
            # Update status to transcribing
            conversation.status = ConversationStatus.TRANSCRIBING
            await db.commit()
            
            # Step 1: Transcribe audio
            transcription_result = await transcription_service.transcribe_with_segments(
                conversation.file_path
            )
            
            conversation.raw_transcript = transcription_result['text']
            conversation.duration_seconds = transcription_result.get('duration')
            
            # Update status to diarizing
            conversation.status = ConversationStatus.DIARIZING
            await db.commit()
            
            # Step 2: Diarize (identify speakers)
            diarization_segments = await diarization_service.diarize_audio(
                conversation.file_path,
                num_speakers=2
            )
            
            # Merge transcription with diarization
            merged_segments = await diarization_service.merge_transcription_with_diarization(
                transcription_result['segments'],
                diarization_segments,
                speaker_mapping={"SPEAKER_00": "zach", "SPEAKER_01": "client"}
            )
            
            # Save transcript segments
            for seg in merged_segments:
                segment = TranscriptSegment(
                    conversation_id=conversation.id,
                    speaker=seg.get('speaker', 'unknown'),
                    start_time=seg.get('start'),
                    end_time=seg.get('end'),
                    text=seg.get('text'),
                    confidence=seg.get('confidence')
                )
                db.add(segment)
            
            # Update status to extracting
            conversation.status = ConversationStatus.EXTRACTING
            await db.commit()
            
            # Step 3: Extract mortgage entities and action items
            extraction_result = await extraction_service.process_transcript(
                transcription_result['text']
            )
            
            # Save mortgage extraction
            mortgage_data = extraction_result.get('mortgage_extraction', {})
            if mortgage_data and not mortgage_data.get('parse_error'):
                extraction = MortgageExtraction(
                    conversation_id=conversation.id,
                    loan_amount=mortgage_data.get('loan_amount'),
                    interest_rate=mortgage_data.get('interest_rate'),
                    loan_term_years=mortgage_data.get('loan_term_years'),
                    loan_type=mortgage_data.get('loan_type'),
                    property_type=mortgage_data.get('property_type'),
                    property_address=mortgage_data.get('property_address'),
                    purchase_price=mortgage_data.get('purchase_price'),
                    down_payment=mortgage_data.get('down_payment'),
                    down_payment_percentage=mortgage_data.get('down_payment_percentage'),
                    borrower_income=mortgage_data.get('borrower_income'),
                    borrower_employment=mortgage_data.get('borrower_employment'),
                    credit_score_range=mortgage_data.get('credit_score_range'),
                    additional_data={
                        k: v for k, v in mortgage_data.items()
                        if k not in ['loan_amount', 'interest_rate', 'loan_term_years', 
                                    'loan_type', 'property_type', 'property_address',
                                    'purchase_price', 'down_payment', 'down_payment_percentage',
                                    'borrower_income', 'borrower_employment', 'credit_score_range']
                    }
                )
                db.add(extraction)
            
            # Save action items
            action_items = extraction_result.get('action_items', [])
            for item in action_items:
                if isinstance(item, dict) and item.get('description'):
                    action = ActionItem(
                        conversation_id=conversation.id,
                        description=item.get('description'),
                        category=item.get('category'),
                        assignee=item.get('assignee'),
                        priority=item.get('priority')
                    )
                    db.add(action)
            
            # Mark as completed
            conversation.status = ConversationStatus.COMPLETED
            conversation.processed_at = datetime.now()
            await db.commit()
            
        except Exception as e:
            # Mark as failed
            conversation.status = ConversationStatus.FAILED
            conversation.error_message = str(e)
            await db.commit()
            raise


@router.post("/conversations/{conversation_id}/process")
async def trigger_processing(
    conversation_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger processing for a conversation.
    This runs the full pipeline: transcription -> diarization -> extraction.
    """
    # Verify conversation exists
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if not conversation.file_path:
        raise HTTPException(status_code=400, detail="No audio file associated with this conversation")
    
    if conversation.status not in [ConversationStatus.PENDING, ConversationStatus.FAILED]:
        raise HTTPException(
            status_code=400, 
            detail=f"Conversation is already {conversation.status.value}"
        )
    
    # Add to background tasks
    background_tasks.add_task(process_conversation_task, conversation_id)
    
    return {"message": "Processing started", "conversation_id": conversation_id}


@router.post("/conversations/{conversation_id}/generate-email")
async def generate_follow_up_email(
    conversation_id: int,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Generate a follow-up email based on a processed conversation."""
    # Get conversation with related data
    result = await db.execute(
        select(Conversation)
        .options(
            selectinload(Conversation.client),
            selectinload(Conversation.extractions),
            selectinload(Conversation.action_items)
        )
        .where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conversation.status != ConversationStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail="Conversation must be fully processed before generating email"
        )
    
    # Get client name
    client_name = conversation.client.name if conversation.client else "Valued Client"
    
    # Get mortgage data from first extraction
    mortgage_data = {}
    if conversation.extractions:
        ext = conversation.extractions[0]
        mortgage_data = {
            'loan_amount': ext.loan_amount,
            'loan_type': ext.loan_type,
            'interest_rate': ext.interest_rate,
            'property_type': ext.property_type,
        }
    
    # Get action items
    action_items = [
        {'description': a.description, 'assignee': a.assignee, 'category': a.category}
        for a in conversation.action_items
    ]
    
    # Generate email
    email = await email_generator_service.generate_follow_up_email(
        client_name=client_name,
        transcript=conversation.raw_transcript or "",
        mortgage_data=mortgage_data,
        action_items=action_items
    )
    
    return email


@router.get("/google-drive/files")
async def list_google_drive_files(
    folder_id: str = None
):
    """List MP3 files from Google Drive."""
    try:
        files = await google_drive_service.list_mp3_files(folder_id)
        return {"files": files}
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")


@router.post("/google-drive/import/{file_id}")
async def import_from_google_drive(
    file_id: str,
    client_id: int = None,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db)
):
    """Import an audio file from Google Drive and optionally start processing."""
    try:
        # Get file metadata
        metadata = await google_drive_service.get_file_metadata(file_id)
        
        # Download file
        import os
        download_path = os.path.join(settings.upload_dir, metadata['name'])
        os.makedirs(settings.upload_dir, exist_ok=True)
        
        await google_drive_service.download_file(file_id, download_path)
        
        # Create conversation record
        conversation = Conversation(
            client_id=client_id,
            google_drive_file_id=file_id,
            original_filename=metadata['name'],
            file_path=download_path,
            status=ConversationStatus.PENDING
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        
        # Optionally start processing
        if background_tasks:
            background_tasks.add_task(process_conversation_task, conversation.id)
        
        return {
            "message": "File imported successfully",
            "conversation_id": conversation.id,
            "filename": metadata['name']
        }
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import file: {str(e)}")

