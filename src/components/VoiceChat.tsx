import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import RecordRTC from 'recordrtc';
import { v4 as uuidv4 } from 'uuid';

interface VoiceChatProps {
  ticketId: string;
  role: 'admin' | 'client';
}

interface VoiceMessage {
  id: string;
  ticketId: string;
  timestamp: string;
  audioData: string;
  sender: string;
}

export default function VoiceChat({ ticketId, role }: VoiceChatProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  
  const recorderRef = useRef<RecordRTC | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 2000);
    return () => {
      clearInterval(interval);
      cleanup();
    };
  }, [ticketId]);

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (recorderRef.current) {
      recorderRef.current.destroy();
    }
  };

  const loadMessages = () => {
    try {
      const allMessages = JSON.parse(localStorage.getItem('voiceMessages') || '[]');
      const ticketMessages = allMessages
        .filter((m: VoiceMessage) => m.ticketId === ticketId)
        .slice(-5);
      setMessages(ticketMessages);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;
      recorderRef.current = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/webm',
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 1,
        timeSlice: 1000,
        desiredSampRate: 16000,
      });

      recorderRef.current.startRecording();
      setIsRecording(true);
      startTimer();

      toast.info('Recording started');
    } catch (err) {
      console.error('Recording error:', err);
      toast.error('Could not access microphone');
    }
  };

  const startTimer = () => {
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= 60) {
          stopRecording();
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = async () => {
    if (!recorderRef.current || !streamRef.current) return;

    return new Promise<void>(resolve => {
      recorderRef.current?.stopRecording(() => {
        const blob = recorderRef.current?.getBlob();
        if (!blob) {
          toast.error('No audio recorded');
          cleanup();
          resolve();
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          saveMessage(base64Audio);
          cleanup();
          setIsRecording(false);
          setRecordingTime(0);
          resolve();
        };

        reader.onerror = () => {
          toast.error('Failed to process audio');
          cleanup();
          resolve();
        };

        reader.readAsDataURL(blob);
      });
    });
  };

  const saveMessage = (audioData: string) => {
    const message: VoiceMessage = {
      id: uuidv4(),
      ticketId,
      timestamp: new Date().toISOString(),
      audioData,
      sender: role
    };

    const allMessages = JSON.parse(localStorage.getItem('voiceMessages') || '[]');
    const otherMessages = allMessages.filter((m: VoiceMessage) => m.ticketId !== ticketId);
    const ticketMessages = allMessages
      .filter((m: VoiceMessage) => m.ticketId === ticketId)
      .slice(-4);

    localStorage.setItem('voiceMessages', JSON.stringify([
      ...otherMessages,
      ...ticketMessages,
      message
    ]));

    if (role === 'client') {
      localStorage.setItem('adminTicketSync', JSON.stringify({
        ticketId,
        timestamp: message.timestamp,
        hasNewMessage: true
      }));
    }

    loadMessages();
    toast.success('Message sent');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="voice-chat">
      {role === 'client' && (
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className="record-btn"
          disabled={isRecording && recordingTime >= 60}
        >
          {isRecording ? (
            <>
              <span className="recording-dot" />
              Stop Recording ({formatTime(recordingTime)})
            </>
          ) : (
            'Record Message'
          )}
        </button>
      )}

      <div className="messages">
        {messages.map(message => (
          <div key={message.id} className="message">
            <div className="message-header">
              <span className="sender">
                {message.sender === 'client' ? 'Client' : 'Admin'}
              </span>
              <span className="time">
                {new Date(message.timestamp).toLocaleString()}
              </span>
            </div>
            <audio src={message.audioData} controls className="audio-player" />
          </div>
        ))}
      </div>
    </div>
  );
}