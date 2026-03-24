import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue, set, remove, push, update } from 'firebase/database';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('students'); 
  const [lastScan, setLastScan] = useState("");
  const [scanMode, setScanMode] = useState("上學");

  const [students, setStudents] = useState([]);
  const [authCards, setAuthCards] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [logs, setLogs] = useState([]);

  const [newStudent, setNewStudent] = useState({ classInfo: '', seat: '', name: '' });
  const [newTeacherName, setNewTeacherName] = useState("");
  const [bindingTarget, setBindingTarget] = useState(null);
  const [unlockTarget, setUnlockTarget] = useState(null);

  const [queryDate, setQueryDate] = useState(() => {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzOffset).toISOString().split('T')[0];
  });

  useEffect(() => {
    // 1. 監聽門禁總開關
    const unsubMode = onValue(ref(db, 'system/settings/scanMode'), (s) => setScanMode(s.val() || "上學"));

    // 2. 監聽地端 Python (實體讀卡機)
    const checkLocal = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:5000/scan');
        const data = await res.json();
        if (data.status === "success" && data.id) setLastScan(data.id.replace(/[\s:]/g, '').toUpperCase());
      } catch (e) {}
    }, 1000);

    // 3. 監聽雲端 NFC
    const unsubScan = onValue(ref(db, 'system/last_scan'), (s) => {
      const data = s.val();
      if (data && data.id) setLastScan(data.id.replace(/[\s:]/g, '').toUpperCase());
    });
    
    // 4. 資料庫監聽
    const unsubStudents = onValue(ref(db, 'school_roster'), (s) => {
      const data = s.val();
      setStudents(data ? Object.keys(data).map(k => ({ dbId: k, ...data[k] })) : []);
    });
    const unsubCards = onValue(ref(db, 'authorized_cards'), (s) => {
      const data = s.val() || {};
      setAuthCards(data);
      setTeachers(Object.keys(data).map(k => ({ cardId: k, ...data[k] })).filter(item => item.role === 'teacher'));
    });
    const unsubLogs = onValue(ref(db, 'student_logs'), (s) => {
      const data = s.val();
      setLogs(data ? Object.values(data).reverse() : []);
    });

    // 🚩 5. 全域條碼掃描監聽 (支援 Barcode to PC)
    let barcodeBuffer = "";
    const handleGlobalKeyDown = (e) => {
      // ⚠️ 防呆：如果組長正在輸入框打字(姓名/班級)，就不要攔截鍵盤訊號
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        if (barcodeBuffer.trim() !== "") {
          // 收到 Enter 代表條碼發送完畢，寫入 lastScan
          setLastScan(barcodeBuffer.trim().toUpperCase());
          barcodeBuffer = ""; // 清空緩衝區
        }
      } else if (e.key.length === 1) {
        // 收集條碼字元
        barcodeBuffer += e.key;
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => { 
      clearInterval(checkLocal); unsubMode(); unsubScan(); 
      unsubStudents(); unsubCards(); unsubLogs(); 
      window.removeEventListener('keydown', handleGlobalKeyDown); 
    };
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

  const startBinding = (student) => { setBindingTarget(student); setUnlockTarget(null); setLastScan(""); };
  const startUnlock = (student) => { setUnlockTarget(student); setBindingTarget(null); setLastScan(""); };

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

  const confirmUnlock = async () => {
    if (!lastScan || !unlockTarget) return;
    if (lastScan !== unlockTarget.cardId) {
      alert(`❌ 警告：這不是 【${unlockTarget.name}】 被封印的那張卡！請拿原卡來解鎖。`);
      setLastScan("");
      return;
    }
    await update(ref(db, `authorized_cards/${unlockTarget.cardId}`), { isLocked: false, spamCount: 0 });
    setUnlockTarget(null); setLastScan("");
    alert("🔓 封印解除！卡片已恢復正常。");
  };

  const handleAddTeacher = async () => {
    if (!lastScan || !newTeacherName) return alert("請感應卡片並填寫老師姓名");
    await set(ref(db, `authorized_cards/${lastScan}`), { name: newTeacherName, role: 'teacher' });
    setNewTeacherName(""); setLastScan("");
    alert("✅ 老師註冊成功！");
  };

  const generateDailyReport = () => {
    const dailyStatus = {};
    logs.forEach(log => {
      if (!log.time) return;
      const d = new Date(log.time);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const logDate = `${year}-${month}-${day}`; 
      
      if (logDate === queryDate && log.id) {
        if (!dailyStatus[log.id]) dailyStatus[log.id] = {};
        dailyStatus[log.id][log.period || '上學'] = d.toLocaleTimeString('zh-TW', { hour12: false });
      }
    });

    const sortedStudents = [...students].sort((a, b) => {
      if (a.classInfo !== b.classInfo) return a.classInfo.localeCompare(b.classInfo);
      return a.seat.padStart(2, '0').localeCompare(b.seat.padStart(2, '0'));
    });

    const lockedStudents = sortedStudents.filter(s => s.cardId && authCards[s.cardId]?.isLocked);

    return { sortedStudents, dailyStatus, lockedStudents };
  };

  const { sortedStudents, dailyStatus, lockedStudents } = generateDailyReport();

  const exportToHeFeng = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF班級,座號,學生姓名,上學狀態,放學狀態\n";
    sortedStudents.forEach(s => {
      const status = s.cardId ? (dailyStatus[s.cardId] || {}) : {};
      const morning = status['上學'] || "未打卡";
      const evening = status['放學'] || "未打卡";
      csvContent += `${s.classInfo},${s.seat},${s.name},${morning},${evening}\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `禾豐出缺席日報表_${queryDate.replace(/-/g, '')}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div style={layout}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700&display=swap');`}</style>
      <header style={header}>
        <h1 style={title}>TerryEdu 案內所</h1>
        <div style={modeSwitchContainer}>
          <span style={{ fontWeight: 'bold', marginRight: '15px', fontSize: '1.2rem' }}>⛩️ 現在門禁狀態：</span>
          <button onClick={toggleScanMode} style={scanMode === '上學' ? modeBtnMorning : modeBtnEvening}>
            {scanMode === '上學' ? '🌅 登校 (上學) 收集中' : '🌇 下校 (放學) 收集中'}
          </button>
        </div>
        <div style={tabs}>
          <button onClick={() => setActiveTab('students')} style={activeTab === 'students' ? activeBtn : btn}>壹。生徒登錄</button>
          <button onClick={() => setActiveTab('attendance')} style={activeTab === 'attendance' ? activeBtn : btn}>貳。出勤日報表</button>
          <button onClick={() => setActiveTab('teachers')} style={activeTab === 'teachers' ? activeBtn : btn}>參。教師名簿</button>
          <button onClick={() => setActiveTab('locked')} style={activeTab === 'locked' ? activeLockedBtn : lockedBtn}>
            肆。封印解除 {lockedStudents.length > 0 && <span style={badge}>{lockedStudents.length}</span>}
          </button>
        </div>
      </header>

      <main style={mainContent}>
        {/* 生徒登錄 */}
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
                <p style={{margin: '10px 0'}}>請感應卡片 (或使用手機 Barcode 掃描)...</p> 
                <p>目前讀取: <code style={codeBlock}>{lastScan || "待機中"}</code></p>
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
                  const isLocked = s.cardId ? authCards[s.cardId]?.isLocked : false;
                  return (
                    <tr key={s.dbId} style={isLocked ? {background: '#f8d7da'} : {}}>
                      <td>{s.classInfo}</td><td>{s.seat}</td><td><b style={{color: isLocked ? '#9b2226' : 'inherit'}}>{s.name}</b></td>
                      <td>
                        {s.cardId ? (isLocked ? <span style={{color:'#9b2226'}}>🔒 封印中</span> : <span style={{color:'#2d6a4f'}}>✅ 正常</span>) : <span style={{color:'#888'}}>未發放</span>}
                      </td>
                      <td>
                        {!s.cardId && <button onClick={() => startBinding(s)} style={actionBtn}>+ 綁定</button>}
                        {s.cardId && <button onClick={() => remove(ref(db, `authorized_cards/${s.cardId}`)).then(()=>set(ref(db, `school_roster/${s.dbId}/cardId`), null))} style={cancelBtn}>收回</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 出勤日報表 */}
        {activeTab === 'attendance' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '15px' }}>
              <div>
                <h2 style={sectionTitle}>🕰️ 每日出缺席報表</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '15px' }}>
                  <label style={{ fontWeight: 'bold' }}>🗓️ 選擇日期：</label>
                  <input type="date" value={queryDate} onChange={(e) => setQueryDate(e.target.value)} style={dateInput} />
                </div>
              </div>
              <button onClick={exportToHeFeng} style={exportBtn}>📥 匯出 {queryDate} 報表</button>
            </div>
            
            <table style={table}>
              <thead><tr><th>班級</th><th>座號</th><th>氏名 (姓名)</th><th>🌅 登校 (上學)</th><th>🌇 下校 (放學)</th></tr></thead>
              <tbody>
                {sortedStudents.length === 0 ? (
                  <tr><td colSpan="5" style={{textAlign: 'center', padding: '20px'}}>請先至「生徒登錄」建立學生名冊</td></tr>
                ) : (
                  sortedStudents.map(s => {
                    const status = s.cardId ? (dailyStatus[s.cardId] || {}) : {};
                    return (
                      <tr key={s.dbId}>
                        <td>{s.classInfo}</td>
                        <td>{s.seat}</td>
                        <td style={{fontWeight:'bold'}}>{s.name}</td>
                        <td style={{color: status['上學'] ? '#2d6a4f' : '#8c3b3a', fontWeight: 'bold'}}>{status['上學'] ? `✅ ${status['上學']}` : '❌ 未打卡'}</td>
                        <td style={{color: status['放學'] ? '#2d6a4f' : '#8c3b3a', fontWeight: 'bold'}}>{status['放學'] ? `✅ ${status['放學']}` : '❌ 未打卡'}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 教職員 */}
        {activeTab === 'teachers' && (
          <div>
            <h2 style={sectionTitle}>🍎 教職員特許名簿</h2>
            <div style={formCard}>
              <p style={{margin: 0, paddingRight: '15px', fontWeight: 'bold'}}>請感應卡片 (或掃描條碼)：<code style={codeBlock}>{lastScan || "待機中..."}</code></p>
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

        {/* 封印解除 */}
        {activeTab === 'locked' && (
          <div>
            <h2 style={{...sectionTitle, borderLeftColor: '#9b2226', color: '#9b2226'}}>⛔ 謹慎者名簿 (鎖卡區)</h2>
            <p style={{ color: '#5a3d31', fontWeight: 'bold', marginBottom: '20px' }}>
              ※ 學生必須持原卡片親自至辦公室，進行感應或掃描後方可解除封印。
            </p>

            {unlockTarget && (
              <div style={lockedAlertBox}>
                <h3 style={{margin: '0 0 10px 0', color: '#9b2226'}}>⚖️ 解卡儀式進行中：【 {unlockTarget.name} 】</h3>
                <p style={{fontSize: '1.2rem', margin: '10px 0'}}>👉 請犯規學生將卡片放置於感應區 (或進行掃描)... </p>
                <p style={{fontSize: '1.2rem', fontWeight: 'bold', margin: '15px 0'}}>
                  目前感應晶片：<code style={{...codeBlock, fontSize: '1.2rem'}}>{lastScan || "等待感應..."}</code>
                </p>
                <div>
                  {lastScan === unlockTarget.cardId ? (
                    <button onClick={confirmUnlock} style={massiveUnlockBtn}>✨ 確認恩赦 (解除封印)</button>
                  ) : lastScan ? (
                    <span style={{color: '#9b2226', fontWeight: 'bold', fontSize: '1.1rem'}}>❌ 卡號不符！這不是被鎖的那張卡！</span>
                  ) : null}
                  <button onClick={() => {setUnlockTarget(null); setLastScan("");}} style={cancelBtn}>中斷程序</button>
                </div>
              </div>
            )}

            <table style={table}>
              <thead><tr><th>班級</th><th>座號</th><th>氏名</th><th>被封印的卡號</th><th>處置</th></tr></thead>
              <tbody>
                {lockedStudents.length === 0 ? (
                  <tr><td colSpan="5" style={{textAlign: 'center', padding: '20px', color: '#2d6a4f', fontWeight: 'bold'}}>🎉 太平盛世，目前無人被鎖卡！</td></tr>
                ) : (
                  lockedStudents.map(s => (
                    <tr key={s.dbId} style={{background: '#f8d7da'}}>
                      <td>{s.classInfo}</td><td>{s.seat}</td>
                      <td><b style={{color: '#9b2226'}}>{s.name}</b></td>
                      <td><code style={codeBlock}>{s.cardId}</code></td>
                      <td><button onClick={() => startUnlock(s)} style={prepareUnlockBtn}>🔓 準備解卡</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

// 樣式
const layout = { padding: '40px 20px', minHeight: '100vh', background: '#f4ecd8', fontFamily: '"Noto Serif TC", serif', color: '#3e2723' };
const header = { maxWidth: '1000px', margin: '0 auto 30px auto', textAlign: 'center', borderBottom: '3px double #3e2723', paddingBottom: '20px' };
const title = { fontSize: '2.5rem', letterSpacing: '5px', margin: '0 0 20px 0', color: '#5a3d31', fontWeight: 'bold' };
const modeSwitchContainer = { background: '#dcd3c6', padding: '15px', border: '2px solid #3e2723', display: 'inline-block', marginBottom: '25px', boxShadow: '3px 3px 0px #3e2723' };
const modeBtnMorning = { padding: '10px 20px', background: '#d9b650', color: '#3e2723', border: '2px solid #3e2723', fontFamily: '"Noto Serif TC", serif', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '2px 2px 0px #3e2723', transition: '0.1s' };
const modeBtnEvening = { ...modeBtnMorning, background: '#5c7a5f', color: '#f4ecd8' };
const tabs = { display: 'flex', justifyContent: 'center', gap: '15px' };
const btn = { padding: '8px 20px', border: '2px solid #3e2723', background: '#eaddc5', color: '#3e2723', fontFamily: '"Noto Serif TC", serif', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '2px 2px 0px #3e2723' };
const activeBtn = { ...btn, background: '#3e2723', color: '#f4ecd8', boxShadow: 'none', transform: 'translate(2px, 2px)' };
const lockedBtn = { ...btn, background: '#f8d7da', borderColor: '#9b2226', color: '#9b2226', fontWeight: 'bold' };
const activeLockedBtn = { ...lockedBtn, background: '#9b2226', color: '#fff', boxShadow: 'none', transform: 'translate(2px, 2px)' };
const badge = { background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '0.9rem', marginLeft: '5px' };
const mainContent = { maxWidth: '1000px', margin: '0 auto', background: '#fffcf5', padding: '30px', border: '2px solid #3e2723', boxShadow: '5px 5px 0px #3e2723' };
const sectionTitle = { borderLeft: '8px solid #8c3b3a', paddingLeft: '15px', color: '#3e2723', marginTop: '0', marginBottom: '15px' };
const formCard = { display: 'flex', gap: '10px', padding: '20px', background: '#eaddc5', border: '1px solid #3e2723', marginBottom: '25px', alignItems: 'center' };
const input = { padding: '8px 12px', border: '1px solid #3e2723', background: '#f4ecd8', fontFamily: '"Noto Serif TC", serif', flex: 1, fontSize: '1rem', outline: 'none' };
const dateInput = { ...input, flex: 'none', width: '150px', fontWeight: 'bold' };
const actionBtn = { padding: '8px 20px', background: '#5c7a5f', color: '#f4ecd8', border: '2px solid #3e2723', fontFamily: '"Noto Serif TC", serif', cursor: 'pointer', fontWeight: 'bold', boxShadow: '2px 2px 0px #3e2723' };
const cancelBtn = { padding: '8px 15px', background: '#8c3b3a', color: '#f4ecd8', border: '2px solid #3e2723', fontFamily: '"Noto Serif TC", serif', cursor: 'pointer', boxShadow: '2px 2px 0px #3e2723', marginLeft: '10px' };
const confirmBtn = { padding: '8px 15px', background: '#d9b650', color: '#3e2723', border: '2px solid #3e2723', fontFamily: '"Noto Serif TC", serif', cursor: 'pointer', boxShadow: '2px 2px 0px #3e2723', fontWeight: 'bold' };
const exportBtn = { padding: '8px 20px', background: '#3b82f6', color: '#fff', border: '2px solid #3e2723', fontFamily: '"Noto Serif TC", serif', cursor: 'pointer', fontWeight: 'bold', boxShadow: '2px 2px 0px #3e2723' };
const alertBox = { padding: '20px', background: '#f5e6d3', border: '2px dashed #8c3b3a', marginBottom: '25px', color: '#3e2723' };
const codeBlock = { background: '#dcd3c6', padding: '2px 8px', border: '1px solid #a89f91', fontFamily: 'monospace' };
const lockedAlertBox = { padding: '25px', background: '#f8d7da', border: '3px solid #9b2226', marginBottom: '25px', color: '#3e2723', boxShadow: 'inset 0 0 15px rgba(155, 34, 38, 0.2)' };
const prepareUnlockBtn = { padding: '8px 15px', background: '#d9b650', color: '#3e2723', border: '2px solid #3e2723', fontFamily: '"Noto Serif TC", serif', cursor: 'pointer', boxShadow: '2px 2px 0px #3e2723', fontWeight: 'bold' };
const massiveUnlockBtn = { padding: '15px 30px', background: '#2d6a4f', color: '#fff', border: '3px solid #143628', fontFamily: '"Noto Serif TC", serif', cursor: 'pointer', boxShadow: '4px 4px 0px #143628', fontWeight: 'bold', fontSize: '1.2rem', marginRight: '15px', animation: 'pulse 1.5s infinite' };
const table = { width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '10px', border: '2px solid #3e2723' };

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `th, td { border: 1px solid #3e2723; padding: 12px 15px; } th { background: #dcd3c6; color: #3e2723; font-weight: bold; letter-spacing: 2px; } tr:nth-child(even) { background: #fbf8f1; } @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }`;
  document.head.appendChild(style);
}
