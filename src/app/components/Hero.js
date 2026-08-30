import styles from "./Hero.module.css";

export default function Hero({ signHref }) {
  return (
    <section className={styles.hero}>
      <h1>Sua terra pode gerar renda com a floresta em pé.</h1>
      <p>
        A Hectare06 conecta produtores rurais a projetos de preservação
        florestal remunerados. Assine a carta de intenção para demonstrar seu
        interesse — sem custo e sem compromisso de venda.
      </p>
      <div className={styles.actions}>
        <a href={signHref} className="button button--primary">
          Assinar carta de intenção
        </a>
        <a href="#projeto" className={styles.secondary}>
          Entender primeiro →
        </a>
      </div>
    </section>
  );
}
