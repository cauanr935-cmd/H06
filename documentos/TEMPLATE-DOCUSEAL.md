# Template DocuSeal — Carta de Intenção H06

Guia de montagem do template a partir de `carta-intencao-h06-template.pdf`.

---

## 1. Criar o template

No admin (`https://docuseal.h06.online`), com a interface em português:

**Modelos → Novo → Enviar arquivo** → suba o PDF.

O DocuSeal converte cada página em imagem e você arrasta os campos por cima. O quadro de identificação na página 1 tem células vazias desenhadas exatamente para isso — arraste o campo até preencher a área interna de cada célula.

## 2. Definir o papel

Antes de criar os campos, renomeie o papel padrão (`First Party`) para **`Manifestante`**.

Esse nome precisa bater **exatamente** com a variável `SUBMITTER_ROLE` do Next.js. Divergência aqui é a causa mais comum de erro 502 na criação da submission.

**Só existe um papel.** A anuência da Hectare06 é dada pela emissão do documento (cláusula 10.2), então não crie um segundo signatário — cada carta ficaria pendente esperando vocês assinarem, o que destrói o fluxo sem atrito.

## 3. Mapa de campos

Coloque na ordem abaixo. A coluna **Nome do campo** é o que você digita no painel lateral do DocuSeal e é a chave usada no `values` da API — precisa ser idêntica.

### Página 1 — Quadro de Identificação

| Célula no PDF | Nome do campo | Tipo | Obrigatório | Somente leitura |
|---|---|---|---|---|
| NOME COMPLETO / RAZÃO SOCIAL | `nome_completo` | Texto | Sim | Não |
| CPF / CNPJ | `cpf_cnpj` | Texto | Sim | Não |
| TELEFONE / WHATSAPP | `telefone` | **Texto** | **Sim** | **Sim** |
| E-MAIL (opcional) | `email` | Texto | Não | Não |
| MUNICÍPIO / UF DA PROPRIEDADE | `municipio_uf` | Texto | Sim | Não |
| ÁREA APROXIMADA (hectares) | `area_hectares` | Número | Sim | Não |
| CAR (se possuir) | `car` | Texto | Não | Não |
| QUALIDADE EM QUE ASSINA | `qualidade` | Menu suspenso | Sim | Não |
| DATA | `data_assinatura` | Data | Sim | Não |

**`qualidade`** — opções do menu suspenso:
- `Proprietário(a) rural`
- `Representante de cooperativa`
- `Representante de associação`
- `Procurador(a) / outro representante`

**Por que Texto e não Número:** o tipo Telefone do DocuSeal é recurso pago. O tipo Número trataria o valor como quantidade — separador de milhar, perda de zero à esquerda, rejeição de parênteses e hífen. Texto é o substituto correto. Como o campo chega pronto e travado, a validação vive no Route Handler (`toE164BR`), que é onde ela deve estar.

**Formato no documento:** mande `(11) 99999-8888` em `values`. O PDF é lido por humanos; o E.164 fica só no lado interno, em `external_id` e `metadata`.

**Por que `telefone` é somente leitura:** ele vem preenchido da landing page via `values` e é a chave que liga o lead ao documento no webhook. Se for editável, a pessoa altera e o vínculo se perde.

**Por que `nome_completo` NÃO é somente leitura:** o público inclui cooperativas e associações. Alguém digita o próprio nome na LP e depois percebe que assina como pessoa jurídica — com o campo travado, abandona o fluxo. O campo `qualidade` registra em que condição a pessoa assina.

### Página 3 — Consentimento e assinatura

| Elemento no PDF | Nome do campo | Tipo | Obrigatório |
|---|---|---|---|
| Quadrinho à esquerda da declaração | `consentimento_lgpd` | Caixa de seleção | **Sim** |
| Retângulo acima de "Assinatura do(a) Manifestante" | `assinatura` | Assinatura | **Sim** |

O `consentimento_lgpd` obrigatório é o que registra o consentimento da cláusula 8 na trilha de auditoria. Sem ele, você tem os dados mas não tem o registro de que a pessoa consentiu — que é justamente o que a LGPD exige demonstrar.

## 4. Configurações do template

Em **Configurações** do template:

| Opção | Valor | Motivo |
|---|---|---|
| Exigir e-mail antes de assinar | **Desativado** | A identificação já vai no payload da submission; pedir de novo é uma tela extra de atrito |
| Enviar e-mail de conclusão | **Desativado** | Não há SMTP configurado |
| Permitir download do concluído | **Ativado** | É como o signatário recebe o PDF |
| Exigir verificação por e-mail/SMS | **Desativado** | Adicionaria atrito |

## 4b. Telefone como identificador principal

> **Recursos pagos:** o tipo de campo `Telefone` do template e o envio por SMS são gated no DocuSeal.
> Isso NÃO impede o fluxo — use campo `Texto` no documento e `external_id` + `metadata`
> como chave de vínculo, em vez do atributo `phone` do submitter.

O público tem baixo letramento digital e o fluxo é embedado com `send_email: false` — o e-mail não entrega nada, é só identificador. Exigi-lo é atrito puro. A referência da API confirma que submissions podem ser iniciadas por e-mail **ou** telefone.

**Antes de montar o template, rode este teste na sua instância** (verifica se dá para criar submitter sem e-mail e sem `phone`):

```bash
curl -sS -X POST https://docuseal.h06.online/api/submissions \
  -H "X-Auth-Token: SEU_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "template_id": SEU_TEMPLATE_ID,
    "send_email": false,
    "send_sms": false,
    "submitters": [{ "name": "Teste Silva", "role": "Manifestante", "external_id": "teste-001" }]
  }' | head -c 600
```

**Se voltar array com `slug`** → o e-mail sai do fluxo. Envie apenas `name`, `role`, `external_id` e `metadata`.

**Se voltar erro de validação exigindo e-mail** → plano B: gere um e-mail sintético determinístico no Route Handler, usado só como identificador interno. Como `send_email: false`, nada é enviado para ele:

```js
// somente se a API exigir email
const phoneDigits = phoneE164.replace(/\D/g, '');
const syntheticEmail = `${phoneDigits}@sem-email.h06.online`;
```

Use um subdomínio que você controla e que **não** tenha registro MX, para nunca gerar tentativa de entrega real. Registre no log que o e-mail é sintético, para não confundir esses registros com leads que informaram e-mail de verdade.

### Normalização do telefone (obrigatória)

O `phone` do submitter precisa estar no padrão **E.164**. Um produtor não vai digitar `+55`. A LP coleta no formato brasileiro e o Route Handler normaliza:

```js
function toE164BR(input) {
  const d = String(input || '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) return `+${d}`;   // 55 + DDD + 9 digitos
  if (d.length === 12 && d.startsWith('55')) return `+${d}`;   // fixo com DDI
  if (d.length === 11) return `+55${d}`;                        // DDD + celular
  if (d.length === 10) return `+55${d}`;                        // DDD + fixo
  return null;                                                  // invalido
}
```

Casos de teste para essa função: `11999998888`, `(11) 99999-8888`, `+55 11 99999-8888`, `5511999998888`, `999998888` (sem DDD → `null`), string vazia → `null`.

**No front:** `inputMode="numeric"`, máscara visual `(00) 00000-0000`, e rótulo "WhatsApp" em vez de "telefone" — é o termo que esse público reconhece.

## 4c. Decisão sobre o e-mail

**E-mail é opcional em dois pontos, e os dois coexistem:**

1. **Campo opcional no formulário da LP** — se preenchido, chega ao backend em `/api/init-form`, ou seja, **antes** da assinatura. Se a pessoa abandonar o documento no meio, o contato não se perde.
2. **Campo editável no documento** — quem informou na LP vê preenchido e pode corrigir; quem não informou pode preencher durante a assinatura.

Nenhum caminho é bloqueado. No template, `email` fica **não obrigatório** e **não somente leitura**.

No Route Handler:

```js
const email = String(payload?.email ?? '').trim().toLowerCase();

// so valida se veio preenchido
if (email && !EMAIL_RE.test(email)) return fail(400, 'invalid_email');

const values = {
  nome_completo: nome,
  telefone: telefoneFormatado,   // (11) 99999-8888
};
if (email) values.email = email;  // ausente != vazio
```

O `if (email)` importa: não envie a chave com string vazia em `values`, porque o DocuSeal pode tratar o campo como preenchido e renderizar vazio no PDF.

Em `metadata`, guarde os dois canais:

```js
metadata: {
  telefone_e164: telefoneE164,
  email: email || null,
  origem: 'lp-carbono',
}
```

**Consequência operacional:** a base de leads fica heterogênea — parte com e-mail, parte só com WhatsApp. Defina desde já qual é o canal oficial de reengajamento, senão você acaba com duas listas parciais e nenhum processo que cubra as duas.

## 5. Integração com o Route Handler

Copie o `template_id` da URL (`/templates/123` → `123`) para `DOCUSEAL_TEMPLATE_ID`.

Payload que o `/api/init-form` deve enviar:

```json
{
  "template_id": 123,
  "send_email": false,
  "send_sms": false,
  "submitters": [
    {
      "name": "João da Silva",
      "role": "Manifestante",
      "external_id": "lead_01H...",
      "metadata": { "telefone_e164": "+5511999998888", "origem": "lp-carbono" },
      "values": {
        "nome_completo": "João da Silva",
        "telefone": "(11) 99999-8888"
      }
    }
  ]
}
```

Se a sua landing page já coleta município, área ou telefone antes do embed, inclua essas chaves em `values` também — cada campo pré-preenchido é um campo a menos para o produtor digitar no celular, em área rural, possivelmente com conexão ruim.

**Atualize o `.env.local` e a Vercel:**

```
SUBMITTER_ROLE=Manifestante
DOCUSEAL_TEMPLATE_ID=123
```

E corrija o `CLAUDE.md`: onde estiver `Comprador` como exemplo de role, troque por `Manifestante`.

## 6. Teste antes de codar

Crie uma submission manualmente pelo admin, abra o link de assinatura e percorra o fluxo completo. Verifique:

- [ ] Todos os campos do quadro cabem visualmente na célula, sem transbordar
- [ ] `nome_completo` e `email` aparecem preenchidos e bloqueados
- [ ] O menu `qualidade` abre com as quatro opções
- [ ] A caixa de consentimento bloqueia a conclusão se desmarcada
- [ ] O PDF final fica legível, com os valores nos lugares certos
- [ ] O documento concluído aparece em **Submissões** no admin

O ponto mais provável de ajuste é a altura dos campos de texto: se a fonte ficar grande demais e cortar nomes longos, reduza o tamanho do campo no painel lateral.

---

## Mudanças em relação ao documento original

| Mudança | Motivo |
|---|---|
| Quadro de identificação no topo, no lugar das lacunas no texto | Lacunas em texto corrido reflowam entre versões e tornam o posicionamento dos campos instável |
| Assinatura única (só Manifestante) | Duas assinaturas deixariam cada carta pendente aguardando os fundadores |
| Cláusula 8 — LGPD | Você coleta CPF, localização e dados de propriedade; faltava base legal, finalidade, prazo de retenção e canal de exercício de direitos |
| Cláusula 10 — assinatura eletrônica | Reconhecimento expresso da validade e da trilha de auditoria, com base no art. 10, § 2º, da MP 2.200-2/2001 |
| Cláusula 12 — consentimento com checkbox | Registra o consentimento de forma auditável, em vez de presumi-lo |
| Campos de e-mail, telefone e CAR | O e-mail é necessário para o fluxo; CAR já era citado na cláusula 5.1(a) mas não tinha onde ser informado |
| "Duas vias de igual teor" removido | Linguagem de documento físico, sem sentido em via eletrônica única |

**Não sou advogado e isto não é aconselhamento jurídico.** As cláusulas de LGPD e assinatura eletrônica seguem práticas usuais de mercado, mas uma carta que vai a produção com dados de terceiros merece uma revisão jurídica — provavelmente barata, dado o caráter preliminar e não vinculante do documento.
