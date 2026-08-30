import styles from "./SignCta.module.css";

export default function SignCta({ signHref }) {
  return (
    <section className={styles.signCta} id="assinar">
      <h2>Pronto para assinar?</h2>
      <p>
        Você será direcionado à plataforma de assinatura para concluir o
        processo.
      </p>
      <div className={styles.actions}>
        <a
          href={signHref}
          className={`button button--primary ${styles.button}`}
        >
          Assinar carta de intenção ↗
        </a>
        <a
          href="/carta-de-intencao.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.docLink}
        >
          Ler o documento (PDF)
        </a>
      </div>
      <span className={styles.hint}>link externo · API de assinatura</span>
    </section>
  );
}
