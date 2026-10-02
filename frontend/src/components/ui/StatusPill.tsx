import { cn } from '../../lib/utils'

type StatusType =
  | 'idle'
  | 'running'
  | 'error'
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'new'
  | 'pitched'
  | 'converted'

interface StatusPillProps {
  status: StatusType
}

const statusConfig: Record<
  StatusType,
  { label: string; className: string; pulse?: boolean }
> = {
  idle: { label: 'Idle', className: 'bg-white/10 text-white/50' },
  draft: { label: 'Draft', className: 'bg-white/10 text-white/50' },
  new: { label: 'New', className: 'bg-white/10 text-white/50' },
  running: {
    label: 'Running',
    className: 'bg-accent-primary/20 text-accent-primary',
    pulse: true,
  },
  scheduled: {
    label: 'Scheduled',
    className: 'bg-accent-primary/20 text-accent-primary',
    pulse: true,
  },
  published: { label: 'Published', className: 'bg-green-500/20 text-green-400' },
  converted: { label: 'Converted', className: 'bg-green-500/20 text-green-400' },
  error: { label: 'Error', className: 'bg-red-500/20 text-red-400' },
  pitched: { label: 'Pitched', className: 'bg-amber-500/20 text-amber-400' },
}

export function StatusPill({ status }: StatusPillProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        config.className,
      )}
    >
      {config.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {config.label}
    </span>
  )
}
