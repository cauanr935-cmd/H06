"use client";

import { useState } from "react";
import styles from "./Faq.module.css";

const QUESTIONS = [
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
  const [openIndex, setOpenIndex] = useState(1);

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
