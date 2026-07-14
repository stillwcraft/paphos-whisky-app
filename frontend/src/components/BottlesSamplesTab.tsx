import { useState } from 'react';

type ItemType = 'Бутылка' | 'Сэмпл 40 мл';

type ShopItem = {
  id: number;
  name: string;
  price: number;
  type: ItemType;
  image: string;
  description: string;
};

const items: ShopItem[] = [
  {
    id: 1,
    name: 'Ardbeg Uigeadail',
    price: 92,
    type: 'Бутылка',
    image: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=600&q=80',
    description: 'Дымный, торфяной, с нотами ванили и темного шоколада.',
  },
  {
    id: 2,
    name: 'GlenDronach 15 Revival',
    price: 14,
    type: 'Сэмпл 40 мл',
    image: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=600&q=80',
    description: 'Хересный, насыщенный, с вишней, орехом и пряностями.',
  },
  {
    id: 3,
    name: 'Springbank 10',
    price: 79,
    type: 'Бутылка',
    image: 'https://images.unsplash.com/photo-1568213816046-0ee1c42bd559?auto=format&fit=crop&w=600&q=80',
    description: 'Слегка дымный, маслянистый, с цитрусом и морской солью.',
  },
  {
    id: 4,
    name: 'Port Charlotte 10',
    price: 11,
    type: 'Сэмпл 40 мл',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
    description: 'Яркий торф, лимонная цедра и долгий солоноватый финиш.',
  },
  {
    id: 5,
    name: 'Nikka From The Barrel',
    price: 55,
    type: 'Бутылка',
    image: 'https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=600&q=80',
    description: 'Плотный бленд с карамелью, дубом и деликатными специями.',
  },
  {
    id: 6,
    name: 'Lagavulin 16',
    price: 16,
    type: 'Сэмпл 40 мл',
    image: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=600&q=80',
    description: 'Глубокий дым, сухофрукты, йод и теплое дубовое послевкусие.',
  },
];

type OrderModalProps = {
  item: ShopItem;
  onClose: () => void;
};

function OrderModal({ item, onClose }: OrderModalProps) {
  const [comment, setComment] = useState('');

  const confirmOrder = () => {
    alert('Заказ оформлен!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-slate-950/75 p-4 backdrop-blur-sm sm:items-center sm:justify-center" role="presentation">
      <section
        aria-labelledby="order-modal-title"
        aria-modal="true"
        role="dialog"
        className="w-full max-w-md rounded-3xl border border-amber-100/10 bg-slate-900 p-6 shadow-2xl shadow-black/50"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Подтверждение заказа</p>
        <h2 id="order-modal-title" className="mt-3 text-xl font-semibold text-white">Вы заказываете {item.name}</h2>
        <label htmlFor="order-comment" className="mt-6 block text-sm font-medium text-slate-200">Комментарий к заказу</label>
        <textarea
          id="order-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Хочу забрать на следующей дегустации"
          rows={4}
          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-slate-800 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400"
        />
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={confirmOrder}
            className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300"
          >
            Подтвердить заказ
          </button>
        </div>
      </section>
    </div>
  );
}

export function BottlesSamplesTab() {
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);

  return (
    <section className="mx-auto w-full max-w-md pt-8">
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">Whisky Club</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Бутылки и сэмплы</h1>
      </header>

      <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-2xl bg-slate-800 shadow-lg shadow-black/20">
            <div className="relative h-40 overflow-hidden">
              <img
                src={item.image}
                alt={item.name}
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
              />
              <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                item.type === 'Бутылка' ? 'bg-emerald-400 text-emerald-950' : 'bg-violet-400 text-violet-950'
              }`}>
                {item.type}
              </span>
            </div>
            <div className="flex min-h-48 flex-col p-4">
              <h2 className="text-sm font-semibold text-white">{item.name}</h2>
              <p className="mt-2 text-xs leading-5 text-slate-400">{item.description}</p>
              <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                <span className="text-xl font-bold text-amber-400">€{item.price}</span>
                <button
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-300"
                >
                  Заказать
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {selectedItem && <OrderModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </section>
  );
}