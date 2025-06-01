import Link from 'next/link';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="layout-wrapper">
      <header style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img 
          src="/logo copy.png" 
          alt="iValet" 
          style={{ 
            height: 40, 
            marginBottom: 20,
            marginTop: 15,
            filter: 'brightness(1.1)'
          }} 
        />
        <nav style={{ 
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '12px 24px',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <Link 
            href="/dashboard" 
            style={{ 
              marginRight: 24,
              color: 'white',
              textDecoration: 'none',
              padding: '6px 16px',
              borderRadius: '8px',
              transition: 'all 0.2s',
              background: 'rgba(255, 255, 255, 0.1)'
            }}
          >
            Admin
          </Link>
          <Link 
            href="/entry" 
            style={{ 
              marginRight: 24,
              color: 'white',
              textDecoration: 'none',
              padding: '6px 16px',
              borderRadius: '8px',
              transition: 'all 0.2s',
              background: 'rgba(255, 255, 255, 0.1)'
            }}
          >
            Valet
          </Link>
          <Link 
            href="/create-qr" 
            style={{ 
              marginRight: 24,
              color: 'white',
              textDecoration: 'none',
              padding: '6px 16px',
              borderRadius: '8px',
              transition: 'all 0.2s',
              background: 'rgba(255, 255, 255, 0.1)'
            }}
          >
            Create QR
          </Link>
          <Link 
            href="/scan-close" 
            style={{ 
              marginRight: 24,
              color: 'white',
              textDecoration: 'none',
              padding: '6px 16px',
              borderRadius: '8px',
              transition: 'all 0.2s',
              background: 'rgba(255, 255, 255, 0.1)'
            }}
          >
            Scan
          </Link>
          <Link 
            href="/login"
            style={{ 
              color: 'white',
              textDecoration: 'none',
              padding: '6px 16px',
              borderRadius: '8px',
              transition: 'all 0.2s',
              background: 'rgba(255, 255, 255, 0.1)'
            }}
          >
            Logout
          </Link>
        </nav>
      </header>

      <main>{children}</main>
    </div>
  );
}