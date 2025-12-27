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
    print(f"\n{'='*60}")
    print(f"🎙️ STARTING PROCESSING for conversation {conversation_id}")
    print(f"{'='*60}\n")
    
    async with AsyncSessionLocal() as db:
        try:
            # Get the conversation
            result = await db.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()
            
            if not conversation:
                print(f"❌ Conversation {conversation_id} not found")
                return
            
            print(f"📁 File: {conversation.file_path}")
            print(f"📄 Original filename: {conversation.original_filename}")
            
            # Update status to transcribing
            conversation.status = ConversationStatus.TRANSCRIBING
            await db.commit()
            
            # Step 1: Transcribe audio
            print(f"\n📝 STEP 1: Transcribing audio with OpenAI Whisper...")
            transcription_result = await transcription_service.transcribe_with_segments(
                conversation.file_path
            )
            
            conversation.raw_transcript = transcription_result['text']
            conversation.duration_seconds = transcription_result.get('duration')
            
            print(f"\n{'='*60}")
            print(f"📝 TRANSCRIPTION RESULT:")
            print(f"{'='*60}")
            print(f"Duration: {transcription_result.get('duration', 'N/A')} seconds")
            print(f"Language: {transcription_result.get('language', 'N/A')}")
            print(f"\n--- FULL TRANSCRIPT ---")
            print(transcription_result['text'])
            print(f"--- END TRANSCRIPT ---\n")
            print(f"Segments: {len(transcription_result.get('segments', []))} segments")
            
            # Update status to diarizing
            conversation.status = ConversationStatus.DIARIZING
            await db.commit()
            
            # Step 2: Diarize (identify speakers)
            print(f"\n🎭 STEP 2: Diarizing audio (identifying speakers)...")
            diarization_segments = await diarization_service.diarize_audio(
                conversation.file_path,
                num_speakers=2
            )
            print(f"   Found {len(diarization_segments)} speaker segments")
            
            # Merge transcription with diarization
            merged_segments = await diarization_service.merge_transcription_with_diarization(
                transcription_result['segments'],
                diarization_segments,
                speaker_mapping={"SPEAKER_00": "user", "SPEAKER_01": "client"}
            )
            print(f"   Merged into {len(merged_segments)} segments")
            
            # Print merged segments
            print(f"\n--- DIARIZED TRANSCRIPT ---")
            for seg in merged_segments[:10]:  # Show first 10 segments
                speaker = seg.get('speaker', 'unknown').upper()
                text = seg.get('text', '')
                print(f"[{speaker}]: {text}")
            if len(merged_segments) > 10:
                print(f"... and {len(merged_segments) - 10} more segments")
            print(f"--- END DIARIZED TRANSCRIPT ---\n")
            
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
            print(f"\n🔍 STEP 3: Extracting mortgage entities with Gemini AI...")
            extraction_result = await extraction_service.process_transcript(
                transcription_result['text']
            )
            
            # Print extraction results
            print(f"\n{'='*60}")
            print(f"🏠 MORTGAGE EXTRACTION RESULT:")
            print(f"{'='*60}")
            mortgage_data_raw = extraction_result.get('mortgage_extraction', {})
            
            # Flatten nested structure if present (loan_details, property_details, borrower_details)
            mortgage_data = {}
            if mortgage_data_raw:
                for key, value in mortgage_data_raw.items():
                    if isinstance(value, dict):
                        # Flatten nested dict
                        for nested_key, nested_value in value.items():
                            mortgage_data[nested_key] = nested_value
                            if nested_value is not None:
                                print(f"   {nested_key}: {nested_value}")
                    else:
                        mortgage_data[key] = value
                        if value is not None:
                            print(f"   {key}: {value}")
            
            if not mortgage_data:
                print("   No mortgage data extracted")
            
            print(f"\n📋 ACTION ITEMS:")
            action_items = extraction_result.get('action_items', [])
            for i, item in enumerate(action_items, 1):
                if isinstance(item, dict):
                    print(f"   {i}. [{item.get('priority', 'N/A').upper()}] {item.get('description', 'N/A')}")
                    print(f"      Assignee: {item.get('assignee', 'N/A')}, Category: {item.get('category', 'N/A')}")
            
            # Save loan details extraction
            if mortgage_data and not mortgage_data.get('parse_error'):
                # Normalize loan_type to one of: conventional, FHA, VA, jumbo
                # Default to "conventional" if not detected or invalid
                loan_type = mortgage_data.get('loan_type')
                if loan_type:
                    loan_type = loan_type.lower()
                    if loan_type not in ['conventional', 'fha', 'va', 'jumbo']:
                        loan_type = 'conventional'  # Default to conventional if invalid
                else:
                    loan_type = 'conventional'  # Default to conventional if not detected
                
                extraction = MortgageExtraction(
                    conversation_id=conversation.id,
                    loan_amount=mortgage_data.get('loan_amount'),
                    loan_term_years=mortgage_data.get('loan_term_years'),
                    loan_type=loan_type,
                )
                db.add(extraction)
                
                print(f"\n💾 Saved Loan Details:")
                print(f"   Loan Amount: {mortgage_data.get('loan_amount')}")
                print(f"   Loan Term: {mortgage_data.get('loan_term_years')} years")
                print(f"   Loan Type: {loan_type}")
            
            # Save action items
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
            print(f"\n📝 Setting status to COMPLETED...")
            conversation.status = ConversationStatus.COMPLETED
            conversation.processed_at = datetime.now()
            
            print(f"   Committing to database...")
            await db.commit()
            print(f"   ✓ Commit successful!")
            
            print(f"\n{'='*60}")
            print(f"✅ PROCESSING COMPLETED for conversation {conversation_id}")
            print(f"   Status: {conversation.status}")
            print(f"{'='*60}\n")
            
        except Exception as e:
            # Mark as failed
            print(f"\n{'='*60}")
            print(f"❌ PROCESSING FAILED for conversation {conversation_id}")
            print(f"Error: {str(e)}")
            print(f"{'='*60}\n")
            import traceback
            traceback.print_exc()
            
            # Rollback any pending changes and re-fetch conversation
            try:
                await db.rollback()
                result = await db.execute(
                    select(Conversation).where(Conversation.id == conversation_id)
                )
                conversation = result.scalar_one_or_none()
                if conversation:
                    conversation.status = ConversationStatus.FAILED
                    conversation.error_message = str(e)[:500]  # Limit error message length
                    await db.commit()
            except Exception as inner_e:
                print(f"Failed to update conversation status: {inner_e}")


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


@router.post("/conversations/{conversation_id}/re-extract")
async def re_extract_from_transcript(
    conversation_id: int,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Re-extract loan details from the (possibly modified) transcript.
    Uses verified_text if available, otherwise uses original text.
    """
    # Get conversation with segments
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.segments))
        .where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conversation.status != ConversationStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail="Conversation must be fully processed before re-extraction"
        )
    
    # Build transcript from segments (use verified_text if available)
    transcript_parts = []
    for segment in sorted(conversation.segments, key=lambda s: s.start_time or 0):
        text = segment.verified_text or segment.text or ""
        if text.strip():
            transcript_parts.append(text.strip())
    
    transcript = " ".join(transcript_parts)
    
    if not transcript:
        raise HTTPException(status_code=400, detail="No transcript text available")
    
    print(f"\n🔄 RE-EXTRACTING loan details for conversation {conversation_id}")
    print(f"   Transcript length: {len(transcript)} characters")
    
    # Run extraction
    extraction_result = await extraction_service.extract_mortgage_entities(transcript)
    
    print(f"   Extraction result: {extraction_result}")
    
    # Flatten nested structure if present
    mortgage_data = {}
    if extraction_result:
        for key, value in extraction_result.items():
            if isinstance(value, dict):
                for nested_key, nested_value in value.items():
                    mortgage_data[nested_key] = nested_value
            else:
                mortgage_data[key] = value
    
    # Delete existing extractions for this conversation
    existing = await db.execute(
        select(MortgageExtraction).where(MortgageExtraction.conversation_id == conversation_id)
    )
    for ext in existing.scalars().all():
        await db.delete(ext)
    
    # Save new extraction
    if mortgage_data and not mortgage_data.get('parse_error'):
        # Normalize loan_type, default to "conventional" if not detected or invalid
        loan_type = mortgage_data.get('loan_type')
        if loan_type:
            loan_type = loan_type.lower()
            if loan_type not in ['conventional', 'fha', 'va', 'jumbo']:
                loan_type = 'conventional'  # Default to conventional if invalid
        else:
            loan_type = 'conventional'  # Default to conventional if not detected
        
        new_extraction = MortgageExtraction(
            conversation_id=conversation.id,
            loan_amount=mortgage_data.get('loan_amount'),
            loan_term_years=mortgage_data.get('loan_term_years'),
            loan_type=loan_type,
        )
        db.add(new_extraction)
        
        print(f"   💾 Saved new extraction:")
        print(f"      Loan Amount: {mortgage_data.get('loan_amount')}")
        print(f"      Loan Term: {mortgage_data.get('loan_term_years')} years")
        print(f"      Loan Type: {loan_type}")
    
    await db.commit()
    
    return {
        "message": "Re-extraction completed",
        "loan_details": {
            "loan_amount": mortgage_data.get('loan_amount'),
            "loan_term_years": mortgage_data.get('loan_term_years'),
            "loan_type": loan_type if mortgage_data else 'conventional',
        }
    }


@router.post("/conversations/{conversation_id}/generate-email")
async def generate_follow_up_email(
    conversation_id: int,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Generate a follow-up email based on a processed conversation."""
    from app.services.email_generator import get_documents_for_loan_type
    
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
    loan_type = 'conventional'  # Default
    if conversation.extractions:
        ext = conversation.extractions[0]
        loan_type = ext.loan_type or 'conventional'
        mortgage_data = {
            'loan_amount': ext.loan_amount,
            'loan_term_years': ext.loan_term_years,
            'loan_type': loan_type,
        }
    
    # Get required documents based on loan type
    loan_docs_info = get_documents_for_loan_type(loan_type)
    required_documents = loan_docs_info.get('documents', [])
    
    print(f"\n📧 GENERATING EMAIL for conversation {conversation_id}")
    print(f"   Client: {client_name}")
    print(f"   Loan Type: {loan_type}")
    print(f"   Loan Amount: {mortgage_data.get('loan_amount')}")
    print(f"   Required Documents: {len(required_documents)} items")
    
    # Get action items
    action_items = [
        {'description': a.description, 'assignee': a.assignee, 'category': a.category}
        for a in conversation.action_items
    ]
    
    # Generate email with loan details and document requirements
    email = await email_generator_service.generate_follow_up_email(
        client_name=client_name,
        transcript=conversation.raw_transcript or "",
        mortgage_data=mortgage_data,
        action_items=action_items,
        required_documents=required_documents
    )
    
    print(f"   ✓ Email generated successfully")
    
    return email


@router.post("/conversations/{conversation_id}/send-email")
async def send_follow_up_email(
    conversation_id: int,
    email_data: Dict[str, str],
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Send a follow-up email to the client and broker.
    
    Args:
        conversation_id: The conversation ID
        email_data: Dictionary with 'subject' and 'body' keys
    """
    from app.services.email import email_service
    
    # Get conversation with client info
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.client))
        .where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    subject = email_data.get('subject')
    body = email_data.get('body')
    broker_email = email_data.get('broker_email')
    
    if not subject or not body:
        raise HTTPException(status_code=400, detail="Subject and body are required")
    
    # Collect recipient emails
    recipients = []
    
    # Add client email if available
    if conversation.client and conversation.client.email:
        recipients.append(conversation.client.email)
    
    # Add broker email if provided
    if broker_email:
        recipients.append(broker_email)
    
    if not recipients:
        raise HTTPException(status_code=400, detail="No recipient email addresses available")
    
    client_name = conversation.client.name if conversation.client else "Client"
    
    print(f"\n📧 SENDING FOLLOW-UP EMAIL for conversation {conversation_id}")
    print(f"   Recipients: {recipients}")
    print(f"   Subject: {subject}")
    
    # Send email
    result = await email_service.send_follow_up_email(
        to_emails=recipients,
        subject=subject,
        body=body
    )
    
    if result['success']:
        print(f"   ✓ Email sent successfully to {result['sent_to']}")
    else:
        print(f"   ✗ Some emails failed: {result['failed']}")
    
    return {
        "message": "Email sent" if result['success'] else "Some emails failed",
        "sent_to": result['sent_to'],
        "failed": result['failed'],
        "client_name": client_name
    }


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

