import { useMemo } from 'react'

const COLOURS = ['#f6c544', '#b99cf0', '#ffa98a', '#7fd6b8', '#ffb3c7', '#ffffff']

// A small burst of stars and confetti. `big` fills the screen for completed quests and trails.
export default function Confetti({ big = false }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: big ? 46 : 16 }, (_, i) => {
        const angle = (i / (big ? 46 : 16)) * Math.PI * 2 + Math.random() * 0.4
        const dist = big ? 180 + Math.random() * 260 : 50 + Math.random() * 40
        return {
          i,
          star: i % 3 === 0,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist * (big ? 0.7 : 0.6) - (big ? 40 : 20),
          rot: Math.random() * 540 - 270,
          delay: Math.random() * (big ? 0.25 : 0.08),
          colour: COLOURS[i % COLOURS.length],
          size: (big ? 10 : 7) + Math.random() * (big ? 10 : 5),
        }
      }),
    [big],
  )
  return (
    <div className={`confetti${big ? ' big' : ''}`} aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.i}
          className={p.star ? 'piece star' : 'piece'}
          style={{
            '--x': `${p.x}px`,
            '--y': `${p.y}px`,
            '--r': `${p.rot}deg`,
            '--d': `${p.delay}s`,
            '--c': p.colour,
            '--s': `${p.size}px`,
          }}
        >
          {p.star ? '★' : ''}
        </span>
      ))}
    </div>
  )
}
