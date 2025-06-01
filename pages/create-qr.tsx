import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  getFirestore,
  collection,
  doc,
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { firebaseApp } from '@/utils/firebase';
import { QRCodeCanvas } from 'qrcode.react';
import styles from '@/styles/create.module.css';

export default function CreateQR() {
  const db = getFirestore(firebaseApp);
  const router = useRouter();

  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const fieldsFrozen = ticketNumber !== null;

  const handleCreate = async () => {
    if (!plate.trim() || !model.trim()) {
      alert('يرجى إدخال رقم اللوحة ونوع السيارة');
      return;
    }

    setLoading(true);

    try {
      const counterRef = doc(db, 'counters', 'tickets');
      const ticketRef = collection(db, 'tickets');

      await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        const last = counterSnap.exists() ? counterSnap.data().last_number : 0;
        const next = last + 1;

        transaction.set(counterRef, { last_number: next });

        const docRef = doc(ticketRef);
        const url = `https://qr-ivalet.vercel.app/clients/${next.toString().padStart(4, '0')}`;
        const timestamp = Timestamp.now();

        transaction.set(docRef, {
          ticket_number: next,
          plate_number: plate,
          car_model: model,
          status: 'new',
          requestedAt: timestamp,
          ticket_url: url,
          created_at: timestamp,
        });

        setTicketNumber(next);
        setTicketUrl(url);
        setCreatedAt(timestamp.toDate());
      });
    } catch (error: any) {
      console.error('Error creating ticket:', error.message);
      alert('حدث خطأ أثناء إنشاء التذكرة. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const rotatingEls = document.querySelectorAll('.rotating-button') as NodeListOf<HTMLElement>;
    let angle = 0;
    let frameId: number;

    const rotate = () => {
      angle = (angle + 1) % 360;
      rotatingEls.forEach(el => el.style.setProperty('--angle', `${angle}deg`));
      frameId = requestAnimationFrame(rotate);
    };
    rotate();

    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className={styles.screenWrapper}>
      <div className={styles.topBar} onClick={() => router.back()}>
        <img src="/icons/back.svg" alt="Back" width="30" height="30" />
      </div>

      <div style={{ textAlign: 'center', margin: '2rem' }}>
        <img src="/b.gif" alt="Brand Visual" width="175" height="175" />
      </div>

      <div className={styles.wrapper}>
        <input
          type="tel"
          placeholder="رقم اللوحة"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          disabled={fieldsFrozen}
          className={styles.inputGlass}
        />
        <input
          type="text"
          placeholder="نوع السيارة"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={fieldsFrozen}
          className={styles.inputGlass}
        />

        {ticketNumber && ticketUrl && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent} dir="rtl">
              <div className={styles.qrFrame}>
                <div className={styles.qrBackground}>
                  <QRCodeCanvas
                    value={ticketUrl}
                    size={220}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    includeMargin={false}
                  />
                </div>
              </div>

              <div className={styles.qrInfo}>
                <p><strong>رقم التذكرة:</strong> {ticketNumber.toString().padStart(4, '0')}</p>
                <p><strong>رقم اللوحة:</strong> {plate}</p>
                <p><strong>موديل السيارة:</strong> {model}</p>
                <p><strong>وقت الدخول:</strong> {createdAt?.toLocaleString()}</p>
              </div>

              <button
                className={styles.modalClose}
                onClick={() => {
                  setPlate('');
                  setModel('');
                  setTicketNumber(null);
                  setTicketUrl('');
                  setCreatedAt(null);
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        )}

        {!fieldsFrozen && (
          <button
            onClick={handleCreate}
            disabled={loading}
            className={`${styles.button} rotating-button`}
          >
            {loading ? 'يتم الإنشاء . . .' : 'طلب بطاقة'}
          </button>
        )}
      </div>
    </div>
  );
}
