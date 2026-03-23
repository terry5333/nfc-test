import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue, set, remove } from 'firebase/database';

export default function Admin() {
  const [teachers, setTeachers] = useState([]);
  const [lastScan, setLastScan] = useState(""); // 🚩 自動抓取剛感應的卡號
  const [newName, setNewName] = useState("");
  const [role, setRole] = useState("teacher");

  useEffect(() => {
    // 1. 監聽最新感應到的卡號 (來自手機或 Python)
    const scanRef = ref(db, 'system/last_scan');
    onValue(scanRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.id) {
        setLastScan(data.id.replace(/[\s:]/g, '').toUpperCase());
      }
    });

    // 2. 監聽已註冊清單
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

  return (
    <div style={adminLayout}>
      <h2>🛠️ TerryEdu 快速註冊中心</h2>
      
      {/* 註冊區塊 */}
      <div style={registerCard}>
        <h3>🆕 新增授權</h3>
        <p>請感應卡片或掃描條碼...</p>
        <div style={inputGroup}>
          <label>偵測到卡號：</label>
          <input value={lastScan} readOnly placeholder="等待感應中..." style={readOnlyInput} />
        </div>
        <div style={inputGroup}>
          <label>姓名/班級：</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例如：林小明 或 201班" />
        </div>
        <div style={inputGroup}>
          <label>身分：</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="teacher">🍎 老師 (可進入系統)</option>
            <option value="student">🎒 學生 (僅限打卡)</option>
          </select>
        </div>
        <button onClick={handleSave} style={saveBtn}>確認註冊</button>
      </div>

      {/* 清單區塊 */}
      <div style={listArea}>
        <h3>📋 已授權名單 ({teachers.length})</h3>
        {teachers.map(t => (
          <div key={t.dbId} style={listItem}>
            <span>{t.role === 'teacher' ? '🍎' : '🎒'} <b>{t.name}</b> <small>({t.dbId})</small></span>
            <button onClick={() => remove(ref(db, `authorized_cards/${t.dbId}`))} style={delBtn}>刪除</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// 樣式略 (保持簡潔)
const adminLayout = { padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' };
const registerCard = { background: '#f0f9ff', padding: '20px', borderRadius: '15px', border: '2px solid #bae6fd', marginBottom: '30px' };
const inputGroup = { marginBottom: '15px', display: 'flex', flexDirection: 'column' };
const readOnlyInput = { background: '#e2e8f0', border: '1px solid #cbd5e1' };
const saveBtn = { width: '100%', padding: '12px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' };
const listItem = { display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #eee' };
const delBtn = { color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' };
