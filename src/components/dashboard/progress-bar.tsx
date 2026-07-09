import { cn } from "@/lib/utils";

interface ProgressBarProps {
  percentage: number;
  label?: string;
  showPercentage?: boolean;
  className?: string;
  barClassName?: string;
}

export function ProgressBar({ 
  percentage, 
  label, 
  showPercentage = true, 
  className,
  barClassName 
}: ProgressBarProps) {
  // Clamp percentage between 0 and 100
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
  
  return (
    <div className={cn("w-full space-y-2", className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center text-sm">
          {label && <span className="font-medium text-foreground">{label}</span>}
          {showPercentage && <span className="text-muted-foreground font-medium">{Math.round(clampedPercentage)}%</span>}
        </div>
      )}
      <div className="progress-bar w-full bg-secondary overflow-hidden rounded-full h-2.5">
        <div 
          className={cn("progress-bar__fill h-full rounded-full transition-all duration-500 ease-out", barClassName)}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </div>
  );
}
