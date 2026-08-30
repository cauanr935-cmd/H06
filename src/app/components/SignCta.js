import styles from "./SignCta.module.css";
import SignFlow from "./SignFlow";

export default function SignCta() {
  return (
    <section className={styles.signCta} id="assinar">
      <h2>Pronto para assinar?</h2>
      <p>
        Você preenche aqui, assina na plataforma segura do DocuSeal e volta
        para esta página. Sem cadastro, sem custo — o PDF assinado fica
        disponível para download na hora.
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
