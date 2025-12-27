from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.extraction import MortgageExtraction, ActionItem
from app.models.conversation import Conversation
from app.models.document import DocumentChecklist, DocumentItem
from app.schemas.extraction import (
    MortgageExtractionResponse,
    MortgageExtractionUpdate,
    ActionItemResponse,
    ActionItemUpdate,
)

router = APIRouter()


# Mortgage Extractions
@router.get("/mortgage", response_model=List[MortgageExtractionResponse])
async def list_mortgage_extractions(
    conversation_id: Optional[int] = None,
    verified_only: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """List mortgage extractions with optional filtering."""
    query = select(MortgageExtraction)
    
    if conversation_id:
        query = query.where(MortgageExtraction.conversation_id == conversation_id)
    if verified_only:
        query = query.where(MortgageExtraction.is_verified == 1)
    
    query = query.offset(skip).limit(limit).order_by(MortgageExtraction.created_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/mortgage/{extraction_id}", response_model=MortgageExtractionResponse)
async def get_mortgage_extraction(
    extraction_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific mortgage extraction."""
    result = await db.execute(
        select(MortgageExtraction).where(MortgageExtraction.id == extraction_id)
    )
    extraction = result.scalar_one_or_none()
    
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")
    
    return extraction


@router.patch("/mortgage/{extraction_id}", response_model=MortgageExtractionResponse)
async def update_mortgage_extraction(
    extraction_id: int,
    extraction_data: MortgageExtractionUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update/verify a mortgage extraction. If loan_type changes, update document checklist."""
    from app.api.documents import LOAN_TYPE_DOCUMENTS
    
    result = await db.execute(
        select(MortgageExtraction).where(MortgageExtraction.id == extraction_id)
    )
    extraction = result.scalar_one_or_none()
    
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")
    
    update_data = extraction_data.model_dump(exclude_unset=True)
    old_loan_type = extraction.loan_type
    new_loan_type = update_data.get('loan_type')
    
    # Track verification
    if update_data.get('is_verified') == 1:
        update_data['verified_at'] = datetime.now()
    
    for field, value in update_data.items():
        setattr(extraction, field, value)
    
    await db.commit()
    await db.refresh(extraction)
    
    # If loan type changed, update the document checklist
    if new_loan_type and new_loan_type != old_loan_type:
        print(f"\n📋 Loan type changed from '{old_loan_type}' to '{new_loan_type}'")
        
        # Get the conversation to find client_id
        conv_result = await db.execute(
            select(Conversation).where(Conversation.id == extraction.conversation_id)
        )
        conversation = conv_result.scalar_one_or_none()
        
        if conversation and conversation.client_id:
            # Find existing checklist for this conversation
            checklist_result = await db.execute(
                select(DocumentChecklist)
                .options(selectinload(DocumentChecklist.items))
                .where(
                    DocumentChecklist.client_id == conversation.client_id,
                    DocumentChecklist.conversation_id == conversation.id
                )
            )
            existing_checklist = checklist_result.scalar_one_or_none()
            
            if existing_checklist:
                # Delete old items
                for item in existing_checklist.items:
                    await db.delete(item)
                
                # Update checklist loan type and title
                loan_type_display = new_loan_type.upper() if new_loan_type in ['fha', 'va'] else new_loan_type.capitalize()
                existing_checklist.loan_type = new_loan_type
                existing_checklist.title = f"{loan_type_display} Loan - Required Documents"
                
                # Add new items based on new loan type
                loan_type_key = new_loan_type.lower()
                default_docs = LOAN_TYPE_DOCUMENTS.get(loan_type_key, LOAN_TYPE_DOCUMENTS.get('conventional', []))
                
                for doc in default_docs:
                    item = DocumentItem(
                        checklist_id=existing_checklist.id,
                        name=doc.get('name', ''),
                        description=doc.get('description', ''),
                        category=doc.get('category', 'other'),
                        is_required=1,
                        status='pending'
                    )
                    db.add(item)
                
                await db.commit()
                print(f"   ✓ Updated document checklist with {len(default_docs)} items for {new_loan_type}")
            else:
                # Create new checklist
                loan_type_key = new_loan_type.lower()
                loan_type_display = new_loan_type.upper() if new_loan_type in ['fha', 'va'] else new_loan_type.capitalize()
                default_docs = LOAN_TYPE_DOCUMENTS.get(loan_type_key, LOAN_TYPE_DOCUMENTS.get('conventional', []))
                
                checklist = DocumentChecklist(
                    client_id=conversation.client_id,
                    conversation_id=conversation.id,
                    loan_type=new_loan_type,
                    title=f"{loan_type_display} Loan - Required Documents"
                )
                db.add(checklist)
                await db.flush()
                
                for doc in default_docs:
                    item = DocumentItem(
                        checklist_id=checklist.id,
                        name=doc.get('name', ''),
                        description=doc.get('description', ''),
                        category=doc.get('category', 'other'),
                        is_required=1,
                        status='pending'
                    )
                    db.add(item)
                
                await db.commit()
                print(f"   ✓ Created new document checklist with {len(default_docs)} items for {new_loan_type}")
    
    return extraction


# Action Items
@router.get("/actions", response_model=List[ActionItemResponse])
async def list_action_items(
    conversation_id: Optional[int] = None,
    assignee: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """List action items with optional filtering."""
    query = select(ActionItem)
    
    if conversation_id:
        query = query.where(ActionItem.conversation_id == conversation_id)
    if assignee:
        query = query.where(ActionItem.assignee == assignee)
    if status:
        query = query.where(ActionItem.status == status)
    
    query = query.offset(skip).limit(limit).order_by(ActionItem.created_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/actions/{action_id}", response_model=ActionItemResponse)
async def get_action_item(
    action_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific action item."""
    result = await db.execute(
        select(ActionItem).where(ActionItem.id == action_id)
    )
    action = result.scalar_one_or_none()
    
    if not action:
        raise HTTPException(status_code=404, detail="Action item not found")
    
    return action


@router.patch("/actions/{action_id}", response_model=ActionItemResponse)
async def update_action_item(
    action_id: int,
    action_data: ActionItemUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update an action item."""
    result = await db.execute(
        select(ActionItem).where(ActionItem.id == action_id)
    )
    action = result.scalar_one_or_none()
    
    if not action:
        raise HTTPException(status_code=404, detail="Action item not found")
    
    update_data = action_data.model_dump(exclude_unset=True)
    
    # Track completion
    if update_data.get('status') == 'completed' and action.status != 'completed':
        update_data['completed_at'] = datetime.now()
    
    for field, value in update_data.items():
        setattr(action, field, value)
    
    await db.commit()
    await db.refresh(action)
    return action


@router.delete("/actions/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action_item(
    action_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete an action item."""
    result = await db.execute(
        select(ActionItem).where(ActionItem.id == action_id)
    )
    action = result.scalar_one_or_none()
    
    if not action:
        raise HTTPException(status_code=404, detail="Action item not found")
    
    await db.delete(action)
    await db.commit()

