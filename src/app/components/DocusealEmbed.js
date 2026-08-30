"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

import styles from "./DocusealEmbed.module.css";

const FORM_JS = "https://cdn.docuseal.com/js/form.js";

/**
 * Renderiza o <docuseal-form> (web component do DocuSeal) e escuta os eventos
 * `completed` / `declined` disparados no elemento host. O form.js renderiza o
 * formulário inline (sem iframe) e busca os dados por fetch cross-origin.
 */
export default function DocusealEmbed({ src, onCompleted, onDeclined }) {
  const ref = useRef(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const handleCompleted = (e) => onCompleted?.(e.detail);
    const handleDeclined = (e) => onDeclined?.(e.detail);

    el.addEventListener("completed", handleCompleted);
    el.addEventListener("declined", handleDeclined);
    return () => {
      el.removeEventListener("completed", handleCompleted);
      el.removeEventListener("declined", handleDeclined);
    };
  }, [onCompleted, onDeclined]);

  return (
    <div className={styles.wrap}>
      <Script src={FORM_JS} strategy="lazyOnload" onReady={() => setScriptReady(true)} />
      {!scriptReady && <p className={styles.loading}>Carregando o formulário de assinatura…</p>}
      <docuseal-form ref={ref} data-src={src} />
    </div>
  );
}
