from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: Optional[str] = Field(default=None, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OAuthTokenRequest(BaseModel):
    id_token: str = Field(min_length=10)


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    email_verified: bool = False


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=10)


class MessageResponse(BaseModel):
    message: str
    verification_url: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    verification_url: Optional[str] = None
