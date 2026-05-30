export const BEATS_PER_MEASURE = 4;

export const SUBDIVISIONS = [
  { id: '4beat',   label: '4비트',   sub: 1 },
  { id: '8beat',   label: '8비트',   sub: 2 },
  { id: '16beat',  label: '16비트',  sub: 4 },
  { id: 'triplet', label: '3연음',   sub: 3 },
];

// BPM
export const BPM_MIN = 40;
export const BPM_MAX = 200;
export const BPM_STEP = 5;
export const BPM_DEFAULT = 100;

// 마이크 감도 (UI 슬라이더 범위)
export const SENSITIVITY_MIN = 10;
export const SENSITIVITY_MAX = 95;
export const SENSITIVITY_DEFAULT = 92;

// 판정 윈도우 (ms) + 점수 + 라벨 + className
// 위에서 아래로 검사: 첫 매칭에서 결정
export const JUDGEMENTS = [
  { maxMs:  40, score: 100, label: 'PERFECT!', className: 'perfect' },
  { maxMs:  80, score:  85, label: 'GREAT!',   className: 'great'   },
  { maxMs: 140, score:  60, label: 'GOOD',     className: 'good'    },
  { maxMs: Infinity, score: 20, label: 'MISS', className: 'miss'    },
];

// 결과 화면 랭크 (정확도 임계값)
export const RANKS = [
  { minAcc: 80, stars: '★★★', title: '당신은 드럼의 신' },
  { minAcc: 50, stars: '★★',  title: '당신은 이미 드러머' },
  { minAcc: 30, stars: '★',   title: '할 수 있다. 해보자.' },
  { minAcc:  0, stars: '',    title: '마이크 체크해 보세요.' },
];

// 볼륨 미터 색상 임계값
export const VOLUME_HIGH = 70;
export const VOLUME_MID = 40;
export const VOLUME_COLOR_HIGH = '#43A047';
export const VOLUME_COLOR_MID = '#1E88E5';
export const VOLUME_COLOR_LOW = '#90CAF9';

// 피드백 표시 유지 시간 (ms)
export const FEEDBACK_DURATION_MS = 400;

// 메트로놈 클릭 음량 (0~1, 1 이상은 클리핑 위험)
export const CLICK_GAIN = {
  accent: 1.0,
  beat:   0.75,
  sub:    0.45,
};
