import { useState } from 'react';
import { db } from '../lib/firebase';
import { ref, set } from 'firebase/database';

export default function MobileScanner() {
  const [status, setStatus] = useState("等待啟動...");

  const startScan = async () => {
    if (!('NDEFReader' in window)) {
      setStatus("錯誤：此裝置不支援 NFC");
      return;
    }

    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      setStatus("掃描中...請靠近卡片");

      ndef.onreading = async (event) => {
        const cardId = event.serialNumber;
        await set(ref(db, 'system/last_scan'), {
          id: cardId,
          timestamp: Date.now()
        });
        setStatus(`感應成功：${cardId}`);
      };
    } catch (error) {
      setStatus("啟動失敗：" + error.message);
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '50px', background: '#121212', color: 'white', height: '100vh' }}>
      <h1>📲 門口讀卡機</h1>
      <div style={{ border: '2px dashed #444', padding: '40px', margin: '20px' }}>
        <p>{status}</p>
      </div>
      <button onClick={startScan} style={{ padding: '15px 30px', fontSize: '18px', borderRadius: '10px' }}>啟動掃描</button>
    </div>
  );
}
