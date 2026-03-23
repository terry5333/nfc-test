import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { ref, onValue, get, set } from 'firebase/database';

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState("⌛ 系統待命：請感應卡片");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // A. 監聽地端 Python (IC/ID 讀卡機)
    const checkLocal = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:5000/scan');
        const data = await res.json();
        if (data.status === "success") handleAuth(data.id, "實體讀卡機");
      } catch (e) {}
    }, 1000);

    // B. 監聽雲端 (手機端傳來的老師卡)
    const scanRef = ref(db, 'system/last_scan');
    const unsubscribe = onValue(scanRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.id) handleAuth(data.id, "手機遠端感應");
    });

    async function handleAuth(cardId, source) {
      if (isSuccess) return;
      const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
      
      const userSnap = await get(ref(db, `authorized_cards/${cleanId}`));
      if (userSnap.exists()) {
        setIsSuccess(true);
        setStatus(`✅ 歡迎 ${userSnap.val().name} (${source})`);
        if (source === "手機遠端感應") await set(ref(db, 'system/last_scan'), null);
        setTimeout(() => router.push('/teacher'), 1500);
      } else {
        setStatus(`🚫 未授權卡號: ${cleanId.substring(0,8)}`);
      }
    }

    return () => { clearInterval(checkLocal); unsubscribe(); };
  }, [isSuccess]);

  return (
    <div style={isSuccess ? successBg : normalBg}>
      <div style={cardStyle}>
        <h1>TERRY EDU</h1>
        <div style={{ fontSize: '5rem' }}>{isSuccess ? "🔓" : "🛡️"}</div>
        <p>{status}</p>
      </div>
    </div>
  );
}
const normalBg = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: 'white', textAlign: 'center' };
const successBg = { ...normalBg, background: '#064e3b' };
const cardStyle = { padding: '50px', borderRadius: '30px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' };
