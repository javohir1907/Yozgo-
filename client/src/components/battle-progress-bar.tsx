import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface BattleProgressBarProps {
  progress: number;
  username: string;
  avatarUrl?: string;
  wpm: number;
  isMe?: boolean;
}

export function BattleProgressBar({
  progress,
  username,
  avatarUrl,
  wpm,
  isMe,
}: BattleProgressBarProps) {
  return (
    <div className="space-y-2 mb-6" data-testid={`battle-progress-${username}`}>
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={username} />}
            <AvatarFallback>{username.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className={isMe ? "font-bold text-primary" : "text-muted-foreground"}>
            {username} {isMe && "(You)"}
          </span>
        </div>
        <span className="font-mono text-primary">{wpm} WPM</span>
      </div>
      <Progress value={progress} className="h-2" data-testid={`progress-bar-${username}`} />
    </div>
  );
}
