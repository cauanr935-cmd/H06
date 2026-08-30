import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
});

export const metadata = {
  title: "Hectare06 | Carta de Intenção",
  description:
    "Assine a carta de intenção da Hectare06 (H06) e demonstre interesse em transformar sua área rural em renda com floresta em pé.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={montserrat.variable}>
      <body>{children}</body>
    </html>
  );
}
