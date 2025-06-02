import { useState } from 'react';
import { useRouter } from 'next/router';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/utils/firebase';
import { toast } from 'react-toastify';
import styles from '@/styles/login.module.css';

export default function Login() {
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, 'users', userCred.user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        throw new Error('User data not found');
      }

      const role = snap.data()?.role;
      
      if (role === 'admin') {
        router.push('/admin/dashboard');
      } else if (role === 'user') {
        router.push('/entry');
      } else {
        throw new Error('Invalid user role');
      }
    } catch (err) {
      console.error('Login error:', err);
      toast.error('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleLogin} className={styles.wrapper}>
        <img src="/logo.png" alt="i-Valet Logo" className={styles.logo} />

        <input
          type="email"
          placeholder="البريد الإلكتروني"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="glass-input"
          required
          dir="rtl"
        />

        <input
          type="password"
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="glass-input"
          required
          dir="rtl"
        />

        <button
          type="submit"
          disabled={loading}
          className="rotating-button"
        >
          {loading ? 'جاري التسجيل...' : 'تسجيل الدخول'}
        </button>
      </form>
      
      <img src="/files_714772-1748851574775-players.png" alt="Space Vision" className={styles.footerLogo} />
    </div>
  );
}