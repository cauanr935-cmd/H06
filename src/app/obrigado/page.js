import Link from "next/link";

import styles from "./obrigado.module.css";

export const metadata = {
  title: "Recebemos sua manifestação — Hectare06",
};

export default async function Obrigado({ searchParams }) {
  const params = await searchParams;
  const leadId = typeof params?.lead_id === "string" ? params.lead_id : null;

  return (
    <main className={styles.wrap}>
      <section className={styles.card}>
        <h1>Recebemos sua manifestação de interesse.</h1>
        <p>
          Obrigado por preencher a carta de intenção. Nossa equipe vai
          analisar as respostas e entrar em contato pelos dados informados.
        </p>
        {leadId && <p className={styles.leadId}>Protocolo: {leadId}</p>}
        <Link href="/" className="button button--primary">
          Voltar para a página inicial
        </Link>
      </section>
    </main>
  );
}
