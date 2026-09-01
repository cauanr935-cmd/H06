"use client";

import { useState } from "react";
import styles from "./AboutUs.module.css";

export default function AboutUs() {
  const [open, setOpen] = useState(false);

  return (
    <section className={styles.aboutUs} id="quem-somos">
      <h2>Quem somos</h2>
      <p className={styles.summary}>
        A H06 conecta agricultores que preservam suas terras a empresas que
        querem compensar carbono — gerando renda extra para quem cuida do
        meio ambiente.
      </p>

      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{open ? "Ver menos" : "Saiba mais sobre a H06"}</span>
        <span className={`${styles.icon} ${open ? styles.iconOpen : ""}`}>
          +
        </span>
      </button>

      <div className={`${styles.moreWrap} ${open ? styles.moreOpen : ""}`}>
        <div className={styles.moreInner}>
          <p>
            Cada hectare de área de preservação legal mantida na propriedade
            rural passa a gerar renda extra recorrente para o produtor,
            através da comercialização de créditos de carbono no mercado
            voluntário, com pagamento anual e repasse direto às famílias
            envolvidas.
          </p>
          <p>
            A startup nasceu dentro do INTELI (Instituto de Tecnologia e
            Liderança), fundada por dois estudantes da instituição.
            Atualmente, estamos na fase de estruturação técnica e captação de
            cartas de intenção, validando a demanda do mercado antes do
            lançamento comercial completo, com foco inicial na Mata
            Atlântica, bioma no qual as metodologias de cálculo de captação
            de carbono já são bem estabelecidas. O plano é expandir para
            atuação nacional nas fases seguintes.
          </p>
        </div>
      </div>
    </section>
  );
}
