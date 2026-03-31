import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { HUDLayout } from "@/components/layout/HUDLayout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import CommunityPage from "@/pages/CommunityPage";
import UserManagementPage from "@/pages/admin/UserManagementPage";
import AuthPage from "@/pages/AuthPage";
import { useEffect } from "react";
import { setBaseUrl } from "@workspace/api-client-react";
import { API_ORIGIN } from "@/lib/api-config";

setBaseUrl(API_ORIGIN || null);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2,
    },
  },
});

// Redirect logged-in users away from /auth
function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!loading && user) navigate("/");
  }, [user, loading, navigate]);
  if (loading) return null;
  return <>{children}</>;
}

function Router() {
  const [location] = useLocation();

  if (location === "/auth") {
    return (
      <AuthRedirect>
        <AuthPage />
      </AuthRedirect>
    );
  }

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
