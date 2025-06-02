import styles from '@/styles/dashboard.module.css';

interface Ticket {
  id: string;
  ticket_number: number;
  plate_number: string;
  car_model: string;
  status: string;
  assignedWorker?: string | null;
  etaMinutes?: number;
}

interface Worker {
  id: string;
  name: string;
}

interface Props {
  tickets: Ticket[];
  workers: Worker[];
  onAssign: (ticketId: string, workerId: string) => void;
  onComplete: (ticketId: string) => void;
  onCancel: (ticketId: string) => void;
}

export default function RequestTable({
  tickets,
  workers,
  onAssign,
  onComplete,
  onCancel,
}: Props) {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Plate</th>
            <th>Model</th>
            <th>Status</th>
            <th>Worker</th>
            <th>ETA</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                No tickets found.
              </td>
            </tr>
          ) : (
            tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>{ticket.ticket_number}</td>
                <td>{ticket.plate_number}</td>
                <td>{ticket.car_model}</td>
                <td>
                  <span className={`${styles.badge} ${styles[ticket.status]}`}>
                    {ticket.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  {ticket.assignedWorker
                    ? workers.find(w => w.id === ticket.assignedWorker)?.name || ticket.assignedWorker
                    : '—'}
                </td>
                <td>{ticket.etaMinutes ? `${ticket.etaMinutes} min` : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    <select
                      onChange={(e) => onAssign(ticket.id, e.target.value)}
                      defaultValue=""
                      disabled={ticket.status === 'completed'}
                    >
                      <option value="" disabled>Assign</option>
                      {workers.map((worker) => (
                        <option key={worker.id} value={worker.id}>
                          {worker.name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => onComplete(ticket.id)}
                      disabled={ticket.status === 'completed'}
                      className={styles.actionBtn}
                    >
                      ✔
                    </button>

                    <button
                      onClick={() => onCancel(ticket.id)}
                      className={`${styles.actionBtn} ${styles.cancelBtn}`}
                    >
                      ✖
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}