import asyncio
from typing import Dict, Any, Optional, List
import google.generativeai as genai
from app.config import get_settings

settings = get_settings()


# Default email template - can be customized by Zach
DEFAULT_FOLLOW_UP_TEMPLATE = """
Dear {client_name},

Thank you for taking the time to speak with me today about your mortgage needs. I wanted to follow up on our conversation and provide you with a summary of what we discussed.

{conversation_summary}

{action_items_section}

{next_steps}

Please don't hesitate to reach out if you have any questions or need any clarification. I'm here to help make this process as smooth as possible for you.

Best regards,
Zach
Mortgage Broker
"""


class EmailGeneratorService:
    """Service for generating personalized follow-up emails."""
    
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
        else:
            raise ValueError("Gemini API key not configured")
    
    async def generate_follow_up_email(
        self,
        client_name: str,
        transcript: str,
        mortgage_data: Dict[str, Any],
        action_items: List[Dict[str, Any]],
        template: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Generate a personalized follow-up email based on conversation.
        
        Args:
            client_name: Client's name
            transcript: Conversation transcript
            mortgage_data: Extracted mortgage entities
            action_items: Extracted action items
            template: Optional custom email template
        
        Returns:
            Dictionary with 'subject' and 'body' keys
        """
        await self.initialize()
        
        # Format action items for the prompt
        action_items_text = "\n".join([
            f"- {item.get('description', '')} (Assignee: {item.get('assignee', 'TBD')})"
            for item in action_items
        ])
        
        # Format mortgage data
        mortgage_summary = []
        if mortgage_data.get('loan_amount'):
            mortgage_summary.append(f"Loan Amount: ${mortgage_data['loan_amount']:,.0f}")
        if mortgage_data.get('loan_type'):
            mortgage_summary.append(f"Loan Type: {mortgage_data['loan_type']}")
        if mortgage_data.get('interest_rate'):
            mortgage_summary.append(f"Interest Rate: {mortgage_data['interest_rate']}%")
        if mortgage_data.get('property_type'):
            mortgage_summary.append(f"Property Type: {mortgage_data['property_type']}")
        
        mortgage_text = "\n".join(mortgage_summary) if mortgage_summary else "To be determined based on your application"
        
        prompt = f"""Generate a professional, warm, and personalized follow-up email for a mortgage broker to send to a client after their initial consultation.

CLIENT NAME: {client_name}

CONVERSATION TRANSCRIPT (for context):
{transcript[:2000]}  # Limit transcript length

MORTGAGE DETAILS DISCUSSED:
{mortgage_text}

ACTION ITEMS:
{action_items_text or "No specific action items identified"}

Generate an email that:
1. Thanks the client for their time
2. Summarizes key points from the discussion
3. Lists any documents or information needed from the client
4. Outlines next steps
5. Maintains a professional but friendly tone
6. Is concise but comprehensive

Respond with a JSON object containing:
- "subject": Email subject line
- "body": Full email body (no salutation needed, start with the greeting)

Example format:
{{"subject": "Following Up on Your Mortgage Consultation", "body": "Dear John,\\n\\nThank you for..."}}
"""
        
        def _generate():
            response = self.model.generate_content(prompt)
            return response.text
        
        loop = asyncio.get_event_loop()
        response_text = await loop.run_in_executor(None, _generate)
        
        # Parse the JSON response
        try:
            import json
            cleaned = response_text.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned.split('\n', 1)[1]
                cleaned = cleaned.rsplit('```', 1)[0]
            
            result = json.loads(cleaned)
        except Exception:
            # Fallback to basic template if AI fails
            result = {
                "subject": f"Following Up on Our Mortgage Conversation - {client_name}",
                "body": DEFAULT_FOLLOW_UP_TEMPLATE.format(
                    client_name=client_name,
                    conversation_summary=mortgage_text,
                    action_items_section=action_items_text or "We'll discuss next steps soon.",
                    next_steps="I'll be in touch shortly with more information."
                )
            }
        
        return result
    
    async def generate_document_request_email(
        self,
        client_name: str,
        required_documents: List[Dict[str, str]],
        loan_type: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Generate an email requesting specific documents from the client.
        
        Args:
            client_name: Client's name
            required_documents: List of documents needed with descriptions
            loan_type: Type of loan being applied for
        
        Returns:
            Dictionary with 'subject' and 'body' keys
        """
        await self.initialize()
        
        docs_list = "\n".join([
            f"- {doc.get('name', 'Document')}: {doc.get('description', '')}"
            for doc in required_documents
        ])
        
        prompt = f"""Generate a professional email requesting documents for a mortgage application.

CLIENT NAME: {client_name}
LOAN TYPE: {loan_type or 'Mortgage'}

DOCUMENTS NEEDED:
{docs_list}

The email should:
1. Be friendly but professional
2. Clearly list all required documents
3. Explain briefly why each document type is needed
4. Provide a reasonable timeline
5. Offer to answer any questions

Respond with a JSON object:
{{"subject": "...", "body": "..."}}
"""
        
        def _generate():
            response = self.model.generate_content(prompt)
            return response.text
        
        loop = asyncio.get_event_loop()
        response_text = await loop.run_in_executor(None, _generate)
        
        try:
            import json
            cleaned = response_text.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned.split('\n', 1)[1]
                cleaned = cleaned.rsplit('```', 1)[0]
            
            result = json.loads(cleaned)
        except Exception:
            result = {
                "subject": f"Documents Needed for Your {loan_type or 'Mortgage'} Application",
                "body": f"Dear {client_name},\n\nTo proceed with your mortgage application, we'll need the following documents:\n\n{docs_list}\n\nPlease let me know if you have any questions.\n\nBest regards,\nZach"
            }
        
        return result


# Singleton instance
email_generator_service = EmailGeneratorService()

