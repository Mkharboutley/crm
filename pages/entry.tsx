import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { requireAuth } from '@/utils/auth';
import styles from '@/styles/entry.module.css';

export default function EntryScreen() {
  const router = useRouter();

  useEffect(() => {
    requireAuth((user) => {
      console.log('Valet logged in:', user.email);
    });
  }, []);

  useEffect(() => {
    const rotatingEls = document.querySelectorAll('.rotating-button') as NodeListOf<HTMLElement>;
    let angle = 0;
    const rotate = () => {
      angle = (angle + 1) % 360;
      rotatingEls.forEach(el => el.style.setProperty('--angle', `${angle}deg`));
      requestAnimationFrame(rotate);
    };
    rotate();
  }, []);

  return (
    <div className={styles.screenWrapper}>
      <div className={styles.wrapper}>
        <img
          src="/logo2.gif"
          alt="Valet Logo"
          className={styles.logo}
        />

        <button
          onClick={() => router.push('/create-qr')}
          className={`${styles.button} rotating-button`}
        >
          <img src="/b1.png" alt="Create" width="120" height="52" />
          &nbsp;بطاقة جديدة
        </button>

        <button
          onClick={() => router.push('/scan-close')}
          className={`${styles.button} rotating-button`}
        >
          <img src="/b2.png" alt="Scan" width="120" height="52" />
          &nbsp;إغلاق بطاقة
        </button>
      </div>
    </div>
  );
}