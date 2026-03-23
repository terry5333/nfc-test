import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue, set, remove, push, update } from 'firebase/database';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('students');
  const [lastScan, setLastScan] = useState("");
  const [scanMode, setScanMode] = useState("上學"); // 門禁總開關狀態

  const [students, setStudents] = useState([]);
  const [authCards, setAuthCards] = useState({}); // 存放所有卡片的詳細狀態 (包含鎖卡資訊)
  const [teachers, setTeachers] = useState([]);
  const [logs, setLogs] = useState([]);

  const [newStudent, setNewStudent] = useState({ classInfo: '', seat: '', name: '' });
  const [newTeacherName, setNewTeacherName] = useState("");
  const [bindingTarget, setBindingTarget] = useState(null);

  useEffect(() => {
    // 1. 監聽門禁總開關
    const unsubMode = onValue(ref(db, 'system/settings/scanMode'), (s) => setScanMode(s.val() || "上學"));

    // 2. 監聽地端 Python (USB 讀卡機)
    const checkLocal = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:5000/scan');
        const data = await res.json();
        if (data.status === "success" && data.id) setLastScan(data.id.replace(/[\s:]/g, '').toUpperCase());
      } catch (e) {}
    }, 1000);

    // 3. 監聽雲端與資料庫
    const unsubScan = onValue(ref(db, 'system/last_scan'), (s) => {
      const data = s.val();
      if (data && data.id) setLastScan(data.id.replace(/[\s:]/g, '').toUpperCase());
    });
    
    const unsubStudents = onValue(ref(db, 'school_roster'), (s) => {
      const data = s.val();
      setStudents(data ? Object.keys(data).map(k => ({ dbId: k, ...data[k] })) : []);
    });
    
    const unsubCards = onValue(ref(db, 'authorized_cards'), (s) => {
      const data = s.val() || {};
      setAuthCards(data); // 儲存所有卡片資訊以便查閱鎖定狀態
      setTeachers(Object.keys(data).map(k => ({ cardId: k, ...data[k] })).filter(item => item.role === 'teacher'));
    });
    
    const unsubLogs = onValue(ref(db, 'student_logs'), (s) => {
      const data = s.val();
      setLogs(data ? Object.values(data).reverse() : []);
    });

    return () => { clearInterval(checkLocal); unsubMode(); unsubScan(); unsubStudents(); unsubCards(); unsubLogs(); };
  }, []);

  // --- 操作邏輯 ---
  const toggleScanMode = async () => {
    const newMode = scanMode === '上學' ? '放學' : '上學';
    await set(ref(db, 'system/settings/scanMode'), newMode);
  };

  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.classInfo) return alert("請填寫班級與姓名");
    await push(ref(db, 'school_roster'), { ...newStudent, cardId: null });
    setNewStudent({ classInfo: '', seat: '', name: '' });
  };

  const startBinding = (student) => { setBindingTarget(student); setLastScan(""); };

  const confirmBinding = async () => {
    if (!lastScan || !bindingTarget) return;
    await set(ref(db, `school_roster/${bindingTarget.dbId}/cardId`), lastScan);
    await set(ref(db, `authorized_cards/${lastScan}`), { 
      name: `${bindingTarget.classInfo}-${bindingTarget.seat} ${bindingTarget.name}`, 
      role: 'student', refId: bindingTarget.dbId, spamCount: 0, isLocked: false 
    });
    setBindingTarget(null); setLastScan("");
    alert("✅ 學生綁卡成功！");
  };

  const handleUnlock = async (cardId) => {
    await update(ref(db, `authorized_cards/${cardId}`), { isLocked: false, spamCount: 0 });
    alert("🔓 已解除封印！");
  };

  const handleAddTeacher = async () => {
    if (!lastScan || !newTeacherName) return alert("請感應卡片並填寫老師姓名");
    await set(ref(db, `authorized_cards/${lastScan}`), { name: newTeacherName, role: 'teacher' });
    setNewTeacherName(""); setLastScan("");
    alert("✅ 老師註冊成功！");
  };

  const exportToHeFeng = () => {
    if (logs.length === 0) return alert("目前沒有打卡紀錄可匯出！");
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF打卡日期,打卡時間,學生姓名,感應卡號,打卡狀態\n";
    logs.forEach(log => {
      const d = new Date(log.time);
      csvContent += `${d.toLocaleDateString('zh-TW')},${d.toLocaleTimeString('zh-TW', { hour12: false })},${log.name || "未命名"},${log.id || ""},${log.period || "正常"}\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `禾豐打卡匯出_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '')}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // --- 昭和風介面渲染 ---
  return (
    <div style={layout}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700&display=swap');`}</style>
      
      <header style={header}>
        <h1 style={title}>TerryEdu 案內所</h1>
        
        {/* 門禁總開關 */}
        <div style={modeSwitchContainer}>
          <span style={{ fontWeight: 'bold', marginRight: '15px', fontSize: '1.2rem' }}>⛩️ 現在門禁狀態：</span>
          <button onClick={toggleScanMode} style={scanMode === '上學' ? modeBtnMorning : modeBtnEvening}>
            {scanMode === '上學' ? '🌅 登校 (上學) 收集中' : '🌇 下校 (放學) 收集中'}
          </button>
          <p style={{ fontSize: '0.85rem', color: '#8c3b3a', marginTop: '10px', margin: '10px 0 0 0' }}>
            ※ 點擊木牌切換。全校打卡機將同步切換為此狀態，並套用防呆機制。
          </p>
        </div>

        <div style={tabs}>
          <button onClick={() => setActiveTab('students')} style={activeTab === 'students' ? activeBtn : btn}>壹。生徒登錄</button>
          <button onClick={() => setActiveTab('attendance')} style={activeTab === 'attendance' ? activeBtn : btn}>貳。出勤紀錄</button>
          <button onClick={() => setActiveTab('teachers')} style={activeTab === 'teachers' ? activeBtn : btn}>參。教師名簿</button>
        </div>
      </header>

      <main style={mainContent}>
        {activeTab === 'students' && (
          <div>
            <h2 style={sectionTitle}>🎒 生徒名冊與識別卷發放</h2>
            <div style={formCard}>
              <input placeholder="班級 (例:201)" value={newStudent.classInfo} onChange={e => setNewStudent({...newStudent, classInfo: e.target.value})} style={input} />
              <input placeholder="座號 (例:05)" value={newStudent.seat} onChange={e => setNewStudent({...newStudent, seat: e.target.value})} style={input} />
              <input placeholder="姓名" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} style={input} />
              <button onClick={handleAddStudent} style={actionBtn}>記入</button>
            </div>

            {bindingTarget && (
              <div style={alertBox}>
                <p style={{margin: 0, fontWeight: 'bold'}}>⚠️ 正在為【 {bindingTarget.name} 】發放識別卷</p>
                <p style={{margin: '10px 0'}}>請將卡片放置於感應區... 目前讀取: <code style={codeBlock}>{lastScan || "待機中"}</code></p>
                <div>
                  {lastScan && <button onClick={confirmBinding} style={confirmBtn}>確認發放</button>}
                  <button onClick={() => setBindingTarget(null)} style={cancelBtn}>取消</button>
                </div>
              </div>
            )}

            <table style={table}>
              <thead><tr><th>班級</th><th>座號</th><th>氏名</th><th>識別卷狀態</th><th>處置</th></tr></thead>
              <tbody>
                {students.map(s => {
                  const cardData = s.cardId ? authCards[s.cardId] : null;
                  const isLocked = cardData?.isLocked;
                  return (
                    <tr key={s.dbId} style={isLocked ? {background: '#f8d7da'} : {}}>
                      <td>{s.classInfo}</td><td>{s.seat}</td><td><b style={{color: isLocked ? '#9b2226' : 'inherit'}}>{s.name}</b></td>
                      <td>
                        {s.cardId 
                          ? (isLocked ? <span style={{color:'#9b2226', fontWeight:'bold'}}>🔒 謹慎中 (鎖定)</span> : <span style={{color:'#2d6a4f', fontWeight:'bold'}}>✅ 正常運作</span>) 
                          : <span style={{color:'#888'}}>未發放</span>}
                      </td>
                      <td>
                        {!s.cardId && <button onClick={() => startBinding(s)} style={actionBtn}>+ 綁定</button>}
                        {isLocked && <button onClick={() => handleUnlock(s.cardId)} style={unlockBtn}>🔓 恩赦</button>}
                        {s.cardId && !isLocked && <button onClick={() => remove(ref(db, `authorized_cards/${s.cardId}`)).then(()=>set(ref(db, `school_roster/${s.dbId}/cardId`), null))} style={cancelBtn}>收回</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={sectionTitle}>🕰️ 本日出勤帳</h2>
              <button onClick={exportToHeFeng} style={exportBtn}>📥 匯出禾豐 CSV</button>
            </div>
            <table style={table}>
              <thead><tr><th>時段</th><th>刻 (時間)</th><th>氏名 (姓名)</th><th>識別番號</th></tr></thead>
              <tbody>
                {logs.slice(0, 100).map((log, i) => (
                  <tr key={i}>
                    <td style={{color: log.period === '上學' ? '#2d6a4f' : '#8c3b3a', fontWeight: 'bold'}}>{log.period || '紀錄'}</td>
                    <td>{new Date(log.time).toLocaleString('zh-TW')}</td>
                    <td style={{fontWeight:'bold', color:'#3e2723'}}>{log.name}</td>
                    <td><code style={codeBlock}>{log.id}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'teachers' && (
          <div>
            <h2 style={sectionTitle}>🍎 教職員特許名簿</h2>
            <div style={formCard}>
              <p style={{margin: 0, paddingRight: '15px', fontWeight: 'bold'}}>請感應卡片：<code style={codeBlock}>{lastScan || "待機中..."}</code></p>
              <input placeholder="輸入教職員姓名" value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)} style={input} />
              <button onClick={handleAddTeacher} style={actionBtn}>特許發放</button>
            </div>
            
            <table style={table}>
              <thead><tr><th>教職員氏名</th><th>識別番號</th><th>處置</th></tr></thead>
              <tbody>
                {teachers.map(t => (
                  <tr key={t.cardId}>
                    <td style={{fontWeight:'bold'}}>{t.name}</td><td><code style={codeBlock}>{t.cardId}</code></td>
                    <td><button onClick={() => remove(ref(db, `authorized_cards/${t.cardId}`))} style={cancelBtn}>剝奪</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

// --- 昭和風樣式 ---
const layout = { padding: '40px 20px', minHeight: '100vh', background: '#f4ecd8', fontFamily: '"Noto Serif TC", serif', color: '#3e2723' };
const header = { maxWidth: '1000px', margin: '0 auto 30px auto', textAlign: 'center', borderBottom: '3px double #3e2723', paddingBottom: '20px' };
const title = { fontSize: '2.5rem', letterSpacing: '5px', margin: '0 0 20px 0', color: '#5a3d31', fontWeight: 'bold' };

const modeSwitchContainer = { background: '#dcd3c6', padding: '15px', border: '2px solid #3e2723', display: 'inline-block', marginBottom: '25px', boxShadow: '3px 3px 0px #3e2723' };
const modeBtnMorning = { padding: '10px 20px', background: '#d9b650', color: '#3e2723', border: '2px solid #3e2723', fontFamily: '"Noto Serif TC", serif', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '2px 2px 0px #3e2723', transition: '0.1s' };
const modeBtnEvening = { ...modeBtnMorning, background: '#5c7a5f', color: '#f4ecd8' };

const tabs = { display: 'flex', justifyContent: 'center', gap: '15px' };
const btn = { padding: '8px 20px', border: '2px solid #3e2723', background: '#eaddc5', color: '#3e2723', fontFamily: '"Noto Serif TC", serif', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '2px 2px 0px #3e2723' };
const activeBtn = { ...btn, background: '#3e2723', color: '#f4ecd8', boxShadow: 'none', transform: 'translate(2px, 2px)' };
const mainContent = { maxWidth: '1000px', margin: '0 auto', background: '#fffcf5', padding: '30px', border: '2px solid #3e2723', boxShadow: '5px 5px 0px #3e2723' };
const sectionTitle = { borderLeft: '8px solid #8c3b3a', paddingLeft: '15px', color: '#3e2723', marginTop: '0' };
const formCard = { display: 'flex', gap: '10px', padding: '20px', background: '#eaddc5', border: '1px solid #3e2723', marginBottom: '25px', alignItems: 'center' };
const input = { padding: '8px 12px', border: '1px solid #3e2723', background: '#f4ecd8', fontFamily: '"Noto Serif TC", serif', flex: 1, fontSize: '1rem', outline: 'none' };

const actionBtn = { padding: '8px 20px', background: '#5c7a5f', color: '#f4ecd8', border: '2px solid #3e2723', fontFamily: '"Noto Serif TC", serif', cursor: 'pointer', fontWeight: 'bold', boxShadow: '2px 2px 0px #3e2723' };
const cancelBtn = { padding: '8px 15px', background: '#8c3b3a', color: '#f4ecd8', border: '2px solid #3e2723', fontFamily: '"Noto Serif TC", serif', cursor: 'pointer', boxShadow: '2px 2px 0px #3e2723' };
const confirmBtn = { padding: '8px 15px', background: '#d9b650', color: '#3e2723', border: '2px solid #3e2723', fontFamily: '"Noto Serif TC", serif', cursor: 'pointer', boxShadow: '2px 2px 0px #3e2723', fontWeight: 'bold' };
const unlockBtn = { padding: '8px 15px', background: '#d97750', color: '#fffcf5', border: '2px solid #3e2723', fontFamily: '"Noto Serif TC", serif', cursor: 'pointer', boxShadow: '2px 2px 0px #3e2723', fontWeight: 'bold', marginRight: '5px' };
const exportBtn = { padding: '8px 20px', background: '#3b82f6', color: '#fff', border: '2px solid #3e2723', fontFamily: '"Noto Serif TC", serif', cursor: 'pointer', fontWeight: 'bold', boxShadow: '2px 2px 0px #3e2723' };
const alertBox = { padding: '20px', background: '#f5e6d3', border: '2px dashed #8c3b3a', marginBottom: '25px', color: '#3e2723' };
const codeBlock = { background: '#dcd3c6', padding: '2px 8px', border: '1px solid #a89f91', fontFamily: 'monospace' };

const table = { width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '10px', border: '2px solid #3e2723' };

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `th, td { border: 1px solid #3e2723; padding: 12px 15px; } th { background: #dcd3c6; color: #3e2723; font-weight: bold; letter-spacing: 2px; } tr:nth-child(even) { background: #fbf8f1; }`;
  document.head.appendChild(style);
}
