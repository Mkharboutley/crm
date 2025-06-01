import { useEffect, useState } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  orderBy
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/utils/firebase'; // adjust path if needed

const STATUS_COLORS: Record<string, string> = {
  requested: 'text-yellow-600',
  assigned: 'text-blue-600',
  completed: 'text-green-600',
  cancelled: 'text-gray-500',
  expired: 'text-red-600',
};

export default function RequestHandler() {
  const db = getFirestore(firebaseApp);
  const functions = getFunctions(firebaseApp);


  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'tickets'),
      where('status', 'in', ['requested', 'assigned']),
      orderBy('requestedAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setTickets(list);
    });

    return () => unsubscribe();
  }, [db]);

  const callFunction = async (name: string, data: any) => {
    try {
      const func = httpsCallable(functions, name);
      await func(data);
      alert(`✅ ${name} executed`);
    } catch (err: any) {
      alert(`❌ ${name} failed: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center mb-8">
          <img src="/qr-anim.gif" alt="QR animation" style={{ width: 120 }} />
          <h1 className="text-3xl font-bold mt-4">Admin: Active Tickets</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tickets.map((t) => (
            <div key={t.id} className="bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-700">
              <h2 className="text-xl font-semibold mb-2">Ticket #{t.ticket_number}</h2>
              <p><strong>Plate:</strong> {t.plate_number}</p>
              <p><strong>Model:</strong> {t.car_model}</p>
              <p><strong>Status:</strong> <span className={`${STATUS_COLORS[t.status]} font-semibold`}>{t.status}</span></p>
              <p><strong>ETA:</strong> {t.etaMinutes ?? '--'} min</p>

              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                  onClick={() => callFunction('assignWorker', { ticketId: t.id })}
                >
                  Assign
                </button>
                <button
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                  onClick={() => callFunction('completeTicket', { ticketId: t.id })}
                >
                  Complete
                </button>
                <button
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded"
                  onClick={() => callFunction('recalculateETA', { ticketId: t.id })}
                >
                  Recalc ETA
                </button>
                <button
                  className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-1 rounded"
                  onClick={() => callFunction('cancelTicket', { ticketId: t.id })}
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
