# Arquitetura e Regras de Desenvolvimento - Fit.AI

## 1. Stack Tecnológica Base

- **Backend Framework:** Fastify
- **Node.js:** Versão 24.x
- **Linguagem:** TypeScript com ES Modules (`type: "module"` no `package.json`).
- **Gerenciador de Pacotes:** `pnpm`
- **Validação e Tipagem:** Zod (via `fastify-type-provider-zod`)
- **Documentação da API:** Swagger via `@fastify/swagger` e Scalar via `@scalar/fastify-api-reference`
- **ORM / Banco de Dados:** Prisma ORM (com PostgreSQL)
- **Autenticação:** `better-auth`

## 2. Padrão Arquitetural (Layered/Clean-ish)

O projeto divide as responsabilidades em camadas distintas:

### A) Rotas (`src/routes/`)

- **Responsabilidade:** Definir os endpoints da API, integrar a validação do Zod para a requisição/resposta, realizar a checagem de autenticação (`better-auth`) e delegar a execução para a camada de _UseCases_.
- **Regras:**
  - Devem ser exportadas como plugins assíncronos do Fastify. Ex: `export const featureRoutes = async (app: FastifyInstance) => { ... }`.
  - Utilizar `app.withTypeProvider<ZodTypeProvider>().route({ ... })` para aproveitar a inferência de tipos.
  - Definir os schemas de entrada (`body`, `params`, `query`) e saída (`response`) no objeto `schema` do endpoint.
  - **Documentação Swagger:** Sempre incluir `tags`, `summary` e `description` no `schema` de cada rota para gerar a documentação automática corretamente. Exemplo:
    ```ts
    schema: {
      tags: ["Nome do Recurso"],
      summary: "Breve descrição da ação",
      description: "Descrição detalhada do que o endpoint faz",
      // body, params, response...
    }
    ```

### B) Casos de Uso (`src/usecases/`)

- **Responsabilidade:** Conter a regra de negócio e fazer a comunicação com o banco de dados (Prisma).
- **Regras:**
  - Criar classes com um único método público chamado `execute()`.
  - Definir e exportar interfaces explícitas chamadas `InputDto` e `OutputDto` no mesmo arquivo do UseCase para tipar fortemente a entrada e a saída.
  - O UseCase **não** deve conhecer ou manipular objetos de requisição/resposta (Request/Reply) do Fastify. Ele recebe dados puros (InputDto) e retorna dados puros (OutputDto).
  - Sempre que houver múltiplas operações de banco de dados que dependam uma da outra, utilizar transações do Prisma (`prisma.$transaction`).

### C) Schemas (`src/schemas/`)

- **Responsabilidade:** Centralizar a definição das validações (Zod) que serão reutilizadas em rotas, tanto para validação de payload quanto para a documentação automática.
- **Regras:**
  - Exportar schemas reaproveitáveis de `src/schemas/index.ts` (ex: `ErrorSchema`, `workoutPlanSchema`).
  - **Enums do Prisma:** Sempre validar campos do tipo enum usando `z.nativeEnum(EnumName)` importado de `../generated/prisma/enums.js`. Nunca usar `z.string()` para representar enums.

### D) Lib e Configurações (`src/lib/`)

- **Responsabilidade:** Armazenar configurações de pacotes terceiros (ex: instância de auth e instância do db).
- **Regras:**
  - Arquivos como `db.ts` devem exportar a instância global configurada (ex: `prisma`).
  - Idem para arquivos de autenticação (`auth.ts`).

## 3. Regras de Código e Importação (Code Style)

- **ES Modules Imports:** É obrigatório incluir a extensão `.js` ao importar arquivos locais no TypeScript.
  Exemplo correto: `import { auth } from "../lib/auth.js";` (NUNCA omitir o `.js` nas importações relativas).
- **Tratamento de Exceções:** Ao lidar com erros nas rotas genéricas, logar com o `app.log.error(error)` (estilo Fastify) e sempre retornar códigos HTTP apropriados em um formato json com `error` e `code`.
- **Geração de IDs:** O projeto utiliza `crypto.randomUUID()` nativo do Node.js para geração manual de identificadores primários (UUIDs) antes da inserção no Prisma quando necessário.
- **Autenticação nas Rotas:** Usar a função `auth.api.getSession({ headers: fromNodeHeaders(request.headers) })` importada de `better-auth/node` para validar os tokens e obter dados do usuário nas rotas protegidas.

## 4. Commits (Conventional Commits)

- Todos os commits devem seguir o padrão [Conventional Commits](https://www.conventionalcommits.org/).
- Formato: `<tipo>(escopo opcional): descrição`
- Tipos mais comuns: `feat`, `fix`, `refactor`, `docs`, `chore`, `style`, `test`.
- Exemplo: `feat(workout-session): add start workout session route`
