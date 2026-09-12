# Spider Solitaire Géocaching - 2 couleurs

Cette version contient :

- pseudo Géocaching obligatoire avant de jouer ;
- Spider Solitaire 2 couleurs : ♠ et ♥ ;
- 104 cartes ;
- 8 suites complètes à terminer ;
- chrono ;
- nombre de coups ;
- score final ;
- classement en ligne des 10 meilleurs joueurs ;
- mot secret envoyé uniquement après validation de la victoire ;
- mot secret absent du code HTML/JS public.

## Fichiers

- `index.html` : page du jeu
- `style.css` : mise en forme
- `script.js` : logique du jeu
- `worker.js` : API Cloudflare pour le classement et le mot secret
- `schema.sql` : tables D1

## Mise en place Cloudflare

1. Créer un Worker Cloudflare, par exemple `spider-solitaire-api`.
2. Copier le contenu de `worker.js` dans le Worker.
3. Créer une base D1, par exemple `spider-solitaire-db`.
4. Exécuter `schema.sql` dans la console SQL de la base.
5. Ajouter un binding D1 nommé `DB` au Worker.
6. Ajouter un Secret Worker nommé `SECRET_WORD` contenant le mot à afficher après la victoire.
7. Facultatif : ajouter `ALLOWED_ORIGIN` avec la valeur `https://teddy1902-r.github.io`.
8. Déployer le Worker.
9. Dans `script.js`, remplacer `https://TON-WORKER.workers.dev` par l'adresse réelle du Worker.

## Score

Le score est calculé par le serveur :

`100000 - (temps en secondes × 5) - (nombre de coups × 20)`

Le classement est limité aux 10 meilleurs joueurs et est trié par :

1. meilleur score ;
2. meilleur temps ;
3. moins de coups ;
4. date d'enregistrement la plus ancienne.

## Mot secret

Le mot secret n'est pas présent dans le code public GitHub. Il reste stocké dans le Worker Cloudflare et n'est renvoyé qu'à la fin d'une partie validée.
