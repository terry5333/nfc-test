import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { ref, onValue, get, set } from 'firebase/database';

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState("🔒 系統鎖定中...");
  const [isSuccess, setIsSuccess] = useState(false);
  const MY_GOD_CARD = process.env.NEXT_PUBLIC_MY_GOD_CARD;

  useEffect(() => {
    // --- 1. 監聽地端 Python (IC 卡 / 接觸式) ---
    const checkLocalIC = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:5000/scan');
        const data = await res.json();
        if (data.status === "success") handleAuth(data.id, "IC/ID");
      } catch (err) {
        // Python 未啟動時不顯示錯誤，保持靜默
      }
    }, 1000);

    // --- 2. 監聽雲端 Firebase (手機傳過來的老師卡) ---
    const scanRef = ref(db, 'system/last_scan');
    const unsubscribeFirebase = onValue(scanRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.id) handleAuth(data.id, "Mobile/NFC");
    });

    // --- 統一驗證與跳轉邏輯 ---
    async function handleAuth(cardId, source) {
      if (isSuccess) return;

      const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
      const godId = MY_GOD_CARD.replace(/[\s:]/g, '').toUpperCase();

      // 判定管理員
      if (cleanId === godId) {
        executeLogin("管理員", source);
        setTimeout(() => router.push('/admin'), 1000);
        return;
      }

      // 判定一般授權老師
      const userSnap = await get(ref(db, `authorized_cards/${cleanId}`));
      if (userSnap.exists()) {
        executeLogin(userSnap.val().name, source);
        setTimeout(() => router.push('/teacher'), 1000);
      } else {
        setStatus(`🚫 未授權卡片: ${cardId.substring(0, 10)}...`);
      }
    }

    async function executeLogin(name, source) {
      setIsSuccess(true);
      setStatus(`✅ ${name} 驗證成功 (${source})`);
      // 如果是從手機來的，要清空 Firebase 避免重複觸發
      if (source === "Mobile/NFC") {
        await set(ref(db, 'system/last_scan'), null);
      }
    }

    return () => {
      clearInterval(checkLocalIC);
      unsubscribeFirebase();
    };
  }, [router, MY_GOD_CARD, isSuccess]);

  return (
    <div style={isSuccess ? successStyle : normalStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: '3rem', margin: '0' }}>TERRY EDU</h1>
        <div style={{ fontSize: '5rem', margin: '20px 0' }}>{isSuccess ? "🔓" : "🛡️"}</div>
        <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{status}</p>
        <p style={{ opacity: 0.5 }}>[ 請插入 IC 卡或感應學生證 ]</p>
      </div>
    </div>
  );
}

// 樣式設定
const normalStyle = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: 'white', fontFamily: 'sans-serif' };
const successStyle = { ...normalStyle, background: '#064e3b' };
const cardStyle = { textAlign: 'center', padding: '60px', borderRadius: '40px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' };
