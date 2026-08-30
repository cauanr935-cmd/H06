/** @type {import('next').NextConfig} */
const nextConfig = {
  // Evita que o Next.js gere CLAUDE.md/AGENTS.md automaticamente — o projeto já mantém o seu próprio claude.md.
  agentRules: false,
};

export default nextConfig;
