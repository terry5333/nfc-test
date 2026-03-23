import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { ref, onValue, get, set } from 'firebase/database';

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState("🔒 系統鎖定中...");
  const MY_GOD_CARD = process.env.NEXT_PUBLIC_MY_GOD_CARD;

  useEffect(() => {
    const scanRef = ref(db, 'system/last_scan');
    
    const unsubscribe = onValue(scanRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data || !data.id) return; // 如果已被抹除或是空的，就忽略

      const cardId = data.id;

      // 1. 判定管理員
      if (cardId === MY_GOD_CARD) {
        setStatus("✅ 管理員驗證成功...");
        await set(ref(db, 'system/last_scan'), null); // 🚩 關鍵：立刻抹除雲端紀錄
        router.push('/admin');
        return;
      }

      // 2. 判定教師
      const cleanId = cardId.replace(/:/g, '');
      const userSnap = await get(ref(db, `authorized_cards/${cleanId}`));
      
      if (userSnap.exists()) {
        setStatus(`👋 歡迎 ${userSnap.val().name} 老師`);
        await set(ref(db, 'system/last_scan'), null); // 🚩 關鍵：立刻抹除雲端紀錄
        router.push('/teacher');
      } else {
        setStatus(`🚫 未授權卡片: ${cardId}`);
        // 未授權卡片我們不抹除，讓管理員可以在 /admin 頁面看到它並註冊
      }
    });

    return () => unsubscribe();
  }, [router, MY_GOD_CARD]);

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1>TERRY EDU</h1>
        <div style={{ fontSize: '3rem' }}>🛡️</div>
        <p style={{ color: '#00d2ff', fontWeight: 'bold' }}>{status}</p>
        <p style={{ opacity: 0.6 }}>請在門口出示感應卡</p>
      </div>
    </div>
  );
}

const pageStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: 'white', fontFamily: 'sans-serif' };
const cardStyle = { textAlign: 'center', padding: '60px', borderRadius: '40px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' };
