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

    return () => {
      const recordBtn = document.getElementById('record');
      if (recordBtn) {
        recordBtn.removeEventListener('click', () => setIsRecording(true));
      }
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
            <ul id="recordingsList" className="recordings-list"></ul>
          </div>
        )}
      </div>
    </div>
  );
}