interface Stats {
  requested: number;
  assigned: number;
  completed: number;
}

interface Props {
  stats: Stats;
}

export default function TicketStats({ stats }: Props) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '1rem 0' }}>
      <div>Requested: {stats.requested}</div>
      <div>Assigned: {stats.assigned}</div>
      <div>Completed: {stats.completed}</div>
    </div>
  );
}
