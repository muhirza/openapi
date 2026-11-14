import bcrypt
from cryptography.fernet import Fernet

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
