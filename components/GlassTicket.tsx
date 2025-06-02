import { useEffect, useState } from 'react';

export default function GlassTicket({ ticketId, role }: { ticketId: string, role: string }) {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    // Load voice handler script
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
      script.remove();
    };
  }, [ticketId, role]);

  return (
    <div className="glass-ticket">
      <h2 style={{ 
        fontSize: '14px', 
        fontWeight: 'normal', 
        marginBottom: '15px',
        textAlign: 'right'
      }}>
        {role === 'client' 
          ? 'يمكنكم إرسال رسالة صوتية إلى المسؤول في حالة الطوارئ'
          : 'سجل الرسائل الصوتية'
        }
      </h2>
      
      {role === 'client' && (
        <>
          <button 
            id="record" 
            className="voice-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isRecording ? (
              <>
                <span style={{ color: 'red', marginRight: '8px' }}>●</span>
                إيقاف التسجيل
              </>
            ) : (
              'بدء التسجيل'
            )}
          </button>
          <button 
            id="stop" 
            disabled={!isRecording}
            className="voice-btn"
            style={{ marginTop: '8px' }}
          >
            حفظ التسجيل
          </button>
          <ul id="recordingsList" className="recordings-list"></ul>
        </>
      )}

      {role === 'admin' && (
        <ul id="recordingsList" className="recordings-list"></ul>
      )}
    </div>
  );
}