# 🚀 Déploiement USM — Guide étape par étape

Suis ces étapes **dans l'ordre**. Elles doivent toutes être faites par toi (moi Claude je ne peux pas le faire).

---

## 1. Supabase — Créer le projet

1. Va sur https://supabase.com et crée un compte
2. Clique **New Project** → donne un nom (`usm-production`) et un mot de passe DB
3. Attends 2 min la création

### Récupère les clés

Dans ton projet Supabase → **Project Settings → API** :
- `Project URL` → sera `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` → sera `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` (⚠️ secret) → sera `SUPABASE_SERVICE_ROLE_KEY`

### Exécute les migrations SQL

Dans **SQL Editor**, colle et exécute **dans l'ordre** :

1. `supabase/migrations/01_schema.sql` (toutes les tables)
2. `supabase/migrations/02_rls.sql` (sécurité RLS)
3. `supabase/migrations/03_triggers.sql` (notifications automatiques)

### Active Realtime

**Database → Replication → Source: supabase_realtime** → active :
- `users`
- `reports`
- `audit_logs`
- `notifications`
- `training_sessions`
- `sanctions`
- `requests`
- `user_badges`

### Crée les buckets Storage

**Storage → Create bucket** → crée :
- `avatars` (public)
- `documents` (public ou privé selon ton choix)
- `rapports` (privé)
- `investigations` (privé)

Pour chaque bucket, configure les policies (onglet Policies) :
- **Authenticated users can upload**
- **Authenticated users can read**

---

## 2. Discord — Créer l'application OAuth2

1. Va sur https://discord.com/developers/applications
2. **New Application** → nomme-la `USM Portail`
3. **OAuth2 → General** :
   - Copie `CLIENT ID` → sera `DISCORD_CLIENT_ID`
   - Reset Secret → copie `CLIENT SECRET` → sera `DISCORD_CLIENT_SECRET`
4. **OAuth2 → Redirects** → ajoute :
   - `http://localhost:3000/api/auth/callback/discord` (dev)
   - `https://ton-domaine.com/api/auth/callback/discord` (prod)

### Crée un webhook Discord

Dans ton serveur Discord → Paramètres du salon → Intégrations → **Créer un webhook**

Copie l'URL → sera `DISCORD_WEBHOOK_URL`

Crée plusieurs webhooks (un par type) si tu veux séparer :
- `DISCORD_WEBHOOK_RAPPORTS`
- `DISCORD_WEBHOOK_SANCTIONS`
- `DISCORD_WEBHOOK_PROMOTIONS`
- `DISCORD_WEBHOOK_ENTRAINEMENTS`

---

## 3. Variables d'environnement

Crée `.env.local` à la racine à partir de `.env.local.example` :

```env
NEXTAUTH_SECRET=une_chaine_aleatoire_de_32_chars
NEXTAUTH_URL=http://localhost:3000
DISCORD_CLIENT_ID=ton_id
DISCORD_CLIENT_SECRET=ton_secret
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

💡 Pour `NEXTAUTH_SECRET` : `openssl rand -base64 32`

---

## 4. Installation + lancement local

```bash
npm install
npm run dev
```

Ouvre http://localhost:3000 → clique **Se connecter avec Discord**

### Promouvoir le premier Shériff

Après ta première connexion (tu seras BCSO niveau 1), va dans **Supabase → Table editor → users** et modifie ton `rank_level` à **9** (Shériff) pour débloquer toutes les fonctions admin.

---

## 5. Déploiement Vercel

### Push sur GitHub

```bash
git init
git add .
git commit -m "init USM"
gh repo create usm-website --private --source=. --push
# ou via web: crée un repo + git remote add origin ... + git push
```

### Déployer sur Vercel

1. https://vercel.com → **Import Project** → choisis le repo
2. **Environment Variables** → ajoute TOUTES les variables de `.env.local`
   **⚠️ change `NEXTAUTH_URL` et `NEXT_PUBLIC_SITE_URL` à ton domaine final**
3. Deploy

### Domaine personnalisé

Vercel → Project → Settings → Domains → ajoute ton domaine.

### Met à jour Discord OAuth

Retourne dans Discord Developer Portal → OAuth2 → Redirects → ajoute :
`https://ton-domaine.com/api/auth/callback/discord`

---

## 6. Checklist de déploiement

- [ ] Projet Supabase créé
- [ ] 3 migrations SQL exécutées (01, 02, 03)
- [ ] Realtime activé sur les tables
- [ ] Buckets Storage créés avec policies
- [ ] Application Discord OAuth2 créée
- [ ] Redirect URIs configurés (dev + prod)
- [ ] Webhook Discord créé
- [ ] `.env.local` rempli
- [ ] `npm install` + `npm run dev` fonctionne
- [ ] 1er utilisateur promu Shériff dans Supabase
- [ ] Déployé sur Vercel avec variables d'env
- [ ] Domaine personnalisé configuré
- [ ] Redirect Discord prod ajouté

---

## Notes importantes

- Les **logos SVG** dans `/public/logos/` (usm.svg, bcso.svg) sont stylisés. Remplace-les par les officiels si tu en as.
- Les **buckets Storage** nécessitent des policies SQL. Tu peux les ajouter via l'UI Supabase (onglet Policies de chaque bucket).
- Le **JWT Supabase** est signé avec `NEXTAUTH_SECRET`. Si tu changes cette variable, les sessions existantes deviennent invalides.

## Dépannage courant

**"Invalid JWT"** → Vérifie que `NEXTAUTH_SECRET` est bien défini partout.

**"Row level security policy violation"** → Le user n'a pas le rang requis. Vérifie son `rank_level` dans la table `users`.

**Upload de fichier échoue** → Vérifie les policies du bucket `documents` dans Supabase Storage.

**Webhooks Discord ne partent pas** → Vérifie l'URL et que le webhook est toujours actif dans Discord.
