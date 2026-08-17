import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'KAZA — Solutions Immobilières au Bénin';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
          padding: '80px',
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 800, marginBottom: 24 }}>KAZA</div>
        <div style={{ fontSize: 36, fontWeight: 400, opacity: 0.9, marginBottom: 48 }}>
          Solutions Immobilières au Bénin
        </div>
        <div style={{ fontSize: 24, opacity: 0.6 }}>
          Gestion locative · Paiement mobile money · Quittances légales
        </div>
      </div>
    ),
    { ...size },
  );
}
