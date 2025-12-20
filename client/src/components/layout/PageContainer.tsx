import { cn } from "@/lib/utils";

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export function PageContainer({ 
  children, 
  className, 
  fullWidth = false,
  ...props 
}: PageContainerProps) {
  return (
    <div 
      className={cn(
        "container mx-auto px-4 py-8 sm:px-6 lg:px-8",
        !fullWidth && "max-w-5xl",
        className
      )} 
      {...props}
    >
      {children}
    </div>
  );
}
