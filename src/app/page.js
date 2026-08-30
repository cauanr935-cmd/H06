import Header from "./components/Header";
import Hero from "./components/Hero";
import AboutLetter from "./components/AboutLetter";
import Founders from "./components/Founders";
import Faq from "./components/Faq";
import SignCta from "./components/SignCta";

// Âncora para a seção de assinatura (o fluxo vive em <SignCta />).
const SIGN_HREF = "#assinar";

export default function Home() {
  return (
    <main>
      <Header />
      <Hero signHref={SIGN_HREF} />
      <AboutLetter />
      <Founders />
      <Faq />
      <SignCta />
    </main>
  );
}
