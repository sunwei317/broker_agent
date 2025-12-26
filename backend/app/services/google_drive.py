import os
import asyncio
from typing import Optional, List, Dict, Any
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io
import aiofiles
from app.config import get_settings

settings = get_settings()


class GoogleDriveService:
    """Service for interacting with Google Drive API."""
    
    SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
    
    def __init__(self):
        self.credentials = None
        self.service = None
        self._initialized = False
    
    async def initialize(self):
        """Initialize Google Drive service with credentials."""
        if self._initialized:
            return
        
        credentials_path = settings.google_drive_credentials_path
        
        if os.path.exists(credentials_path):
            self.credentials = service_account.Credentials.from_service_account_file(
                credentials_path,
                scopes=self.SCOPES
            )
            self.service = build('drive', 'v3', credentials=self.credentials)
            self._initialized = True
        else:
            raise FileNotFoundError(f"Google Drive credentials not found at {credentials_path}")
    
    async def list_mp3_files(self, folder_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all MP3 files in a specific folder or the configured folder."""
        await self.initialize()
        
        folder_id = folder_id or settings.google_drive_folder_id
        
        query = f"'{folder_id}' in parents and mimeType='audio/mpeg' and trashed=false"
        
        def _list_files():
            results = self.service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name, createdTime, modifiedTime, size)',
                orderBy='modifiedTime desc'
            ).execute()
            return results.get('files', [])
        
        loop = asyncio.get_event_loop()
        files = await loop.run_in_executor(None, _list_files)
        
        return files
    
    async def download_file(self, file_id: str, destination_path: str) -> str:
        """Download a file from Google Drive."""
        await self.initialize()
        
        def _download():
            request = self.service.files().get_media(fileId=file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            
            done = False
            while not done:
                status, done = downloader.next_chunk()
            
            return fh.getvalue()
        
        loop = asyncio.get_event_loop()
        content = await loop.run_in_executor(None, _download)
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(destination_path), exist_ok=True)
        
        async with aiofiles.open(destination_path, 'wb') as f:
            await f.write(content)
        
        return destination_path
    
    async def get_file_metadata(self, file_id: str) -> Dict[str, Any]:
        """Get metadata for a specific file."""
        await self.initialize()
        
        def _get_metadata():
            return self.service.files().get(
                fileId=file_id,
                fields='id, name, createdTime, modifiedTime, size, mimeType'
            ).execute()
        
        loop = asyncio.get_event_loop()
        metadata = await loop.run_in_executor(None, _get_metadata)
        
        return metadata


# Singleton instance
google_drive_service = GoogleDriveService()

