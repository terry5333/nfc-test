async function handleAuth(cardId, source) {
    if (processing) return; 
    setProcessing(true);
    
    const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
    const godId = MY_GOD_CARD.replace(/[\s:]/g, '').toUpperCase();

    if (cleanId === godId) {
      setIsSuccess(true);
      setStatus("👑 管理員神卡確認，進入系統...");
      if (source === "手機感應") await set(ref(db, 'system/last_scan'), null);
      setTimeout(() => router.push('/admin'), 1000);
      return;
    }
    
    try {
      const snap = await get(ref(db, `authorized_cards/${cleanId}`));
      if (snap.exists()) {
        const user = snap.val();

        if (user.isLocked) {
          setIsSuccess(false);
          setStatus(`⛔ 卡片已鎖定：請找資訊組長解鎖`);
          if (source === "手機感應") await set(ref(db, 'system/last_scan'), null);
        } 
        else if (user.role === 'teacher') {
          setIsSuccess(true);
          setStatus(`✅ 歡迎 ${user.name} 老師`);
          if (source === "手機感應") await set(ref(db, 'system/last_scan'), null);
        } 
        else {
          const today = new Date().toLocaleDateString('zh-TW'); // 紀錄用日期

          // 🚩 防屁孩邏輯：同日期且同時段
          if (user.lastCheckInDate === today && user.lastCheckInPeriod === scanMode) {
            
            // 讀取已刷次數，如果沒有紀錄就當作 1 (第一次的成功)
            const currentCount = user.spamCount || 1; 
            const newCount = currentCount + 1;

            if (newCount >= 3) {
              // ⛔ 第 3 次：鎖卡！
              await update(ref(db, `authorized_cards/${cleanId}`), { isLocked: true, spamCount: newCount });
              setStatus(`⛔ 連刷 3 次！卡片已遭封印`);
            } else {
              // ⚠️ 第 2 次：警告
              await update(ref(db, `authorized_cards/${cleanId}`), { spamCount: newCount });
              setStatus(`⚠️ ${scanMode}已打卡，請勿重複感應 (第${newCount}次)`);
            }
          } else {
            // ✅ 第 1 次：正常打卡
            setIsSuccess(true);
            setStatus(`✅ ${user.name} ${scanMode}打卡成功`);
            
            await update(ref(db, `authorized_cards/${cleanId}`), {
              lastCheckInDate: today, 
              lastCheckInPeriod: scanMode, 
              spamCount: 1 // 重置計數為 1
            });
            await push(ref(db, 'student_logs'), { 
              name: user.name, id: cleanId, time: serverTimestamp(), source, period: scanMode 
            });
          }
          if (source === "手機感應") await set(ref(db, 'system/last_scan'), null);
        }
      } else {
        setIsSuccess(false);
        setStatus(`🚫 未註冊卡片: ${cleanId.substring(0,8)}`);
        await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
      }
    } catch (e) {
      setStatus("連線錯誤");
    }

    setTimeout(() => { 
      setProcessing(false); 
      if (source === "手機感應") {
        setIsSuccess(false); 
        setStatus(`⌛ 待命：請感應或嗶卡 (${scanMode}中)`); 
      }
    }, 3000);
  }
