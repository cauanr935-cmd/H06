import Image from "next/image";
import logo from "../../../public/Hectare06.png";
import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <Image src={logo} alt="Hectare06" width={48} height={48} priority />
        <span className={styles.name}>Hectare06</span>
      </div>
      <nav className={styles.nav}>
        <a href="#projeto">O projeto</a>
        <a href="#duvidas">Dúvidas</a>
        <a href="#assinar" className={styles.navActive}>
          Assinar
        </a>
      </nav>
    </header>
  );
}
