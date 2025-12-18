import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutList, Building2, Settings } from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const [location] = useLocation();

  const sidebarItems = [
    { label: "Service Types", href: "/admin/service-types", icon: LayoutList },
    { label: "Organizations", href: "/admin/organizations", icon: Building2 },
    { label: "Platform Settings", href: "/admin/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <PageContainer fullWidth className="max-w-7xl">
        <div className="grid md:grid-cols-[240px_1fr] gap-8">
          <aside className="space-y-6">
            <div className="bg-slate-900 text-white p-4 rounded-lg mb-6">
              <div className="text-xs font-mono text-slate-400 mb-1">CURRENT ROLE</div>
              <div className="font-bold">Platform Admin</div>
            </div>

            <nav className="space-y-1">
              {sidebarItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <a className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    location === item.href 
                      ? "bg-white text-primary shadow-sm ring-1 ring-slate-200" 
                      : "text-muted-foreground hover:text-primary hover:bg-slate-100/50"
                  )}>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </a>
                </Link>
              ))}
            </nav>
          </aside>

          <main>
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {description && <p className="text-muted-foreground mt-1">{description}</p>}
            </div>
            {children}
          </main>
        </div>
      </PageContainer>
    </div>
  );
}
