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

    const handleRecordingClick = () => {
      setIsRecording(!isRecording);
    };

    const recordBtn = document.getElementById('recordButton');
    if (recordBtn) {
      recordBtn.addEventListener('click', handleRecordingClick);
    }

    return () => {
      if (recordBtn) {
        recordBtn.removeEventListener('click', handleRecordingClick);
      }
    };
  }, [ticketId, role, isRecording]);

  return (
    <div className="glass-ticket" style={{ paddingTop: '25px' }}>
      <h2 style={{ fontSize: '14px', fontWeight: 'normal', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img 
          src="/mic.png" 
          alt="Microphone" 
          style={{ width: '24px', height: '24px' }} 
        />
        يمكنكم إرسال رسالة صوتية إلى المسؤول في حالة الطوارئ
      </h2>
      {role === 'client' && (
        <>
          <button 
            id="recordButton"
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
          <ul id="recordingsList" className="recordings-list"></ul>
        </>
      )}
      {role === 'admin' && (
        <div>
          <h4>👂 سجل الرسائل الصوتية</h4>
          <ul id="recordingsList" className="recordings-list"></ul>
        </div>
      )}
    </div>
  );
}