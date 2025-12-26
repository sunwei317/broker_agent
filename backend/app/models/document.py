from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class DocumentChecklist(Base):
    __tablename__ = "document_checklists"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    
    loan_type = Column(String(100))
    title = Column(String(255))
    notes = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    client = relationship("Client", back_populates="document_checklists")
    items = relationship("DocumentItem", back_populates="checklist", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<DocumentChecklist {self.id} - {self.title}>"


class DocumentItem(Base):
    __tablename__ = "document_items"
    
    id = Column(Integer, primary_key=True, index=True)
    checklist_id = Column(Integer, ForeignKey("document_checklists.id"), nullable=False)
    
    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))  # income, assets, property, identity, etc.
    is_required = Column(Integer, default=1)
    
    # Status
    status = Column(String(50), default="pending")  # pending, received, reviewed, approved
    received_at = Column(DateTime(timezone=True))
    notes = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    checklist = relationship("DocumentChecklist", back_populates="items")
    
    def __repr__(self):
        return f"<DocumentItem {self.name}>"

