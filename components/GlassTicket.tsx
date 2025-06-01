import { useEffect, useState } from 'react';

export default function GlassTicket({ ticketId, role }: { ticketId: string, role: string }) {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/js/sql-voice-handler.js';
    script.defer = true;
    script.onload = () => {
      localStorage.setItem('currentTicketId', ticketId);
      if (role === 'client') localStorage.setItem('clientRequest', 'true');
      if (role === 'admin') localStorage.setItem('dashboardReply', 'true');
    };
    document.body.appendChild(script);

    // Monitor recording state
    const recordBtn = document.getElementById('record');
    const stopBtn = document.getElementById('stop');

    if (recordBtn && stopBtn) {
      recordBtn.addEventListener('click', () => setIsRecording(true));
      stopBtn.addEventListener('click', () => setIsRecording(false));
    }

    return () => {
      if (recordBtn && stopBtn) {
        recordBtn.removeEventListener('click', () => setIsRecording(true));
        stopBtn.removeEventListener('click', () => setIsRecording(false));
      }
    };
  }, [ticketId, role]);

  return (
    <div className="glass-ticket" style={{ paddingTop: '25px' }}>
      <h2 style={{ fontSize: '14px', fontWeight: 'normal', marginBottom: '15px' }}>
        🎙️ Voice Messages for Ticket #{ticketId}
      </h2>
      {role === 'client' && (
        <>
          <button id="record" className="voice-btn">
            {isRecording ? (
              <>
                <span style={{ color: 'red', marginRight: '8px' }}>●</span>
                Recording...
              </>
            ) : (
              'Start Recording'
            )}
          </button>
          <button id="stop" disabled className="voice-btn">Stop</button>
          <ul id="recordingsList" className="recordings-list"></ul>
        </>
      )}
      {role === 'admin' && (
        <div>
          <h4>👂 Voice Messages History</h4>
          <ul id="recordingsList" className="recordings-list"></ul>
        </div>
      )}
    </div>
  );
}