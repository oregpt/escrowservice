import { useEffect, useState } from 'react';
import { auth, getSessionId, setSessionId } from '@/lib/api';

export function useSession() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initSession() {
      const existingSession = getSessionId();

      if (existingSession) {
        // Verify session is still valid
        const res = await auth.getMe();
        if (res.success) {
          setIsInitialized(true);
          setIsLoading(false);
          return;
        }
      }

      // Create new session
      const res = await auth.createSession();
      if (res.success && res.data?.sessionId) {
        setSessionId(res.data.sessionId);
      }

      setIsInitialized(true);
      setIsLoading(false);
    }

    initSession();
  }, []);

  return { isInitialized, isLoading };
}
