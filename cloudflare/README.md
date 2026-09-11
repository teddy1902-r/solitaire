# Activation du classement Solitaire sur Cloudflare

Les fichiers nécessaires sont déjà dans ce dossier :

- `worker.js` : API du classement
- `schema.sql` : structure de la base D1
- `wrangler.jsonc` : configuration de référence

## 1. Créer la base D1

Dans Cloudflare, crée une base **D1** appelée :

`solitaire-scores`

Ouvre ensuite la console SQL de cette base et exécute le contenu de `schema.sql`.

## 2. Créer le Worker

Crée un Worker appelé :

`solitaire-scores`

Remplace son code par le contenu de `worker.js`, puis déploie-le.

## 3. Lier D1 au Worker

Dans les paramètres du Worker, ajoute un binding D1 :

- Nom de variable : `DB`
- Base : `solitaire-scores`

## 4. Ajouter le mot Certitudes comme secret

Dans **Variables and Secrets** du Worker, ajoute un secret :

- Nom : `CERTITUDE_WORD`
- Valeur : ton mot final Certitudes

Ne mets pas ce mot dans les fichiers GitHub publics.

## 5. Origine autorisée

Le Worker est prévu pour accepter le site :

`https://teddy1902-r.github.io`

Tu peux également ajouter une variable texte :

- Nom : `ALLOWED_ORIGIN`
- Valeur : `https://teddy1902-r.github.io`

## 6. URL attendue

Le jeu est actuellement configuré pour appeler :

`https://solitaire-scores.teddysegura-ts.workers.dev`

Si Cloudflare te donne une autre adresse, il suffit de remplacer la constante `SOLITAIRE_API_URL` au début de `community.js`.

## Classement

Le Top 10 est trié dans cet ordre :

1. score le plus élevé ;
2. temps le plus court ;
3. moins de coups ;
4. date la plus ancienne si tout le reste est identique.

Le mot Certitudes n'est renvoyé par l'API qu'après l'enregistrement réussi d'une victoire.
