import { cn } from '@/lib/utils'

/** Small attribution shown bottom-right of the app and the login page. */
export function PoweredBy({ className }: { className?: string }) {
  return (
    <div className={cn('text-[11px] text-muted-foreground', className)}>
      Designed and Developed by {" "}
      <a href="https://niranthra.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground/70 underline-offset-2 transition-colors hover:text-brand-dark hover:underline">Niranthra</a>
    </div>
  )
}
