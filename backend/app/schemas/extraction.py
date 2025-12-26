from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class MortgageExtractionResponse(BaseModel):
    id: int
    conversation_id: int
    
    # Loan Details
    loan_amount: Optional[float] = None
    interest_rate: Optional[float] = None
    loan_term_years: Optional[int] = None
    loan_type: Optional[str] = None
    
    # Property Details
    property_type: Optional[str] = None
    property_address: Optional[str] = None
    purchase_price: Optional[float] = None
    down_payment: Optional[float] = None
    down_payment_percentage: Optional[float] = None
    
    # Borrower Details
    borrower_income: Optional[float] = None
    borrower_employment: Optional[str] = None
    credit_score_range: Optional[str] = None
    
    additional_data: Optional[Dict[str, Any]] = None
    
    is_verified: int = 0
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    corrections: Optional[Dict[str, Any]] = None
    extraction_confidence: Optional[float] = None
    
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class MortgageExtractionUpdate(BaseModel):
    loan_amount: Optional[float] = None
    interest_rate: Optional[float] = None
    loan_term_years: Optional[int] = None
    loan_type: Optional[str] = None
    property_type: Optional[str] = None
    property_address: Optional[str] = None
    purchase_price: Optional[float] = None
    down_payment: Optional[float] = None
    down_payment_percentage: Optional[float] = None
    borrower_income: Optional[float] = None
    borrower_employment: Optional[str] = None
    credit_score_range: Optional[str] = None
    additional_data: Optional[Dict[str, Any]] = None
    is_verified: Optional[int] = None
    verified_by: Optional[str] = None
    corrections: Optional[Dict[str, Any]] = None


class ActionItemResponse(BaseModel):
    id: int
    conversation_id: int
    description: str
    category: Optional[str] = None
    assignee: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[str] = None
    status: str = "pending"
    completed_at: Optional[datetime] = None
    is_verified: int = 0
    verified_text: Optional[str] = None
    source_segment_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ActionItemUpdate(BaseModel):
    description: Optional[str] = None
    category: Optional[str] = None
    assignee: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    is_verified: Optional[int] = None
    verified_text: Optional[str] = None

