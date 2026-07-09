import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface GenderSelectorProps {
  value: string;
  onChange: (value: "male" | "female" | "other") => void;
  disabled?: boolean;
}

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
] as const;

export function GenderSelector({ value, onChange, disabled }: GenderSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-muted-foreground">Voice Gender</Label>
      <div className="grid grid-cols-3 gap-2">
        {GENDERS.map((g) => (
          <button
            key={g.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(g.value)}
            className={cn(
              "px-4 py-3 text-sm font-medium rounded-md border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
              value === g.value
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-card-foreground border-border hover:bg-secondary hover:text-secondary-foreground"
            )}
          >
            {g.label}
          </button>
        ))}
      </div>
    </div>
  );
}
