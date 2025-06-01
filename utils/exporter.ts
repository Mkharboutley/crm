interface Ticket {
  ticket_number?: number;
assignedWorker?: number | null;
assignedAt?: {
toDate: () => Date;
  };
  etaMinutes?: number;
}

export const scheduleLocalNotification = (ticket: Ticket) => {
  if (!('Notification' in window)) return;

  Notification.requestPermission().then((permission) => {
    if (permission !== 'granted') return;

    if (!ticket.assignedAt || !ticket.etaMinutes || !ticket.ticket_number) return;

    const etaTime = ticket.assignedAt.toDate().getTime() + ticket.etaMinutes * 60000;
    const triggerInMs = etaTime - Date.now() - 180000; // 3 minutes before ETA

    if (triggerInMs > 0) {
      console.log(`⏰ Scheduling notification in ${triggerInMs}ms`);
      setTimeout(() => {
        new Notification('⏳ Your Car Is Almost Ready!', {
          body: `Ticket #${ticket.ticket_number} is arriving in 3 minutes. Please be ready.`,
          icon: '/logo192.png', // optional
        });
      }, triggerInMs);
    }
  });
};
