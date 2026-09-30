import type { HTMLAttributes } from 'react';

/** Indicateur partagé par les pages, formulaires et actions asynchrones. */
export default function SugubaLoader({ className = '', ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...props} aria-hidden="true" className={`suguba-loader inline-flex shrink-0 items-center justify-center rounded-[28%] bg-white ${className.replace(/\banimate-spin\b/g, '')}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={32} height={32} className="h-full w-full rounded-[inherit] object-contain" />
    </span>
  );
}
