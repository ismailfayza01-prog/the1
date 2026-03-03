import Link from 'next/link';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  textClassName?: string;
  withText?: boolean;
  href?: string;
}

export function BrandLogo({
  className,
  imageClassName,
  textClassName,
  withText = true,
  href,
}: BrandLogoProps) {
  const content = (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <img
        src="/brand-logo.svg"
        alt="The 1000 logo"
        className={cn('h-10 w-10 rounded-xl object-cover', imageClassName)}
      />
      {withText && (
        <div className={cn('leading-tight', textClassName)}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Courier Platform</p>
          <p className="text-xl font-extrabold text-foreground">THE 1000</p>
        </div>
      )}
    </div>
  );

  if (!href) return content;
  return (
    <Link href={href} className="inline-block">
      {content}
    </Link>
  );
}

