import { motion } from 'framer-motion';
import type { TimelinePayload } from '@/types/infographicSchemas.ts';

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const stepVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function TimelineStepByStep({ payload }: { payload: TimelinePayload }) {
  return (
    <motion.ol
      className="space-y-4"
      variants={listVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
    >
      {payload.steps.map((item) => (
        <motion.li
          key={item.step}
          variants={stepVariants}
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="flex gap-4 rounded-xl border border-[#C5A059]/20 bg-[#1A1A1E] p-4"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#C5A059]/50 text-[#FFE28A]">
            {item.step}
          </span>
          <div>
            {item.badge && <span className="text-xs uppercase tracking-widest text-[#C5A059]">{item.badge}</span>}
            <h3 className="font-serif text-lg text-[#FFE28A]">{item.title}</h3>
            <p className="text-sm text-[#E5E7EB]">{item.description}</p>
          </div>
        </motion.li>
      ))}
    </motion.ol>
  );
}
