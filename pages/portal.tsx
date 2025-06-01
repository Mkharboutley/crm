import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function PortalRedirect() {
  const router = useRouter();
  const { ticketId } = router.query;

  useEffect(() => {
    if (!router.isReady) return;

    if (ticketId && typeof ticketId === 'string') {
      router.push(`/clients/${ticketId}`);
    } else {
      console.warn('❗ No ticketId found in query parameters');
    }
  }, [router.isReady, ticketId, router]);

  return (
    <p style={{ padding: 24, textAlign: 'center' }}>
      جاري تحويلك إلى صفحة التذكرة...
    </p>
  );
}
