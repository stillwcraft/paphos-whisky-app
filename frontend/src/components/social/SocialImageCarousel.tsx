import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function SocialImageCarousel({ images, alt, className, expandable = false }: {
  images: string[];
  alt: string;
  className: string;
  expandable?: boolean;
}) {
  const { t } = useTranslation();
  const galleryRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<number | null>(null);
  const swipedRef = useRef(false);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`w-full overflow-hidden ${expandable && expanded ? 'absolute inset-0 z-20 bg-[#141417]' : `relative ${className}`}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && expanded) setExpanded(false);
      }}
    >
      <div
        ref={galleryRef}
        className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onTouchStart={(event) => {
          touchStartRef.current = event.touches[0]?.clientX ?? null;
          swipedRef.current = false;
        }}
        onTouchEnd={(event) => {
          if (touchStartRef.current !== null && Math.abs((event.changedTouches[0]?.clientX ?? touchStartRef.current) - touchStartRef.current) > 10) {
            swipedRef.current = true;
          }
          touchStartRef.current = null;
        }}
        onScroll={(event) => {
          const { clientWidth, scrollLeft } = event.currentTarget;
          if (clientWidth) setActive(Math.min(images.length - 1, Math.max(0, Math.round(scrollLeft / clientWidth))));
        }}
      >
        {images.map((url, index) => (
          expandable ? (
            <button
              key={`${index}-${url}`}
              type="button"
              aria-label={t(expanded ? 'social.collapse_image' : 'social.expand_image', { number: index + 1 })}
              aria-expanded={expanded}
              onClick={() => {
                if (swipedRef.current) {
                  swipedRef.current = false;
                  return;
                }
                setExpanded((current) => !current);
              }}
              className={`h-full w-full shrink-0 snap-center ${expanded ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
            >
              <img src={url} alt={alt} className={`h-full w-full ${expanded ? 'object-contain' : 'object-cover'}`} />
            </button>
          ) : (
            <img key={`${index}-${url}`} src={url} alt={alt} className="h-full w-full shrink-0 snap-center object-cover" />
          )
        ))}
      </div>
      {expandable && expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label={t('social.close')}
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#141417]/85 text-xl text-white"
        >×</button>
      )}
      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
          {images.map((url, index) => (
            <button
              key={`${index}-${url}`}
              type="button"
              aria-label={t('social.image_number', { number: index + 1 })}
              aria-current={active === index ? 'true' : undefined}
              onClick={() => galleryRef.current?.scrollTo({ left: index * galleryRef.current.clientWidth, behavior: 'smooth' })}
              className={`h-2 w-2 rounded-full shadow-[0_0_4px_#000] ${active === index ? 'bg-[#C5A059]' : 'bg-white/60'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
