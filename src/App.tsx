import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "@/context/WalletContext";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Train from "./pages/Train";
import Races from "./pages/Races";
import RaceResults from "./pages/RaceResults";
import Leaderboard from "./pages/Leaderboard";
import CreatureProfile from "./pages/CreatureProfile";
import Admin from "./pages/Admin";
import FAQ from "./pages/FAQ";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/train" element={<Train />} />
            <Route path="/train/:creatureId" element={<Train />} />
            <Route path="/races" element={<Races />} />
            <Route path="/races/:raceId/results" element={<RaceResults />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/creatures/:creatureId" element={<CreatureProfile />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/admin" element={<Admin />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </WalletProvider>
  </QueryClientProvider>
);

export default App;
