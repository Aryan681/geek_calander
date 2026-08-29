import { Routes, Route } from "react-router-dom";
import { CalendarPage } from "../pages/CalendarPage";
import { DiscoverPage } from "../pages/DiscoverPage";
import { AboutPage } from "../pages/AboutPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { RoulettePage } from "../pages/RoulettePage";
export function App() {
  return (
    <Routes>
      <Route path="/" element={<CalendarPage />} />
      <Route path="/discover" element={<DiscoverPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/roulette" element={<RoulettePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
