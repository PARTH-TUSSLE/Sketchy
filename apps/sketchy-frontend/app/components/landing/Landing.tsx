import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { Marquee } from "./Marquee";
import { How } from "./How";
import { Features } from "./Features";
import { Cta } from "./Cta";
import { Footer } from "./Footer";

export function Landing() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <Nav />
      <Hero />
      <Marquee />
      <How />
      <Features />
      <Cta />
      <Footer />
    </main>
  );
}