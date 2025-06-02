import { useState } from 'react';
import { ToastContainer } from 'react-toastify';
import VoiceChat from './components/VoiceChat';
import 'react-toastify/dist/ReactToastify.css';
import './styles/VoiceChat.css';

export default function App() {
  const [ticketId] = useState('demo-ticket');

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <VoiceChat ticketId={ticketId} role="client" />
      <ToastContainer position="top-right" theme="dark" />
    </div>
  );
}