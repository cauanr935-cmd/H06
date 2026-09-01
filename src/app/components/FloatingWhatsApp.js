import styles from "./FloatingWhatsApp.module.css";

// Número de contato da H06 no WhatsApp (somente dígitos, com DDI). O link de QR
// (wa.me/qr/...) não aceita mensagem pré-preenchida — por isso usamos o número.
const WHATSAPP_NUMBER = "558892895332";
const PREFILLED_MESSAGE = "Eu quero entender mais sobre o projeto!";

const HREF =
  `https://wa.me/${WHATSAPP_NUMBER}?text=` +
  encodeURIComponent(PREFILLED_MESSAGE);

export default function FloatingWhatsApp() {
  return (
    <div className={styles.wrap}>
      <a
        className={styles.button}
        href={HREF}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Fale conosco no WhatsApp"
      >
        <span className={styles.tooltip} aria-hidden="true">
          Posso ajudar?
        </span>
        <svg
          className={styles.icon}
          viewBox="0 0 32 32"
          role="img"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M16.003 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.256.59 4.454 1.71 6.394L3.2 28.8l6.57-1.72a12.74 12.74 0 0 0 6.23 1.62h.005c7.06 0 12.8-5.74 12.8-12.8 0-3.42-1.332-6.635-3.75-9.052A12.72 12.72 0 0 0 16.003 3.2Zm0 23.02h-.004a10.63 10.63 0 0 1-5.42-1.484l-.39-.23-4.03 1.056 1.075-3.926-.253-.403a10.6 10.6 0 0 1-1.626-5.663c0-5.867 4.774-10.64 10.646-10.64 2.842 0 5.514 1.108 7.522 3.118a10.57 10.57 0 0 1 3.116 7.53c0 5.867-4.774 10.64-10.64 10.64Zm5.836-7.968c-.32-.16-1.893-.934-2.187-1.04-.293-.107-.507-.16-.72.16-.213.32-.826 1.04-1.013 1.253-.187.213-.373.24-.693.08-.32-.16-1.35-.498-2.573-1.588-.95-.848-1.593-1.895-1.78-2.215-.187-.32-.02-.493.14-.652.144-.143.32-.373.48-.56.16-.187.213-.32.32-.533.107-.213.053-.4-.027-.56-.08-.16-.72-1.735-.987-2.376-.26-.623-.524-.539-.72-.549l-.613-.011c-.213 0-.56.08-.853.4-.293.32-1.12 1.094-1.12 2.669 0 1.574 1.147 3.095 1.307 3.308.16.213 2.257 3.446 5.468 4.832.764.33 1.36.527 1.825.674.767.244 1.464.21 2.016.127.615-.092 1.893-.774 2.16-1.522.267-.747.267-1.388.187-1.521-.08-.133-.293-.213-.613-.373Z"
          />
        </svg>
      </a>
    </div>
  );
}
