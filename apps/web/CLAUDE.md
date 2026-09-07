# CLAUDE.md — Règles de développement frontend KAZA

Règles de codage à respecter impérativement sur l'ensemble du frontend
(`apps/web`). Ces règles s'appliquent à tout ajout, modification ou relecture
de code dans ce workspace.

---

## 1. TypeScript — zéro `any`

**Interdiction absolue du type `any` en TypeScript strict mode.**

```ts
// ❌ Interdit
const data: any = await res.json();
function handle(x: any) { ... }

// ✅ Correct
const data: unknown = await res.json();
function handle(x: Record<string, unknown>) { ... }
```

- Utiliser `unknown` pour les valeurs de type inconnu, puis affiner avec des
  guards (`typeof`, `instanceof`, prédicats de type).
- Les `as SomeType` ne sont autorisés qu'après une vérification structurelle
  explicite (pas de cast aveugle).
- La règle `@typescript-eslint/no-explicit-any` est activée en `error`.
- Interdiction de désactiver la règle via `// eslint-disable-next-line` sans
  commentaire justificatif approuvé.

---

## 2. Style fonctionnel — `.map()` / `.filter()` plutôt que boucles impératives

**Préférer les transformations fonctionnelles déclaratives aux boucles `for`/`while`.**

```ts
// ❌ Interdit
const results = [];
for (const item of items) {
  if (item.active) results.push(item.id);
}

// ✅ Correct
const results = items.filter((item) => item.active).map((item) => item.id);
```

- Utiliser `.map()`, `.filter()`, `.reduce()`, `.flatMap()`, `.find()`,
  `.every()`, `.some()` selon le besoin.
- Les `for...of` restent tolérés uniquement pour les effets de bord séquentiels
  (ex : appels `await` en série) ou lorsque la lisibilité en souffrirait
  réellement avec du fonctionnel.
- Les fonctions doivent être **pures** : même entrée → même sortie, sans
  mutation des arguments ni effet de bord caché.

```ts
// ❌ Mutation interdite
function addId(items: Item[]) {
  items.push({ id: 'new' }); // mutation en place
  return items;
}

// ✅ Immutabilité
function addId(items: Item[]): Item[] {
  return [...items, { id: 'new' }];
}
```

---

## 3. Commentaires — préfixe `note :` pour la logique métier complexe

**Toute logique métier non évidente doit être documentée avec le préfixe `note :`.**

```ts
// note : le statut 'pending' est conservé jusqu'à confirmation du webhook
// FedaPay — une mise à jour optimiste côté client ferait diverger l'état.
const status = payment.status;
```

- Le préfixe `note :` (en minuscules) est réservé aux explications de
  **règles métier**, de **cas limites non évidents** ou de **décisions
  d'architecture** locales.
- Les commentaires purement descriptifs ("appel l'API") sont inutiles et
  interdits.
- La langue des commentaires suit la langue du fichier ambiant (le codebase
  KAZA est en français).

---

## 4. Commits — Conventional Commits atomiques

**Chaque commit ne doit porter qu'une seule préoccupation logique.**

Format obligatoire :

```
<type>(<scope>): <description courte en minuscules>
```

### Types autorisés

| Type | Quand l'utiliser |
| :--- | :--- |
| `feat` | Nouvelle fonctionnalité visible par l'utilisateur |
| `fix` | Correction d'un bug |
| `refactor` | Réécriture sans changement de comportement |
| `style` | Mise en forme, espaces, lint (pas de logique) |
| `test` | Ajout ou modification de tests |
| `docs` | Documentation uniquement |
| `chore` | Mise à jour de dépendances, CI, config |
| `perf` | Optimisation de performance |

### Scopes courants KAZA

`ui`, `auth`, `chat`, `payment`, `lease`, `residence`, `admin`, `notif`, `api`, `db`

### Exemples

```
feat(ui): ajouter le composant ResidenceMap avec clustering Leaflet
fix(auth): corriger la régression de rate-limit sur POST /api/login
fix(payment): gérer le cas où months dépasse 6 dans fedapay-init
refactor(lease): remplacer les boucles for par .filter().map() dans listMyLeases
docs(api): documenter les endpoints Edge Functions dans CLAUDE.md
chore(deps): mettre à jour vitest vers 3.3.0
```

### Règles supplémentaires

- **Atomique** : un commit = un changement logique unique, testable et
  réversible indépendamment.
- **Ne jamais** committer du code en cours (`// TODO fix this`) ou des
  `console.log` de debug.
- Message en **impératif présent** : "ajouter" et non "ajouté" ni "ajout de".
- La description ne dépasse pas **72 caractères**.

---

## 5. Identité du projet

Le projet s'appelle **KAZA** (jamais "Casa", "kaza" en minuscules dans les
interfaces utilisateur, ni tout autre variante). Toute occurrence de "Casa"
dans le code, les libellés, les commentaires ou la documentation est une
erreur à corriger immédiatement.

---

## 6. Checklist avant tout commit

- [ ] Aucun `any` introduit (`npx tsc --noEmit` passe sans erreur)
- [ ] Boucles impératives remplacées par du fonctionnel là où c'est clair
- [ ] Logique métier non évidente annotée avec `note :`
- [ ] Message de commit au format Conventional Commits
- [ ] `npm run lint` passe sans warning ni erreur
- [ ] `npm run typecheck` passe sans erreur
