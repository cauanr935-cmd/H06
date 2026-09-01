import styles from "./AboutUs.module.css";

export default function AboutUs() {
  return (
    <section className={styles.aboutUs} id="quem-somos">
      <h2>Quem somos</h2>
      <p>
        A H06 (Hectare06) é uma plataforma que conecta pequenos e médios
        agricultores familiares brasileiros, com terras legalizadas e
        Cadastro Ambiental Rural (CAR) regularizado, a empresas interessadas
        em compensar suas emissões de carbono.
      </p>
      <p>
        Cada hectare de área de preservação legal mantida na propriedade
        rural passa a gerar renda extra recorrente para o produtor, através
        da comercialização de créditos de carbono no mercado voluntário, com
        pagamento anual e repasse direto às famílias envolvidas.
      </p>
      <p>
        A startup nasceu dentro do INTELI (Instituto de Tecnologia e
        Liderança), fundada por dois estudantes da instituição. Atualmente,
        estamos na fase de estruturação técnica e captação de cartas de
        intenção, validando a demanda do mercado antes do lançamento
        comercial completo, com foco inicial na Mata Atlântica, bioma no
        qual as metodologias de cálculo de captação de carbono já são bem
        estabelecidas. O plano é expandir para atuação nacional nas fases
        seguintes.
      </p>
    </section>
  );
}
