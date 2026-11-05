export function PresentationIcon({ name }: { name: 'close' | 'follow' | 'play' | 'pause' | 'mute' | 'volume' }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'close' && <path d="m6 6 12 12M6 18 18 6" />}
    {name === 'follow' && <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></>}
    {name === 'play' && <path d="m8 5 11 7-11 7Z" />}
    {name === 'pause' && <path d="M8 5v14M16 5v14" />}
    {(name === 'mute' || name === 'volume') && <path d="m11 5-5 4H3v6h3l5 4Z" />}
    {name === 'mute' && <path d="m16 9 5 6m-5 0 5-6" />}
    {name === 'volume' && <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />}
  </svg>;
}
