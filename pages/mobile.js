import { useState } from 'react';
import { db } from '../lib/firebase';
import { ref, set } from 'firebase/database';

export default function Mobile() {
  const [scanning, setScanning] = useState(false);

  const startScan = async () => {
    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      setScanning(true);
      ndef.onreading = async (event) => {
        // 每次讀到新卡，直接覆蓋雲端的 last_scan
        await set(ref(db, 'system/last_scan'), {
          id: event.serialNumber,
          timestamp: Date.now()
        });
        // 震動一下，讓手機有回饋感
        if (navigator.vibrate) navigator.vibrate(200);
      };
    } catch (e) { alert("啟動失敗: " + e.message); }
  };

  return (
    <div style={{ textAlign: 'center', background: scanning ? '#064e3b' : '#111', color: '#10b981', height: '100vh', paddingTop: '100px' }}>
      <h1>📲 門口感應器</h1>
      <div style={{ fontSize: '5rem' }}>{scanning ? '📡' : '💤'}</div>
      <p>{scanning ? "持續掃描中...請將卡片靠近" : "尚未啟動"}</p>
      {!scanning && <button onClick={startScan} style={{ padding: '20px', fontSize: '1.2rem' }}>點擊啟動監控</button>}
    </div>
  );
}
