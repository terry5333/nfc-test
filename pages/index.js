import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { ref, onValue, get, set } from 'firebase/database';

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState("🔒 系統鎖定中，請感應 ID 或插入 IC 卡...");
  const MY_GOD_CARD = process.env.NEXT_PUBLIC_MY_GOD_CARD;

  useEffect(() => {
    // --- 來源 A: 手機感應 (ID/NFC) ---
    const scanRef = ref(db, 'system/last_scan');
    const unsubscribeFirebase = onValue(scanRef, async (snapshot) => {
      const data = snapshot.val();
      if (data && data.id) handleAuth(data.id, "ID/NFC");
    });

    // --- 來源 B: 地端讀卡機 (IC 卡) ---
    const checkLocalIC = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:5000/scan');
        const data = await res.json();
        if (data.status === "success") handleAuth(data.id, "IC 卡");
      } catch (err) {
        // Python 沒開時不報錯，靜默等待
      }
    }, 1000);

    // --- 統一驗證邏輯 ---
    async function handleAuth(cardId, type) {
      const cleanId = cardId.replace(/[\s:]/g, ''); // 統一格式：移除空格與冒號
      const godId = MY_GOD_CARD.replace(/[\s:]/g, '');

      if (cleanId === godId) {
        setStatus(`✅ 管理員 (${type}) 驗證成功...`);
        if (type === "ID/NFC") await set(ref(db, 'system/last_scan'), null); // 清空雲端
        setTimeout(() => router.push('/admin'), 500);
        return;
      }

      const userSnap = await get(ref(db, `authorized_cards/${cleanId}`));
      if (userSnap.exists()) {
        setStatus(`👋 歡迎 ${userSnap.val().name} 老師 (${type})`);
        if (type === "ID/NFC") await set(ref(db, 'system/last_scan'), null);
        setTimeout(() => router.push('/teacher'), 500);
      } else {
        setStatus(`🚫 未授權 ${type}: ${cardId.substring(0, 10)}...`);
      }
    }

    return () => {
      unsubscribeFirebase();
      clearInterval(checkLocalIC);
    };
  }, [router, MY_GOD_CARD]);

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1>TERRY EDU</h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '3rem' }}>
          <span>📲</span><span>💳</span>
        </div>
        <p style={{ color: '#00d2ff', fontWeight: 'bold', marginTop: '20px' }}>{status}</p>
      </div>
    </div>
  );
}

const pageStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: 'white', fontFamily: 'sans-serif' };
const cardStyle = { textAlign: 'center', padding: '50px', borderRadius: '40px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' };
