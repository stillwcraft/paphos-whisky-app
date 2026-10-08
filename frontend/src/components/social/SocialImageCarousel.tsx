import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function SocialImageCarousel({ images, alt, className }: {
  images: string[];
  alt: string;
  className: string;
}) {
  const { t } = useTranslation();
  const galleryRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      <div
        ref={galleryRef}
        className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(event) => {
          const { clientWidth, scrollLeft } = event.currentTarget;
          if (clientWidth) setActive(Math.min(images.length - 1, Math.max(0, Math.round(scrollLeft / clientWidth))));
        }}
      >
        {images.map((url, index) => (
          <img key={`${index}-${url}`} src={url} alt={alt} className="h-full w-full shrink-0 snap-center object-cover" />
        ))}
      </div>
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
