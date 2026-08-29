import { Link } from "react-router-dom";
import { Header } from "../components/navigation/Header";
export function NotFoundPage() {
  return (
    <>
      <Header onSearch={() => {}} onMenu={() => {}} />
      <main className="simple-page">
        <p className="eyebrow">/ signal lost</p>
        <h1>404</h1>
        <p className="lede">This page doesn’t exist.</p>
        <Link className="primary-button inline-button" to="/">
          Return to calendar
        </Link>
      </main>
    </>
  );
}
