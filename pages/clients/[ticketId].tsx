import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
  updateDoc,
  doc,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { firebaseApp } from '@/utils/firebase';
import styles from '@/styles/ticketid.module.css';
import { scheduleLocalNotification } from '@/utils/exporter';
import GlassTicket from '@/components/GlassTicket';

interface Ticket {
  ticket_number: number;
  plate_number: string;
  car_model: string;
  status: string;
  assignedAt?: { toDate: () => Date };
  created_at?: { toDate: () => Date };
  etaMinutes?: number;
  visitorId?: string;
}

export default function ClientTicketView() {
  const db = getFirestore(firebaseApp);
  const router = useRouter();
  const { ticketId } = router.query;

  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [docId, setDocId] = useState('');
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  function generateVisitorId() {
    return 'xxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let id = localStorage.getItem('visitorId');
      if (!id) {
        id = generateVisitorId();
        localStorage.setItem('visitorId', id);
      }
      setVisitorId(id);
    }
  }, []);

  const translateStatus = (status: string) => {
    switch (status) {
      case 'new':
        return 'مركونة';
      case 'requested':
        return 'تم الطلب';
      case 'assigned':
        return 'تم تعيين سائق';
      case 'completed':
        return 'تم التوصيل';
      case 'cancelled':
        return 'ملغاة';
      default:
        return status;
    }
  };

  useEffect(() => {
    if (!ticketId || !visitorId) return;

    const initializePusher = async () => {
      try {
        if (!window.PusherPushNotifications) {
          console.warn('Pusher Beams not loaded');
          return;
        }

        if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
          const beamsClient = new window.PusherPushNotifications.Client({
            instanceId: '3edf71c5-d3e0-471a-aaa5-ebe35be280ba'
          });

          const paddedTicket = String(ticketId).padStart(4, '0');
          const interestKey = `ticket-${paddedTicket}-client-${visitorId}`;

          await beamsClient.start();
          await beamsClient.addDeviceInterest(interestKey);
          console.log(`✅ Beams: Subscribed to ${interestKey}`);
        } else {
          toast.warn('التنبيهات تتطلب اتصال آمن (HTTPS)');
        }
      } catch (error: any) {
        if (error.message?.includes('permission denied')) {
          toast.error('يرجى تمكين إذن الإشعارات في إعدادات المتصفح للحصول على التحديثات');
        } else {
          console.error('Pusher Beams initialization error:', error);
          toast.error('تعذر تمكين الإشعارات. يرجى المحاولة مرة أخرى لاحقاً');
        }
      }
    };

    initializePusher();
  }, [ticketId, visitorId]);

  useEffect(() => {
    if (!ticketId || !visitorId) return;

    const q = query(
      collection(db, 'tickets'),
      where('ticket_number', '==', parseInt(ticketId as string))
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        const data = d.data() as Ticket;
        setDocId(d.id);
        setTicket(data);

        if (data.status === 'completed') {
          setCountdown(0);
          setLoading(false);
          return;
        }

        if (
          data.status === 'assigned' &&
          data.assignedAt &&
          data.etaMinutes &&
          (!data.visitorId || data.visitorId === visitorId)
        ) {
          const etaTime = data.assignedAt.toDate().getTime() + data.etaMinutes * 60000;
          const remaining = Math.max(etaTime - Date.now(), 0);
          setCountdown(remaining);
          scheduleLocalNotification(data);
        } else {
          setCountdown(0);
        }
      }
      setLoading(false);
    });

    return () => unsub();
  }, [ticketId, visitorId]);

  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(prev - 1000, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  const handleRequest = async () => {
    try {
      const now = Timestamp.now();
      const q = query(
        collection(db, 'tickets'),
        where('status', '==', 'requested'),
        orderBy('requestedAt', 'asc')
      );
      const snap = await getDocs(q);
      const etaMinutes = snap.docs.length < 5 ? 7 : Math.ceil(snap.docs.length / 5) * 7;

      await updateDoc(doc(db, 'tickets', docId), {
        requestedAt: now,
        etaMinutes,
        status: 'requested',
        visitorId: visitorId
      });
      toast.success('✅ تم إرسال طلب السيارة');
    } catch (err) {
      console.error('❌ Failed to request car:', err);
      toast.error('فشل طلب السيارة. حاول مجدداً');
    }
  };

  const mins = Math.floor(countdown / 60000).toString().padStart(2, '0');
  const secs = Math.floor((countdown % 60000) / 1000).toString().padStart(2, '0');

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const hourDegrees = (hours % 12) * 30 + minutes * 0.5;
  const minuteDegrees = minutes * 6 + seconds * 0.1;
  const secondDegrees = seconds * 6;

  if (loading) return <p className={styles.container}>Loading ticket...</p>;
  if (!ticket) return <p className={styles.container}>Ticket not found</p>;

  return (
    <>
      <video autoPlay muted loop playsInline id="background-video" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1, objectFit: 'cover' }}>
        <source src="/back.mp4" type="video/mp4" />
      </video>

      <div className={styles.ticketContainer} dir="rtl">
        <img src="/logo.png" alt="i-Valet" className={styles.logo} />

        <div className={styles.glassCard}>
          <h2 className={styles.title}>معلومات البطاقة</h2>
          
          <div className={styles.analogClock}>
            <div className={styles.hourHand} style={{ transform: `rotate(${hourDegrees}deg)` }} />
            <div className={styles.minuteHand} style={{ transform: `rotate(${minuteDegrees}deg)` }} />
            <div className={styles.secondHand} style={{ transform: `rotate(${secondDegrees}deg)` }} />
            <div className={styles.clockCenter} />
          </div>

          <p><strong>رقم البطاقة  : </strong> {ticket.ticket_number}</p>
          <p><strong>رقم اللوحة  : </strong> {ticket.plate_number}</p>
          <p><strong>موديل السيارة  : </strong> {ticket.car_model}</p>
          <p><strong>وقت الدخول  : </strong> {ticket.created_at?.toDate().toLocaleString()}</p>
          <p><strong>الحالة  : </strong> {translateStatus(ticket.status)}</p>

          {ticket.status === 'assigned' ? (
            <div className={styles.countdown}>{mins}:{secs}</div>
          ) : ticket.status === 'completed' ? (
            <p style={{ color: 'green', fontWeight: 'bold' }}>✅ تمت عملية التسليم بنجاح</p>
          ) : ticket.status === 'new' ? (
            <button onClick={handleRequest} className="rotating-button">
              إطلب سيارتك
            </button>
          ) : (
            <p>بإنتظار تعيين سائق ...</p>
          )}

          {ticketId && <GlassTicket ticketId={ticketId as string} role="client" />}
        </div>
      </div>
    </>
  );
}