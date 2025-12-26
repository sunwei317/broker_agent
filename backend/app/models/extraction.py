from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class MortgageExtraction(Base):
    __tablename__ = "mortgage_extractions"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    
    # Loan Details
    loan_amount = Column(Float)
    interest_rate = Column(Float)
    loan_term_years = Column(Integer)
    loan_type = Column(String(100))  # conventional, FHA, VA, jumbo, etc.
    
    # Property Details
    property_type = Column(String(100))  # single-family, condo, multi-family, etc.
    property_address = Column(Text)
    purchase_price = Column(Float)
    down_payment = Column(Float)
    down_payment_percentage = Column(Float)
    
    # Borrower Details
    borrower_income = Column(Float)
    borrower_employment = Column(String(255))
    credit_score_range = Column(String(50))
    
    # Additional extracted data as JSON
    additional_data = Column(JSON)
    
    # Verification
    is_verified = Column(Integer, default=0)
    verified_by = Column(String(100))
    verified_at = Column(DateTime(timezone=True))
    corrections = Column(JSON)  # Store any corrections made
    
    # Confidence scores
    extraction_confidence = Column(Float)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    conversation = relationship("Conversation", back_populates="extractions")
    
    def __repr__(self):
        return f"<MortgageExtraction {self.id} - ${self.loan_amount}>"


class ActionItem(Base):
    __tablename__ = "action_items"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    
    # Action item details
    description = Column(Text, nullable=False)
    category = Column(String(100))  # document_request, follow_up, commitment, etc.
    assignee = Column(String(100))  # "zach" or "client"
    due_date = Column(DateTime(timezone=True))
    priority = Column(String(20))  # high, medium, low
    
    # Status tracking
    status = Column(String(50), default="pending")  # pending, in_progress, completed
    completed_at = Column(DateTime(timezone=True))
    
    # Verification
    is_verified = Column(Integer, default=0)
    verified_text = Column(Text)
    
    # Source reference
    source_segment_id = Column(Integer, ForeignKey("transcript_segments.id"))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    conversation = relationship("Conversation", back_populates="action_items")
    
    def __repr__(self):
        return f"<ActionItem {self.id} - {self.description[:50]}...>"

