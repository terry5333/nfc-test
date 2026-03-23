import { useState } from 'react';
import { db } from '../lib/firebase';
import { ref, set } from 'firebase/database';

export default function Mobile() {
  const [active, setActive] = useState(false);

  const startScan = async () => {
    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      setActive(true);
      ndef.onreading = async (event) => {
        await set(ref(db, 'system/last_scan'), {
          id: event.serialNumber,
          timestamp: Date.now()
        });
      };
    } catch (e) { alert("啟動失敗：" + e.message); }
  };

  return (
    <div style={{ textAlign: 'center', padding: '100px 20px', background: active ? '#003300' : '#111', color: '#0f0', height: '100vh' }}>
      <h1>{active ? "📡 門禁掃描中" : "請啟動"}</h1>
      {!active && <button onClick={startScan} style={{ padding: '20px', fontSize: '20px' }}>啟動門口感應器</button>}
      <p style={{ marginTop: '50px' }}>手機請貼緊門口感應區</p>
    </div>
  );
}
