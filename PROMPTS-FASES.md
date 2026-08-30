# Prompts por Fase — Claude Code CLI

**Como usar:** rode `claude` na raiz do repo e cole um prompt por vez. Não pule fases. (O swap `claude.md` → `CLAUDE.md` já foi feito.)

> **Contrato do `/api/init-form` mudou na Fase A.** Onde as fases abaixo citam
> `{ name, email }`, vale `{ name, phone, email? }` → `{ slug, embed_src, lead_id }`.
> Ver a seção "Fase A" para o contrato completo.

```bash
cd ~/Projects/Startup/H06
claude
```

**Uma fase por sessão.** Contexto longo degrada a precisão do agente. Encerre com o prompt de fechamento e abra sessão nova.

---

## Prompt 0 — Onboarding e auditoria

```
Leia CLAUDE.md por completo antes de qualquer coisa.

Depois audite o repositório sem alterar nada:
  - cat package.json
  - ls -R src | head -60
  - cat .gitignore
  - ls -la infra/ scripts/ 2>/dev/null
  - git log --oneline -10
  - git status

Me responda em no máximo 20 linhas:
1. Qual o test runner real (jest, vitest, node:test ou nenhum) e o script exato
2. Se o projeto é App Router ou Pages Router, e onde ficam as rotas hoje
3. Qual o fluxo atual do formulário no front (arquivos envolvidos e estado)
4. Se .env.local está ignorado pelo git
5. Divergências entre CLAUDE.md e o que existe no disco — em especial o "vite build"
   mencionado, que parece resquício de template
6. Qualquer violação das regras invioláveis da seção "Regras invioláveis"

Não corrija nada ainda. Só reporte, e proponha as correções que faria no CLAUDE.md.
```

---

## Fase A — Route Handler `/api/init-form` ✅ IMPLEMENTADA

> Feito em 30/08/2026. O contrato abaixo **substitui** o do prompt original
> (`{ name, email }`), que foi escrito antes das decisões sobre telefone como
> identificador principal e e-mail opcional (ver `documentos/TEMPLATE-DOCUSEAL.md`).

**Contrato final:**

```
Request:  { name: string, phone: string, email?: string, values?: object }
200:      { slug, embed_src, lead_id }
400:      { error: "name_required" | "phone_required" | "invalid_phone" | "invalid_email" | "invalid_json" }
502:      { error: "upstream_error" }
500:      { error: "server_misconfigured" }
```

- `phone` obrigatório, normalizado para E.164 (`src/lib/phone.js`); `email` só
  validado se preenchido; `lead_id` = `randomUUID()` gerado no handler e devolvido
  para o front correlacionar com o webhook (Fase C).
- `values` do cliente passa por allowlist (`CAMPOS_PERMITIDOS` em
  `src/lib/docuseal/validate.js`): `municipio_uf`, `area_hectares`, `car`,
  `qualidade`. `nome_completo` e `telefone` são montados no servidor.

**Arquivos:** `src/app/api/init-form/route.js` (wiring), `src/lib/phone.js`,
`src/lib/mask.js`, `src/lib/docuseal/{config,validate,client}.js` + `*.test.js`.
Runner: **vitest** (`npm run test`). `.env.example` na raiz.

**Restrições aplicadas:** sem `NEXT_PUBLIC_`; corpo de erro do upstream só em
`console.error`; e-mail e telefone mascarados no log; timeout 15s via
`AbortSignal.timeout`; `Cache-Control: no-store` em todas as respostas; aceita
resposta em array **ou** `{ submitters: [...] }`.

Verificado com `curl` real contra a instância: 200 com `slug`/`embed_src`/`lead_id`,
`embed_src` abre sem login, log mascarado.

---

## Fase B — Formulário + redirect para o DocuSeal ✅ IMPLEMENTADA (revisada)

> Feito em 30/08/2026. A abordagem original (embed via `<docuseal-form>`) foi
> **descartada** — evidência de fonte primária (branch `master` do
> `docusealco/docuseal`): o web component do CDN é gated no OSS self-hosted
> (`embed_scripts_controller.rb` serve um `DUMMY_SCRIPT` "Upgrade to Pro"; não
> existe rota `embed/forms`; `POST /embed/forms` responde 404). Ver
> "API do DocuSeal — fatos verificados" no CLAUDE.md para o trace completo.

**Decisão: redirect, não embed.** A LP redireciona o usuário (mesma aba) para o
`embed_src` retornado por `POST /api/submissions`; o DocuSeal traz o usuário de
volta via `completed_redirect_url` (funciona no OSS — trace de 4 etapas
verificado, ver CLAUDE.md). Trade-off aceito: o usuário sai da LP durante a
assinatura, mas evita mexer no Caddy (`X-Frame-Options`/clickjacking) e melhora
a experiência mobile (tela cheia) e a confiança (cadeado do domínio DocuSeal
visível ao assinar com CPF).

**O que foi feito:**
1. `src/lib/docuseal/config.js` — `APP_URL` obrigatória, `readConfig` retorna
   `config.appUrl` (sem barra final).
2. `src/lib/docuseal/client.js` — `buildPayload` inclui
   `completed_redirect_url: \`${appUrl}/obrigado?lead_id=${leadId}\`` no
   submitter.
3. `src/app/components/SignFlow.js` — removido o embed (`DocusealEmbed.js`,
   deletado); fluxo agora é `form -> loading -> window.location.assign(embed_src)`.
   Guarda de duplo submit (`phase === "loading"` + botão `disabled`).
4. `src/app/obrigado/page.js` (novo) — página neutra de conclusão, lê
   `lead_id` da query string. Não afirma que o documento foi assinado (isso
   será confirmado pelo webhook, Fase C).
5. Copy corrigida: `SignCta.js` (deixa claro que a assinatura acontece em
   outra tela) e `Faq.js` (item sobre "receber via assinada" não promete mais
   e-mail — regra #11 do CLAUDE.md).
6. `.env.example`/`.env.local` ganharam `APP_URL`.

**Testes:** `config.test.js`, `client.test.js`, `route.test.js` cobrem
`APP_URL` ausente (500), `completed_redirect_url` no payload com o `lead_id`
gerado, e barra final normalizada. Duplo clique verificado manualmente (não
por teste unitário — evita `@testing-library/react` como dependência nova).

Nenhuma mudança em `infra/`.

---

## Fase C — Webhook de conclusão ✅ IMPLEMENTADA

> Feito em 30/08/2026. Pesquisa de fonte primária (branch `master` do
> `docusealco/docuseal`) confirmou: webhooks são recurso OSS nativo (sem
> guard de `multitenant?`/Cloud em `routes.rb`/`ability.rb`), com dois
> mecanismos de auth possíveis (header customizado ou HMAC nativo via
> `X-Docuseal-Signature`). **Decisão do usuário: header customizado +
> `crypto.timingSafeEqual`**, exatamente como este prompt original desenhou.
> Ver "Webhooks — fatos verificados" no CLAUDE.md para eventos, payload e
> correlação com o lead confirmados no código-fonte.

**O que foi feito:**
1. `src/app/api/docuseal/webhook/route.js` — `runtime nodejs`,
   `dynamic force-dynamic`. Valida `X-Webhook-Secret` **antes** de ler o
   corpo; ausente/errado/tamanho diferente → 401, sem lançar exceção.
2. `src/lib/docuseal/webhook.js` — `verifySecret` (timingSafeEqual seguro),
   `parseEvent` (parsing defensivo do envelope `{event_type, data}`, nunca
   lança em campo ausente), `redactSecret` (substitui qualquer campo do log
   cujo valor bata exatamente com o segredo — cobre o caso de payload
   malicioso/mal-formado injetando o segredo em `status`/`event_type`).
3. `readWebhookConfig` em `src/lib/docuseal/config.js` — independente de
   `readConfig`, para `/api/init-form` não quebrar se só `WEBHOOK_SECRET`
   estiver faltando.
4. Log estruturado: `{ event_type, submitter_id, submission_id, lead_id,
   status, email/phone mascarados }`. `lead_id` vem de `data.external_id`
   (mesmo valor enviado pelo `/api/init-form` na criação da submission).
5. Sem persistência própria (decisão arquitetural mantida) — só valida, loga
   e responde 200 `{ ok: true }`.

**Testes:** `webhook.test.js` (`verifySecret`, `parseEvent`, `redactSecret`)
+ `route.test.js` cobrindo todos os casos obrigatórios do prompt original,
incluindo o teste explícito de injeção do segredo em campos do payload.

**Verificado via `curl` local:** sem header → 401; header errado → 401;
header + payload real de `form.completed` → 200 e log mascarado; JSON
malformado → 400.

**Não feito nesta sessão** (fora do repositório / requer infra adicional):
- Cadastrar a URL do webhook no admin do DocuSeal (Settings → Webhooks →
  Nova URL → `https://<APP_URL>/api/docuseal/webhook`, aba Secret com header
  `X-Webhook-Secret` = `WEBHOOK_SECRET` de produção — eventos
  `form.viewed/started/completed/declined` já vêm marcados por padrão).
- Teste ponta a ponta com a instância real (precisa de túnel `ngrok` ou
  deploy de preview, já que o dev server só existe em `localhost`).

---

## Fase D — Rate limiting ✅ IMPLEMENTADA

> Feito em 30/08/2026. Pesquisa (dados de 2026, não memória de treino)
> confirmou: "Vercel KV" nativo foi descontinuado e migrado para a Vercel
> Marketplace com Upstash Redis. **Decisão do usuário: Upstash Redis**
> (alternativa avaliada: Vercel WAF Rate Limiting nativo via
> `@vercel/firewall` — descartada por exigir regra criada no painel da
> Vercel, fora do repo, e não ser testável localmente com `npm run dev` +
> `curl`, diferente do Upstash).

**O que foi feito:**
1. `src/lib/rate-limit.js` — `readRateLimitConfig` (mesmo padrão de
   `readWebhookConfig`, independente), `getClientIp` (primeiro valor de
   `x-forwarded-for`, `"unknown"` se ausente), `checkRateLimit` — contador
   de **janela fixa** (5 req/IP/10min) direto contra a REST API do Upstash
   (`INCR`/`PEXPIRE`/`PTTL` via `fetch`, **sem** a lib `@upstash/ratelimit`
   — decisão deliberada: a lib usa `EVAL`/Lua por baixo, difícil de mockar
   fielmente em teste; REST crua segue o mesmo padrão de
   `docuseal/client.js` e é trivial de testar).
2. `src/app/api/init-form/route.js` — checa o rate limit como primeiro
   passo do handler (antes de `readConfig()`); excedido → 429
   `{ error: "too_many_requests" }` com header `Retry-After`. `json()`
   ganhou um terceiro parâmetro para headers extras.
3. **Fail-open** tanto para erro de runtime do Upstash quanto para
   `UPSTASH_REDIS_REST_URL`/`TOKEN` ausentes — decisão consciente: rate
   limit é camada defensiva sobre um endpoint que já funciona sem ela,
   diferente das envs do DocuSeal (essenciais à função do endpoint).
4. `.env.example`/`.env.local` ganharam as duas novas envs (opcionais).

**Testes:** todos os casos obrigatórios cobertos em `rate-limit.test.js` e
`route.test.js` (5 passam / 6ª bloqueia, IP diferente não afetado, janela
expira e libera, store indisponível libera com log, `x-forwarded-for` com
múltiplos IPs usa o primeiro, ausente não lança, sem env configurada o
endpoint segue funcionando normalmente).

**Verificado ponta a ponta com Upstash real** (conta provisionada via
Vercel Marketplace): 5 requisições da mesma IP → 200, a 6ª → 429 com
`retry-after: 589` e `{"error":"too_many_requests"}`. Submissions de teste
criadas no DocuSeal durante a verificação foram arquivadas depois. Falta só
cadastrar `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` nas
Environment Variables da Vercel para produção.

---

## Fase E — Backups do VPS ✅ IMPLEMENTADA

> Feito em 30/08/2026. Bloqueio resolvido nesta sessão: `~/.ssh/config`
> desta máquina não tinha o alias `docuseal`; o usuário autorizou a chave
> local em `deploy@docuseal.h06.online` e a conexão foi confirmada antes de
> qualquer coisa. Levantamento real do servidor (containers, volumes,
> disco, timezone, timers existentes) feito via SSH antes de escrever os
> scripts — ver "Estado atual" no `CLAUDE.md`.

**O que foi feito:**
1. `scripts/backup.sh` — `pg_dump -Fc` do Postgres dentro do container
   (`docker compose exec`), `tar.gz` do volume `docuseal_app_data` via
   container `alpine` efêmero (não mexe no `app` rodando), verificação de
   integridade com `pg_restore --list` (falha se não achar nenhuma
   `TABLE`), aborta se `<5GB` livres, retenção local de 7 dias,
   `set -euo pipefail` + `trap` que remove artefatos parciais em falha.
   Credenciais sempre lidas de `/opt/docuseal/.env` em runtime, nunca
   hardcoded.
2. `scripts/restore.sh` — caminho inverso (dropdb/createdb/pg_restore +
   reextração do volume), **destrutivo por design**: exige digitar
   `restaurar` antes de tocar em qualquer coisa; sem TTY/confirmação,
   falha fechado.
3. `scripts/systemd/docuseal-backup.service` + `.timer` —
   `OnCalendar=*-*-* 03:00:00 America/Sao_Paulo` (explícito, mesmo o
   sistema já estando nesse fuso), `Persistent=true` (não perde o backup
   do dia se o servidor estiver fora do ar às 3h).
4. `scripts/deploy.sh` (novo — resolve uma inconsistência entre o
   `CLAUDE.md`, que já prometia `deploy.sh` nascendo nesta fase, e o
   detalhamento da tarefa, que só citava `backup.sh`/`restore.sh`): rsync
   de `infra/` e de `scripts/backup.sh`/`restore.sh`/`systemd/` pro
   servidor + `docker compose up -d`. **Sem `--delete`** (apagaria
   `backups/` e `scripts/`, que não existem em `infra/` localmente).

**Testado de verdade no VPS** (não só localmente):
- `backup.sh` rodado duas vezes seguidas — gerou dois conjuntos de
  arquivos distintos, sem corromper nada.
- `pg_restore --list` confirmado com 473 TOC entries reais (tabelas do
  schema do DocuSeal).
- Timer instalado (`sudo systemctl enable --now`) e disparado manualmente
  (`systemctl start docuseal-backup.service`) — `status=0/SUCCESS`,
  `TriggeredBy: docuseal-backup.timer` confirmado.
- `systemctl list-timers` mostrando o próximo disparo (03:00 do dia
  seguinte).
- `bash -n` e `shellcheck` (via `docker run koalaman/shellcheck:stable`)
  limpos nos 4 scripts.
- Artefatos de teste extras foram limpos do servidor — ficou só o backup
  real mais recente.

**Não feito (deliberadamente, ver `restore.sh` acima):** não rodei
`restore.sh` contra o banco/volume reais — é destrutivo por natureza
(apaga e recria o banco `docuseal` e o conteúdo de `app_data` de verdade).
Validado só por `bash -n`/`shellcheck`/revisão lógica. Um teste real
precisaria de uma janela de manutenção dedicada ou ambiente descartável.

---

### Plano — backup off-site com Cloudflare R2 (não implementado, só o plano)

**Por quê:** o backup local (Fase E) protege contra corrupção/erro no
Postgres ou no volume, mas não contra perda do VPS inteiro (disco morto,
conta Hetzner suspensa, etc.) — nesse cenário local + off-site é que
garante recuperação.

**Por que R2:** free tier de 10 GB de storage e, principal vantagem sobre
S3, **egress gratuito** (importante se algum dia precisar restaurar
puxando os arquivos de volta) — não precisa de cartão de crédito para o
tier grátis.

1. **Bucket**: criar um bucket privado no Cloudflare R2 (dashboard →
   R2 → Create bucket), sem acesso público — só API S3-compatível.
2. **Credenciais**: gerar um R2 API Token (Account → R2 → Manage API
   Tokens) com permissão restrita **só a esse bucket** (least privilege) —
   gera um par `Access Key ID`/`Secret Access Key` compatível com S3.
   Guardar em `/opt/docuseal/.env` como `R2_ACCESS_KEY_ID`/
   `R2_SECRET_ACCESS_KEY`/`R2_BUCKET`/`R2_ENDPOINT` (nunca hardcoded, mesmo
   padrão das credenciais do Postgres).
3. **Ferramenta de sync**: `rclone` (binário único, suporta R2
   nativamente como backend S3-compatível, `rclone sync` é idempotente e
   só transfere o que mudou) — mais simples que escrever chamadas SigV4 na
   mão. Instalar no VPS (`apt install rclone` ou binário oficial),
   configurar via `rclone.conf` gerado a partir das env vars do `.env`
   (não interativo, gerado pelo próprio script).
4. **Novo `scripts/offsite-sync.sh`**: roda **depois** de `backup.sh`
   (mesmo `docuseal-backup.service`, como um segundo `ExecStart=` — ou um
   `.service` separado encadeado via `OnSuccess=`), faz
   `rclone sync /opt/docuseal/backups/ r2:$R2_BUCKET/` — sobe só os
   arquivos novos desde o último sync (rclone já é incremental).
5. **Retenção no R2**: pensar separado da retenção local (7 dias) —
   como o storage é praticamente grátis até 10GB, faz sentido manter mais
   histórico off-site (ex.: 30 dias) via `rclone` com uma flag de
   `--max-age` no sync ou uma regra de lifecycle no próprio bucket R2.
6. **Falha do sync não deve travar o backup local** — mesmo raciocínio de
   fail-open já usado no rate limit (Fase D): se o R2 estiver
   indisponível, o backup local (que já é o mais crítico) continua valendo,
   só loga o erro do sync.
7. **Teste de restauração**: documentar como puxar de volta
   (`rclone copy r2:$R2_BUCKET/postgres_TIMESTAMP.dump
   /opt/docuseal/backups/`) antes de rodar `restore.sh` normalmente — útil
   justamente no cenário de VPS perdido, restaurando num servidor novo.

Escopo sugerido para uma fase futura (não esta sessão): criar o bucket e o
token (ação manual do usuário, como o Upstash na Fase D), depois
implementar `offsite-sync.sh` + encadear no systemd + testar de verdade
subindo e puxando um arquivo de teste do R2.

---

## Prompt de encerramento de sessão

```
Atualize CLAUDE.md:
- Seção "Estado atual": o que foi concluído nesta sessão e o que ficou pendente
- Seção "Regras invioláveis": adicione qualquer restrição nova que descobrimos
- Seção "API do DocuSeal — fatos verificados": corrija qualquer fato que se
  mostrou diferente na prática
- Se algum comportamento meu precisou de correção, aplique o Loop de Feedback:
  categorize a falha e registre a regra que evita a regressão

Depois faça um resumo em até 10 linhas do que mudou no disco.
Não commite — apenas liste os arquivos alterados.
```

---

## Notas operacionais

**Rodar os testes é obrigatório antes de aceitar uma fase.** O agente vai declarar sucesso; a suíte é quem confirma.

**Onde cada comando roda:**

| Local (raiz do repo) | Servidor (via `ssh docuseal`) |
|---|---|
| `git`, `npm`, `claude` | `docker compose ps` / `logs` |
| `./scripts/deploy.sh` | `psql` |
| testes e lint | editar `/opt/docuseal/.env` |

Se o prompt do terminal mostrar `deploy@docuseal-prod`, você está no servidor — `exit` para voltar.

**Ordem de prioridade se precisar cortar escopo:** A → B → E → C → D. A Fase E (backup) é mais crítica que a C e a D, porque protege dados que já existem.
