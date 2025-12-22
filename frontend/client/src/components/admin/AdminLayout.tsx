import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Link, useLocation, Redirect } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, LayoutList, Building2, Settings, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-api";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const [location] = useLocation();
  const { data: authData, isLoading } = useAuth();
  const user = authData?.user;

  // Determine role display and permissions
  const isPlatformAdmin = user?.role === 'platform_admin';

  // Role display text
  const roleDisplay = isPlatformAdmin ? 'Platform Admin' : 'Organization Admin';

  // Filter sidebar items based on role
  // Platform admins see everything
  // Org admins only see Organizations (their own org)
  const allSidebarItems = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard, platformOnly: true },
    { label: "Service Types", href: "/admin/service-types", icon: LayoutList, platformOnly: true },
    { label: "Organizations", href: "/admin/organizations", icon: Building2, platformOnly: false },
    { label: "Platform Settings", href: "/admin/settings", icon: Settings, platformOnly: true },
  ];

  const sidebarItems = isPlatformAdmin
    ? allSidebarItems
    : allSidebarItems.filter(item => !item.platformOnly);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Redirect non-authenticated users
  if (!user) {
    return <Redirect to="/login" />;
  }

  // Redirect non-admin users trying to access platform-only pages
  if (!isPlatformAdmin) {
    const isPlatformOnlyPage = location !== '/admin/organizations' && location !== '/admin';
    if (isPlatformOnlyPage) {
      return <Redirect to="/admin/organizations" />;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <PageContainer fullWidth className="max-w-7xl">
        <div className="grid md:grid-cols-[240px_1fr] gap-8">
          <aside className="space-y-6">
            <div className={cn(
              "text-white p-4 rounded-lg mb-6",
              isPlatformAdmin ? "bg-slate-900" : "bg-indigo-900"
            )}>
              <div className="text-xs font-mono text-slate-400 mb-1">CURRENT ROLE</div>
              <div className="font-bold">{roleDisplay}</div>
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
