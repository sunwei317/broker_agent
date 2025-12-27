from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.document import DocumentChecklist, DocumentItem
from app.schemas.document import (
    DocumentChecklistCreate,
    DocumentChecklistResponse,
    DocumentItemCreate,
    DocumentItemUpdate,
    DocumentItemResponse,
)

router = APIRouter()


# Default document requirements by loan type
LOAN_TYPE_DOCUMENTS = {
    "conventional": [
        {"name": "Government-issued ID", "category": "identity", "description": "Driver's license or passport"},
        {"name": "Pay stubs (last 30 days)", "category": "income", "description": "Most recent pay stubs"},
        {"name": "W-2s (last 2 years)", "category": "income", "description": "W-2 forms from employers"},
        {"name": "Tax returns (last 2 years)", "category": "income", "description": "Complete federal tax returns"},
        {"name": "Bank statements (last 2 months)", "category": "assets", "description": "All pages of statements"},
        {"name": "Employment verification", "category": "income", "description": "Letter from employer"},
    ],
    "fha": [
        {"name": "Government-issued ID", "category": "identity", "description": "Driver's license or passport"},
        {"name": "Social Security card", "category": "identity", "description": "Original or certified copy"},
        {"name": "Pay stubs (last 30 days)", "category": "income", "description": "Most recent pay stubs"},
        {"name": "W-2s (last 2 years)", "category": "income", "description": "W-2 forms from employers"},
        {"name": "Tax returns (last 2 years)", "category": "income", "description": "Complete federal tax returns"},
        {"name": "Bank statements (last 2 months)", "category": "assets", "description": "All pages of statements"},
        {"name": "Gift letter (if applicable)", "category": "assets", "description": "For down payment gifts"},
    ],
    "va": [
        {"name": "Certificate of Eligibility (COE)", "category": "va", "description": "VA eligibility certificate"},
        {"name": "DD-214", "category": "va", "description": "Military discharge papers"},
        {"name": "Government-issued ID", "category": "identity", "description": "Driver's license or passport"},
        {"name": "Pay stubs (last 30 days)", "category": "income", "description": "Most recent pay stubs"},
        {"name": "W-2s (last 2 years)", "category": "income", "description": "W-2 forms from employers"},
        {"name": "Tax returns (last 2 years)", "category": "income", "description": "Complete federal tax returns"},
        {"name": "Bank statements (last 2 months)", "category": "assets", "description": "All pages of statements"},
    ],
    "jumbo": [
        {"name": "Government-issued ID", "category": "identity", "description": "Driver's license or passport"},
        {"name": "Pay stubs (last 30 days)", "category": "income", "description": "Most recent pay stubs"},
        {"name": "W-2s (last 2 years)", "category": "income", "description": "W-2 forms from employers"},
        {"name": "Tax returns (last 2 years)", "category": "income", "description": "Complete federal tax returns with all schedules"},
        {"name": "Bank statements (last 3 months)", "category": "assets", "description": "All pages of statements"},
        {"name": "Investment account statements", "category": "assets", "description": "Brokerage, 401k, IRA statements"},
        {"name": "Asset documentation", "category": "assets", "description": "Proof of additional assets"},
    ],
}


@router.post("/checklists", response_model=DocumentChecklistResponse, status_code=status.HTTP_201_CREATED)
async def create_checklist(
    checklist_data: DocumentChecklistCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new document checklist for a client."""
    # Create the checklist
    checklist = DocumentChecklist(
        client_id=checklist_data.client_id,
        conversation_id=checklist_data.conversation_id,
        loan_type=checklist_data.loan_type,
        title=checklist_data.title or f"{checklist_data.loan_type or 'Mortgage'} Application Checklist",
        notes=checklist_data.notes,
    )
    db.add(checklist)
    await db.commit()
    
    # Add default documents based on loan type if no items provided
    items = checklist_data.items
    if not items and checklist_data.loan_type:
        loan_type_key = checklist_data.loan_type.lower()
        default_docs = LOAN_TYPE_DOCUMENTS.get(loan_type_key, LOAN_TYPE_DOCUMENTS["conventional"])
        items = [DocumentItemCreate(**doc) for doc in default_docs]
    
    # Create document items
    if items:
        for item_data in items:
            item = DocumentItem(
                checklist_id=checklist.id,
                **item_data.model_dump()
            )
            db.add(item)
    
    await db.commit()
    await db.refresh(checklist)
    
    # Reload with items
    result = await db.execute(
        select(DocumentChecklist)
        .options(selectinload(DocumentChecklist.items))
        .where(DocumentChecklist.id == checklist.id)
    )
    return result.scalar_one()


@router.get("/checklists", response_model=List[DocumentChecklistResponse])
async def list_checklists(
    client_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """List document checklists."""
    query = select(DocumentChecklist).options(selectinload(DocumentChecklist.items))
    
    if client_id:
        query = query.where(DocumentChecklist.client_id == client_id)
    
    query = query.offset(skip).limit(limit).order_by(DocumentChecklist.created_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/checklists/{checklist_id}", response_model=DocumentChecklistResponse)
async def get_checklist(
    checklist_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific document checklist."""
    result = await db.execute(
        select(DocumentChecklist)
        .options(selectinload(DocumentChecklist.items))
        .where(DocumentChecklist.id == checklist_id)
    )
    checklist = result.scalar_one_or_none()
    
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")
    
    return checklist


@router.post("/checklists/{checklist_id}/items", response_model=DocumentItemResponse, status_code=status.HTTP_201_CREATED)
async def add_checklist_item(
    checklist_id: int,
    item_data: DocumentItemCreate,
    db: AsyncSession = Depends(get_db)
):
    """Add a new item to a checklist."""
    # Verify checklist exists
    result = await db.execute(
        select(DocumentChecklist).where(DocumentChecklist.id == checklist_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Checklist not found")
    
    item = DocumentItem(
        checklist_id=checklist_id,
        **item_data.model_dump()
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    
    return item


@router.patch("/items/{item_id}", response_model=DocumentItemResponse)
async def update_item(
    item_id: int,
    item_data: DocumentItemUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a document item status."""
    result = await db.execute(
        select(DocumentItem).where(DocumentItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    update_data = item_data.model_dump(exclude_unset=True)
    
    # Track when document is received
    if update_data.get('status') == 'received' and item.status == 'pending':
        item.received_at = datetime.now()
    
    for field, value in update_data.items():
        setattr(item, field, value)
    
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a document item."""
    result = await db.execute(
        select(DocumentItem).where(DocumentItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    await db.delete(item)
    await db.commit()


@router.delete("/checklists/{checklist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_checklist(
    checklist_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete an entire document checklist and all its items."""
    result = await db.execute(
        select(DocumentChecklist).where(DocumentChecklist.id == checklist_id)
    )
    checklist = result.scalar_one_or_none()
    
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")
    
    await db.delete(checklist)
    await db.commit()


@router.get("/loan-types")
async def get_loan_type_documents():
    """Get default document requirements by loan type."""
    return LOAN_TYPE_DOCUMENTS

