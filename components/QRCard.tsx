// components/QRCard.tsx
import { QRCodeCanvas } from 'qrcode.react';

interface QRCardProps {
  value: string;
  title?: string;
}

export default function QRCard({ value, title }: QRCardProps) {
  return (
    <div style={{
      padding: 20,
      border: '1px solid #ccc',
      borderRadius: 12,
      textAlign: 'center',
      background: '#f9f9f9',
      boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
    }}>
      {title && <h3>{title}</h3>}
      <QRCodeCanvas value={value} size={180} />
      <p style={{ marginTop: 12, fontSize: 12, wordBreak: 'break-all' }}>{value}</p>
    </div>
  );
}
