import asyncio
import json
from typing import Dict, Any, List, Optional
import google.generativeai as genai
from app.config import get_settings

settings = get_settings()


class ExtractionService:
    """Service for extracting mortgage entities and action items using Gemini AI."""
    
    def __init__(self):
        self.model = None
        self._initialized = False
    
    async def initialize(self):
        """Initialize the Gemini AI model."""
        if self._initialized:
            return
        
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            self._initialized = True
        else:
            raise ValueError("Gemini API key not configured")
    
    async def extract_mortgage_entities(
        self,
        transcript: str
    ) -> Dict[str, Any]:
        """
        Extract mortgage-related entities from a conversation transcript.
        
        Args:
            transcript: The conversation transcript text
        
        Returns:
            Dictionary containing extracted mortgage information
        """
        await self.initialize()
        
        prompt = f"""Analyze this mortgage broker-client conversation transcript and extract all relevant mortgage information.

TRANSCRIPT:
{transcript}

Extract the following information if mentioned (return null if not found):

1. Loan Details:
   - loan_amount: Dollar amount being requested
   - interest_rate: Rate discussed
   - loan_term_years: Loan term (15, 20, 30 years)
   - loan_type: Type of loan (conventional, FHA, VA, USDA, jumbo, etc.)

2. Property Details:
   - property_type: Type of property (single-family, condo, townhouse, multi-family, etc.)
   - property_address: Full or partial address mentioned
   - purchase_price: Property price
   - down_payment: Down payment amount discussed
   - down_payment_percentage: Percentage of purchase price

3. Borrower Details:
   - borrower_income: Annual income mentioned
   - borrower_employment: Employment type or employer
   - credit_score_range: Credit score or range mentioned

4. Additional Information:
   - debt_to_income_ratio: If discussed
   - property_taxes: Estimated property taxes
   - insurance_estimate: Homeowner's insurance estimate
   - pmi_required: Whether PMI is needed
   - closing_cost_estimate: Estimated closing costs

Respond ONLY with a valid JSON object. Do not include markdown formatting or code blocks.
Example format:
{{"loan_amount": 450000, "interest_rate": 6.5, "loan_type": "conventional", ...}}
"""
        
        def _generate():
            response = self.model.generate_content(prompt)
            return response.text
        
        loop = asyncio.get_event_loop()
        response_text = await loop.run_in_executor(None, _generate)
        
        # Parse the JSON response
        try:
            # Clean up response if needed
            cleaned = response_text.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned.split('\n', 1)[1]
                cleaned = cleaned.rsplit('```', 1)[0]
            
            result = json.loads(cleaned)
        except json.JSONDecodeError:
            result = {"raw_response": response_text, "parse_error": True}
        
        return result
    
    async def extract_action_items(
        self,
        transcript: str
    ) -> List[Dict[str, Any]]:
        """
        Extract action items, commitments, and next steps from a conversation.
        
        Args:
            transcript: The conversation transcript text
        
        Returns:
            List of action items with details
        """
        await self.initialize()
        
        prompt = f"""Analyze this mortgage broker-client conversation and extract all action items, commitments, and next steps.

TRANSCRIPT:
{transcript}

For each action item, identify:
1. description: What needs to be done
2. category: One of [document_request, follow_up, commitment, information_needed, deadline, other]
3. assignee: Who is responsible - "broker" (Zach) or "client"
4. priority: "high", "medium", or "low"
5. context: Brief context from the conversation

Common document requests in mortgage include:
- Pay stubs, W-2s, tax returns
- Bank statements
- ID/driver's license
- Employment verification
- Gift letters
- Proof of assets

Respond ONLY with a valid JSON array. Do not include markdown formatting.
Example format:
[
  {{"description": "Provide last 2 years of tax returns", "category": "document_request", "assignee": "client", "priority": "high", "context": "Needed for income verification"}},
  {{"description": "Send rate lock options by Friday", "category": "commitment", "assignee": "broker", "priority": "high", "context": "Client wants to lock in current rate"}}
]
"""
        
        def _generate():
            response = self.model.generate_content(prompt)
            return response.text
        
        loop = asyncio.get_event_loop()
        response_text = await loop.run_in_executor(None, _generate)
        
        # Parse the JSON response
        try:
            cleaned = response_text.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned.split('\n', 1)[1]
                cleaned = cleaned.rsplit('```', 1)[0]
            
            result = json.loads(cleaned)
        except json.JSONDecodeError:
            result = [{"description": "Error parsing response", "raw_response": response_text}]
        
        return result
    
    async def process_transcript(
        self,
        transcript: str
    ) -> Dict[str, Any]:
        """
        Process a transcript to extract both mortgage entities and action items.
        
        Args:
            transcript: The conversation transcript text
        
        Returns:
            Dictionary containing mortgage_extraction and action_items
        """
        # Run both extractions in parallel
        entities_task = self.extract_mortgage_entities(transcript)
        actions_task = self.extract_action_items(transcript)
        
        entities, actions = await asyncio.gather(entities_task, actions_task)
        
        return {
            "mortgage_extraction": entities,
            "action_items": actions
        }


# Singleton instance
extraction_service = ExtractionService()

