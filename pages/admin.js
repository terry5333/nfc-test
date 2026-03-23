import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { ref, onValue, set, remove } from 'firebase/database';

export default function Admin() {
  const router = useRouter();
  const [lastScanId, setLastScanId] = useState("");
  const [cardList, setCardList] = useState({});
  const [newName, setNewName] = useState("");

  useEffect(() => {
    // 監聽最新掃描到的卡片 (包含剛感應的未知卡)
    onValue(ref(db, 'system/last_scan'), (snapshot) => {
      setLastScanId(snapshot.val()?.id || "");
    });

    // 監聽並讀取所有已授權教師名單
    onValue(ref(db, 'authorized_cards'), (snapshot) => {
      setAuthorizedCards(snapshot.val() || {});
    });
  }, []);

  const [authorizedCards, setAuthorizedCards] = useState({});

  // 註冊卡片功能
  const handleRegister = async () => {
    if (!newName || !lastScanId) {
      alert("請輸入姓名，並確保手機端有讀到卡片 ID！");
      return;
    }
    const cleanId = lastScanId.replace(/:/g, '');
    
    // 寫入授權名單
    await set(ref(db, `authorized_cards/${cleanId}`), {
      name: newName,
      id: lastScanId,
      role: 'teacher',
      createdAt: Date.now()
    });

    // 🚩 註冊成功後，主動清空感應紀錄，讓 UI 回到「等待感應」狀態
    await set(ref(db, 'system/last_scan'), null);
    
    setNewName("");
    alert(`${newName} 老師已授權成功！`);
  };

  const deleteCard = async (key) => {
    if (confirm("確定要移除此卡權限嗎？")) {
      await remove(ref(db, `authorized_cards/${key}`));
    }
  };

  const manualClear = () => set(ref(db, 'system/last_scan'), null);

  return (
    <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif', color: '#334155' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1>🛠️ 管理員控制中心</h1>
        <button onClick={() => router.push('/')} style={logoutStyle}>登出系統</button>
      </header>

      {/* 註冊區域 */}
      <div style={registerBoxStyle}>
        <h3>✨ 快速註冊模式</h3>
        <p>目前感應到的 ID：<code style={codeStyle}>{lastScanId || "等待手機感應中..."}</code></p>
        
        {lastScanId && (
          <div style={{ marginTop: '20px' }}>
            <input 
              style={inputStyle}
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              placeholder="請輸入教師姓名" 
            />
            <button style={btnStyle} onClick={handleRegister}>完成註冊</button>
            <button style={clearBtnStyle} onClick={manualClear}>重置感應狀態</button>
          </div>
        )}
      </div>

      {/* 名單區域 */}
      <h3>👥 已授權名單 ({Object.keys(authorizedCards).length})</h3>
      <div style={listContainerStyle}>
        {Object.entries(authorizedCards).map(([key, val]) => (
          <div key={key} style={itemStyle}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{val.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>ID: {val.id}</div>
            </div>
            <button onClick={() => deleteCard(key)} style={delBtnStyle}>移除權限</button>
          </div>
        ))}
        {Object.keys(authorizedCards).length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>目前尚無任何授權教師</div>
        )}
      </div>
    </div>
  );
}

// 樣式設定
const registerBoxStyle = { background: '#f8fafc', padding: '30px', borderRadius: '20px', border: '1px solid #e2e8f0', marginBottom: '40px' };
const codeStyle = { background: '#e2e8f0', padding: '4px 10px', borderRadius: '5px', fontSize: '1.2rem', color: '#0f172a' };
const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '250px', fontSize: '1rem' };
const btnStyle = { padding: '12px 25px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', marginLeft: '10px', cursor: 'pointer' };
const clearBtnStyle = { padding: '12px 15px', background: 'none', border: '1px solid #cbd5e1', borderRadius: '8px', marginLeft: '10px', cursor: 'pointer', color: '#64748b' };
const listContainerStyle = { background: 'white', borderRadius: '15px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' };
const itemStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #f1f5f9' };
const delBtnStyle = { color: '#ef4444', background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer' };
const logoutStyle = { padding: '8px 20px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer' };
