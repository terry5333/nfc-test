import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { ref, onValue, get, set } from 'firebase/database';

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState("⌛ 系統待命：請插卡或感應");
  const [isSuccess, setIsSuccess] = useState(false);
  
  // 🚩 你的神卡 ID (請確認 .env.local 裡有設定 NEXT_PUBLIC_MY_GOD_CARD)
  const MY_GOD_CARD = process.env.NEXT_PUBLIC_MY_GOD_CARD || "你的神卡卡號";

  useEffect(() => {
    // A. 監聽地端讀卡機 (Python)
    const checkLocal = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:5000/scan');
        const data = await res.json();
        
        if (data.status === "success") {
          handleAuth(data.id, "實體讀卡");
        } else if (data.status === "removed") {
          // 🚩 拔卡清除邏輯：卡片拔出，立刻恢復待命
          setIsSuccess(false);
          setStatus("⌛ 系統待命：請插卡或感應");
        }
      } catch (e) {}
    }, 1000);

    // B. 監聽雲端手機感應 (NFC)
    const scanRef = ref(db, 'system/last_scan');
    const unsubscribe = onValue(scanRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.id) handleAuth(data.id, "手機感應");
    });

    return () => { clearInterval(checkLocal); unsubscribe(); };
  }, []);

  async function handleAuth(cardId, source) {
    if (isSuccess) return;
    const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
    const godId = MY_GOD_CARD.replace(/[\s:]/g, '').toUpperCase();

    // 🚩 1. 判斷神卡 (組長專用)
    if (cleanId === godId) {
      setIsSuccess(true);
      setStatus("👑 管理員神卡確認，進入系統...");
      if (source === "手機感應") await set(ref(db, 'system/last_scan'), null);
      setTimeout(() => router.push('/admin'), 1000);
      return;
    }
    
    // 2. 判斷一般授權卡
    const userSnap = await get(ref(db, `authorized_cards/${cleanId}`));
    if (userSnap.exists()) {
      setIsSuccess(true);
      setStatus(`✅ 歡迎 ${userSnap.val().name}`);
      if (source === "手機感應") await set(ref(db, 'system/last_scan'), null);
    } else {
      setStatus(`🚫 未註冊卡片: ${cleanId.substring(0,8)}`);
    }
  }

  return (
    <div style={isSuccess ? successBg : normalBg}>
      <div style={cardStyle}>
        <h1>TERRY EDU</h1>
        <div style={{ fontSize: '5rem' }}>{isSuccess ? "🔓" : "🛡️"}</div>
        <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{status}</p>
      </div>
    </div>
  );
}

const normalBg = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: 'white', textAlign: 'center' };
const successBg = { ...normalBg, background: '#064e3b' };
const cardStyle = { padding: '50px', borderRadius: '30px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' };
