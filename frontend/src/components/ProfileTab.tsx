type TelegramUser = {
  id?: number;
  first_name?: string;
  username?: string;
  photo_url?: string;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe?: {
          user?: TelegramUser;
        };
      };
    };
  }
}

const attendedTastings = [
  ['ardbeg-uigeadail', 'lagavulin-16', 'caol-ila-12'],
  ['glendronach-15', 'balvenie-12', 'auchentoshan-three-wood'],
  ['bunnahabhain-12', 'laphroaig-10', 'kilchoman-machir-bay'],
  ['springbank-10', 'hazelburn-10', 'longrow-peated'],
  ['nikka-from-the-barrel', 'hibiki-harmony', 'mars-kasei'],
  ['macallan-12', 'macallan-15', 'macallan-rare-cask'],
  ['port-charlotte-10', 'bruichladdich-classic-laddie', 'octomore-14'],
  ['glenallachie-12', 'glen-scotia-15', 'clynelish-14'],
];

function getClubStatus(tastingsCount: number) {
  if (tastingsCount < 3) {
    return 'Новичок';
  }

  if (tastingsCount <= 7) {
    return 'Ценитель';
  }

  return 'Торфяной Монстр';
}

function UserPlaceholderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-12 w-12" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function ProfileTab() {
  const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const name = telegramUser?.first_name ?? 'Константин';
  const username = telegramUser?.username ?? 'whisky_connoisseur';
  const photoUrl = telegramUser?.photo_url;
  const tastingsCount = attendedTastings.length;
  const bottlesCount = new Set(attendedTastings.flat()).size;
  const clubStatus = getClubStatus(tastingsCount);

  return (
    <section className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-md items-center py-8">
      <article className="w-full rounded-3xl border border-amber-200/15 bg-slate-900/70 p-6 text-center shadow-2xl shadow-black/30 backdrop-blur">
        <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-amber-400 p-1 text-amber-400 shadow-lg shadow-amber-400/20">
          {photoUrl ? (
            <img src={photoUrl} alt={`Аватар ${name}`} className="h-full w-full rounded-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-800">
              <UserPlaceholderIcon />
            </div>
          )}
        </div>

        <h1 className="mt-5 text-2xl font-semibold text-white">{name}</h1>
        <p className="mt-1 text-sm text-slate-400">@{username}</p>
        <span className="mt-4 inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-400">
          {clubStatus}
        </span>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-slate-800/80 p-4">
            <p className="text-3xl font-bold text-white">{tastingsCount}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">Tastings attended</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-800/80 p-4">
            <p className="text-3xl font-bold text-white">{bottlesCount}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">Tested releases</p>
          </div>
        </div>
      </article>
    </section>
  );
}