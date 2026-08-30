import styles from "./SignCta.module.css";
import SignFlow from "./SignFlow";

export default function SignCta() {
  return (
    <section className={styles.signCta} id="assinar">
      <h2>Pronto para assinar?</h2>
      <p>
        Preencha os dados abaixo e assine a carta de intenção aqui mesmo. Sem
        cadastro, sem custo — o PDF assinado fica disponível para download na hora.
      </p>
      <SignFlow />
      <a
        href="/carta-de-intencao.pdf"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.docLink}
      >
        Ler o documento antes (PDF)
      </a>
    </section>
  );
}
