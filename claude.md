# CLAUDE.md

Este arquivo fornece contexto para o Claude Code (claude.ai/code) ao trabalhar neste repositório.

## Visão geral do projeto

Esse projeto é relativo a uma landing page de captação de cartas de intenção, para comprovar que agricultores e produtores rurais, além de outras pessoas com propriedades rurais possuem a intenção de caso o negócio venha a se consolidar como real , eles estariam dispostos a assinar um futuro contrato com a startup Hectare06 (H06) futuramente, nessa landing page o usuário deve poder preencher uma carta de intenção online e as respostas devem ficar visíveis somente para nós administradores

## Comandos comuns

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev 

# Rodar testes
npm run test

# Build de produção
vite build

# Lint / formatação
npm run lint
```

## Arquitetura

- `src/` — pasta com códigos
- `assets/` —  pasta com imagens e figuras utilizadas
- `documentos/` — pasta com documentação

## Convenções de código


- Linguagem/framework principal: javascript, next, react


## Fluxo de trabalho

- Rodar testes/lint antes de finalizar mudanças
- Não commitar sem solicitação explícita
- Listar o que foi implementado e o que não foi possível de implementar de forma objetiva
- <!-- outras regras específicas do projeto -->

## Loop de Feedback e Melhoria Contínua

Para garantir a evolução do projeto e a precisão das respostas, siga rigorosamente este ciclo de feedback a cada interação crítica ou erro detectado:

### 1. Captura e Registro (Input)
* **Feedback Explícito:** Sempre que o usuário corrigir uma resposta ou sinalizar um erro (via chat ou logs), capture o par `[Prompt Original] + [Resposta Incorreta] + [Correção/Crítica]`.
* **Identificação de Falhas:** Categorize o erro imediatamente em uma das seguintes frentes:
  * *Alucinação:* Dados falsos ou inventados.
  * *Contexto:* Falta de informações sobre o projeto ou regras de negócio.
  * *Instrução:* Desvio do comportamento esperado no `claude.md`.

### 2. Ação Imediata (Mitigação)
* Corrija a resposta atual adaptando o tom ou buscando a informação correta na documentação existente.
* Se a falha foi por falta de contexto, peça ao usuário a informação ausente e guarde-a para a próxima etapa.

### 3. Atualização do Conhecimento (Refinamento)
* **Ajuste de Prompt:** Se o erro foi comportamental, atualize as seções de "Regras" ou "Instruções" deste `claude.md`.
* **Base de Conhecimento:** Se o erro foi de conteúdo, adicione o novo aprendizado na seção relevante de documentação do projeto.
* **Exemplos (Few-Shot):** Adicione o caso corrigido a uma seção de `Exemplos de Sucesso` dentro do contexto do projeto para evitar regressões.

### 4. Validação (Output)
* Teste o prompt modificado contra o cenário que falhou.
* Certifique-se de que a nova regra não quebrou comportamentos anteriores que já funcionavam.

## Notas adicionais

Cores primárias: verde bandeira e branco
Cores secundárias: preto
Tipografia: Montserrat
