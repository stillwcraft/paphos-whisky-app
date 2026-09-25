import { motion } from 'framer-motion';
import type { TimelineStep } from '@/types/infographicSchemas.ts';

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.18 } },
};

const stepVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

type Props = { steps: TimelineStep[]; title?: string };

export default function TimelineStepByStep({ steps, title }: Props) {
  return (
    <section aria-label={title || 'Таймлайн'} className="text-[#E5E7EB]">
      {title && <h2 className="mb-6 font-serif text-xl text-[#FFE28A]">{title}</h2>}
      <motion.div
        className="relative flex flex-col gap-5"
        variants={listVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <motion.div
          aria-hidden="true"
          className="absolute bottom-0 left-[11px] top-0 w-[2px] origin-top bg-gradient-to-b from-[#C5A059] via-[#8A5A2B] to-[#141417]"
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
        {steps.map((item) => {
          const key = 'id' in item ? item.id : item.step;
          return (
            <motion.div
              key={key}
              variants={stepVariants}
              whileInView="visible"
              viewport={{ once: true }}
              className="relative pl-10"
            >
              <span aria-hidden="true" className="absolute left-[6px] top-5 flex h-3.5 w-3.5 items-center justify-center">
                <span className="absolute h-full w-full animate-ping rounded-full bg-[#C5A059]/60" />
                <span className="relative h-3 w-3 rounded-full border border-[#FFE28A] bg-[#C5A059]" />
              </span>
              <div className="rounded-2xl border border-[#C5A059]/20 bg-[#141417]/90 p-4 backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#C5A059]">
                  {item.badge && <span className="uppercase tracking-widest">{item.badge}</span>}
                  {'dateOrYear' in item && <span>{item.dateOrYear}</span>}
                  {'step' in item && <span>{item.step}</span>}
                </div>
                <h3 className="mt-1 font-serif text-lg text-[#FFE28A]">{item.title}</h3>
                {'subtitle' in item && item.subtitle && <p className="text-sm text-[#C5A059]">{item.subtitle}</p>}
                <p className="mt-2 text-sm leading-relaxed text-[#E5E7EB]">{item.description}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
