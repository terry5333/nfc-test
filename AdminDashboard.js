import { useState, useEffect } from 'react';
import { db } from './firebase'; // 你的 Firebase 設定
import { ref, onValue, set, get } from "firebase/database";

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentScan, setCurrentScan] = useState(null);
  const [newName, setNewName] = useState("");

  const MY_GOD_CARD = process.env.NEXT_PUBLIC_MY_GOD_CARD;

  useEffect(() => {
    const scanRef = ref(db, 'system/last_scan');
    onValue(scanRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      // 1. 如果感應到管理員卡，解鎖後台
      if (data.id === MY_GOD_CARD) {
        setIsAdmin(true);
      } 
      
      // 2. 記錄當前掃描到的卡片 (不論是誰)
      setCurrentScan(data.id);
    });
  }, []);

  const handleRegister = async () => {
    if (!newName) return alert("請輸入姓名");
    // 將新卡片寫入授權名單
    await set(ref(db, `authorized_cards/${currentScan.replace(/:/g, '')}`), {
      name: newName,
      role: "user",
      registeredAt: Date.now()
    });
    alert("註冊成功！");
    setNewName("");
  };

  if (!isAdmin) {
    return <div className="lock-screen">🔒 請感應管理員卡片以進入系統</div>;
  }

  return (
    <div className="admin-panel">
      <h1>🔓 TerryEdu 管理系統</h1>
      
      <div className="registration-box">
        <h3>🆕 當前感應到的卡片：{currentScan}</h3>
        <input 
          value={newName} 
          onChange={(e) => setNewName(e.target.value)} 
          placeholder="輸入使用者姓名 (例如：李老師)"
        />
        <button onClick={handleRegister}>新增至授權名單</button>
      </div>

      <hr />
      
      <h3>👥 已授權名單</h3>
      {/* 這裡可以 map 讀取 authorized_cards 的列表 */}
    </div>
  );
}
