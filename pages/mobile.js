import { useState } from 'react';
import { db } from '../lib/firebase';
import { ref, set, push, get, serverTimestamp } from 'firebase/database';

export default function MobileStation() {
  const [status, setStatus] = useState("請點擊啟動監控");
  const [active, setActive] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const startScanner = async () => {
    setActive(true);
    setStatus("📡 監控中：請靠近或掃描");
    
    // 啟動條碼掃描 (30 FPS 優化)
    const { Html5Qrcode } = await import("html5-qrcode");
    const html5QrCode = new Html5Qrcode("mobile-reader");
    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 30, qrbox: { width: 300, height: 120 } },
      (text) => handleProcess(text, "BARCODE")
    );

    // 啟動 NFC
    if ('NDEFReader' in window) {
      const ndef = new NDEFReader();
      await ndef.scan();
      ndef.onreading = (e) => handleProcess(e.serialNumber, "NFC");
    }
  };

  const handleProcess = async (cardId, type) => {
    if (isDone) return;
    const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
    setIsDone(true);
    if (navigator.vibrate) navigator.vibrate(200);

    const teacherSnap = await get(ref(db, `authorized_cards/${cleanId}`));
    if (teacherSnap.exists()) {
      setStatus(`🍎 老師：${teacherSnap.val().name}`);
      await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
    } else {
      setStatus(`🎒 學生打卡：${cleanId.substring(0,8)}`);
      await push(ref(db, 'student_logs'), { id: cleanId, time: serverTimestamp(), type });
    }

    setTimeout(() => { setIsDone(false); setStatus("📡 監控中：請靠近或掃描"); }, 3000);
  };

  return (
    <div style={isDone ? successStyle : containerStyle}>
      <h1>TERRY EDU 門口機</h1>
      {!active ? <button onClick={startScanner} style={btn}>啟動掃描</button> : 
      <div id="mobile-reader" style={{ width: '100%', maxWidth: '350px', display: isDone ? 'none' : 'block' }}></div>}
      <p style={{ fontSize: '1.2rem', marginTop: '20px' }}>{status}</p>
    </div>
  );
}
const containerStyle = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111', color: '#10b981', textAlign: 'center' };
const successStyle = { ...containerStyle, background: '#064e3b', color: 'white' };
const btn = { padding: '20px 40px', fontSize: '1.2rem', background: '#10b981', color: 'white', borderRadius: '50px', border: 'none' };
