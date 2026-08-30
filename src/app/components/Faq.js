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
      "Depois de assinar, você recebe uma cópia por e-mail para guardar com você.",
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
                <span className={styles.icon}>{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && <p className={styles.answer}>{item.answer}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
