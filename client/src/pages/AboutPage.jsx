import { Command } from "lucide-react";
import { Header } from "../components/navigation/Header";
export function AboutPage() {
  return (
    <>
      <Header onSearch={() => {}} onMenu={() => {}} />
      <main className="simple-page">
        <p className="eyebrow">/ geek calendar</p>
        <h1>Built for the next thing.</h1>
        <p className="lede">
          Geek Calendar brings anime, movie, and game release dates into one
          focused place, aggregated from the project’s supported providers.
        </p>
        <div className="about-note">
          <Command size={18} />
          <span>Stay curious. Keep your watchlist moving.</span>
        </div>
      </main>
    </>
  );
}
