import { useEffect, useState } from 'react';

export default function GlassTicket({ ticketId, role }: { ticketId: string, role: string }) {
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    console.log(`Initializing GlassTicket for ticket ${ticketId} with role ${role}`);
    
    // Clear any existing handlers
    localStorage.removeItem('clientRequest');
    localStorage.removeItem('dashboardReply');
    localStorage.removeItem('currentTicketId');

    const script = document.createElement('script');
    script.src = '/js/sql-voice-handler.js';
    script.defer = true;
    
    script.onload = () => {
      console.log('Voice handler script loaded');
      localStorage.setItem('currentTicketId', ticketId);
      if (role === 'client') {
        localStorage.setItem('clientRequest', 'true');
      } else if (role === 'admin') {
        localStorage.setItem('dashboardReply', 'true');
      }
    };

    document.body.appendChild(script);

    const loadMessages = () => {
      try {
        const recordings = JSON.parse(localStorage.getItem('voiceRecordings') || '[]');
        console.log('Loading messages for ticket:', ticketId, recordings);
        const ticketMessages = recordings.filter((r: any) => r.ticketId === ticketId);
        setMessages(ticketMessages);
      } catch (err) {
        console.error('Error loading messages:', err);
      }
    };

    // Initial load
    loadMessages();

    // Set up polling for new messages
    const interval = setInterval(() => {
      if (role === 'admin') {
        const sync = localStorage.getItem('adminTicketSync');
        if (sync) {
          try {
            const { ticketId: syncedTicketId } = JSON.parse(sync);
            if (syncedTicketId === ticketId) {
              console.log('New message detected for ticket:', ticketId);
              loadMessages();
              localStorage.removeItem('adminTicketSync'); // Clear the sync flag
            }
          } catch (err) {
            console.error('Error checking for new messages:', err);
          }
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (role === 'client') {
        localStorage.removeItem('clientRequest');
      } else {
        localStorage.removeItem('dashboardReply');
      }
      localStorage.removeItem('currentTicketId');
    };
  }, [ticketId, role]);

  const handleRecordingClick = () => {
    setIsRecording(!isRecording);
  };

  return (
    <div className="glass-ticket-container">
      <div className="glass-ticket-content">
        <h2 className="glass-ticket-title">
          🎙️ يمكنكم إرسال رسالة صوتية إلى المسؤول في حالة الطوارئ
        </h2>
        {role === 'client' && (
          <>
            <button
              id={isRecording ? 'stop' : 'record'}
              className="voice-btn"
              onClick={handleRecordingClick}
            >
              {isRecording ? (
                <>
                  <span className="recording-dot">●</span>
                  Stop Recording
                </>
              ) : (
                'Start Recording'
              )}
            </button>
            <ul id="recordingsList" className="recordings-list"></ul>
          </>
        )}
        {role === 'admin' && (
          <div>
            <h4>👂 Voice Messages History</h4>
            <ul id="recordingsList" className="recordings-list">
              {messages.map((msg, index) => (
                <li key={index}>
                  <div className="meta">{new Date(msg.timestamp).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}