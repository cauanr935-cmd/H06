# CLAUDE.md

Este arquivo fornece contexto para o Claude Code ao trabalhar neste repositório.

---

## Visão geral do projeto

Landing page de **captação de cartas de intenção** para a startup **Hectare06 (H06)**.

Agricultores, produtores rurais e demais proprietários de terra preenchem e assinam eletronicamente uma carta de intenção, comprovando que estariam dispostos a firmar contrato futuro caso o negócio se consolide. As respostas ficam visíveis **somente para os administradores**.

**Requisito central: zero atrito para o signatário.**
- Sem cadastro de conta
- Sem e-mail de convite ou confirmação
- Assinatura direta no iframe da LP via `<docuseal-form>`
- PDF assinado disponível na própria tela ao concluir

**Escala esperada:** ~150 assinaturas/mês. Não otimizar prematuramente.

---

## Arquitetura

```
Browser (LP Next.js na Vercel)
  ├─ POST /api/init-form                 [Route Handler, server-side]
  │     └─ POST https://docuseal.h06.online/api/submissions
  │           header X-Auth-Token
  │           ← [{ id, slug, embed_src }]
  │
  └─ <docuseal-form data-src={embed_src}>
        └─ iframe cross-origin → docuseal.h06.online

DocuSeal → POST https://<lp>/api/docuseal/webhook
             header secreto compartilhado
```

**A LP roda na Vercel. O DocuSeal roda num VPS separado.** Não há backend em container — o Route Handler do Next.js é o backend.

### Pastas

- `src/app/**` — código da aplicação Next.js (App Router); componentes em `src/app/components/` (CSS Modules `*.module.css` + classes utilitárias globais em `globals.css`, ex.: `button button--primary`)
- `public/` — estáticos (inclui `carta-de-intencao.pdf`)
- `assets/` — imagens e figuras
- `documentos/` — documentação (`TEMPLATE-DOCUSEAL.md`, PDF do template; `documento.md` está vazio)
- `infra/` — `docker-compose.yml` e `caddy/Caddyfile` do VPS; **não** faz parte do build do Next. Presente no working tree, **ainda não commitado**
- `scripts/` — **ainda não existe.** Criada na Fase E (`deploy.sh`, `backup.sh`, `restore.sh`)

---

## Infraestrutura do DocuSeal (JÁ PROVISIONADA — não recriar)

| Item | Valor |
|---|---|
| VPS | Hetzner CX23 — 2 vCPU, 4 GB RAM, 40 GB NVMe, Falkenstein/Helsinki |
| OS | Ubuntu 24.04 LTS, usuário `deploy` |
| Domínio | `docuseal.h06.online` (Hostinger, registro A, TTL 300) |
| TLS | Caddy v2 + Let's Encrypt, automático |
| Diretório remoto | `/opt/docuseal` |
| Serviços | `app` (docuseal/docuseal:latest), `postgres:15-alpine`, `caddy:2-alpine` |
| Portas publicadas | somente 80, 443, 443/udp (pelo Caddy) |

Hardening aplicado: SSH só por chave, root bloqueado, fail2ban, UFW + Hetzner Cloud Firewall, unattended-upgrades, swap 2 GB, log rotation do Docker.

**Backups: DESLIGADOS.** Não existe backup hoje. É a maior dívida técnica aberta.

---

## Regras invioláveis

1. **O `DOCUSEAL_TOKEN` nunca vai para o browser.** Nenhuma variável relacionada pode ter prefixo `NEXT_PUBLIC_` — esse prefixo injeta o valor no bundle do cliente.
2. **Toda chamada à API do DocuSeal sai de código server-side** (Route Handler ou Server Action), nunca de componente client.
3. **Segredos nunca commitados.** `.env.local` para dev, Environment Variables na Vercel para produção. O repo deve ter apenas `.env.example` com chaves vazias — **`.env.example` ainda não existe** (será criado na Fase A). `.env.local` já está no `.gitignore` e não é rastreado.
4. **Nunca vazar corpo de erro do upstream para o cliente.** Log detalhado no servidor, resposta genérica no browser.
5. **E-mail sempre mascarado em log** (`t***@exemplo.com`). Nunca logar token, secret ou payload completo de webhook.
6. **Nunca publicar portas além de 80/443** no `infra/docker-compose.yml`. O Docker escreve direto na chain `DOCKER-USER` do iptables e **contorna o UFW** — um `ports:` em `app` ou `postgres` expõe o serviço à internet mesmo com o UFW mostrando a porta bloqueada.
7. **Postgres com major pinada (`15`).** Tag flutuante quebra o volume numa mudança de major.
8. **Sem SMTP.** Nenhuma funcionalidade pode depender de envio de e-mail.
9. **Estado em memória não funciona na Vercel.** Serverless é stateless — rate limit, cache e deduplicação precisam de store externo (Vercel KV / Upstash).
10. **`infra/` não faz parte do build.** O deploy do VPS é separado do deploy da LP. O `./scripts/deploy.sh` **ainda não existe** (Fase E); até lá o deploy do VPS é manual: `rsync`/`scp` do `infra/` para `/opt/docuseal` + `ssh docuseal 'cd /opt/docuseal && docker compose up -d'`.
11. **Sem envio de e-mail em nenhuma ponta.** Além de "sem SMTP" (regra #8): o front não pode prometer envio de cópia por e-mail — `send_email:false` no DocuSeal e o signatário baixa o PDF na própria tela. Corrigir a copy do FAQ (`src/app/components/Faq.js` diz "recebe uma cópia por e-mail").

---

## API do DocuSeal — fatos verificados

**Criar submission** (`POST /api/submissions`, header `X-Auth-Token`):

```json
{
  "template_id": 123,
  "send_email": false,
  "send_sms": false,
  "submitters": [
    { "email": "...", "name": "...", "role": "Manifestante", "values": {} }
  ]
}
```

**A resposta é um ARRAY de submitters.** Cada item traz `id`, `slug` e `embed_src` (URL completa do formulário). A documentação oficial mostra `submission.slug` nos exemplos em Express — **isso está errado**, é `resposta[0].slug`.

**Verificado na instância em 30/08/2026:**
- `template_id` = **1**, role = **`Manifestante`**
- Submitter **sem `email` e sem `phone` é aceito** — a resposta retorna ambos como `null`. Não é preciso e-mail sintético.
- `external_id` é aceito e retornado; espelhado também no campo `application_key`
- `preferences` volta com `send_email: false` e `send_sms: false`
- O tipo de campo `Telefone` e o envio por SMS são recursos pagos. No template, telefone é campo **Texto**.
- **Confirmado ponta a ponta pelo `/api/init-form` (Fase A):** a resposta é o array; `resposta[0].embed_src` já vem como URL completa (`https://docuseal.h06.online/s/<slug>`, slug ~14 chars alfanuméricos) e abre o formulário sem login. Não precisa construir a URL nem enviar `X-Forwarded-Proto` (a chamada Vercel→VPS é HTTPS externa normal).

**Payload em uso:**

```json
{
  "template_id": 1,
  "send_email": false,
  "submitters": [{
    "name": "João da Silva",
    "role": "Manifestante",
    "external_id": "<id do lead>",
    "metadata": { "telefone_e164": "+5511999998888", "email": null, "origem": "lp-carbono" },
    "values": { "nome_completo": "João da Silva", "telefone": "(11) 99999-8888" }
  }]
}
```

`values.email` só é enviado se o lead informou e-mail — ausente é diferente de vazio. Já `metadata.email` está **sempre presente** (valor real ou `null`) porque é registro interno. O telefone vai em formato brasileiro no documento (lido por humanos) e em E.164 no `metadata`.

**Contrato do `/api/init-form` (Fase A):** request `{ name, phone, email?, values? }` → 200 `{ slug, embed_src, lead_id }`. `phone` obrigatório e normalizado (`src/lib/phone.js`); `email` validado só se preenchido; `lead_id` é um `randomUUID` gerado no handler e devolvido para o front correlacionar com o webhook. `values` do cliente passa por allowlist (`CAMPOS_PERMITIDOS` em `src/lib/docuseal/validate.js`) — `nome_completo` e `telefone` são montados no servidor e nunca aceitos do cliente. Erros: 400 `name_required|phone_required|invalid_phone|invalid_email|invalid_json`, 502 `upstream_error`, 500 `server_misconfigured`.

**Embed:**
```html
<script src="https://cdn.docuseal.com/js/form.js"></script>
<docuseal-form data-src="{embed_src}"></docuseal-form>
```

**Onde os administradores veem as respostas:** no próprio admin do DocuSeal (`https://docuseal.h06.online`), com a conta admin criada. Não há painel próprio na LP e isso não é requisito.

---

## Variáveis de ambiente

| Nome | Onde | Descrição |
|---|---|---|
| `DOCUSEAL_URL` | Vercel + `.env.local` | `https://docuseal.h06.online` |
| `DOCUSEAL_TOKEN` | Vercel + `.env.local` | token da API (Settings → API no admin) |
| `DOCUSEAL_TEMPLATE_ID` | Vercel + `.env.local` | id numérico do template |
| `SUBMITTER_ROLE` | Vercel + `.env.local` | role definido no template: `Manifestante` |
| `LEAD_ORIGEM` | Vercel + `.env.local` (opcional) | rótulo gravado em `metadata.origem`. Default `lp-carbono` |
| `WEBHOOK_SECRET` | Vercel + DocuSeal | segredo compartilhado do webhook (**falta no `.env.local` atual**; entra na Fase C) |

`.env.example` (raiz) documenta todas essas chaves. O `.env.local` de dev tem as 4 obrigatórias preenchidas e testadas contra a instância; falta só `WEBHOOK_SECRET` (Fase C).

No VPS, `/opt/docuseal/.env` (chmod 600) guarda `DOMAIN`, `ACME_EMAIL`, `POSTGRES_*` e `SECRET_KEY_BASE`. **Nunca sai do servidor.**

---

## Comandos comuns

```bash
# --- LOCAL (raiz do repo) ---
npm install
npm run dev
npm run lint
npm run test                 # vitest run — suíte de src/lib e src/app/api
npm run test:watch           # vitest em watch

# Deploy do VPS — ./scripts/deploy.sh só existe a partir da Fase E.
# Até lá, manual:
#   rsync -av infra/ docuseal:/opt/docuseal/
#   ssh docuseal 'cd /opt/docuseal && docker compose up -d'

# --- REMOTO (disparado do local) ---
ssh docuseal 'cd /opt/docuseal && docker compose ps'
ssh docuseal 'cd /opt/docuseal && docker compose logs --tail=50 app'
ssh docuseal 'cd /opt/docuseal && docker compose exec postgres psql -U docuseal -d docuseal'
ssh docuseal 'cat /opt/docuseal/.env'
ssh docuseal "sudo ss -tlnp | grep -E ':(80|443|3000|5432)'"   # só 80/443 podem aparecer
```

O alias `docuseal` existe no `~/.ssh/config` da máquina local. Comandos `git`, `npm`, `rsync` e `claude` rodam **sempre local**.

---

## Convenções de código

- JavaScript (não TypeScript), Next.js App Router, React
- Next.js `16.3.3` / React `19.2.8`; `lint` é `eslint` puro (flat config, `eslint.config.mjs`)
- Estilo: CSS Modules por componente + classes utilitárias globais em `src/app/globals.css`
- Cores primárias: **verde bandeira** e **branco**. Secundária: **preto**
- Tipografia: **Montserrat**
- Testes com **vitest** (`npm run test`). Testes ficam ao lado do código (`*.test.js`) e importam os globais de `vitest` explicitamente
- Lógica testável vive em `src/lib/`; Route Handlers só fazem wiring HTTP
- Rodar testes e lint antes de finalizar mudanças
- Não commitar sem solicitação explícita
- Listar objetivamente o que foi implementado e o que não foi possível implementar

**Nota sobre o lint:** o preset `eslint-config-next/core-web-vitals` (flat) é frouxo — não sinaliza `no-unused-vars` nem `no-undef`. "`npm run lint` limpo" continua sendo critério, mas não substitui revisão.

---

## Loop de Feedback e Melhoria Contínua

A cada interação crítica ou erro detectado:

### 1. Captura e Registro
- **Feedback explícito:** ao ser corrigido, capture `[Prompt Original] + [Resposta Incorreta] + [Correção]`
- **Categorize a falha:** *Alucinação* (dado inventado) / *Contexto* (falta info do projeto) / *Instrução* (desvio deste arquivo)

### 2. Ação Imediata
- Corrija a resposta atual buscando a informação correta na documentação existente
- Se faltou contexto, peça a informação e guarde para a etapa 3

### 3. Atualização do Conhecimento
- Erro comportamental → atualize as seções de regras deste arquivo
- Erro de conteúdo → adicione o aprendizado na documentação do projeto
- Adicione o caso corrigido a `Exemplos de Sucesso` para evitar regressão

### 4. Validação
- Teste a regra modificada contra o cenário que falhou
- Confirme que a nova regra não quebrou comportamento que já funcionava

---

## Estado atual

**Concluído:**
- VPS provisionada e endurecida
- DNS e TLS (`https://docuseal.h06.online`, HTTP/2, certificado válido)
- DocuSeal + Postgres + Caddy rodando; migrations aplicadas; conta admin criada
- `infra/`, swap `claude.md`→`CLAUDE.md`, `PROMPTS-FASES.md` e docs — **commitados** na branch `feat/implementação-docuseal` (commits `f659f04`, `0bd8e1f`, `277c0eb`)
- Front-end da LP: seções estáticas prontas (Hero, AboutLetter, Founders, Faq, SignCta). **Não há formulário** — os CTAs são `<a href="#">` inertes (`SIGN_HREF = "#"` em `src/app/page.js`)
- Template da carta de intenção montado no DocuSeal (`template_id` = 1, role `Manifestante`), testado ponta a ponta via API
- **Fase A — `POST /api/init-form`**: Route Handler + `src/lib/phone.js`, `src/lib/mask.js`, `src/lib/docuseal/{config,validate,client}.js`. `.env.example` criado, runner vitest (73 testes). Testado com `curl` real contra a instância: 200 com `slug`/`embed_src`/`lead_id`, `embed_src` abre sem login, e-mail/telefone mascarados no log. **Não commitado.**

**Pendente:**
- **Fase B** cria os campos (nome + WhatsApp + e-mail opcional) no front + componente de embed. Consome `/api/init-form`, usa `lead_id` da resposta.
- **Fase C** — `POST /api/docuseal/webhook` + `WEBHOOK_SECRET` no `.env.local`
- **Fase D** — rate limiting com store externo
- **Fase E** — backups do VPS (`pg_dump` + volume) + `scripts/`
- Corrigir copy do FAQ que promete "cópia por e-mail"
- Commitar a Fase A (sem pedido explícito ainda)

**Divergência `vite build`:** resolvida — o `CLAUDE.md` novo já usa `next build`. O `vite build` estava no `claude.md` antigo (deletado, falta commitar).
