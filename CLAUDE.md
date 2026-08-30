# CLAUDE.md

Este arquivo fornece contexto para o Claude Code ao trabalhar neste repositório.

---

## Visão geral do projeto

Landing page de **captação de cartas de intenção** para a startup **Hectare06 (H06)**.

Agricultores, produtores rurais e demais proprietários de terra preenchem e assinam eletronicamente uma carta de intenção, comprovando que estariam dispostos a firmar contrato futuro caso o negócio se consolide. As respostas ficam visíveis **somente para os administradores**.

**Requisito central: zero atrito para o signatário.**
- Sem cadastro de conta
- Sem e-mail de convite ou confirmação
- Assinatura na própria instância DocuSeal (redirect same-tab a partir da LP)
- PDF assinado disponível na própria tela ao concluir

**Escala esperada:** ~150 assinaturas/mês. Não otimizar prematuramente.

---

## Arquitetura

```
Browser (LP Next.js na Vercel)
  ├─ POST /api/init-form                 [Route Handler, server-side]
  │     └─ POST https://docuseal.h06.online/api/submissions
  │           header X-Auth-Token
  │           body inclui completed_redirect_url: {APP_URL}/obrigado?lead_id=...
  │           ← [{ id, slug, embed_src }]
  │
  └─ window.location.assign(embed_src)   [redirect same-tab, NÃO embed]
        → docuseal.h06.online/s/{slug}   (assinatura na própria instância)
              → completed_redirect_url ao concluir
                    → {LP}/obrigado?lead_id=...

DocuSeal → POST https://<lp>/api/docuseal/webhook
             header secreto compartilhado
```

> `<docuseal-form>` embedado via iframe foi avaliado e descartado — é recurso
> pago, gated no OSS self-hosted (ver "API do DocuSeal — fatos verificados").

**A LP roda na Vercel. O DocuSeal roda num VPS separado.** Não há backend em container — o Route Handler do Next.js é o backend.

### Pastas

- `src/app/**` — código da aplicação Next.js (App Router); componentes em `src/app/components/` (CSS Modules `*.module.css` + classes utilitárias globais em `globals.css`, ex.: `button button--primary`)
- `public/` — estáticos (inclui `carta-de-intencao.pdf`)
- `assets/` — imagens e figuras
- `documentos/` — documentação (`TEMPLATE-DOCUSEAL.md`, PDF do template; `documento.md` está vazio)
- `infra/` — `docker-compose.yml` e `caddy/Caddyfile` do VPS; **não** faz parte do build do Next. Presente no working tree, **ainda não commitado**
- `scripts/` — `deploy.sh` (sincroniza `infra/` + `scripts/` pro VPS e sobe os containers), `backup.sh`/`restore.sh` (rodam no servidor), `systemd/` (`docuseal-backup.service`/`.timer`, instalados no VPS via `sudo cp` + `systemctl enable --now`)

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

**Backups da Hetzner: DESLIGADOS** (orçamento). **Backup local diário existe desde a Fase E**:
`docuseal-backup.timer` (systemd, 03:00 America/Sao_Paulo) roda
`scripts/backup.sh` — `pg_dump -Fc` do Postgres + `tar.gz` do volume
`docuseal_app_data`, em `/opt/docuseal/backups/`, retenção local de 7 dias.
**Ainda não sai do servidor** — se o VPS inteiro for perdido (não só o
Postgres), os backups vão junto. Cópia off-site (Cloudflare R2) está
planejada mas não implementada — ver plano ao final da Fase E em
`PROMPTS-FASES.md`.

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
9. **Estado em memória não funciona na Vercel.** Serverless é stateless — rate limit, cache e deduplicação precisam de store externo. "Vercel KV" nativo não existe mais (descontinuado, migrado para a Marketplace); a escolha concreta do projeto é **Upstash Redis** (Fase D — rate limit de `/api/init-form`).
10. **`infra/` não faz parte do build.** O deploy do VPS é separado do deploy da LP. `./scripts/deploy.sh` sincroniza `infra/` + `scripts/backup.sh`/`restore.sh`/`systemd/` pro servidor e roda `docker compose up -d` — **não faz `rsync --delete`** (apagaria `backups/` e `scripts/`, que não existem em `infra/` localmente).
11. **Sem envio de e-mail em nenhuma ponta.** Além de "sem SMTP" (regra #8): o front não pode prometer envio de cópia por e-mail — `send_email:false` no DocuSeal e o signatário baixa o PDF na própria tela. Corrigido na Fase B (`src/app/components/Faq.js`).

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
    "completed_redirect_url": "https://<APP_URL>/obrigado?lead_id=<id do lead>",
    "metadata": { "telefone_e164": "+5511999998888", "email": null, "origem": "lp-carbono" },
    "values": { "nome_completo": "João da Silva", "telefone": "(11) 99999-8888" }
  }]
}
```

`values.email` só é enviado se o lead informou e-mail — ausente é diferente de vazio. Já `metadata.email` está **sempre presente** (valor real ou `null`) porque é registro interno. O telefone vai em formato brasileiro no documento (lido por humanos) e em E.164 no `metadata`.

**Contrato do `/api/init-form` (Fase A):** request `{ name, phone, email?, values? }` → 200 `{ slug, embed_src, lead_id }`. `phone` obrigatório e normalizado (`src/lib/phone.js`); `email` validado só se preenchido; `lead_id` é um `randomUUID` gerado no handler e devolvido para o front correlacionar com o webhook. `values` do cliente passa por allowlist (`CAMPOS_PERMITIDOS` em `src/lib/docuseal/validate.js`) — `nome_completo` e `telefone` são montados no servidor e nunca aceitos do cliente. Erros: 400 `name_required|phone_required|invalid_phone|invalid_email|invalid_json`, 502 `upstream_error`, 500 `server_misconfigured`.

**`<docuseal-form>` embedado é recurso pago — gated no OSS self-hosted.**
Evidência de fonte primária (branch `master` do `docusealco/docuseal`):

1. `app/controllers/embed_scripts_controller.rb` serve um `DUMMY_SCRIPT` fixo
   que define `<docuseal-form>` como stub "Upgrade to Pro — Unlock embedded
   components". `curl https://docuseal.h06.online/js/form.js` devolve
   exatamente esse texto.
2. `config/routes.rb` não tem rota `embed/forms` (grep → 0 ocorrências).
3. O `form.js` do CDN é um app Vue que faz `POST {url}/embed/forms`; contra a
   instância real isso responde 404 `{"status":404}` e nada renderiza. Zero
   ocorrências de `iframe` no bundle.

Decisão do projeto (Fase B, 30/08/2026): **redirect same-tab, não embed.** A
LP redireciona o usuário para `embed_src` e o DocuSeal traz de volta via
`completed_redirect_url`. Trade-off aceito: o usuário sai da LP durante a
assinatura — em troca, evita mexer no Caddy (`X-Frame-Options`/clickjacking)
e melhora a experiência mobile e a confiança (cadeado do domínio DocuSeal
visível ao assinar com CPF).

**`completed_redirect_url` funciona no OSS self-hosted** — trace de 4 etapas
confirmado no código-fonte (master):

| Etapa | Fonte |
|---|---|
| API aceita o param (nível submitter/submission) | `app/controllers/api/submissions_controller.rb:258,263` — `permitted_attrs` inclui `:completed_redirect_url` |
| Persistido nas preferences do submitter | `lib/submitters.rb:162` — `normalize_preferences` copia `params['completed_redirect_url']` |
| Renderizado na página de assinatura | `app/views/submit_form/_submission_form.html.erb:5` — `data-completed-redirect-url="<%= submitter.preferences['completed_redirect_url'] %>"` |
| Executado ao concluir | pack `form-*.js` da instância — `this.completedRedirectUrl ? window.location.href = ... : ...` |

Enviado no submitter (não no nível da submission), montado como
`` `${APP_URL}/obrigado?lead_id=${leadId}` ``. `/obrigado` deve tolerar query
params extras — o helper de redirect do DocuSeal pode anexar parâmetros
próprios; a página só lê `lead_id`.

**Redirect em uso:**
```js
window.location.assign(embed_src); // mesma aba, sem iframe
```

**Onde os administradores veem as respostas:** no próprio admin do DocuSeal (`https://docuseal.h06.online`), com a conta admin criada. Não há painel próprio na LP e isso não é requisito.

**Webhooks — recurso OSS nativo, confirmado no código (não só na doc).**
Fonte primária (branch `master` do `docusealco/docuseal`):

- `config/routes.rb` registra `resources :webhooks` sem nenhum guard de
  `Docuseal.multitenant?` (o switch real Cloud/OSS no código, via
  `ENV['MULTITENANT']`); `lib/ability.rb` só tem uma regra CanCan por conta
  (`can :manage, WebhookUrl, account_id: user.account_id`), sem checagem de
  plano pago. Diferente do embed (Fase B), aqui não há pegadinha Cloud-vs-OSS
  — funciona igual em self-hosted.
- **Auth:** DocuSeal suporta dois mecanismos (header customizado com valor
  fixo, OU assinatura HMAC-SHA256 nativa via `X-Docuseal-Signature`).
  **Decisão do projeto: header customizado + `crypto.timingSafeEqual`**
  (mais simples). O admin cadastra em **Settings → Webhooks → (a URL) → aba
  "Secret"** um header arbitrário — usamos o nome **`X-Webhook-Secret`**,
  valor = `WEBHOOK_SECRET`.
- **Eventos** (`app/models/webhook_url.rb`, `EVENTS`): `form.viewed`,
  `form.started`, `form.completed`, `form.declined`, `submission.created`,
  `submission.completed`, `submission.expired`, `submission.archived`,
  `template.created/updated/archived`. Uma URL de webhook **nova já vem com
  `form.viewed/started/completed/declined` habilitados por padrão** —
  exatamente a família que precisamos (`form.completed` é a fonte de
  verdade de que o documento foi assinado; o redirect da Fase B é só UX).
- **Payload**: envelope `{ event_type, timestamp, data }`. Para eventos
  `form.*`, `data` é o submitter serializado
  (`lib/submitters/serialize_for_webhook.rb`) com `id` (submitter_id),
  `submission_id`, `external_id`, `application_key` (mesmo valor de
  `external_id` — `Submitter#application_key` é só um alias), `status`,
  `email`, `phone`.
- **Correlação com o lead**: `/api/init-form` já envia `external_id: leadId`
  no submitter (Fase A/B). O webhook devolve esse valor em `data.external_id`
  (e `data.application_key`) — é a chave para religar o evento ao lead.
- **Timeouts do DocuSeal ao entregar o webhook**: `read_timeout 15s`,
  `open_timeout 8s` (`lib/send_webhook_request.rb`) — folga grande para
  responder rápido sem processamento pesado.
- **`POST /api/docuseal/webhook` (Fase C)**: valida o header
  `X-Webhook-Secret` (`timingSafeEqual`, trata tamanho/ausência sem lançar),
  loga `{ event_type, submitter_id, submission_id, lead_id, status,
  email/phone mascarados }`, responde 200. Sem persistência própria além do
  marcador de dedupe abaixo — arquitetura decidida: o DocuSeal é a fonte de
  verdade dos documentos, administradores consultam pelo admin dele.
- **Idempotência do webhook (implementada após a Fase E)**:
  `checkAndMarkProcessed` em `src/lib/docuseal/webhook.js` usa
  `SET webhook_seen:{submitter_id}:{event_type} 1 EX 604800 NX` no mesmo
  Upstash Redis do rate limit (Fase D) — atômico (sem race condition entre
  checar e marcar), TTL de 7 dias (cobre a janela de retry do DocuSeal,
  que tenta reentregar com backoff exponencial por até ~48-68h). Se a
  chave já existir (retry de um evento já processado), a rota responde
  `{ ok: true, duplicate: true }` sem repetir o log/processamento. Mesmo
  padrão fail-open das outras integrações com o Upstash: falha do store
  não bloqueia o webhook, só processa como se fosse novo. Reaproveita
  `readRateLimitConfig` de `src/lib/rate-limit.js` — não é um store
  dedicado ao webhook, é a mesma instância Upstash servindo os dois
  propósitos. **Testado ponta a ponta contra o Upstash real**: primeira
  entrega processa normal, reenvio do mesmo evento retorna `duplicate:
  true` sem reprocessar.

**Rate limiting (Fase D) — "Vercel KV" não existe mais, confirmado.**
Fonte primária (`vercel.com/docs/redis`, changelog "Upstash joins the
Vercel Marketplace"): o produto nativo Vercel KV foi descontinuado — quem
tinha uma store foi migrado automaticamente para Upstash Redis (dez/2024);
para projetos novos, a store é provisionada via **Vercel Marketplace →
Upstash** (ou direto em upstash.com), injetando `UPSTASH_REDIS_REST_URL`/
`UPSTASH_REDIS_REST_TOKEN`. Free tier do Upstash: 500k comandos/mês, 256 MB,
permanente (sem expirar), sem cartão para o tier grátis — folga enorme para
os ~150 envios/mês esperados.

**Decisão do projeto: contador de janela fixa direto contra a REST API do
Upstash** (`INCR`/`PEXPIRE`/`PTTL` via `fetch`, sem SDK), em vez da lib
`@upstash/ratelimit`. Motivo: a lib usa scripts Lua via `EVAL` por baixo —
preciso, mas frágil de simular fielmente num mock de teste; a REST crua
segue o mesmo padrão de `docuseal/client.js` (chamada HTTP direta com
`fetch` injetado, sem SDK) e fica trivial de mockar. `src/lib/rate-limit.js`:
`checkRateLimit` — 5 requisições por IP a cada 10min, `Retry-After` no 429.
**Fail-open** tanto para falha de runtime do Redis quanto para
`UPSTASH_REDIS_REST_URL`/`TOKEN` ausentes (diferente do padrão "falhar
explícito" de `readConfig`/`readWebhookConfig` — rate limit é camada
defensiva sobre um endpoint que já funciona sem ela, não um pré-requisito
funcional). Alternativa avaliada e descartada: Vercel WAF Rate Limiting
nativo (`@vercel/firewall`) — zero dependência externa, mas exige regra
criada pelo painel da Vercel (fora do repo) e só funciona em deploy real,
sem reprodução local via `npm run dev` + `curl`.

---

## Variáveis de ambiente

| Nome | Onde | Descrição |
|---|---|---|
| `DOCUSEAL_URL` | Vercel + `.env.local` | `https://docuseal.h06.online` |
| `DOCUSEAL_TOKEN` | Vercel + `.env.local` | token da API (Settings → API no admin) |
| `DOCUSEAL_TEMPLATE_ID` | Vercel + `.env.local` | id numérico do template |
| `SUBMITTER_ROLE` | Vercel + `.env.local` | role definido no template: `Manifestante` |
| `LEAD_ORIGEM` | Vercel + `.env.local` (opcional) | rótulo gravado em `metadata.origem`. Default `lp-carbono` |
| `WEBHOOK_SECRET` | Vercel + DocuSeal | segredo compartilhado do webhook. Mesmo valor colado como header customizado `X-Webhook-Secret` em Settings → Webhooks → aba Secret no admin do DocuSeal |
| `APP_URL` | Vercel + `.env.local` | base da LP, sem barra final; usada para montar `completed_redirect_url`. Dev: `http://localhost:3000`. Prod: `https://h06.online` |
| `UPSTASH_REDIS_REST_URL` | Vercel + `.env.local` (opcional) | REST endpoint do Upstash Redis usado pelo rate limit de `/api/init-form`. Sem ela, o endpoint funciona normalmente, só sem a proteção (fail-open) |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel + `.env.local` (opcional) | token da REST API do Upstash Redis (mesmo par de credenciais acima) |

`.env.example` (raiz) documenta todas essas chaves. O `.env.local` de dev tem as 6 obrigatórias preenchidas (`WEBHOOK_SECRET` gerado localmente via `openssl rand -hex 32`, não é o segredo de produção); `UPSTASH_REDIS_REST_URL`/`TOKEN` ainda **não** preenchidas — faltam credenciais reais de uma conta Upstash (Fase D).

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

# Deploy do VPS
./scripts/deploy.sh                               # usa o alias "docuseal" do ~/.ssh/config
REMOTE=deploy@docuseal.h06.online ./scripts/deploy.sh   # se a máquina não tiver o alias configurado

# Backup manual (o timer já roda isso diariamente às 03:00)
ssh docuseal '/opt/docuseal/scripts/backup.sh'
ssh docuseal 'systemctl list-timers docuseal-backup.timer'
ssh docuseal 'sudo systemctl start docuseal-backup.service && systemctl status docuseal-backup.service --no-pager'

# Restore (DESTRUTIVO — confirmação interativa obrigatória, ver scripts/restore.sh)
ssh docuseal
# no servidor: /opt/docuseal/scripts/restore.sh <postgres_TIMESTAMP.dump> <app_data_TIMESTAMP.tar.gz>

# --- REMOTO (disparado do local) ---
ssh docuseal 'cd /opt/docuseal && docker compose ps'
ssh docuseal 'cd /opt/docuseal && docker compose logs --tail=50 app'
ssh docuseal 'cd /opt/docuseal && docker compose exec postgres psql -U docuseal -d docuseal'
ssh docuseal 'cat /opt/docuseal/.env'
ssh docuseal "sudo ss -tlnp | grep -E ':(80|443|3000|5432)'"   # só 80/443 podem aparecer
```

O alias `docuseal` **pode não existir** em toda máquina que trabalha neste
repo — confirme com `ssh docuseal true` antes de assumir; se falhar, use
`deploy@docuseal.h06.online` diretamente (usuário `deploy`, chave pública
precisa estar em `authorized_keys` no servidor). Comandos `git`, `npm`,
`rsync` e `claude` rodam **sempre local**.

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

### Casos registrados

**Alucinação (30/08/2026):** o plano original da Fase B presumiu que o embed
`<docuseal-form>` (documentado para o DocuSeal Cloud) funcionaria igual no
OSS self-hosted. Não funciona — é recurso pago, gated no OSS (ver "API do
DocuSeal — fatos verificados"). **Regra:** antes de assumir que um recurso
embedado/do Cloud funciona no self-hosted, verificar no código-fonte do OSS
(`routes.rb`, controllers) — não confiar só na documentação, que mistura
Cloud e OSS sem distinguir.

---

## Estado atual

**Concluído:**
- VPS provisionada e endurecida
- DNS e TLS (`https://docuseal.h06.online`, HTTP/2, certificado válido)
- DocuSeal + Postgres + Caddy rodando; migrations aplicadas; conta admin criada
- `infra/`, swap `claude.md`→`CLAUDE.md`, `PROMPTS-FASES.md` e docs — **commitados** na branch `feat/implementação-docuseal` (commits `f659f04`, `0bd8e1f`, `277c0eb`)
- Front-end da LP: seções estáticas prontas (Hero, AboutLetter, Founders, Faq, SignCta)
- Template da carta de intenção montado no DocuSeal (`template_id` = 1, role `Manifestante`), testado ponta a ponta via API
- **Fase A — `POST /api/init-form`**: Route Handler + `src/lib/phone.js`, `src/lib/mask.js`, `src/lib/docuseal/{config,validate,client}.js`. `.env.example` criado, runner vitest. Testado com `curl` real contra a instância: 200 com `slug`/`embed_src`/`lead_id`, `embed_src` abre sem login, e-mail/telefone mascarados no log.
- **Fase B (revisada) — Formulário + redirect**: `SignCta`/`SignFlow` têm o formulário completo (nome, WhatsApp, e-mail opcional, município/UF, área). No submit, `POST /api/init-form` e depois `window.location.assign(embed_src)` — redirect same-tab para `docuseal.h06.online/s/{slug}`, sem embed/iframe (`DocusealEmbed.js` removido — era baseado em recurso pago indisponível no OSS). `completed_redirect_url` traz o usuário de volta para `/obrigado?lead_id=...` (página nova, neutra, não afirma assinatura concluída). Copy do FAQ e do SignCta corrigidas para não prometer e-mail. `APP_URL` nova env obrigatória. Testado ponta a ponta via `curl` contra a instância real (submission criada com `completed_redirect_url` correto nas `preferences`).
- **Fase C — `POST /api/docuseal/webhook`**: `src/lib/docuseal/webhook.js` (`verifySecret` com `timingSafeEqual`, `parseEvent`, `redactSecret`, `checkAndMarkProcessed`) + `readWebhookConfig` em `src/lib/docuseal/config.js` (independente de `readConfig`, para não acoplar `/api/init-form` a `WEBHOOK_SECRET`). Rota valida o header `X-Webhook-Secret`, deduplica reenvios via Upstash (`SET ... NX EX 604800`, mesmo store do rate limit), loga `{ event_type, submitter_id, submission_id, lead_id, status }` com e-mail/telefone mascarados, responde 200. Sem persistência própria além do marcador de dedupe. **Webhook cadastrado no admin do DocuSeal** (`https://h06.vercel.app/api/docuseal/webhook`, header `X-Webhook-Secret`, eventos `form.viewed/started/completed/declined`) e **testado ponta a ponta com o botão "Test Webhook" do próprio DocuSeal** — confirmado via a chave de dedupe aparecendo no Upstash (prova que o evento chegou, autenticou e foi processado).
- **Fase D — Rate limiting**: `src/lib/rate-limit.js` (`readRateLimitConfig`, `getClientIp`, `checkRateLimit` — janela fixa de 5 req/IP/10min direto contra a REST API do Upstash, sem SDK) integrado em `/api/init-form` como primeiro passo do handler, antes de `readConfig()`. 429 com `Retry-After` quando excede; fail-open (loga e libera) tanto se o Upstash falhar em runtime quanto se `UPSTASH_REDIS_REST_URL`/`TOKEN` estiverem ausentes. `json()` do route ganhou um terceiro parâmetro para headers extras. Conta Upstash provisionada via Vercel Marketplace (env vars `KV_REST_API_URL`/`KV_REST_API_TOKEN` — nomenclatura antiga da integração, mapeadas para `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` no `.env.local`). **Testado ponta a ponta contra a instância Upstash real**: 5 requisições da mesma IP → 200, a 6ª → 429 com `retry-after: 589` e corpo `{"error":"too_many_requests"}`. Submissions de teste criadas no DocuSeal durante a verificação foram arquivadas depois.

- **Fase E — Backups do VPS**: `scripts/backup.sh` (`pg_dump -Fc` do Postgres via `docker compose exec`, `tar.gz` do volume `docuseal_app_data` via container efêmero, verificação de integridade com `pg_restore --list`, aborta se `<5GB` livres, retenção local de 7 dias, `set -euo pipefail` com `trap` que limpa artefatos parciais em falha) + `scripts/restore.sh` (caminho inverso, destrutivo, exige digitar `restaurar` — nunca roda sem confirmação interativa) + `scripts/systemd/docuseal-backup.{service,timer}` (`OnCalendar=*-*-* 03:00:00 America/Sao_Paulo`, `Persistent=true`) + `scripts/deploy.sh` (novo — sincroniza `infra/` e `scripts/` pro VPS, sem `--delete`). **Tudo testado de verdade no VPS**: `backup.sh` rodado duas vezes seguidas (sem corromper nada), `pg_restore --list` confirmado com 473 TOC entries reais, timer instalado e disparado manualmente via `systemctl start` com `status=0/SUCCESS`, `systemctl list-timers` mostrando o próximo disparo. `restore.sh` como script inteiro **não foi rodado contra `docuseal`/`docuseal_app_data` reais** (destrutivo por design) — mas as duas partes que ele encadeia foram validadas isoladamente contra alvos descartáveis: `createdb`+`pg_restore` do dump real num banco de teste (`docuseal_restore_test`, 45 tabelas, dados reais restaurados — 1 template, 13 submitters — depois `dropdb`) e `tar xzf` do `app_data` real num volume Docker descartável (`restore_test_data`, 12 arquivos/916K, idêntico ao volume real — depois `docker volume rm`). Produção nunca foi tocada (containers com o mesmo uptime antes/depois). Bloqueio resolvido nesta sessão: `~/.ssh/config` desta máquina não tinha o alias `docuseal` — usuário autorizou a chave local em `deploy@docuseal.h06.online`.

**Deploy:** LP publicada em produção na Vercel, com **domínio próprio conectado**: `https://h06.online` (registro `A` `@` → `216.198.79.1` na Hostinger, TLS emitido automaticamente pela Vercel) — `h06.vercel.app` continua no ar como alias secundário. `docuseal.h06.online` não foi afetado (registro `A` separado, `77.42.32.111`, intacto). Todas as env vars cadastradas na Vercel (`DOCUSEAL_*`, `SUBMITTER_ROLE`, `APP_URL=https://h06.online`, `WEBHOOK_SECRET`, `UPSTASH_REDIS_REST_URL`/`TOKEN`) — **confirmado via submission de teste real**: `completed_redirect_url` veio `https://h06.online/obrigado?...`, provando que o `APP_URL` novo está ativo (submission arquivada depois). Commits `b8466e2`, `8a21a2f` (Fases A-E + idempotência) empurrados pro `origin/main`.

**Pendente:**
- Backup off-site (Cloudflare R2) — só o plano existe (ver `PROMPTS-FASES.md`, fechamento da Fase E), não implementado. Depende de você criar o bucket + API token no Cloudflare primeiro
- Teste real de `restore.sh` contra `docuseal`/`docuseal_app_data` de verdade (com o site fora do ar) — só numa janela de manutenção dedicada, se/quando quiser essa garantia final
- Teste real de `restore.sh` **contra `docuseal`/`docuseal_app_data` de verdade** (com o site fora do ar) ainda não foi feito — só numa janela de manutenção dedicada, se/quando você quiser essa garantia final

**Divergência `vite build`:** resolvida — o `CLAUDE.md` novo já usa `next build`. O `vite build` estava no `claude.md` antigo (deletado, falta commitar).
