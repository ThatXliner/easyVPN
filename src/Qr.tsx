import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Renders `value` as a QR code so a guest can scan it straight into their
 *  client app instead of copy-pasting a long link across devices. */
export function Qr({ value, size = 168 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0b1220", light: "#ffffff" },
    })
      .then((url) => {
        if (alive) setDataUrl(url);
      })
      .catch(() => {
        if (alive) setDataUrl("");
      });
    return () => {
      alive = false;
    };
  }, [value, size]);

  if (!dataUrl) return <div className="qr qr--empty" style={{ width: size, height: size }} />;
  return <img className="qr" src={dataUrl} width={size} height={size} alt="QR code" />;
}
