import { useEffect, useRef, useState } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { firebaseApp } from '@/utils/firebase';
import styles from '@/styles/ScanClose.module.css';

export default function ScanClosePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<any>(null);
  const db = getFirestore(firebaseApp);

  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('');

  const updateStatus = (message: string, type: 'success' | 'error') => {
    setStatusMsg(message);
    setStatusType(type);
  };

  useEffect(() => {
    let mounted = true;

    const initializeScanner = async () => {
      if (!videoRef.current || !mounted || typeof window === 'undefined') return;

      try {
        if (scannerRef.current) {
          scannerRef.current.destroy();
        }

        // Dynamically import QrScanner
        const QrScannerModule = await import('qr-scanner');
        const QrScanner = QrScannerModule.default;

        const scanner = new QrScanner(
          videoRef.current,
          async (result) => {
            const decodedText = result.data;
            const match = decodedText.match(/\/clients\/(\d+)/);

            if (!match) {
              return updateStatus('❌ رمز غير صالح', 'error');
            }

            const ticketNumber = parseInt(match[1]);

            try {
              const q = query(collection(db, 'tickets'), where('ticket_number', '==', ticketNumber));
              const snap = await getDocs(q);

              if (snap.empty) {
                return updateStatus('❌ لم يتم العثور على التذكرة', 'error');
              }

              const ticketDoc = snap.docs[0];
              await updateDoc(doc(db, 'tickets', ticketDoc.id), {
                status: 'completed',
                completedAt: Timestamp.now(),
              });

              updateStatus('✅ تم تسليم السيارة بنجاح', 'success');
              scanner.stop();
            } catch (err) {
              console.error('Firestore error:', err);
              updateStatus('⚠️ حدث خطأ أثناء تحديث الحالة', 'error');
            }
          },
          {
            preferredCamera: 'environment',
            highlightScanRegion: true,
            highlightCodeOutline: true,
          }
        );

        scannerRef.current = scanner;
        await scanner.start();
      } catch (err) {
        console.error('Camera error:', err);
        updateStatus('📵 لا يمكن الوصول إلى الكاميرا', 'error');
      }
    };

    initializeScanner();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
      }
    };
  }, [db]);

  return (
    <div className={styles.root}>
      <video ref={videoRef} className={styles.video} muted playsInline />

      <div className={styles.overlay} />

      <div className={styles.content}>
        <div className={styles.textBlock}>
          <h2 className={styles.heading}>امسح رمز التذكرة لإنهاء العملية</h2>

          {statusMsg && (
            <div
              className={`${styles.status} ${
                statusType === 'success' ? styles.success : styles.error
              }`}
            >
              {statusMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}