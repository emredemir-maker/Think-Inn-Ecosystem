import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { HUDLayout } from "@/components/layout/HUDLayout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import IdeasPage from "@/pages/IdeasPage";
import IdeasWorkspace from "@/pages/IdeasWorkspace";
import ResearchHubPage from "@/pages/ResearchHubPage";
import ProjectsHubPage from "@/pages/ProjectsHubPage";
import FeasibilityPage from "@/pages/FeasibilityPage";
import FinancialPage from "@/pages/FinancialPage";
import MapPage from "@/pages/MapPage";
import CommunityPage from "@/pages/CommunityPage";
import UserManagementPage from "@/pages/admin/UserManagementPage";
import DepartmentManagementPage from "@/pages/admin/DepartmentManagementPage";
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

// Admin-only route guard — public (giriş yok) ziyaretçi /community veya /admin/*
// URL'ine doğrudan giderse Panel'e yönlendir. Topluluk + Yönetim henüz açılmadı.
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);
  if (loading) return null;
  if (!user) return null;
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
        <Route path="/ideas" component={IdeasPage} />
        <Route path="/workspace" component={IdeasWorkspace} />
        <Route path="/research" component={ResearchHubPage} />
        <Route path="/projects" component={ProjectsHubPage} />
        <Route path="/feasibility" component={FeasibilityPage} />
        <Route path="/financial" component={FinancialPage} />
        <Route path="/map" component={MapPage} />
        <Route path="/community">
          <RequireAdmin><CommunityPage /></RequireAdmin>
        </Route>
        <Route path="/admin/users">
          <RequireAdmin><UserManagementPage /></RequireAdmin>
        </Route>
        <Route path="/admin/departments">
          <RequireAdmin><DepartmentManagementPage /></RequireAdmin>
        </Route>
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
