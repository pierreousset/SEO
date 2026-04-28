import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl p-12 flex flex-col items-center text-center max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Icon className="h-8 w-8 text-primary" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
