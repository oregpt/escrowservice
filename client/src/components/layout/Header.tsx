import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, ShieldCheck, Wallet, Settings, Building2, Bell, LogIn, Loader2, Shield, ChevronDown, Plus, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth, useOrganizations, useLogout, useLogin } from "@/hooks/use-api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function Header() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: authData, refetch: refetchAuth, isLoading: isAuthLoading } = useAuth();
  const { data: orgs, refetch: refetchOrgs } = useOrganizations();
  const logout = useLogout();
  const login = useLogin();

  const [loginOpen, setLoginOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const user = authData?.user;
  // Default to first org if none selected, or find selected org
  const currentOrg = selectedOrgId
    ? orgs?.find(o => o.id === selectedOrgId)
    : orgs?.[0];
  const isAdmin = user?.role === 'platform_admin' || user?.role === 'admin';

  // Auto-select first org when orgs load and none is selected
  useEffect(() => {
    if (orgs && orgs.length > 0 && !selectedOrgId) {
      const firstOrgId = orgs[0].id;
      setSelectedOrgId(firstOrgId);
      localStorage.setItem('escrow_current_org_id', firstOrgId);
    }
  }, [orgs, selectedOrgId]);

  // Persist selected org in localStorage
  useEffect(() => {
    const savedOrgId = localStorage.getItem('escrow_current_org_id');
    if (savedOrgId) {
      setSelectedOrgId(savedOrgId);
    }
  }, []);

  const handleSelectOrg = (orgId: string) => {
    setSelectedOrgId(orgId);
    localStorage.setItem('escrow_current_org_id', orgId);
  };

  // Get initials from display name or email
  const getInitials = () => {
    if (user?.displayName) {
      return user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    if (user?.username) {
      return user.username[0].toUpperCase();
    }
    return 'U';
  };

  const handleLogin = async () => {
    setError('');
    if (!username.trim() || !password) {
      setError('Username and password are required');
      return;
    }

    try {
      const result = await login.mutateAsync({ username: username.trim(), password });

      // Clear ALL cached queries to force fresh data
      queryClient.clear();

      // Refetch auth and orgs with fresh session
      await Promise.all([
        refetchAuth(),
        refetchOrgs(),
      ]);

      toast({
        title: 'Welcome!',
        description: `Logged in as ${result?.user?.displayName || result?.user?.username || 'User'}.`,
      });
      setLoginOpen(false);
      setUsername('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid username or password');
    }
  };

  // Build nav items based on auth status
  // Anonymous users can only see Escrows tab
  // Organization is accessed via dropdown, not nav
  const navItems = user?.isAuthenticated
    ? [
        { label: "Dashboard", href: "/", icon: LayoutDashboard },
        { label: "Escrows", href: "/escrow", icon: ShieldCheck },
        { label: "Balances", href: "/account", icon: Wallet },
      ]
    : [
        { label: "Escrows", href: "/escrow", icon: ShieldCheck },
      ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/">
              <a className="flex items-center gap-2 font-semibold text-lg tracking-tight hover:opacity-90 transition-opacity">
                <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold font-mono">
                  E
                </div>
                <span>Escrow<span className="text-muted-foreground">Service</span></span>
              </a>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <a className={cn(
                    "text-sm font-medium transition-colors hover:text-primary flex items-center gap-2",
                    location === item.href || (item.href !== '/' && location.startsWith(item.href))
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}>
                    {item.label}
                  </a>
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {/* Admin link for platform admins */}
            {isAdmin && (
              <Link href="/admin">
                <a className={cn(
                  "text-sm font-medium transition-colors hover:text-primary flex items-center gap-1",
                  location.startsWith('/admin') ? "text-primary" : "text-muted-foreground"
                )}>
                  <Shield className="h-4 w-4" />
                  Admin
                </a>
              </Link>
            )}

            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Bell className="h-5 w-5" />
            </Button>

            {/* Organization Selector - only for authenticated users */}
            {user?.isAuthenticated && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="max-w-[120px] truncate">
                      {currentOrg?.name || (orgs && orgs.length > 0 ? orgs[0].name : 'Create Organization')}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Organizations</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {orgs && orgs.length > 0 ? (
                    orgs.map((org) => (
                      <DropdownMenuItem
                        key={org.id}
                        onClick={() => handleSelectOrg(org.id)}
                        className="flex items-center justify-between"
                      >
                        <span>{org.name}</span>
                        {currentOrg?.id === org.id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>
                      <span className="text-muted-foreground">No organizations yet</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/org/new" className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Create Organization
                      </Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Login button for non-authenticated users */}
            {!user?.isAuthenticated && (
              <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Sign In</DialogTitle>
                    <DialogDescription>
                      Enter your credentials to access your account.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="login-username">Username</Label>
                      <Input
                        id="login-username"
                        placeholder="Enter your username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        disabled={login.isPending}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        disabled={login.isPending}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleLogin}
                      disabled={login.isPending}
                    >
                      {login.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Sign In
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8 border">
                    <AvatarImage src={user?.avatarUrl || "/avatars/01.png"} alt="@user" />
                    <AvatarFallback>{getInitials()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.displayName || user?.username || user?.email || 'Guest User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email || user?.username || (user?.isAuthenticated ? 'Authenticated' : 'Anonymous Session')}
                    </p>
                    {user?.role && user.role !== 'user' && (
                      <p className="text-xs leading-none text-primary font-medium mt-1">
                        {user.role.replace('_', ' ')}
                      </p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Shield className="h-4 w-4 mr-2" />
                      Admin Panel
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout.mutate()}>
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
