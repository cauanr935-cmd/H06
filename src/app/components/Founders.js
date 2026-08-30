import Image from "next/image";
import styles from "./Founders.module.css";

const FOUNDERS = [
  {
    name: "Bruno",
    photo: "/bruno.png",
    bio: "Sou estudante de ciência da computação, já realizei projetos com o BTG Pactual, Nvidia e a Traction.",
    linkedin: "https://www.linkedin.com/in/bruno-nascimento-ara%C3%BAjo",
  },
  {
    name: "Cauan",
    photo: "/cauan.png",
    bio: "Sou estudante de Sistemas de Informação e já realizei projetos com a Cielo, Redbull e Cocamar.",
    linkedin: "https://www.linkedin.com/in/cauanmartinss/",
  },
];

export default function Founders() {
  return (
    <section className={styles.founders} id="fundadores">
      <h2>Fundadores</h2>
      <div className={styles.grid}>
        {FOUNDERS.map((founder) => (
          <div className={styles.profile} key={founder.name}>
            <Image
              src={founder.photo}
              alt={founder.name}
              width={160}
              height={160}
              className={styles.photo}
            />
            <p className={styles.name}>{founder.name}</p>
            <p className={styles.bio}>{founder.bio}</p>
            <a
              href={founder.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkedin}
            >
              LinkedIn
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
