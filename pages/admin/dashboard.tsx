
import { useEffect, useState } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { firebaseApp } from '@/utils/firebase';
import {
  assignTicketToWorker,
  cancelTicket,
  completeTicket
} from '@/utils/ticketActions';
import RequestTable from '@/components/RequestTable';
import SettingsPanel from '@/components/SettingsPanel';
import TicketStats from '@/components/TicketStats';
import Layout from '@/components/Layout';
import Loader from '@/components/Loader';
import GlassTicket from '@/components/GlassTicket';
import styles from '@/styles/dashboard.module.css';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface Ticket {
  id: string;
  ticket_number: number;
  plate_number: string;
  car_model: string;
  status: string;
  assignedWorker?: string | null;
  created_at?: {
    toDate: () => Date;
  };
  requestedAt?: {
    toDate: () => Date;
  };
  etaMinutes?: number;
}

interface Worker {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
}

interface Settings {
  defaultEtaMinutes: number;
  maxWorkersPerShift: number;
  etaCalculationMethod: 'fixed' | 'dynamic';
  workers: Worker[];
}

const defaultSettings: Settings = {
  defaultEtaMinutes: 7,
  maxWorkersPerShift: 5,
  etaCalculationMethod: 'dynamic',
  workers: []
};

export default function AdminDashboard() {
  const db = getFirestore(firebaseApp);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedWorker, setSelectedWorker] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (!settingsDoc.exists()) {
          await setDoc(doc(db, 'settings', 'global'), defaultSettings);
          setSettings(defaultSettings);
          setWorkers(defaultSettings.workers.filter(w => w.isActive));
        } else {
          const settingsData = settingsDoc.data() as Settings;
          setSettings(settingsData);
          setWorkers(settingsData.workers.filter(w => w.isActive));
        }
      } catch (err) {
        console.error('Error loading settings:', err);
        toast.error('Failed to load settings');
      }
    };
    loadSettings();
  }, [db]);

  useEffect(() => {
    const q = query(
      collection(db, 'tickets'),
      where('status', 'in', ['new', 'requested', 'assigned', 'completed']),
      orderBy('requestedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Ticket[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as Ticket));
      setTickets(data);
      setLoading(false);
    }, (error) => {
      console.error('Snapshot error:', error);
      toast.error('Failed to load tickets');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  useEffect(() => {
    const checkForNewVoice = () => {
      const sync = localStorage.getItem("adminTicketSync");
      if (!sync) return;

      try {
        const { ticketId } = JSON.parse(sync);
        if (!ticketId) return;

        setSelectedTicket(ticketId);
        toast.info('New voice message received!');
        localStorage.removeItem("adminTicketSync");
      } catch (err) {
        console.error("Invalid sync data:", err);
      }
    };

    const interval = setInterval(checkForNewVoice, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAssign = async (ticketId: string, workerId: string) => {
    try {
      await assignTicketToWorker(ticketId, workerId);
      const etaMinutes = settings.etaCalculationMethod === 'fixed' 
        ? settings.defaultEtaMinutes 
        : Math.ceil(tickets.filter(t => t.status === 'requested').length / settings.maxWorkersPerShift) * settings.defaultEtaMinutes;
      await updateDoc(doc(db, 'tickets', ticketId), { etaMinutes });
      toast.success(`Ticket assigned successfully`);
    } catch (error) {
      console.error('Error assigning ticket:', error);
      toast.error('Failed to assign ticket');
    }
  };

  const handleComplete = async (ticketId: string) => {
    await completeTicket(ticketId);
    toast.success(`Ticket completed successfully`);
  };

  const handleCancel = async (ticketId: string) => {
    await cancelTicket(ticketId);
    toast.info(`Ticket cancelled`);
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchStatus = filter === 'all' || ticket.status === filter;
    const matchSearch = [ticket.plate_number, ticket.car_model]
      .some((field) => field?.toLowerCase().includes(search.toLowerCase()));
    const matchWorker =
      selectedWorker === 'all' || `${ticket.assignedWorker ?? ''}` === selectedWorker;

    const matchDate = (() => {
      if (!fromDate && !toDate) return true;
      const ticketTime = ticket.created_at?.toDate?.() || new Date();
      const from = fromDate ? new Date(fromDate + 'T00:00:00') : null;
      const to = toDate ? new Date(toDate + 'T23:59:59') : null;
      if (from && ticketTime < from) return false;
      if (to && ticketTime > to) return false;
      return true;
    })();

    return matchStatus && (!search || matchSearch) && matchWorker && matchDate;
  });

  const stats = {
    requested: tickets.filter((t) => t.status === 'requested').length,
    assigned: tickets.filter((t) => t.status === 'assigned').length,
    completed: tickets.filter((t) => t.status === 'completed').length,
  };

  return (
    <Layout>
      <div className={styles.dashboardWrapper}>
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <h1>Dashboard</h1>
            <p className={styles.subtitle}>Manage your valet operations</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.settingsToggle} onClick={() => setShowSettings(!showSettings)}>
              ⚙️ Settings
            </button>
          </div>
        </header>

        {showSettings && <SettingsPanel settings={settings} onSave={setSettings} />}
        <TicketStats stats={stats} />

        {selectedTicket && (
          <GlassTicket ticketId={selectedTicket} role="admin" />
        )}

        <div className={styles.filterBar}>
          <label>Status:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="requested">Requested</option>
            <option value="assigned">Assigned</option>
            <option value="completed">Completed</option>
          </select>

          <label>Worker:</label>
          <select
            value={selectedWorker}
            onChange={(e) => setSelectedWorker(e.target.value)}
            className={styles.workerSelect}
          >
            <option value="all">All Workers</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
          </select>

          <label>Search:</label>
          <input
            type="text"
            placeholder="Search plate/model"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <label>From:</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />

          <label>To:</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        {loading ? (
          <Loader />
        ) : (
          <RequestTable
            tickets={filteredTickets}
            workers={workers}
            onAssign={handleAssign}
            onComplete={handleComplete}
            onCancel={handleCancel}
          />
        )}
      </div>
    </Layout>
  );
}
