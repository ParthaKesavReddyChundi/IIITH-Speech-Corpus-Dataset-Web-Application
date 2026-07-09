import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Emotion {
  id: string;
  name: string;
}

interface EmotionSelectorProps {
  emotions: Emotion[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function EmotionSelector({ emotions, value, onChange, disabled }: EmotionSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-muted-foreground">Emotion Tone</Label>
      <div className="flex flex-wrap gap-2">
        {emotions.map((e) => (
          <button
            key={e.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(e.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
              value === e.id
                ? "bg-primary/10 text-primary border-primary shadow-sm"
                : "bg-card text-card-foreground border-border hover:bg-secondary hover:text-secondary-foreground"
            )}
          >
            {e.name}
          </button>
        ))}
      </div>
    </div>
  );
}
