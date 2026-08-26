# Scripts do Banco de Dados MySQL - Bagô Sanduíches e Saladas

Este diretório contém os scripts SQL para criação do banco de dados relacional e inserção de dados iniciais (seed) para o sistema **Bagô Sanduíches e Saladas**.

---

## 📁 Arquivos

- `bago_database.sql`: Script SQL completo com tabelas, chaves primárias, chaves estrangeiras, índices e dados de exemplo.

---

## 🗄️ Estrutura do Banco de Dados

Nome do Banco de Dados: `bago_restaurant`  
Charset: `utf8mb4_unicode_ci`

### Tabelas Criadas:

1. **`users`**: Usuários do sistema (Admin, Cozinha, Balcão).
2. **`ingredients`**: Controle de estoque de pães, proteínas, queijos, saladas, molhos, adicionais e bebidas/cookies.
3. **`customizer_steps`**: Configuração das etapas do montador de sanduíche e salada na tigela.
4. **`step_options`**: Opções configuráveis de preços/adicionais das etapas.
5. **`ready_products`**: Cardápio de lanches prontos, combos e saladas montadas.
6. **`orders`**: Registro dos pedidos (Comanda/Código, tipo de entrega, pagamento, status).
7. **`order_items`**: Itens de cada pedido com detalhes em formato JSON.
8. **`cash_register_sessions`**: Controle de Abertura e Fechamento de Caixa do PDV.
9. **`cash_transactions`**: Sangrias, suprimentos e histórico de vendas no caixa.
10. **`store_settings`**: Configurações gerais da loja (tempo de preparo, taxa de entrega, status aberto/fechado).

---

## 🚀 Como Executar o Script no seu Servidor MySQL

### Opção 1: Via Linha de Comando (Terminal / CMD)

```bash
mysql -u seu_usuario -p < scripts/bago_database.sql
```

### Opção 2: Via MySQL Workbench / DBeaver

1. Abra o **MySQL Workbench** ou seu gerenciador de banco preferido.
2. Conecte ao seu servidor MySQL.
3. Vá em `File > Open SQL Script...` e selecione o arquivo `scripts/bago_database.sql`.
4. Clique no ícone do raio (⚡ **Execute**) para rodar todo o script.

### Opção 3: Via phpMyAdmin

1. Acesse o **phpMyAdmin** do seu servidor.
2. Vá na aba **Importar** (Import).
3. Clique em **Escolher arquivo** e selecione `bago_database.sql`.
4. Clique no botão **Executar** no final da página.

---

## 🔐 Credenciais Padrão do Script (Seed)

- **Admin**: `username: admin` | `senha: admin123`
- **Cozinha**: `username: cozinha` | `senha: cozinha123`
- **Balcão**: `username: balcao` | `senha: balcao123`
