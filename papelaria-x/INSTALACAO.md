# Guia de Instalação — Papelaria X (InfinityFree)

Este sistema foi desenvolvido exclusivamente com **PHP 8 + MySQL (PDO) + HTML5 + CSS3 + JavaScript puro**, 100% compatível com a hospedagem compartilhada **InfinityFree**.

---

## 1. Criar o Banco de Dados MySQL no InfinityFree

1. Acesse o painel da sua conta no **InfinityFree** e abra o **Control Panel (VistaPanel)**.
2. Clique em **MySQL Databases**.
3. Crie um novo banco de dados (por exemplo: `papelaria_x`).
   - O InfinityFree criará o banco com o prefixo da sua conta, ex: `if0_12345678_papelaria_x`.
4. Anote os 4 dados exibidos na tela de **MySQL Databases**:
   - **MySQL Hostname** (ex: `sql204.infinityfree.com`)
   - **MySQL Database Name** (ex: `if0_12345678_papelaria_x`)
   - **MySQL Username** (ex: `if0_12345678`)
   - **MySQL Password** (a mesma senha da conta de hospedagem no InfinityFree)

---

## 2. Importar as Tabelas pelo phpMyAdmin

1. Ainda no **VistaPanel**, clique em **phpMyAdmin**.
2. Clique no botão **Connect Now** ao lado do banco de dados criado.
3. No menu superior do phpMyAdmin, clique na aba **Importar (Import)**.
4. Clique em **Escolher arquivo** e selecione o arquivo:
   `papelaria-x/database/papelaria_x.sql`
5. Role até o final e clique em **Executar (Go)**.
6. Confirme que as 8 tabelas foram criadas (`usuarios`, `clientes`, `categorias`, `produtos`, `pedidos`, `pedido_itens`, `pedido_historico`, `configuracoes`).

---

## 3. Configurar a Conexão com o Banco (`config/database.php`)

1. Abra o arquivo `papelaria-x/config/database.php` em um editor de texto (ou pelo Gerenciador de Arquivos).
2. Preencha as constantes com os dados anotados no Passo 1:

```php
define('DB_HOST', 'sqlXXX.infinityfree.com');
define('DB_NAME', 'if0_XXXXXXXX_papelaria_x');
define('DB_USER', 'if0_XXXXXXXX');
define('DB_PASS', 'SUA_SENHA_MYSQL');
```

> **Segurança:** O arquivo `.htaccess` já bloqueia o acesso direto via navegador às pastas `config/`, `includes/` e `database/`.

---

## 4. Enviar os Arquivos para o InfinityFree (File Manager ou FTP)

### Opção A: Gerenciador de Arquivos (Online File Manager)
1. No painel do InfinityFree, abra o **File Manager**.
2. Entre na pasta `htdocs/`.
3. Envie todo o conteúdo da pasta `papelaria-x/` para dentro de `htdocs/` (ou para `htdocs/papelaria/` se preferir acessar por subpasta — o sistema detecta o caminho automaticamente).

### Opção B: FTP (FileZilla)
1. Use os dados de FTP exibidos no painel do InfinityFree (**FTP Hostname**, **Username**, **Password**, porta `21`).
2. Conecte-se no FileZilla e arraste todos os arquivos de `papelaria-x/` para `/htdocs/`.

---

## 5. Criar o Primeiro Usuário Administrador

1. Após importar o SQL e enviar os arquivos, acesse o endereço do seu site no navegador (ex: `https://seusite.infinityfreeapp.com/`).
2. No primeiro acesso (com a tabela `usuarios` vazia), a tela `login.php` exibirá automaticamente o formulário **Configuração Inicial — Criar Administrador**.
3. Preencha seu **Nome completo**, **E-mail** e uma **Senha segura** (mínimo 6 caracteres) e clique em **Criar Administrador e Entrar**.
4. Assim que o primeiro administrador for criado, o formulário de criação inicial é desativado automaticamente por segurança. Novos atendentes podem ser criados depois em **Configurações**.
