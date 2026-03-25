import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface UserAvatarProfileProps {
  className?: string;
  showInfo?: boolean;
  user: {
    image?: string | null;
    name?: string | null;
    email?: string | null;
    githubUsername?: string | null;
  } | null;
}

export function UserAvatarProfile({
  className,
  showInfo = false,
  user
}: UserAvatarProfileProps) {
  const fallback = (user?.name || user?.githubUsername || 'BW')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className='flex items-center gap-2'>
      <Avatar className={className}>
        <AvatarImage src={user?.image || ''} alt={user?.name || ''} />
        <AvatarFallback className='rounded-lg'>{fallback}</AvatarFallback>
      </Avatar>

      {showInfo && (
        <div className='grid flex-1 text-left text-sm leading-tight'>
          <span className='truncate font-semibold'>
            {user?.name || user?.githubUsername || ''}
          </span>
          <span className='truncate text-xs'>
            {user?.email || `@${user?.githubUsername || ''}`}
          </span>
        </div>
      )}
    </div>
  );
}
