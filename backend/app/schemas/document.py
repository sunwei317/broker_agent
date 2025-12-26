from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class DocumentItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    is_required: int = 1


class DocumentItemCreate(DocumentItemBase):
    pass


class DocumentItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_required: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class DocumentItemResponse(DocumentItemBase):
    id: int
    checklist_id: int
    status: str = "pending"
    received_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class DocumentChecklistBase(BaseModel):
    loan_type: Optional[str] = None
    title: Optional[str] = None
    notes: Optional[str] = None


class DocumentChecklistCreate(DocumentChecklistBase):
    client_id: int
    conversation_id: Optional[int] = None
    items: Optional[List[DocumentItemCreate]] = None


class DocumentChecklistResponse(DocumentChecklistBase):
    id: int
    client_id: int
    conversation_id: Optional[int] = None
    items: List[DocumentItemResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

