import base64
import os
from typing import List
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.config import settings

class EncryptionService:
    def __init__(self):
        keys_b64 = settings.all_aes_keys_list
        if not keys_b64:
            raise RuntimeError(
                "[CRITICAL SECURITY ERROR] AES_KEY_BASE64 is not set in .env! "
                "A persistent 32-byte Base64 key is required to prevent data loss."
            )

        self.keys: List[AESGCM] = []

        # Load all keys strictly configured from .env (zero hardcoded values)
        for key_b64 in keys_b64:
            try:
                raw_key = base64.b64decode(key_b64.strip())
                if len(raw_key) == 32:
                    self.keys.append(AESGCM(raw_key))
            except Exception as e:
                pass

        if not self.keys:
            raise RuntimeError("[CRITICAL SECURITY ERROR] No valid 32-byte AES key found in .env!")

        self.primary_aesgcm = self.keys[0]

    def encrypt(self, plaintext: str) -> tuple[str, str]:
        """
        Encrypts plaintext string using AES-256-GCM with the active primary key from .env.
        Returns: (ciphertext_b64, nonce_b64)
        """
        if plaintext is None:
            plaintext = ""
        nonce = os.urandom(12)  # Standard 96-bit nonce for GCM
        ciphertext = self.primary_aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
        return (
            base64.b64encode(ciphertext).decode("utf-8"),
            base64.b64encode(nonce).decode("utf-8")
        )

    def decrypt(self, ciphertext_b64: str, nonce_b64: str) -> str:
        """
        Decrypts base64 ciphertext and nonce using AES-256-GCM.
        Tries active primary key first; gracefully falls back to secondary keys configured in .env.
        Returns: plaintext string
        """
        try:
            ciphertext = base64.b64decode(ciphertext_b64)
            nonce = base64.b64decode(nonce_b64)
        except Exception as e:
            return f"# Error decoding payload: {str(e)}"

        last_error = None
        for aesgcm in self.keys:
            try:
                decrypted = aesgcm.decrypt(nonce, ciphertext, None)
                return decrypted.decode("utf-8")
            except Exception as e:
                last_error = e
                continue

        return f"# Error decrypting content: {str(last_error)}"

crypto_service = EncryptionService()
