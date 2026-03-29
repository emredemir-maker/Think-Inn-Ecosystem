import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { HUDLayout } from "@/components/layout/HUDLayout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import CommunityPage from "@/pages/CommunityPage";
import UserManagementPage from "@/pages/admin/UserManagementPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2,
    },
  },
});

function Router() {
  return (
    <HUDLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/community" component={CommunityPage} />
        <Route path="/admin/users" component={UserManagementPage} />
        <Route component={NotFound} />
      </Switch>
    </HUDLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
