import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Share2 } from "lucide-react";

interface ResultCardProps {
  wpm: number;
  accuracy: number;
  correctChars: number;
  incorrectChars: number;
  onRestart: () => void;
}

export function ResultCard({
  wpm,
  accuracy,
  correctChars,
  incorrectChars,
  onRestart,
}: ResultCardProps) {
  return (
    <Card className="w-full max-w-2xl mx-auto border-none bg-transparent" data-testid="result-card">
      <CardHeader className="text-center p-0 mb-8">
        <CardTitle className="text-5xl font-mono text-primary mb-2">Result</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2 gap-8 mb-12">
          <div className="text-center">
            <p className="text-lg text-muted-foreground uppercase tracking-widest mb-2">wpm</p>
            <p className="text-7xl font-mono text-primary" data-testid="result-wpm">{wpm}</p>
          </div>
          <div className="text-center">
            <p className="text-lg text-muted-foreground uppercase tracking-widest mb-2">acc</p>
            <p className="text-7xl font-mono text-primary" data-testid="result-accuracy">{accuracy}%</p>
          </div>
        </div>

        <div className="flex justify-center gap-12 mb-12 text-muted-foreground font-mono">
          <div className="text-center">
            <p className="text-xs uppercase mb-1">correct</p>
            <p className="text-2xl text-correct" data-testid="result-correct-chars">{correctChars}</p>
          </div>
          <div className="text-center">
            <p className="text-xs uppercase mb-1">incorrect</p>
            <p className="text-2xl text-error" data-testid="result-incorrect-chars">{incorrectChars}</p>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <Button 
            size="lg" 
            variant="ghost" 
            onClick={onRestart}
            className="hover-elevate active-elevate-2 font-mono"
            data-testid="button-restart"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Restart Test
          </Button>
          <Button 
            size="lg" 
            variant="ghost"
            className="hover-elevate active-elevate-2 font-mono"
            data-testid="button-share"
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
