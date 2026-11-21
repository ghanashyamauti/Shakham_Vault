import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.config import settings

class EncryptionService:
    def __init__(self):
        if not settings.AES_KEY_BASE64:
            raise RuntimeError(
                "[CRITICAL SECURITY ERROR] AES_KEY_BASE64 is not set in .env! "
                "A persistent 32-byte Base64 key is required to prevent data loss."
            )

        try:
            self.key = base64.b64decode(settings.AES_KEY_BASE64)
            if len(self.key) != 32:
                raise ValueError(f"AES key must decode to exactly 32 bytes (got {len(self.key)} bytes)")
        except Exception as e:
            raise RuntimeError(f"[CRITICAL SECURITY ERROR] Invalid AES_KEY_BASE64 in .env: {e}")

        self.aesgcm = AESGCM(self.key)

    def encrypt(self, plaintext: str) -> tuple[str, str]:
        """
        Encrypts plaintext string using AES-256-GCM.
        Returns: (ciphertext_b64, nonce_b64)
        """
        if plaintext is None:
            plaintext = ""
        nonce = os.urandom(12)  # Standard 96-bit nonce for GCM
        ciphertext = self.aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
        return (
            base64.b64encode(ciphertext).decode("utf-8"),
            base64.b64encode(nonce).decode("utf-8")
        )

    def decrypt(self, ciphertext_b64: str, nonce_b64: str) -> str:
        """
        Decrypts base64 ciphertext and nonce using AES-256-GCM.
        Returns: plaintext string
        """
        try:
            ciphertext = base64.b64decode(ciphertext_b64)
            nonce = base64.b64decode(nonce_b64)
            decrypted = self.aesgcm.decrypt(nonce, ciphertext, None)
            return decrypted.decode("utf-8")
        except Exception as e:
            return f"# Error decrypting content: {str(e)}"

crypto_service = EncryptionService()
