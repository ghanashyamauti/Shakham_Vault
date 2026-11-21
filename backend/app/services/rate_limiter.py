import time
from collections import defaultdict
from threading import Lock
from fastapi import HTTPException, status
from app.config import settings

class RateLimiter:
    def __init__(self):
        self._requests = defaultdict(list)
        self._lock = Lock()

    def check_rate_limit(self, identifier: str, limit: int = None, window_seconds: int = 60):
        """
        Thread-safe sliding-window rate limiter.
        Raises HTTP 429 Too Many Requests if limit is exceeded in window_seconds.
        """
        if limit is None:
            limit = settings.AUTH_RATE_LIMIT_PER_MINUTE

        now = time.time()
        with self._lock:
            # Filter timestamps within current window
            self._requests[identifier] = [
                ts for ts in self._requests[identifier] if now - ts < window_seconds
            ]
            if len(self._requests[identifier]) >= limit:
                retry_after = int(window_seconds - (now - self._requests[identifier][0])) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many requests. Please try again in {retry_after} seconds.",
                    headers={"Retry-After": str(retry_after)}
                )
            self._requests[identifier].append(now)

auth_limiter = RateLimiter()
