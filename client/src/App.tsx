import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSession } from "@/hooks/use-session";
import { SaveAccountBanner } from "@/components/auth/SaveAccountBanner";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import EscrowNew from "@/pages/escrow-new";
import EscrowDetail from "@/pages/escrow-detail";
import EscrowList from "@/pages/escrow-list";
import AccountPage from "@/pages/account";
import OrganizationPage from "@/pages/organization";
import SettingsPage from "@/pages/settings";
import ServiceTypesPage from "@/pages/admin/service-types";
import AdminOrganizationsPage from "@/pages/admin/organizations";
import AdminDashboard from "@/pages/admin/dashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/escrow" component={EscrowList} />
      <Route path="/escrow/new" component={EscrowNew} />
      <Route path="/escrow/:id" component={EscrowDetail} />
      <Route path="/account" component={AccountPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/org/:id" component={OrganizationPage} />

      {/* Admin Routes */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/service-types" component={ServiceTypesPage} />
      <Route path="/admin/organizations" component={AdminOrganizationsPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isInitialized, isLoading } = useSession();

  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Initializing session...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SaveAccountBanner />
      <Router />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
