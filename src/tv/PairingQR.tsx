import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function PairingQR({ code }: { code: string | null }) {
  const [image, setImage] = useState('');
  useEffect(() => {
    let active = true;
    setImage('');
    if (code && /^\d{6}$/.test(code)) {
      const url = new URL('/connect-tv', location.origin);
      url.searchParams.set('code', code);
      void QRCode.toDataURL(url.href, { width: 224, margin: 4, errorCorrectionLevel: 'M' })
        .then((value) => { if (active) setImage(value); })
        .catch(() => { /* The manual code remains available. */ });
    }
    return () => { active = false; };
  }, [code]);
  return image ? <img className="tv-pairing-qr" src={image} alt="Scan this QR code with your phone camera to connect to the TV" /> : null;
}
