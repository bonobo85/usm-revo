# Logos USM & BCSO

Les fichiers SVG de ce dossier sont des **placeholders stylisés** générés pour le site.
Remplace-les par tes propres logos en gardant **exactement les mêmes noms de fichiers** :

| Fichier                        | Où il est utilisé                             | Dimensions recommandées |
| ------------------------------ | --------------------------------------------- | ----------------------- |
| `usm-logo.svg`                 | Logo carré principal (sidebar, login, PDFs)    | 200×200 px              |
| `usm-logo-horizontal.svg`      | Bannières, header, en-têtes de pages          | 380×80 px               |
| `bcso-logo.svg`                | Partenariat BCSO (footer, organigramme)       | 200×220 px              |
| `/public/favicon.svg`          | Onglet du navigateur                           | 32×32 px (SVG vecteur)  |

## Comment remplacer

1. Remplace simplement les fichiers SVG par les tiens (mêmes noms)
2. Tu peux aussi fournir des PNG : place-les dans ce dossier et change `.svg` en `.png` dans les imports (chercher `from "@/public/logos"` dans le code)
3. Pour le favicon, remplace `/public/favicon.svg` OU ajoute un `favicon.ico` dans `/public/`

Les emplacements dans le code où les logos sont affichés :
- `components/layout/Sidebar.tsx`
- `components/layout/LogoHeader.tsx`
- `app/login/page.tsx`
- `components/pdf/*.tsx` (exports PDF)
- `app/layout.tsx` (metadata / favicon)
