// utils/auth.ts
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { firebaseApp } from './firebase';

const auth = getAuth(firebaseApp);

/**
 * Redirects to login if user is not authenticated.
 * Runs once on page load (e.g. in useEffect).
 */
export const requireAuth = (callback: (user: any) => void) => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      callback(user);
    } else {
      window.location.href = '/login';
    }
  });
};
