import bcrypt
from cryptography.fernet import Fernet
from jose import jwt
from datetime import datetime, timedelta, timezone

from app.core.config import settings

# --- Password hashing ---

def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


# --- Credential encryption (Fernet symmetric) ---

def _get_cipher() -> Fernet:
    key = settings.encryption_key
    if not key:
        # Derive a stable key from secret if no explicit encryption key provided
        import base64, hashlib
        derived = hashlib.sha256(settings.app_secret_key.encode()).digest()
        key = base64.urlsafe_b64encode(derived).decode()
    return Fernet(key.encode())


def encrypt_value(value: str) -> str:
    cipher = _get_cipher()
    return cipher.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_value(token: str) -> str:
    cipher = _get_cipher()
    return cipher.decrypt(token.encode("utf-8")).decode("utf-8")


# --- JWT token ---

def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.app_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.app_secret_key, algorithms=[settings.jwt_algorithm])
    except Exception:
        return None
