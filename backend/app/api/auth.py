from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    UserCreate,
    UserLogin,
    UserResponse,
    Token,
    VerifyEmail,
    ResendVerification,
    MessageResponse,
)
from app.services.auth import (
    get_password_hash,
    create_access_token,
    generate_verification_token,
    get_user_by_email,
    get_user_by_verification_token,
    authenticate_user,
    get_current_user,
    get_current_active_user,
)
from app.services.email import email_service

router = APIRouter()


@router.post("/signup", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user and send verification email."""
    print(f"🔔 Signup request received for: {user_data.email}")
    
    # Check if user already exists
    existing_user = await get_user_by_email(db, user_data.email)
    if existing_user:
        print(f"❌ User already exists: {user_data.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create verification token
    verification_token = generate_verification_token()
    token_expires = datetime.utcnow() + timedelta(hours=24)
    print(f"🔑 Generated verification token for: {user_data.email}")
    
    # Create user
    try:
        user = User(
            email=user_data.email,
            hashed_password=get_password_hash(user_data.password),
            full_name=user_data.full_name,
            verification_token=verification_token,
            verification_token_expires=token_expires,
            is_verified=False,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f"✅ User created in database: {user.email}")
    except Exception as e:
        print(f"❌ Error creating user: {str(e)}")
        raise
    
    # Send verification email
    print(f"📧 Sending verification email to: {user.email}")
    try:
        email_sent = await email_service.send_verification_email(
            to_email=user.email,
            verification_token=verification_token,
            user_name=user.full_name
        )
        print(f"📧 Email send result: {email_sent}")
    except Exception as e:
        print(f"❌ Error sending email: {str(e)}")
        import traceback
        traceback.print_exc()
    
    return {"message": "Registration successful. Please check your email to verify your account."}


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Login and get access token."""
    user = await authenticate_user(db, form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()
    
    # Create access token
    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login/json", response_model=Token)
async def login_json(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """Login with JSON body (alternative to form-based login)."""
    user = await authenticate_user(db, credentials.email, credentials.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()
    
    # Create access token
    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(
    data: VerifyEmail,
    db: AsyncSession = Depends(get_db)
):
    """Verify user's email with the token sent via email."""
    user = await get_user_by_verification_token(db, data.token)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )
    
    if user.is_verified:
        return {"message": "Email already verified"}
    
    # Check if token is expired
    if user.verification_token_expires and user.verification_token_expires < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired. Please request a new one."
        )
    
    # Verify the user
    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    await db.commit()
    
    # Send welcome email
    await email_service.send_welcome_email(
        to_email=user.email,
        user_name=user.full_name
    )
    
    return {"message": "Email verified successfully. You can now log in."}


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(
    data: ResendVerification,
    db: AsyncSession = Depends(get_db)
):
    """Resend verification email."""
    print(f"🔔 Resend verification request for: {data.email}")
    
    user = await get_user_by_email(db, data.email)
    
    if not user:
        print(f"❌ User not found: {data.email}")
        # Don't reveal if user exists
        return {"message": "If the email exists, a verification link has been sent."}
    
    if user.is_verified:
        print(f"ℹ️ User already verified: {data.email}")
        return {"message": "Email is already verified. You can log in."}
    
    # Generate new token
    verification_token = generate_verification_token()
    token_expires = datetime.utcnow() + timedelta(hours=24)
    
    user.verification_token = verification_token
    user.verification_token_expires = token_expires
    await db.commit()
    print(f"🔑 New verification token generated for: {data.email}")
    
    # Send verification email
    print(f"📧 Sending verification email to: {user.email}")
    try:
        email_sent = await email_service.send_verification_email(
            to_email=user.email,
            verification_token=verification_token,
            user_name=user.full_name
        )
        print(f"📧 Email send result: {email_sent}")
    except Exception as e:
        print(f"❌ Error sending email: {str(e)}")
        import traceback
        traceback.print_exc()
    
    return {"message": "If the email exists, a verification link has been sent."}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """Get current user information."""
    return current_user


@router.post("/logout", response_model=MessageResponse)
async def logout():
    """
    Logout user.
    
    Note: With JWT, actual logout is handled client-side by removing the token.
    This endpoint is for API completeness and can be extended for token blacklisting.
    """
    return {"message": "Successfully logged out"}

