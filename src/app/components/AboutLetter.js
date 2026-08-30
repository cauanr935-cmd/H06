import styles from "./AboutLetter.module.css";

export default function AboutLetter() {
  return (
    <section className={styles.about} id="projeto">
      <h2>O que é a carta de intenção?</h2>
      <p>
        É um documento simples em que você declara interesse em participar do
        projeto da Hectare06. Ela não vende nem compromete sua propriedade —
        é o primeiro passo para conversarmos sobre um contrato futuro.
      </p>
      <ul className={styles.checks}>
        <li>✓ não é contrato</li>
        <li>✓ sem custo</li>
        <li>✓ pode desistir depois</li>
      </ul>
    </section>
  );
}
