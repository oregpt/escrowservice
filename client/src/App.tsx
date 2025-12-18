import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import EscrowNew from "@/pages/escrow-new";
import EscrowDetail from "@/pages/escrow-detail";
import AccountPage from "@/pages/account";
import OrganizationPage from "@/pages/organization";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/escrow/new" component={EscrowNew} />
      <Route path="/escrow/:id" component={EscrowDetail} />
      <Route path="/account" component={AccountPage} />
      <Route path="/org/:id" component={OrganizationPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
