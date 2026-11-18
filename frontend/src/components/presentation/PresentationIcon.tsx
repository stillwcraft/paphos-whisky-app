type IconName = 'close' | 'follow' | 'play' | 'pause' | 'mute' | 'volume'
  | 'stop' | 'pencil' | 'pen' | 'laser' | 'trash' | 'arrow-left' | 'arrow-right';

export function PresentationIcon({ name }: { name: IconName }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'close' && <path d="m6 6 12 12M6 18 18 6" />}
    {name === 'follow' && <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></>}
    {name === 'play' && <path d="m8 5 11 7-11 7Z" />}
    {name === 'pause' && <path d="M8 5v14M16 5v14" />}
    {name === 'stop' && <rect x="6" y="6" width="12" height="12" rx="1" />}
    {name === 'pencil' && <path d="m4 16-1 5 5-1L21 7l-4-4L4 16Zm11-11 4 4" />}
    {name === 'pen' && <path d="m12 19 7-7 2-9-9 2-7 7 7 7ZM3 21l11-11M9 10l5 5" />}
    {name === 'laser' && <path d="m3 21 9-9m4-4 4-4M14 4V2m6 12h2M9 6l2 2m5 5 2 2" />}
    {name === 'trash' && <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />}
    {name === 'arrow-left' && <path d="M20 12H4m7-7-7 7 7 7" />}
    {name === 'arrow-right' && <path d="M4 12h16m-7-7 7 7-7 7" />}
    {(name === 'mute' || name === 'volume') && <path d="m11 5-5 4H3v6h3l5 4Z" />}
    {name === 'mute' && <path d="m16 9 5 6m-5 0 5-6" />}
    {name === 'volume' && <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />}
  </svg>;
}
