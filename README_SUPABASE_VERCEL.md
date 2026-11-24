# Papelaria X — Guia de Configuração Supabase + Deploy na Vercel

Este projeto utiliza **React + TypeScript + Vite** no frontend, **Supabase (PostgreSQL + Auth + RLS)** como banco de dados e autenticação, e está pronto para deploy na **Vercel**.

---

## 1. Executar o Script SQL no Supabase

1. Acesse o projeto no Supabase: `https://supabase.com/dashboard` (URL do projeto: `https://xzjaarzyfhozyvyoqlqw.supabase.co`).
2. No menu lateral, clique em **SQL Editor**.
3. Crie uma nova query (**New query**), cole todo o conteúdo do arquivo `supabase/schema.sql` e clique em **Run**.
4. Verifique em **Table Editor** que as tabelas foram criadas:
   - `perfis`
   - `clientes`
   - `categorias`
   - `produtos`
   - `pedidos`
   - `pedido_itens`
   - `pedido_historico`
   - `configuracoes`
5. Todas as tabelas possuem **Row Level Security (RLS)** ativado, permitindo acesso somente a usuários autenticados no Supabase Auth.

---

## 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto (ou configure diretamente na Vercel) com base no `.env.example`:

```env
VITE_SUPABASE_URL="https://xzjaarzyfhozyvyoqlqw.supabase.co"
VITE_SUPABASE_ANON_KEY="SUA_CHAVE_PUBLICA_PUBLISHABLE_OU_ANON_KEY"
```

> **Segurança:** Utilize exclusivamente a chave pública (**Publishable / Anon key**). Nunca coloque a `service_role` key no frontend ou em variáveis `VITE_*`.

---

## 3. Configurar Autenticação no Supabase Auth

1. No painel do Supabase, acesse **Authentication > URL Configuration**.
2. Em **Site URL**, informe a URL de produção da Vercel (ex: `https://papelaria-x.vercel.app`).
3. Em **Redirect URLs**, adicione:
   - `http://localhost:3000/**`
   - `https://papelaria-x.vercel.app/**` (seu domínio da Vercel)
4. Ao acessar o sistema pela primeira vez, utilize a aba **Criar conta** na tela de login para registrar o primeiro usuário administrador (o trigger `on_auth_user_created` define automaticamente o primeiro usuário como `admin`).

---

## 4. Publicar na Vercel

1. Envie o repositório para o GitHub (sem commitar o arquivo `.env` com suas chaves locais).
2. Acesse `https://vercel.com` e clique em **Add New... > Project**.
3. Importe o repositório do projeto.
4. O Vercel detectará automaticamente o framework **Vite** (`npm run build` / diretório `dist`, já configurado também em `vercel.json`).
5. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` = `https://xzjaarzyfhozyvyoqlqw.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = sua chave pública (Publishable / Anon key) do Supabase.
6. Clique em **Deploy**.
