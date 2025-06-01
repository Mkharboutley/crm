import { getFirestore, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from './firebase';

const db = getFirestore(firebaseApp);

export const assignTicketToWorker = (ticketId: string, workerId: string) =>
updateDoc(doc(db, 'tickets', ticketId), {
    assignedWorker: workerId,
    status: 'assigned',
    assignedAt: Timestamp.now(),
  });

export const completeTicket = (ticketId: string) =>
  updateDoc(doc(db, 'tickets', ticketId), {
    status: 'completed',
    completedAt: Timestamp.now(),
  });

export const cancelTicket = (ticketId: string) =>
  updateDoc(doc(db, 'tickets', ticketId), {
    status: 'cancelled',
    cancelledAt: Timestamp.now(),
  });
