import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ardbegMilestones, type ArdbegLanguage } from './ardbegHistory.ts';

type Props = { logoUrl: string | null };

export default function ArdbegTimelineInfographic({ logoUrl }: Props) {
  const { i18n, t } = useTranslation();
  const languageCode = i18n.language.toLowerCase().split(/[-_]/, 1)[0];
  const language: ArdbegLanguage = languageCode === 'ru' || languageCode === 'uk' ? languageCode : 'en';

  return (
    <section aria-label={t('ardbeg_timeline.aria_label')} className="text-[#E5E7EB]">
      <motion.div
        className="sticky top-0 z-30 flex items-center gap-3 bg-[#141417]/95 px-4 py-3 backdrop-blur-md"
        initial={{ y: -50, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        {logoUrl && <img alt="" className="h-10 w-10 rounded-full border border-[#C5A059]/50 object-contain" src={logoUrl} />}
        <div>
          <h2 className="font-serif text-lg font-semibold tracking-[0.16em] text-[#FFE28A]">ARDBEG</h2>
          <p className="text-[10px] uppercase tracking-widest text-[#C5A059]">
            {t('ardbeg_timeline.subtitle')}
          </p>
        </div>
      </motion.div>
      <div className="relative px-4 pb-8 pt-6">
        <motion.div
          aria-hidden="true"
          className="absolute bottom-10 left-[91px] top-8 w-[2px] origin-top bg-gradient-to-b from-[#C5A059] via-[#8A5A2B] to-[#141417]"
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        <div className="relative space-y-5">
          {ardbegMilestones.map((event) => (
            <div key={event.id} className="grid grid-cols-[68px_16px_1fr] items-start">
              <motion.div
                className="break-words pt-5 font-serif text-[11px] font-semibold leading-tight text-[#FFE28A]"
                initial={{ x: -35, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45 }}
              >
                {event.year}
              </motion.div>
              <div className="relative z-10 flex justify-center pt-5" aria-hidden="true">
                <span className="h-3 w-3 rounded-full border border-[#FFE28A] bg-[#C5A059] shadow-[0_0_10px_rgba(197,160,89,0.6)]" />
              </div>
              <motion.article
                className="ml-3 rounded-2xl border border-[#C5A059]/20 bg-[#141417]/90 p-4 shadow-lg shadow-black/30 backdrop-blur-md"
                initial={{ x: 35, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45 }}
              >
                <h3 className="font-serif text-sm font-semibold text-[#FFE28A]">{event.title[language]}</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#E5E7EB]">{event.description[language]}</p>
              </motion.article>
            </div>
          ))}
        </div>
        <p className="mt-7 pl-[84px] text-[11px] text-[#C5A059]">
          {t('ardbeg_timeline.sources')}{' '}
          <a className="underline underline-offset-2" href="https://www.ardbeg.com/en-gb/pages/history" rel="noopener noreferrer" target="_blank">
            Ardbeg
          </a>
          {' · '}
          <a className="underline underline-offset-2" href="https://www.ardbeg.com/en-gb/pages/ardbeg-day-2026" rel="noopener noreferrer" target="_blank">
            Ardbeg Day 2026
          </a>
        </p>
      </div>
    </section>
  );
}
