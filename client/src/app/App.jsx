import { Routes, Route } from "react-router-dom";
import { CalendarPage } from "../pages/CalendarPage";
import { DiscoverPage } from "../pages/DiscoverPage";
import { AboutPage } from "../pages/AboutPage";
import { NotFoundPage } from "../pages/NotFoundPage";
export function App() {
  return (
    <Routes>
      <Route path="/" element={<CalendarPage />} />
      <Route path="/discover" element={<DiscoverPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
