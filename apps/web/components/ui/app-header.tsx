import { cn } from '@/lib/utils';

/**
 * Full-width sticky glass header used across the app. Content is wrapped in a
 * centered, width-capped row so the blur bar spans the whole viewport while
 * the brand/nav stay aligned with the page content.
 */
export function AppHeader({
  className,
  maxWidth = 'max-w-6xl',
  children,
}: {
  className?: string;
  maxWidth?: 'max-w-6xl' | 'max-w-4xl';
  children: React.ReactNode;
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl',
        'supports-[backdrop-filter]:bg-background/55',
        className
      )}
    >
      <div
        className={cn(
          'mx-auto flex w-full items-center justify-between gap-4 px-6 py-4',
          maxWidth
        )}
      >
        {children}
      </div>
    </header>
  );
}
