import React, { useState } from 'react';

const GRID_COLS = 6;
const GRID_ROWS = 5;

const SHOP_ITEMS = [
  { id: 'drum-kit',     icon: '🥁', name: '드럼킷',     price: 5  },
  { id: 'snare',        icon: '🪘', name: '스네어',     price: 3  },
  { id: 'guitar',       icon: '🎸', name: '기타',       price: 4  },
  { id: 'amp',          icon: '🔊', name: '앰프',       price: 4  },
  { id: 'keyboard',     icon: '🎹', name: '키보드',     price: 6  },
  { id: 'mic',          icon: '🎤', name: '마이크',     price: 3  },
  { id: 'light-red',    icon: '🔴', name: '빨간조명',   price: 2  },
  { id: 'light-blue',   icon: '🔵', name: '파란조명',   price: 2  },
  { id: 'light-yellow', icon: '🟡', name: '노란조명',   price: 2  },
  { id: 'poster-rock',  icon: '🎵', name: '록 포스터',  price: 3  },
  { id: 'poster-star',  icon: '⭐', name: '스타 포스터', price: 3  },
  { id: 'carpet',       icon: '🟫', name: '카펫',       price: 4  },
  { id: 'plant',        icon: '🪴', name: '화분',       price: 2  },
  { id: 'speaker',      icon: '📻', name: '스피커',     price: 5  },
  { id: 'trophy',       icon: '🏆', name: '트로피',     price: 8  },
];

export default function Studio({ sticks, ownedItems, studioItems, onBuy, onPlace, onRemove }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [placing, setPlacing] = useState(false);

  const handleBuy = (item) => {
    if (ownedItems.includes(item.id)) {
      // Already owned → select for placing
      setSelectedItem(item);
      setPlacing(true);
      return;
    }
    if (sticks < item.price) return;
    onBuy(item);
    setSelectedItem(item);
    setPlacing(true);
  };

  const handleCellClick = (x, y) => {
    const existing = studioItems.find(i => i.x === x && i.y === y);

    if (placing && selectedItem) {
      if (existing) {
        // Remove first, then place new
        onRemove(x, y);
      }
      onPlace(selectedItem.id, x, y);
      setPlacing(false);
      setSelectedItem(null);
    } else if (existing) {
      onRemove(x, y);
    }
  };

  const cancelPlace = () => {
    setPlacing(false);
    setSelectedItem(null);
  };

  const getItemAt = (x, y) => {
    const placed = studioItems.find(i => i.x === x && i.y === y);
    if (!placed) return null;
    return SHOP_ITEMS.find(s => s.id === placed.id);
  };

  return (
    <div className="studio-section">
      <div className="studio-title">🏠 나의 스튜디오</div>

      {/* Placing message */}
      {placing && selectedItem && (
        <div className="placing-msg">
          {selectedItem.icon} {selectedItem.name}을(를) 배치할 위치를 클릭하세요!
          <div className="mt-8">
            <button className="pixel-btn gray" onClick={cancelPlace} style={{ fontSize: 7, padding: '6px 12px' }}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* Room Grid */}
      <div className="room-grid">
        {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, idx) => {
          const x = idx % GRID_COLS;
          const y = Math.floor(idx / GRID_COLS);
          const item = getItemAt(x, y);

          return (
            <div
              key={idx}
              className={'room-cell' + (item ? ' has-item' : '')}
              onClick={() => handleCellClick(x, y)}
              style={placing ? { cursor: 'crosshair' } : {}}
              title={item ? `${item.name} (클릭하여 제거)` : '빈 칸'}
            >
              {item && (
                <>
                  <span>{item.icon}</span>
                  <span className="remove-x">✕</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Shop */}
      <div className="card">
        <div className="shop-title">🛒 아이템 상점 (보유 스틱: 🥢 {sticks})</div>
        <div className="shop-grid">
          {SHOP_ITEMS.map(item => {
            const owned = ownedItems.includes(item.id);
            const canBuy = sticks >= item.price || owned;

            return (
              <div
                key={item.id}
                className={'shop-item' + (owned ? ' owned' : '')}
                onClick={() => handleBuy(item)}
                style={{ opacity: canBuy ? 1 : 0.5, cursor: canBuy ? 'pointer' : 'not-allowed' }}
              >
                <div className="item-icon">{item.icon}</div>
                <div className="item-name">{item.name}</div>
                <div className="item-price">
                  {owned ? '배치하기' : `🥢 ${item.price}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
