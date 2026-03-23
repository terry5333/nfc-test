import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue, set, remove } from 'firebase/database';

export default function Admin() {
  const [teachers, setTeachers] = useState([]);
  const [lastScan, setLastScan] = useState("");
  const [newName, setNewName] = useState("");
  const [role, setRole] = useState("teacher");

  useEffect(() => {
    // 監聽最新感應到的卡號
    const scanRef = ref(db, 'system/last_scan');
    onValue(scanRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.id) {
        setLastScan(data.id.replace(/[\s:]/g, '').toUpperCase());
      }
    });

    // 監聽已註冊清單
    return onValue(ref(db, 'authorized_cards'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTeachers(Object.keys(data).map(id => ({ dbId: id, ...data[id] })));
      } else { setTeachers([]); }
    });
  }, []);

  const handleSave = async () => {
    if (!lastScan || !newName) return alert("請先感應卡片並輸入姓名");
    await set(ref(db, `authorized_cards/${lastScan}`), {
      name: newName,
      role: role,
      updatedAt: Date.now()
    });
    setNewName("");
    setLastScan("");
    alert("✨ 註冊成功！");
  };

  // --- 樣式定義 (補齊了所有清單變數) ---
  const adminLayout = { padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif', color: '#334155' };
  const registerCard = { background: '#f0f9ff', padding: '20px', borderRadius: '15px', border: '2px solid #bae6fd', marginBottom: '30px' };
  const inputGroup = { marginBottom: '15px', display: 'flex', flexDirection: 'column' };
  const readOnlyInput = { background: '#e2e8f0', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '5px' };
  const textInput = { padding: '10px', borderRadius: '5px', border: '1px solid #cbd5e1' };
  const saveBtn = { width: '100%', padding: '12px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
  const listArea = { background: '#fff', borderRadius: '15px', border: '1px solid #e2e8f0', padding: '10px' }; // 🚩 補上這行
  const listItem = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid #f1f5f9' };
  const delBtn = { color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' };

  return (
    <div style={adminLayout}>
      <h2 style={{ textAlign: 'center' }}>🛠️ TerryEdu 註冊後台</h2>
      
      <div style={registerCard}>
        <h3 style={{ marginTop: 0 }}>🆕 快速新增授權</h3>
        <p style={{ fontSize: '0.9rem', color: '#64748b' }}>請感應卡片或掃描條碼，系統將自動填入 ID</p>
        
        <div style={inputGroup}>
          <label style={{ fontWeight: 'bold', marginBottom: '5px' }}>偵測到卡號：</label>
          <input value={lastScan} readOnly placeholder="等待感應..." style={readOnlyInput} />
        </div>
        
        <div style={inputGroup}>
          <label style={{ fontWeight: 'bold', marginBottom: '5px' }}>姓名/班級：</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="輸入使用者姓名" style={textInput} />
        </div>
        
        <div style={inputGroup}>
          <label style={{ fontWeight: 'bold', marginBottom: '5px' }}>身分：</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={textInput}>
            <option value="teacher">🍎 老師 (可進入系統)</option>
            <option value="student">🎒 學生 (僅限打卡)</option>
          </select>
        </div>
        
        <button onClick={handleSave} style={saveBtn}>確認註冊</button>
      </div>

      <div style={listArea}>
        <h3 style={{ padding: '0 10px' }}>📋 已授權名單 ({teachers.length})</h3>
        {teachers.map(t => (
          <div key={t.dbId} style={listItem}>
            <div>
              <span>{t.role === 'teacher' ? '🍎' : '🎒'} <b>{t.name}</b></span>
              <br/>
              <code style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t.dbId}</code>
            </div>
            <button onClick={() => remove(ref(db, `authorized_cards/${t.dbId}`))} style={delBtn}>移除</button>
          </div>
        ))}
        {teachers.length === 0 && <p style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>目前無註冊資料</p>}
      </div>
    </div>
  );
}
