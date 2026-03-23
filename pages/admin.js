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
    // 監聽最新掃描到的 ID (包含還沒註冊的)
    onValue(ref(db, 'system/last_scan'), (snapshot) => {
      if (snapshot.exists()) setLastScanId(snapshot.val().id);
    });

    // 讀取所有已授權名單
    onValue(ref(db, 'authorized_cards'), (snapshot) => {
      setCardList(snapshot.val() || {});
    });
  }, []);

  // 註冊新卡片
  const handleAddCard = async () => {
    if (!newName || !lastScanId) {
      alert("請輸入姓名並確保手機端有掃描到卡片");
      return;
    }
    const cleanId = lastScanId.replace(/:/g, '');
    await set(ref(db, `authorized_cards/${cleanId}`), {
      name: newName,
      id: lastScanId,
      role: 'teacher',
      createdAt: Date.now()
    });
    setName("");
    alert(`${newName} 老師的卡片已註冊成功！`);
  };

  // 刪除卡片
  const handleDelete = async (key) => {
    if (confirm("確定要取消此卡片的授權嗎？")) {
      await remove(ref(db, `authorized_cards/${key}`));
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>🛠️ TerryEdu 管理後台</h1>
        <button onClick={() => router.push('/')} style={logoutBtn}>登出系統</button>
      </div>

      <div style={boxStyle}>
        <h3>🆕 快速註冊模式</h3>
        <p>目前感應到的 ID：<code style={{background:'#eee', padding:'2px 5px'}}>{lastScanId || "等待掃描..."}</code></p>
        <input 
          style={inputStyle}
          value={newName} 
          onChange={(e) => setNewName(e.target.value)} 
          placeholder="輸入教師姓名 (例如：林小華)" 
        />
        <button style={addBtn} onClick={handleAddCard}>確認新增授權</button>
      </div>

      <h3>👥 已授權教師名單</h3>
      <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', border: '1px solid #ddd' }}>
        {Object.entries(cardList).map(([key, val]) => (
          <div key={key} style={listItemStyle}>
            <div>
              <div style={{ fontWeight: 'bold' }}>{val.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>ID: {val.id}</div>
            </div>
            <button style={delBtn} onClick={() => handleDelete(key)}>刪除</button>
          </div>
        ))}
        {Object.keys(cardList).length === 0 && <p style={{padding:'20px', textAlign:'center'}}>尚無授權名單</p>}
      </div>
    </div>
  );
}

// UI 樣式
const boxStyle = { background: '#f8fafc', padding: '25px', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '30px' };
const inputStyle = { padding: '10px', borderRadius: '5px', border: '1px solid #cbd5e1', marginRight: '10px', width: '200px' };
const addBtn = { padding: '10px 20px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' };
const logoutBtn = { padding: '5px 15px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', alignSelf: 'center' };
const listItemStyle = { display: 'flex', justifyContent: 'space-between', padding: '15px', borderBottom: '1px solid #eee', alignItems: 'center' };
const delBtn = { color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' };
