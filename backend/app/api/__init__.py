from fastapi import APIRouter
from app.api import clients, conversations, extractions, documents, processing

api_router = APIRouter()

api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(conversations.router, prefix="/conversations", tags=["conversations"])
api_router.include_router(extractions.router, prefix="/extractions", tags=["extractions"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(processing.router, prefix="/processing", tags=["processing"])

