import Header from "./components/Header";
import Hero from "./components/Hero";
import AboutLetter from "./components/AboutLetter";
import Faq from "./components/Faq";
import SignCta from "./components/SignCta";

// TODO: substituir pela URL real da plataforma de assinatura (ex.: Autentique, DocuSign) quando integrada.
const SIGN_HREF = "#";

export default function Home() {
  return (
    <main>
      <Header />
      <Hero signHref={SIGN_HREF} />
      <AboutLetter />
      <Faq />
      <SignCta signHref={SIGN_HREF} />
    </main>
  );
}
