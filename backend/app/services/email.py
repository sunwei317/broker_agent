import asyncio
from typing import Optional
import httpx
from app.config import get_settings

settings = get_settings()


class EmailService:
    """
    Email service for sending verification and notification emails.
    Uses Resend API for email delivery.
    """
    
    def __init__(self):
        self.api_url = "https://api.resend.com/emails"
        self.api_key = settings.resend_api_key
        self.from_email = settings.email_from
        self.base_url = settings.frontend_url
    
    async def _send_email(
        self, 
        to_email: str, 
        subject: str, 
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send email using Resend API."""
        payload = {
            "from": f"Broker Agent <{self.from_email}>",
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }
        
        if text_content:
            payload["text"] = text_content
        
        try:
            print(f"📧 Attempting to send email to {to_email}...")
            print(f"   From: {self.from_email}")
            print(f"   Subject: {subject}")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.api_url,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    timeout=30.0
                )
                
                print(f"   Response status: {response.status_code}")
                print(f"   Response body: {response.text}")
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"✓ Email sent successfully to {to_email} (ID: {result.get('id')})")
                    return True
                else:
                    error = response.json()
                    print(f"✗ Failed to send email: {error}")
                    return False
                    
        except Exception as e:
            print(f"✗ Email sending error: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    async def send_verification_email(
        self,
        to_email: str,
        verification_token: str,
        user_name: Optional[str] = None
    ) -> bool:
        """Send email verification link to user."""
        verification_url = f"{self.base_url}/verify-email?token={verification_token}"
        
        subject = "Verify your Broker Agent account"
        
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a1929; margin: 0; padding: 40px 20px;">
    <div style="max-width: 480px; margin: 0 auto; background: linear-gradient(135deg, #102a43 0%, #1a365d 100%); border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 60px; height: 60px; background: linear-gradient(135deg, #fbbf24, #d97706); border-radius: 12px; line-height: 60px; font-size: 28px;">
                🎙️
            </div>
            <h1 style="color: #ffffff; font-size: 24px; margin: 16px 0 8px;">Broker Agent</h1>
        </div>
        
        <h2 style="color: #ffffff; font-size: 20px; margin-bottom: 16px;">
            Hello {user_name or 'there'}! 👋
        </h2>
        
        <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            Thank you for signing up for Broker Agent! Please verify your email address by clicking the button below.
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
            <a href="{verification_url}" style="display: inline-block; background: linear-gradient(135deg, #fbbf24, #d97706); color: #0a1929; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Verify Email Address
            </a>
        </div>
        
        <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
            Or copy and paste this link into your browser:<br>
            <a href="{verification_url}" style="color: #fbbf24; word-break: break-all;">{verification_url}</a>
        </p>
        
        <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 32px 0;">
        
        <p style="color: #64748b; font-size: 12px; text-align: center;">
            This link will expire in 24 hours.<br>
            If you didn't create an account, you can safely ignore this email.
        </p>
    </div>
</body>
</html>
"""
        
        text_content = f"""
Hello {user_name or 'there'},

Thank you for signing up for Broker Agent!

Please verify your email address by clicking the link below:

{verification_url}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

Best regards,
The Broker Agent Team
"""
        
        return await self._send_email(to_email, subject, html_content, text_content)
    
    async def send_welcome_email(
        self,
        to_email: str,
        user_name: Optional[str] = None
    ) -> bool:
        """Send welcome email after successful verification."""
        subject = "Welcome to Broker Agent! 🎉"
        
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a1929; margin: 0; padding: 40px 20px;">
    <div style="max-width: 480px; margin: 0 auto; background: linear-gradient(135deg, #102a43 0%, #1a365d 100%); border-radius: 16px; padding: 40px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 60px; height: 60px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 12px; line-height: 60px; font-size: 28px;">
                ✓
            </div>
            <h1 style="color: #ffffff; font-size: 24px; margin: 16px 0 8px;">You're all set!</h1>
        </div>
        
        <h2 style="color: #ffffff; font-size: 20px; margin-bottom: 16px;">
            Welcome aboard, {user_name or 'there'}! 🎉
        </h2>
        
        <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            Your email has been verified and your account is now active. You can now start using Broker Agent to manage your mortgage conversations.
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
            <a href="{self.base_url}/login" style="display: inline-block; background: linear-gradient(135deg, #fbbf24, #d97706); color: #0a1929; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Log In to Your Account
            </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 32px 0;">
        
        <p style="color: #64748b; font-size: 12px; text-align: center;">
            Questions? Just reply to this email.<br>
            The Broker Agent Team
        </p>
    </div>
</body>
</html>
"""
        
        text_content = f"""
Welcome aboard, {user_name or 'there'}!

Your email has been verified and your account is now active!

You can now log in and start using Broker Agent to manage your mortgage conversations.

Get started: {self.base_url}/login

Best regards,
The Broker Agent Team
"""
        
        return await self._send_email(to_email, subject, html_content, text_content)


    async def send_follow_up_email(
        self,
        to_emails: list[str],
        subject: str,
        body: str,
        sender_name: str = "Broker Agent"
    ) -> dict:
        """
        Send follow-up email to client and broker.
        
        Args:
            to_emails: List of recipient emails (client and broker)
            subject: Email subject
            body: Email body (plain text, will be converted to HTML)
            sender_name: Name to display in the from field
        
        Returns:
            Dictionary with success status and details
        """
        # Convert plain text body to HTML
        import re
        
        # Convert **bold** to <strong>bold</strong>
        html_body = re.sub(r'\*\*(.+?)\*\*', r'<strong style="color: #0f172a;">\1</strong>', body)
        
        # Convert newlines to <br>
        html_body = html_body.replace('\n', '<br>\n')
        
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="color: #1e293b; font-size: 16px; line-height: 1.8;">
            {html_body}
        </div>
    </div>
</body>
</html>
"""
        
        results = {
            'success': True,
            'sent_to': [],
            'failed': [],
            'errors': []
        }
        
        for email in to_emails:
            if not email:
                continue
            try:
                print(f"📧 Sending follow-up email to {email}...")
                success = await self._send_email(email, subject, html_content, body)
                if success:
                    results['sent_to'].append(email)
                else:
                    results['failed'].append(email)
                    results['success'] = False
            except Exception as e:
                print(f"✗ Failed to send to {email}: {str(e)}")
                results['failed'].append(email)
                results['errors'].append(str(e))
                results['success'] = False
        
        return results


# Singleton instance
email_service = EmailService()
