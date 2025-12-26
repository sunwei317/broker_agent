from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.extraction import MortgageExtraction, ActionItem
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
    """Update/verify a mortgage extraction."""
    result = await db.execute(
        select(MortgageExtraction).where(MortgageExtraction.id == extraction_id)
    )
    extraction = result.scalar_one_or_none()
    
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")
    
    update_data = extraction_data.model_dump(exclude_unset=True)
    
    # Track verification
    if update_data.get('is_verified') == 1:
        update_data['verified_at'] = datetime.now()
    
    for field, value in update_data.items():
        setattr(extraction, field, value)
    
    await db.commit()
    await db.refresh(extraction)
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

