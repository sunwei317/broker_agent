import os
import asyncio
from typing import Optional, Dict, Any, List
from openai import AsyncOpenAI
from app.config import get_settings

settings = get_settings()


class TranscriptionService:
    """Service for transcribing audio files using OpenAI Whisper API."""
    
    def __init__(self):
        self.client = None
        self._initialized = False
    
    async def initialize(self):
        """Initialize the OpenAI client."""
        if self._initialized:
            return
        
        if settings.openai_api_key:
            self.client = AsyncOpenAI(api_key=settings.openai_api_key)
            self._initialized = True
        else:
            raise ValueError("OpenAI API key not configured")
    
    async def transcribe_audio(
        self,
        audio_path: str,
        language: str = "en",
        response_format: str = "verbose_json"
    ) -> Dict[str, Any]:
        """
        Transcribe an audio file using OpenAI Whisper API.
        
        Args:
            audio_path: Path to the audio file
            language: Language code (default: English)
            response_format: Output format (verbose_json includes timestamps)
        
        Returns:
            Transcription result with text and segments
        """
        await self.initialize()
        
        with open(audio_path, "rb") as audio_file:
            transcription = await self.client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language=language,
                response_format=response_format,
                timestamp_granularities=["segment", "word"]
            )
        
        # Convert to dict if needed
        if hasattr(transcription, 'model_dump'):
            result = transcription.model_dump()
        else:
            result = {
                "text": transcription.text if hasattr(transcription, 'text') else str(transcription),
                "segments": getattr(transcription, 'segments', []),
                "words": getattr(transcription, 'words', []),
                "duration": getattr(transcription, 'duration', None)
            }
        
        return result
    
    async def transcribe_with_segments(
        self,
        audio_path: str,
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Transcribe audio and return structured segments.
        
        Returns:
            Dict containing:
                - text: Full transcription text
                - segments: List of {start, end, text} dicts
                - duration: Total audio duration
        """
        result = await self.transcribe_audio(
            audio_path,
            language=language,
            response_format="verbose_json"
        )
        
        segments = []
        for seg in result.get('segments', []):
            segments.append({
                'start': seg.get('start', 0),
                'end': seg.get('end', 0),
                'text': seg.get('text', '').strip(),
                'confidence': seg.get('avg_logprob', 0) if 'avg_logprob' in seg else None
            })
        
        return {
            'text': result.get('text', ''),
            'segments': segments,
            'duration': result.get('duration'),
            'language': result.get('language', language)
        }


# Singleton instance
transcription_service = TranscriptionService()

