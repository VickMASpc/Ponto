# Sistema de Controle de Ponto (MVP)

Um sistema simples e funcional para registro de presença de funcionários, construído com HTML, CSS e JavaScript puro, integrado ao Firebase (Authentication e Firestore).

## Funcionalidades

- **Login Seguro**: Acesso via e-mail e senha.
- **Dois Níveis de Acesso**:
  - **Funcionário**: Bate ponto (entrada/saída) e visualiza seu histórico recente.
  - **Administrador**: Gerencia funcionários, departamentos, cargos e visualiza logs de presença de toda a equipe.
- **Gestão de Equipe**: Criação de contas de funcionários diretamente pelo painel administrativo.
- **Painel de Monitoramento**: Visualização em tempo real de quem está em serviço.
- **Filtros e Buscas**: Busca de funcionários e filtragem de logs por departamento ou status.

## Estrutura do Projeto

```txt
Ponto/
├── index.html          # Interface do usuário (UI)
├── styles.css          # Estilização visual
├── app.js              # Lógica da aplicação e integração Firebase
├── firebase-config.js  # Configurações do seu projeto Firebase (não versionado)
├── firestore.rules     # Regras de segurança do banco de dados
└── README.md           # Documentação do projeto
```

## Configuração Inicial

### 1. Firebase
1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. Adicione um "Web App" e copie as credenciais de configuração.
3. No menu **Authentication**, ative o método de login por **E-mail/Senha**.
4. Crie um banco de dados **Cloud Firestore**.
5. Copie o arquivo `firebase-config.example.js` para um novo arquivo chamado `firebase-config.js`.
6. Cole suas credenciais no `firebase-config.js`.

### 2. Regras de Segurança
Copie o conteúdo de `firestore.rules` e cole na aba **Rules** do seu Cloud Firestore no console do Firebase.

### 3. Criando o Primeiro Administrador
Para bootstrap do sistema, existe uma aba oculta de "IT":
1. No console do Firebase, crie manualmente um documento na coleção `system` com o ID `config`.
2. Adicione um campo `it_access_code` (ex: `123456`).
3. No aplicativo, clique no botão **IT** no canto inferior direito.
4. Insira o código definido e crie a primeira conta de administrador.

## Como Executar

Como o projeto utiliza módulos JavaScript, ele precisa ser servido por um servidor local. Você pode usar a extensão "Live Server" do VS Code ou via terminal:

```bash
# Se tiver Python instalado
python -m http.server 8080
```

Acesse em: `http://localhost:8080`

## Notas Importantes
- **Segurança**: As regras de segurança no `firestore.rules` garantem que funcionários só vejam seus próprios dados e que apenas administradores façam alterações críticas.
- **Privacidade**: O arquivo `firebase-config.js` contém chaves públicas do Firebase, mas é boa prática mantê-lo fora do controle de versão se o projeto for público.
