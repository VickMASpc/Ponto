# Sistema de Controle de Ponto — QR Code

Sistema de presença por QR Code para ambientes escolares. Gestores escaneiam crachás via câmera do dispositivo; administradores gerenciam tudo pelo painel web.

## Papéis

| Papel | Acesso |
|---|---|
| **admin** | Painel completo: cria departamentos, cargos, funcionários e gestores; visualiza todos os registros de presença |
| **gestor** | Tela de scanner QR para o seu departamento; vê presentes do dia e scans recentes |
| **worker** | Bate ponto próprio (entrada/saída) e vê seu histórico |
| **TI** | Cria administradores via código de acesso (painel flutuante "IT") |

## Fluxo de Presença por QR

```
Admin cria funcionário → QR único gerado automaticamente
Admin imprime crachá (botão "Crachá" na lista de funcionários)
Gestor faz login → clica "Abrir Scanner de QR"
Browser pede permissão de câmera
Gestor aponta câmera para o QR do crachá
→ Overlay mostra: nome, departamento, status atual
Gestor confirma "Registrar Entrada" ou "Registrar Saída"
→ Feedback grande por 3 s; scanner retoma automaticamente
```

O registro salva: `workerId`, `departmentId`, `recordedByUserId`, `method: "camera-qr"`.

## Biblioteca de QR

- **Leitura**: [`html5-qrcode`](https://github.com/mebjas/html5-qrcode) v2.3.8 — câmera nativa no browser, sem plugins.
- **Geração** (crachá): [`qrcode.js`](https://github.com/davidshimjs/qrcodejs) v1.5.3.

## Feedbacks de Erro (Scanner)

| Situação | Feedback exibido |
|---|---|
| Câmera negada | Mensagem em vermelho + instrução para liberar permissão |
| QR não reconhecido | Overlay de erro "QR não reconhecido neste departamento" |
| Scan repetido | Overlay mostra status atual ("Em serviço desde HH:MM") + opção Saída |
| QR ilegível | Nenhuma ação (frames sem QR são ignorados silenciosamente) |

## Instruções de Demo

### 1. Acesso
Abra: **https://vickmaspc.github.io/Pontos/**

### 2. Criar Gestor (como admin)
1. Faça login com conta admin.
2. Vá em **Funcionários → Adicionar**.
3. Preencha nome, e-mail, senha, selecione departamento e **Role = Gestor**.
4. Confirme criação.
5. Na lista, clique em **🪪 Crachá** para gerar o QR do funcionário/gestor.
6. Clique **🖨️ Imprimir** para imprimir o crachá.

### 3. Modo Scanner (como gestor)
1. Faça login com a conta do gestor.
2. Clique **Abrir Scanner de QR**.
3. Permita acesso à câmera quando solicitado.
4. Aponte para o QR de um crachá de funcionário do mesmo departamento.
5. Confirme **Registrar Entrada** ou **Registrar Saída**.
6. O painel "Presentes agora" e "Scans recentes" atualiza automaticamente.

### 4. Verificar Registros (como admin)
- Aba **Presenças** → coluna **Método** mostrará `camera-qr`.

## Deployment

O sistema é acessível via GitHub Pages: **https://vickmaspc.github.io/Pontos/**

Qualquer push na branch principal aciona deploy automático via GitHub Actions.

## Tech Stack

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-FF6600?style=for-the-badge&logo=firebase&logoColor=white)
