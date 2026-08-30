"use client";

import { useState } from "react";

import { toE164BR, maskInputBR } from "../../lib/phone.js";
import { submitLead, mensagemDeErro } from "../../lib/init-form-client.js";
import styles from "./SignFlow.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CAMPOS_INICIAIS = {
  name: "",
  phone: "",
  email: "",
  municipio_uf: "",
  area_hectares: "",
};

function validar(campos) {
  const errors = {};

  if (!campos.name.trim()) errors.name = "Informe seu nome completo.";
  if (!toE164BR(campos.phone)) errors.phone = "Informe um WhatsApp válido com DDD.";
  if (campos.email.trim() && !EMAIL_RE.test(campos.email.trim())) {
    errors.email = "E-mail inválido.";
  }
  if (!campos.municipio_uf.trim()) errors.municipio_uf = "Informe o município e a UF da propriedade.";

  const area = Number(campos.area_hectares.replace(",", "."));
  if (!campos.area_hectares.trim() || !Number.isFinite(area) || area <= 0) {
    errors.area_hectares = "Informe a área aproximada em hectares.";
  }

  return errors;
}

export default function SignFlow() {
  const [phase, setPhase] = useState("form"); // form | loading
  const [campos, setCampos] = useState(CAMPOS_INICIAIS);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);

  function setCampo(nome, valor) {
    setCampos((c) => ({ ...c, [nome]: valor }));
    setFieldErrors((e) => (e[nome] ? { ...e, [nome]: undefined } : e));
  }

  function focarPrimeiroErro(errors) {
    const primeiro = ["name", "phone", "email", "municipio_uf", "area_hectares"].find((k) => errors[k]);
    if (primeiro) document.getElementById(`sf-${primeiro}`)?.focus();
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (phase === "loading") return;
    setFormError(null);

    const errors = validar(campos);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      focarPrimeiroErro(errors);
      return;
    }

    setFieldErrors({});
    setPhase("loading");

    const res = await submitLead({
      name: campos.name.trim(),
      phone: campos.phone.trim(),
      email: campos.email.trim(),
      values: {
        municipio_uf: campos.municipio_uf.trim(),
        area_hectares: campos.area_hectares.replace(",", ".").trim(),
      },
    });

    if (res.ok) {
      window.location.assign(res.data.embed_src);
      return;
    }

    const msg = mensagemDeErro(res.error, res.status);
    setPhase("form");
    if (msg.campo) {
      setFieldErrors({ [msg.campo]: msg.texto });
      focarPrimeiroErro({ [msg.campo]: msg.texto });
    } else {
      setFormError(msg.texto);
    }
  }

  const carregando = phase === "loading";

  return (
    <form className={styles.flow} onSubmit={enviar} noValidate>
      {formError && (
        <div className={styles.formError} role="alert" aria-live="assertive">
          {formError}
        </div>
      )}

      <Campo
        id="sf-name"
        label="Nome completo"
        value={campos.name}
        erro={fieldErrors.name}
        onChange={(v) => setCampo("name", v)}
        autoComplete="name"
        disabled={carregando}
      />

      <Campo
        id="sf-phone"
        label="WhatsApp"
        value={campos.phone}
        erro={fieldErrors.phone}
        onChange={(v) => setCampo("phone", maskInputBR(v))}
        inputMode="numeric"
        placeholder="(00) 00000-0000"
        autoComplete="tel"
        disabled={carregando}
      />

      <Campo
        id="sf-email"
        label="E-mail (opcional)"
        value={campos.email}
        erro={fieldErrors.email}
        onChange={(v) => setCampo("email", v)}
        type="email"
        inputMode="email"
        autoComplete="email"
        disabled={carregando}
      />

      <Campo
        id="sf-municipio_uf"
        label="Município / UF da propriedade"
        value={campos.municipio_uf}
        erro={fieldErrors.municipio_uf}
        onChange={(v) => setCampo("municipio_uf", v)}
        placeholder="Ex.: Sorriso/MT"
        disabled={carregando}
      />

      <Campo
        id="sf-area_hectares"
        label="Área aproximada (hectares)"
        value={campos.area_hectares}
        erro={fieldErrors.area_hectares}
        onChange={(v) => setCampo("area_hectares", v)}
        inputMode="decimal"
        placeholder="Ex.: 150"
        disabled={carregando}
      />

      <button type="submit" className={`button button--primary ${styles.submit}`} disabled={carregando}>
        {carregando ? "Preparando a assinatura…" : "Assinar carta de intenção"}
      </button>
    </form>
  );
}

function Campo({ id, label, value, erro, onChange, ...rest }) {
  const errId = `${id}-err`;
  return (
    <div className={styles.campo}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={erro ? styles.inputErro : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={erro ? "true" : undefined}
        aria-describedby={erro ? errId : undefined}
        {...rest}
      />
      {erro && (
        <p id={errId} className={styles.erro} role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
