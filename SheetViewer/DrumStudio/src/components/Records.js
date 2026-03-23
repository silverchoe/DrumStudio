import React from 'react';

export default function Records({ records }) {
  // Sort records newest first
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));

  // Summary stats
  const totalSessions = records.reduce((sum, r) => sum + r.sessions.length, 0);
  const totalTime = records.reduce(
    (sum, r) => sum + r.sessions.reduce((s, sess) => s + sess.duration, 0),
    0
  );
  const allAccuracies = records.flatMap(r => r.sessions.map(s => s.accuracy));
  const avgAccuracy = allAccuracies.length > 0
    ? Math.round(allAccuracies.reduce((a, b) => a + b, 0) / allAccuracies.length)
    : 0;

  const formatDuration = (sec) => {
    if (sec < 60) return `${sec}초`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${m}분 ${s}초` : `${m}분`;
  };

  const formatTotalTime = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분`;
  };

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const dayName = dayNames[d.getDay()];
    return `${month}/${day} (${dayName})`;
  };

  return (
    <div className="records-section">
      <div className="records-title">📊 연습 기록</div>

      {/* Summary */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="sum-val">{totalSessions}</div>
          <div className="sum-label">총 세션</div>
        </div>
        <div className="summary-card">
          <div className="sum-val">{formatTotalTime(totalTime)}</div>
          <div className="sum-label">총 연습</div>
        </div>
        <div className="summary-card">
          <div className="sum-val">{avgAccuracy}%</div>
          <div className="sum-label">평균 정확도</div>
        </div>
      </div>

      {/* Day-by-day records */}
      {sorted.length === 0 ? (
        <div className="no-records">
          <div className="no-icon">🥁</div>
          <div>아직 연습 기록이 없어요!</div>
          <div className="mt-8" style={{ fontSize: 7 }}>
            메트로놈을 시작하고 탭해보세요
          </div>
        </div>
      ) : (
        sorted.map(dayRecord => (
          <div className="record-day" key={dayRecord.date}>
            <div className="day-date">
              📅 {formatDate(dayRecord.date)}
            </div>
            {dayRecord.sessions.map((sess, i) => (
              <div className="record-session" key={i}>
                <span className="session-bpm">♩ {sess.bpm} BPM</span>
                <span className="session-acc">🎯 {sess.accuracy}%</span>
                <span className="session-dur">⏱ {formatDuration(sess.duration)}</span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
