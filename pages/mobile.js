// 在 handleProcess 裡面
const handleProcess = async (cardId, type) => {
  const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
  const snap = await get(ref(db, `authorized_cards/${cleanId}`));

  if (snap.exists()) {
    const user = snap.val();
    if (user.role === 'teacher') {
      setStatus(`🍎 老師：${user.name}`);
      await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
    } else {
      setStatus(`🎒 學生：${user.name} 打卡成功`);
      await push(ref(db, 'student_logs'), { name: user.name, id: cleanId, time: serverTimestamp() });
    }
  } else {
    // 🚩 未註冊卡片，把卡號丟給 last_scan 方便組長在 Admin 註冊
    setStatus(`⚠️ 未註冊卡片，請洽資訊組`);
    await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
  }
};
