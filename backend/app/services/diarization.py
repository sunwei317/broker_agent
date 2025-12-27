import asyncio
import json
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from app.config import get_settings

settings = get_settings()


class DiarizationService:
    """
    Service for speaker diarization - separating User (broker) vs Client speech.
    Uses Gemini AI to identify speakers based on conversation context.
    """
    
    def __init__(self):
        self.model = None
        self._initialized = False
    
    async def initialize(self):
        """Initialize the Gemini AI model."""
        if self._initialized:
            return
        
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel(settings.gemini_model)
            self._initialized = True
    
    async def diarize_audio(
        self,
        audio_path: str,
        num_speakers: int = 2
    ) -> List[Dict[str, Any]]:
        """
        Perform speaker diarization on an audio file.
        For MVP, returns empty list - speaker identification is done via AI on transcript.
        """
        return []
    
    async def identify_speakers_from_transcript(
        self,
        segments: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Use Gemini AI to identify which segments are from the User (broker) vs Client.
        
        The User (broker) typically:
        - Asks about loan requirements, income, employment
        - Explains loan options, rates, terms
        - Provides professional advice
        - Uses mortgage terminology
        
        The Client typically:
        - Answers questions about their situation
        - Asks about rates, payments, process
        - Provides personal/financial information
        """
        await self.initialize()
        
        if not self.model or not segments:
            return [{**seg, 'speaker': 'unknown'} for seg in segments]
        
        # Prepare transcript for analysis
        transcript_text = "\n".join([
            f"[{i}]: {seg.get('text', '')}"
            for i, seg in enumerate(segments)
        ])
        
        prompt = f"""Analyze this mortgage conversation transcript and identify which segments are spoken by the User (mortgage broker) and which by the Client.

TRANSCRIPT (each line is numbered):
{transcript_text}

The User (broker) typically:
- Asks about loan requirements, income, credit, employment
- Explains loan options, interest rates, terms, processes
- Provides professional mortgage advice
- Uses industry terminology
- Guides the conversation

The Client typically:
- Answers questions about their personal/financial situation
- Asks about payments, rates, what they need to do
- Provides information about their income, property, needs
- Seeks clarification and advice

For each segment number, respond with either "user" or "client".
Respond ONLY with a valid JSON object mapping segment numbers to speakers.
Example: {{"0": "user", "1": "client", "2": "user", "3": "client"}}
"""
        
        try:
            def _generate():
                response = self.model.generate_content(prompt)
                return response.text
            
            loop = asyncio.get_event_loop()
            response_text = await loop.run_in_executor(None, _generate)
            
            # Parse the JSON response
            cleaned = response_text.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned.split('\n', 1)[1]
                cleaned = cleaned.rsplit('```', 1)[0]
            
            speaker_map = json.loads(cleaned)
            
            # Apply speaker labels to segments
            result = []
            for i, seg in enumerate(segments):
                speaker = speaker_map.get(str(i), 'unknown')
                result.append({**seg, 'speaker': speaker})
            
            return result
            
        except Exception as e:
            print(f"Speaker identification error: {e}")
            return [{**seg, 'speaker': 'unknown'} for seg in segments]
    
    async def merge_transcription_with_diarization(
        self,
        transcription_segments: List[Dict[str, Any]],
        diarization_segments: List[Dict[str, Any]],
        speaker_mapping: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Merge transcription segments with speaker identification.
        Uses AI to identify speakers if no diarization segments provided.
        """
        if not diarization_segments:
            # Use AI to identify speakers from transcript content
            return await self.identify_speakers_from_transcript(transcription_segments)
        
        # If we have diarization segments, merge them
        merged = []
        speaker_mapping = speaker_mapping or {}
        
        for trans_seg in transcription_segments:
            trans_start = trans_seg['start']
            trans_end = trans_seg['end']
            
            best_speaker = 'unknown'
            best_overlap = 0
            
            for diar_seg in diarization_segments:
                diar_start = diar_seg['start']
                diar_end = diar_seg['end']
                
                overlap_start = max(trans_start, diar_start)
                overlap_end = min(trans_end, diar_end)
                overlap = max(0, overlap_end - overlap_start)
                
                if overlap > best_overlap:
                    best_overlap = overlap
                    best_speaker = diar_seg['speaker']
            
            mapped_speaker = speaker_mapping.get(best_speaker, best_speaker)
            
            merged.append({
                **trans_seg,
                'speaker': mapped_speaker
            })
        
        return merged


# Singleton instance
diarization_service = DiarizationService()
