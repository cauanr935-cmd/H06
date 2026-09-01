"use client";

import { useState } from "react";
import styles from "./Faq.module.css";

const QUESTIONS = [
  {
    question: "O que é a H06?",
    answer:
      "Somos uma plataforma que conecta agricultores familiares com terras legalizadas a compradores de créditos de carbono, gerando renda extra para quem preserva a vegetação nativa exigida por lei.",
  },
  {
    question: "Como o produtor rural ganha dinheiro com isso?",
    answer:
      "A área de reserva legal já mantida na propriedade (mínimo de 20% exigido pelo Código Florestal) é usada para gerar créditos de carbono comercializáveis. O produtor recebe repasse anual pela área destinada ao programa.",
  },
  {
    question: "Quais documentos o produtor precisa ter?",
    answer: "CAR regularizado e comprovação de posse da terra.",
  },
  {
    question: "O produtor perde o direito de uso da terra?",
    answer:
      "Não. Toda a área fora do contrato pode ser usada normalmente. A única restrição é não desmatar a área especificamente destinada à captação de crédito de carbono.",
  },
  {
    question: "Em quais regiões vocês atuam?",
    answer:
      "Iniciamos na Mata Atlântica, por já contar com metodologias consolidadas de cálculo de carbono. A expansão para outros biomas e escala nacional está no roadmap.",
  },
  {
    question: "Os créditos são certificados internacionalmente?",
    answer:
      "Seguimos os padrões do mercado voluntário de carbono. A certificação internacional específica está em processo de definição junto aos especialistas técnicos responsáveis.",
  },
  {
    question: "A plataforma já está em operação comercial?",
    answer:
      "Estamos na fase de validação de tração, reunindo cartas de intenção de produtores e potenciais compradores antes do lançamento comercial pleno.",
  },
  {
    question: "Assinar me obriga a alguma coisa?",
    answer:
      "Não. A carta de intenção apenas registra seu interesse em participar do projeto — ela não é um contrato e não gera nenhuma obrigação.",
  },
  {
    question: "Minha terra continua sendo minha?",
    answer:
      "Sim. A propriedade continua sendo integralmente sua. Nenhum documento aqui transfere posse, uso ou direitos sobre a área.",
  },
  {
    question: "Preciso pagar algo?",
    answer:
      "Não. Assinar a carta de intenção não tem nenhum custo para você.",
  },
  {
    question: "Como recebo minha via assinada?",
    answer:
      "Depois de assinar, o PDF assinado fica disponível para download na própria tela — não enviamos por e-mail.",
  },
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className={styles.faq} id="duvidas">
      <h2>Dúvidas frequentes</h2>
      <div className={styles.list}>
        {QUESTIONS.map((item, index) => {
          const isOpen = index === openIndex;
          return (
            <div className={styles.item} key={item.question}>
              <button
                className={styles.question}
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                aria-expanded={isOpen}
              >
                <span>{item.question}</span>
                <span className={`${styles.icon} ${isOpen ? styles.iconOpen : ""}`}>
                  +
                </span>
              </button>
              <div
                className={`${styles.answerWrap} ${
                  isOpen ? styles.answerOpen : ""
                }`}
              >
                <div className={styles.answerInner}>
                  <p className={styles.answer}>{item.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
