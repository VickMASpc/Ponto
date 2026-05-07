# Sistema de Controle de Ponto.

Um sistema simples e funcional para registro de presença de funcionários com Firebase como Banco de Dados.

## Funcionalidades

### Administradores
* Os administradores podem criar departamentos, cargos e funcionários com email e senha.
* É possivel ver a quantidade de cada um e também quantos e quais estão com o ponto ativo no momento.

### Funcionários
* Os funcionários podem bater o ponto, ver suas informações e entradas realizadas.

### TI
* Aqui administradores da TI podem adicionar administradores gerais (similar ao fluxo de administradores -> funcionários) por meio de um código (701977).

## Minhas ideias para a distribuição e utilização
* Minha ideia inicial é que cada representante de cada grupo (departamento) adicione seus funcionários e cargos e alguém do TI ficaria responsável por adicionar os administradores.

## Deployment
* O sistema é completamente acessível pelo github pages (https://vickmaspc.github.io/Pontos/).

## Configurações do Repositório

### .github
* Teste de Github Actions e andamento.
* Deploy automatico pro github pages.

### JSONs
* Arquivos do node.js para conectar com o firebase.

### TechStacks

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-FF6600?style=for-the-badge&logo=firebase&logoColor=white)
