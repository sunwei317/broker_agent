import asyncio
from typing import Dict, Any, Optional, List
import google.generativeai as genai
from app.config import get_settings

settings = get_settings()


# Document requirements by loan type
LOAN_TYPE_DOCUMENTS = {
    'conventional': {
        'name': 'Conventional Loan',
        'documents': [
            {'name': 'Government-issued ID', 'description': "Driver's license, passport, or state ID", 'category': 'identity'},
            {'name': 'Social Security Card', 'description': 'For identity verification', 'category': 'identity'},
            {'name': 'Pay Stubs', 'description': 'Last 30 days of pay stubs from all employers', 'category': 'income'},
            {'name': 'W-2 Forms', 'description': 'W-2s from the past 2 years', 'category': 'income'},
            {'name': 'Tax Returns', 'description': 'Federal tax returns (all pages) for the past 2 years', 'category': 'income'},
            {'name': 'Bank Statements', 'description': 'Last 2-3 months of all bank account statements', 'category': 'assets'},
            {'name': 'Investment Account Statements', 'description': 'Recent statements for 401k, IRA, stocks, etc.', 'category': 'assets'},
            {'name': 'Proof of Down Payment', 'description': 'Documentation showing source of down payment funds', 'category': 'assets'},
            {'name': 'Employment Verification', 'description': 'Letter from employer or recent employment contract', 'category': 'income'},
            {'name': 'Credit Report Authorization', 'description': 'Signed authorization to pull credit report', 'category': 'credit'},
        ]
    },
    'fha': {
        'name': 'FHA Loan',
        'documents': [
            {'name': 'Government-issued ID', 'description': "Driver's license, passport, or state ID", 'category': 'identity'},
            {'name': 'Social Security Card', 'description': 'For identity verification', 'category': 'identity'},
            {'name': 'Pay Stubs', 'description': 'Last 30 days of pay stubs from all employers', 'category': 'income'},
            {'name': 'W-2 Forms', 'description': 'W-2s from the past 2 years', 'category': 'income'},
            {'name': 'Tax Returns', 'description': 'Federal tax returns (all pages) for the past 2 years', 'category': 'income'},
            {'name': 'Bank Statements', 'description': 'Last 2-3 months of all bank account statements', 'category': 'assets'},
            {'name': 'Proof of Down Payment', 'description': 'Minimum 3.5% down payment documentation', 'category': 'assets'},
            {'name': 'Gift Letter', 'description': 'If using gift funds for down payment, letter from donor', 'category': 'assets'},
            {'name': 'Employment Verification', 'description': 'Letter from employer confirming employment', 'category': 'income'},
            {'name': 'Credit Explanation Letter', 'description': 'If applicable, explanation for any credit issues', 'category': 'credit'},
            {'name': 'Residency History', 'description': 'Addresses for the past 2 years', 'category': 'identity'},
        ]
    },
    'va': {
        'name': 'VA Loan',
        'documents': [
            {'name': 'Certificate of Eligibility (COE)', 'description': 'VA Certificate of Eligibility', 'category': 'military'},
            {'name': 'DD-214', 'description': 'Military discharge papers (if applicable)', 'category': 'military'},
            {'name': 'Statement of Service', 'description': 'If currently active duty', 'category': 'military'},
            {'name': 'Government-issued ID', 'description': "Driver's license, passport, or state ID", 'category': 'identity'},
            {'name': 'Social Security Card', 'description': 'For identity verification', 'category': 'identity'},
            {'name': 'Pay Stubs', 'description': 'Last 30 days of pay stubs or LES (Leave and Earnings Statement)', 'category': 'income'},
            {'name': 'W-2 Forms', 'description': 'W-2s from the past 2 years', 'category': 'income'},
            {'name': 'Tax Returns', 'description': 'Federal tax returns for the past 2 years', 'category': 'income'},
            {'name': 'Bank Statements', 'description': 'Last 2-3 months of all bank account statements', 'category': 'assets'},
            {'name': 'VA Funding Fee', 'description': 'Information about funding fee exemption if applicable', 'category': 'military'},
        ]
    },
    'jumbo': {
        'name': 'Jumbo Loan',
        'documents': [
            {'name': 'Government-issued ID', 'description': "Driver's license, passport, or state ID", 'category': 'identity'},
            {'name': 'Social Security Card', 'description': 'For identity verification', 'category': 'identity'},
            {'name': 'Pay Stubs', 'description': 'Last 30-60 days of pay stubs from all employers', 'category': 'income'},
            {'name': 'W-2 Forms', 'description': 'W-2s from the past 2-3 years', 'category': 'income'},
            {'name': 'Tax Returns', 'description': 'Complete federal tax returns for the past 2-3 years', 'category': 'income'},
            {'name': 'Bank Statements', 'description': 'Last 3-6 months of all bank account statements', 'category': 'assets'},
            {'name': 'Investment Account Statements', 'description': 'Complete statements for all investment accounts', 'category': 'assets'},
            {'name': 'Additional Asset Documentation', 'description': 'Documentation for significant assets (real estate, businesses)', 'category': 'assets'},
            {'name': 'Proof of Reserves', 'description': '6-12 months of mortgage payment reserves required', 'category': 'assets'},
            {'name': 'Employment Verification', 'description': 'Detailed employment history and income verification', 'category': 'income'},
            {'name': 'Credit Report Authorization', 'description': 'Signed authorization for credit check', 'category': 'credit'},
            {'name': 'Business Tax Returns', 'description': 'If self-employed, business returns for 2-3 years', 'category': 'income'},
        ]
    }
}


def get_documents_for_loan_type(loan_type: str) -> Dict[str, Any]:
    """Get the required documents for a specific loan type."""
    loan_type_lower = (loan_type or 'conventional').lower()
    return LOAN_TYPE_DOCUMENTS.get(loan_type_lower, LOAN_TYPE_DOCUMENTS['conventional'])


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
        required_documents: Optional[List[Dict[str, str]]] = None,
        template: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Generate a personalized follow-up email based on conversation.
        
        Args:
            client_name: Client's name
            transcript: Conversation transcript
            mortgage_data: Extracted mortgage entities
            action_items: Extracted action items
            required_documents: List of required documents based on loan type
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
        loan_type = mortgage_data.get('loan_type', 'conventional')
        loan_type_display = loan_type.upper() if loan_type in ['fha', 'va'] else loan_type.capitalize()
        
        if mortgage_data.get('loan_amount'):
            mortgage_summary.append(f"Loan Amount: ${mortgage_data['loan_amount']:,.0f}")
        if loan_type:
            mortgage_summary.append(f"Loan Type: {loan_type_display}")
        if mortgage_data.get('loan_term_years'):
            mortgage_summary.append(f"Loan Term: {mortgage_data['loan_term_years']} years")
        if mortgage_data.get('interest_rate'):
            mortgage_summary.append(f"Interest Rate: {mortgage_data['interest_rate']}%")
        
        mortgage_text = "\n".join(mortgage_summary) if mortgage_summary else "To be determined based on your application"
        
        # Format required documents
        if required_documents:
            docs_by_category = {}
            for doc in required_documents:
                category = doc.get('category', 'other').capitalize()
                if category not in docs_by_category:
                    docs_by_category[category] = []
                docs_by_category[category].append(f"  • {doc['name']}: {doc.get('description', '')}")
            
            docs_text_parts = []
            for category, docs in docs_by_category.items():
                docs_text_parts.append(f"\n{category} Documents:")
                docs_text_parts.extend(docs)
            docs_text = "\n".join(docs_text_parts)
        else:
            docs_text = "Standard documentation will be required."
        
        prompt = f"""Generate a professional, warm, and personalized follow-up email for a mortgage broker to send to a client after their initial consultation.

CLIENT NAME: {client_name}

CONVERSATION TRANSCRIPT (for context):
{transcript[:2000]}

LOAN DETAILS DISCUSSED:
{mortgage_text}

REQUIRED DOCUMENTS FOR {loan_type_display} LOAN:
{docs_text}

ACTION ITEMS FROM CONVERSATION:
{action_items_text or "No specific action items identified"}

Generate an email that:
1. Thanks the client for their time
2. Summarizes the loan details discussed (amount, type, term)
3. Clearly lists ALL the required documents organized by category
4. Explains the next steps in the loan process
5. Maintains a professional but friendly tone
6. Is comprehensive but well-organized

The document list is CRITICAL - include every document from the list above in the email.

Respond with a JSON object containing:
- "subject": Email subject line (mention the loan type)
- "body": Full email body starting with "Dear {client_name},"

Example format:
{{"subject": "Your {loan_type_display} Loan Application - Next Steps & Required Documents", "body": "Dear {client_name},\\n\\nThank you for..."}}
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

