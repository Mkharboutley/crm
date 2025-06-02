import { useEffect, useState, useRef } from 'react';
import { toast } from 'react-toastify';

interface VoiceMessage {
  id: string;
  ticketId: string;
  timestamp: string;
  audioData: string;
}

export default function GlassTicket({ ticketId, role }: { ticketId: string, role: string }) {
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log(`Initializing GlassTicket for ticket ${ticketId} with role ${role}`);
    
    localStorage.setItem('currentTicketId', ticketId);
    localStorage.setItem(role === 'client' ? 'clientRequest' : 'dashboardReply', 'true');

    const script = document.createElement('script');
    script.src = '/js/sql-voice-handler.js';
    script.defer = true;
    
    script.onload = () => {
      console.log('Voice handler script loaded');
      loadMessages();
    };

    document.body.appendChild(script);

    const checkNewMessages = setInterval(() => {
      if (role === 'admin') {
        const sync = localStorage.getItem('adminTicketSync');
        if (sync) {
          try {
            const { ticketId: syncedTicketId } = JSON.parse(sync);
            if (syncedTicketId === ticketId) {
              loadMessages();
              localStorage.removeItem('adminTicketSync');
              toast.info('New voice message received!');
            }
          } catch (err) {
            console.error('Error checking messages:', err);
          }
        }
      }
    }, 1000);

    return () => {
      clearInterval(checkNewMessages);
      if (timerRef.current) clearInterval(timerRef.current);
      localStorage.removeItem(role === 'client' ? 'clientRequest' : 'dashboardReply');
      localStorage.removeItem('currentTicketId');
    };
  }, [ticketId, role]);

  const loadMessages = () => {
    try {
      const recordings = JSON.parse(localStorage.getItem('voiceRecordings') || '[]');
      const ticketMessages = recordings.filter((r: VoiceMessage) => r.ticketId === ticketId);
      setMessages(ticketMessages);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const handleRecordingClick = () => {
    if (isRecording) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingTime(0);
      const stopBtn = document.getElementById('stop');
      if (stopBtn) stopBtn.click();
    } else {
      const recordBtn = document.getElementById('record');
      if (recordBtn) {
        recordBtn.click();
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => {
            if (prev >= 60) {
              clearInterval(timerRef.current!);
              const stopBtn = document.getElementById('stop');
              if (stopBtn) stopBtn.click();
              return 0;
            }
            return prev + 1;
          });
        }, 1000);
      }
    }
    setIsRecording(!isRecording);
  };

  const formatTime = (seconds: number) => {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
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
                  <span className="recording-dot"></span>
                  Stop Recording ({formatTime(recordingTime)})
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
                  <audio src={msg.audioData} controls />
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