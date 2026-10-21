// Small hand-drawn style icons for the game interface, as inline SVG.
const Svg = ({ size = 24, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {children}
  </svg>
)

export const MaskIcon = (p) => (
  <Svg {...p}>
    <path d="M4 4.5c2.6 1 5.4 1 8 0s5.4-1 8 0v6.5c0 4.6-3.6 8.5-8 8.5s-8-3.9-8-8.5z" fill="currentColor" fillOpacity="0.18" />
    <path d="M7.5 9.5c.7-.6 1.8-.6 2.5 0M14 9.5c.7-.6 1.8-.6 2.5 0" />
    <path d="M8.5 13.5c1.9 2 5.1 2 7 0" />
  </Svg>
)

export const CupIcon = (p) => (
  <Svg {...p}>
    <path d="M4.5 10h12v3.5a5.5 5.5 0 0 1-5.5 5.5h-1a5.5 5.5 0 0 1-5.5-5.5z" fill="currentColor" fillOpacity="0.18" />
    <path d="M16.5 11.5h1.2a2.3 2.3 0 0 1 0 4.6h-1.6" />
    <path d="M8 3.5c-.8 1 .8 2-.1 3.2M11.5 3.5c-.8 1 .8 2-.1 3.2" />
    <path d="M3.5 21h15" />
  </Svg>
)

export const BookIcon = (p) => (
  <Svg {...p}>
    <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5c-3.5-.5-6.5 0-8.5 1.5z" fill="currentColor" fillOpacity="0.18" />
    <path d="M12 6.5v13" />
  </Svg>
)

export const TrophyIcon = (p) => (
  <Svg {...p}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" fill="currentColor" fillOpacity="0.2" />
    <path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.8M17 6h2.5a2.5 2.5 0 0 1-2.6 3.8" />
    <path d="M12 14v3.5M8.5 20.5h7M9.5 17.5h5v3h-5z" />
  </Svg>
)

export const StarIcon = ({ filled = true, ...p }) => (
  <Svg {...p}>
    <path
      d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </Svg>
)

export const StepsIcon = (p) => (
  <Svg {...p}>
    <path d="M7.5 4.5c1.6 0 2.4 1.7 2.2 3.8-.2 1.8-1 3.2-2.4 3.2S5 10.3 5 8.4c0-2 1-3.9 2.5-3.9z" fill="currentColor" fillOpacity="0.25" />
    <path d="M6 14h3.2" />
    <path d="M16.5 9.5c1.5 0 2.5 1.9 2.5 3.9 0 1.9-.9 3.1-2.3 3.1s-2.2-1.4-2.4-3.2c-.2-2.1.6-3.8 2.2-3.8z" fill="currentColor" fillOpacity="0.25" />
    <path d="M14.8 19h3.2" />
  </Svg>
)

export const CloseIcon = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const SparkleIcon = (p) => (
  <Svg {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
  </Svg>
)

export const questIcon = (id, props) =>
  id === 'culture' ? <MaskIcon {...props} /> : id === 'food' ? <CupIcon {...props} /> : <BookIcon {...props} />
