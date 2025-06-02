import VoiceMessage from './VoiceMessage';

export default function GlassTicket({ ticketId, role }: { ticketId: string; role: string }) {
  return (
    <div className="glass-ticket">
      <VoiceMessage ticketId={ticketId} role={role as 'admin' | 'client'} />
    </div>
  );
}