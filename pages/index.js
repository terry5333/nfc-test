import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue, set, push, get } from 'firebase/database';

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastScanId, setLastScanId] = useState(null);
  const [authorizedCards, setAuthorizedCards] = useState({});
  const [newName, setNewName] = useState("");

  const MY_GOD_CARD = process.env.NEXT_PUBLIC_MY_GOD_CARD;

  useEffect(() => {
    // 監聽掃描紀錄
    onValue(ref(db, 'system/last_scan'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLastScanId(data.id);
        if (data.id === MY_GOD_CARD) setIsAdmin(true);
      }
    });

    // 監聽授權名單
    onValue(ref(db, 'authorized_cards'), (snapshot) => {
      setAuthorizedCards(snapshot.val() || {});
    });
  }, [MY_GOD_CARD]);

  const registerCard = async () => {
    if (!newName) return alert("請輸入姓名");
    const cleanId = lastScanId.replace(/:/g, '');
    await set(ref(db, `authorized_cards/${cleanId}`), {
      name: newName,
      id: lastScanId,
      timestamp: Date.now()
    });
    setNewName("");
    alert("卡片註冊成功！");
  };

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#1a1a2e', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <h1>🔒 系統鎖定</h1>
          <p>請感應管理員神之卡以解鎖後台</p>
          {lastScanId && <p style={{ color: '#ff4b2b' }}>偵測到無效卡片：{lastScanId}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif' }}>
      <h1>🔓 TerryEdu 管理後台</h1>
      <div style={{ background: '#f0f4f8', padding: '20px', borderRadius: '10px' }}>
        <h3>🆕 當前掃描 ID：{lastScanId}</h3>
        <input value={newName} onChange={(e)=>setNewName(e.target.value)} placeholder="使用者姓名" />
        <button onClick={registerCard}>新增此卡片</button>
      </div>
      <hr />
      <h3>👥 已授權名單</h3>
      <ul>
        {Object.values(authorizedCards).map(card => (
          <li key={card.id}>{card.name} ({card.id})</li>
        ))}
      </ul>
      <button onClick={() => { set(ref(db, 'system/last_scan'), null); location.reload(); }}>登出系統</button>
    </div>
  );
}
