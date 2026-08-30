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

## Fase B — Formulário + embed no front

```
Contexto: NÃO existe formulário no front hoje. As seções (Hero, SignCta) só têm
<a href="#"> inertes (SIGN_HREF em src/app/page.js). Esta fase CRIA os campos e
integra o embed. NÃO redesenhe as seções existentes, NÃO crie página nova —
respeite componentes, CSS Modules, cores (verde bandeira / branco / preto) e
tipografia (Montserrat). O backend /api/init-form já existe (Fase A).

Campos do formulário (mínimo, ver documentos/TEMPLATE-DOCUSEAL.md §4b):
- Nome completo — obrigatório
- WhatsApp — obrigatório, inputMode="numeric", máscara visual (00) 00000-0000,
  rótulo "WhatsApp" (não "telefone")
- E-mail — OPCIONAL, rotulado como tal
(município/área/CAR são opcionais e podem entrar em `values` se você quiser
pré-preencher — não são obrigatórios nesta fase)

ANTES DE CODAR: proponha o ponto exato de integração (provavelmente a seção
#assinar / SignCta) e espere minha confirmação.

Tarefa (após confirmação):
1. Componente client com o formulário acima. No submit: chama
   POST /api/init-form com { name, phone, email? }, guarda o lead_id da resposta
   (necessário para correlação futura) e renderiza
   <docuseal-form data-src={embed_src}>.
2. Carregue https://cdn.docuseal.com/js/form.js via next/script com
   strategy="lazyOnload". Não coloque no <head> global — só onde é usado.
3. Escute o evento de conclusão do web component e mostre o estado de sucesso.
4. Estados de erro por código/erro HTTP:
   400 name_required/phone_required/invalid_phone/invalid_email -> mensagem no campo
   429 -> "muitas tentativas, aguarde alguns minutos" (só depois da Fase D)
   502/500 -> mensagem genérica com botão de tentar novamente
5. Estado de loading enquanto /api/init-form responde.

ANTES DE CODAR O PASSO 3: confirme na documentação oficial do DocuSeal o nome
exato do evento de conclusão e a forma correta de escutá-lo no web component.
Não presuma pelo nome. Me diga o que encontrou.

Restrições:
- Nenhum token ou variável sensível no client
- Sem biblioteca nova sem me perguntar antes
- Acessibilidade: mensagens de erro associadas ao campo, foco gerenciado na
  transição para o iframe

Critérios de aceite:
- npm run lint limpo, suíte da Fase A continua passando
- Fluxo completo funciona em npm run dev: preencher -> iframe carrega -> assinar
  -> tela de sucesso
- View-source e aba Network não expõem token
- O documento assinado aparece no admin do DocuSeal

Ponto de atenção: o iframe é cross-origin (LP na Vercel, DocuSeal em
docuseal.h06.online). Se vier em branco, abra o console do browser. Se houver erro
de X-Frame-Options ou frame-ancestors, a correção é um header
Content-Security-Policy no infra/caddy/Caddyfile autorizando o domínio da LP —
me avise antes de alterar a infra.
```

---

## Fase C — Webhook de conclusão

```
Contexto: não dá para confiar no evento JS do browser para saber que a assinatura
foi concluída — o usuário pode fechar a aba antes. O DocuSeal envia webhooks
configurados em Settings -> Webhooks.

ANTES DE CODAR: consulte a documentação atual do DocuSeal sobre webhooks e
confirme os nomes exatos dos eventos e o formato do payload. Me diga o que
encontrou antes de implementar.

Tarefa:
1. POST /api/docuseal/webhook (runtime nodejs, force-dynamic).
2. Autenticação por header secreto compartilhado, valor em WEBHOOK_SECRET,
   comparado com crypto.timingSafeEqual sobre buffers de mesmo tamanho.
   Ausente ou divergente -> 401.
3. Responda 200 em menos de 1s. Nenhum processamento pesado no request.
4. Log estruturado do evento recebido: { event_type, submitter_id, submission_id,
   status }. E-mail mascarado. NUNCA logar o payload completo nem o secret.
5. Idempotência: projete a chave de deduplicação (submitter_id + event_type) e
   deixe o ponto de gravação isolado atrás de uma interface, mas NÃO implemente
   store agora.
6. Correlação com o lead: o /api/init-form envia external_id = lead_id (UUID) no
   submitter. Confirme na doc/payload do webhook onde esse valor volta
   (external_id / application_key / metadata) e logue-o junto do evento.

Decisão arquitetural já tomada — não questione: nesta fase o webhook apenas
valida, loga e responde 200. Não há persistência própria. O DocuSeal é a fonte de
verdade dos documentos e os administradores consultam pelo admin dele. Um store
externo entra na Fase D junto com o rate limit, quando houver requisito concreto
de funil.

Casos de teste obrigatórios:
- sem header secreto -> 401
- header com valor errado -> 401
- header com tamanho diferente do esperado -> 401 sem exceção
  (timingSafeEqual lança se os buffers têm tamanhos diferentes)
- payload válido -> 200
- payload sem os campos esperados -> 400, sem crash
- WEBHOOK_SECRET ausente no ambiente -> 500, e o handler não aceita nada
- teste explícito: injete WEBHOOK_SECRET em vários campos do payload e verifique
  que nenhum log o imprime

Critérios de aceite:
- Suíte completa (A + C) passa
- Teste local com túnel (vercel dev + ngrok, ou deploy de preview):
  configure o webhook no admin do DocuSeal, assine um documento de teste,
  e confirme o log do evento
- Um 401 de tentativa inválida aparece no log com o IP, mas SEM ecoar o valor
  recebido
```

---

## Fase D — Rate limiting

```
Contexto: /api/init-form está aberto. Sem limite, alguém dispara milhares de
submissions no DocuSeal, enche o banco do VPS (40 GB de disco) e potencialmente
derruba o serviço. Isso precisa existir ANTES de a LP ir a público.

Restrição fundamental: a LP roda serverless na Vercel. Estado em memória NÃO
funciona — cada invocação pode cair num container diferente. Rate limit precisa
de store externo.

Tarefa:
1. Pesquise as opções de free tier disponíveis hoje (Vercel KV, Upstash Redis,
   ou alternativa equivalente) e me apresente uma recomendação com trade-offs
   antes de implementar. Espere minha confirmação.
2. Implemente rate limit em /api/init-form: 5 requisições por IP a cada 10 minutos.
3. Extraia o IP de forma correta para a Vercel (o primeiro valor de
   x-forwarded-for, não o socket).
4. Excedido -> 429 com header Retry-After.
5. Falha do store NÃO pode derrubar o endpoint: em caso de erro do Redis,
   registre no log e permita a requisição (fail-open). Justifique essa escolha
   ou proponha fail-closed com argumento.

Casos de teste obrigatórios:
- 5 requisições passam, a 6ª -> 429
- IP diferente não é afetado
- janela expira e libera novamente
- store indisponível -> requisição passa e o erro é logado
- x-forwarded-for com múltiplos IPs -> usa o primeiro
- x-forwarded-for ausente -> não crasha

Critérios de aceite:
- Suíte completa passa, com o store mockado nos testes
- npm run lint limpo
- Teste manual: 6 curls seguidos, o último devolve 429
```

---

## Fase E — Backups do VPS

```
Contexto: os Backups da Hetzner estão DESLIGADOS por restrição de orçamento e não
existe backup nenhum. Se o servidor for perdido hoje, todos os documentos
assinados vão junto. Esta é a maior dívida técnica aberta do projeto.

Atenção ao escopo: esta fase mexe em scripts/ e no VPS, NÃO no código da LP.

Tarefa:
1. Crie scripts/backup.sh que gere, em /opt/docuseal/backups/ no servidor:
   - dump lógico do Postgres via pg_dump -Fc (formato custom)
   - tar.gz do volume app_data (arquivos e PDFs do DocuSeal)
   Nome com timestamp ISO. Retenção local de 7 dias.
2. set -euo pipefail, falha ruidosa, idempotente.
3. Verificação de integridade: após o dump, rode pg_restore --list e falhe se
   não listar tabelas.
4. Aborte com erro claro se restarem menos de 5 GB livres no disco (total: 40 GB).
5. Crie scripts/restore.sh documentando o caminho inverso, com confirmação
   interativa antes de sobrescrever qualquer coisa.
6. Agende via systemd timer (NÃO cron): diário às 03:00 America/Sao_Paulo.
   Crie os arquivos .service e .timer e me dê os comandos de instalação.

Restrições:
- pg_dump roda DENTRO do container postgres (docker compose exec), não no host
- Credenciais lidas de /opt/docuseal/.env, nunca hardcoded
- Os scripts vivem no repo e vão para o servidor por ./scripts/deploy.sh

Critérios de aceite:
- bash -n passa em ambos
- shellcheck limpo:
  docker run --rm -v "$PWD:/mnt" koalaman/shellcheck:stable scripts/*.sh
- Execução manual gera os artefatos e o pg_restore --list lista tabelas
- Rodar duas vezes seguidas não corrompe nada
- systemctl list-timers mostra o timer agendado

Ao final, apresente o plano (só o plano, não implemente) para enviar os backups
para fora do servidor usando o free tier do Cloudflare R2.
```

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
