# Maquette de parcours – Pré‑inscription (École Moser)

## 0) Objectif du projet (rappel)

Dématérialiser et automatiser la pré‑inscription dans Dataverse/Dynamics via Power Pages : Parent 1 authentifié, centralisation des données Élève/Parents, génération PDF, envoi signature (DocuSign/SignNow), suivi dans l’Opportunité, champs sensibles verrouillés.

### Objectifs du formulaire « Préinscription »

- Centraliser les données de la famille pour générer un dossier de pré‑inscription, l'envoyer en signature électronique et suivre l'opportunité associée.
- Parcours guidé en trois blocs : Parent 1, séquence d’Enfant(s), puis Parent 2.

### Conditions d’accès et de navigation

- Parent 1 doit être un utilisateur portail authentifié rattaché au compte famille.
- Parent 2 est un autre contact de la même famille avec une adresse e‑mail différente.
- Les Enfant(s) sont des contacts de type « Enfant » liés à ce compte.
- Le routage repose sur des paramètres de query string (`parent1id`, `eleveid`, `parent2id`, `accountid`).

### Contraintes techniques et fonctionnelles

- Distinction des rôles par l’option‑set `new_typedecontact`.
- Table Permissions limitant la lecture/écriture aux membres de la même famille et champs sensibles verrouillés via Form Metadata.
- Séquence Enfant(s) répétable : après chaque sauvegarde, retour à la liste jusqu’à ce que tous soient traités avant la décision sur Parent 2.

---

## 1) Données & hypothèses clefs

* **Tables** : `contact` (Parents/Enfants), `account` (Famille), `opportunity` (Opportunité d’inscription), tables annexes si besoin.
* **Relations** : `contact.parentcustomerid → account` (Contact → Compte Famille).
* **Distinction des rôles** (Optionset `new_typedecontact`, valeurs **numériques**) :

  * Parent : `100000001`
  * Enfant : `100000000`
* **Parent 1** : utilisateur portail connecté (objet Liquid `user`), lié à `account` (Famille).
* **Parent 2** : autre `contact` de la même Famille, `typedecontact=Parent`, `email ≠ Parent1`.
* **Enfants** : `contact` avec `typedecontact=Enfant` et `_parentcustomerid_value = Famille`.
* **Portals Web API** : lecture/écriture via `/_api/*`, query params encodés.
* **Sécurité** : Table Permissions filtrées sur la Famille, champs verrouillés via Form Metadata.

---

## 2) Web Form – Étapes à créer/configurer

> Un **seul** Web Form « Préinscription », **4 étapes**. Les GUID sont des placeholders.

1. **Étape PARENT1\_EDIT** (Mode : **Modifier**)

   * Table : `contact`
   * Primary key query string : `parent1id`
   * Post‑save redirect : `…/Accueil?after=parent1` (pour enchaîner sur les enfants)

2. **Étape ELEVE\_EDIT** (Mode : **Modifier**)

   * Table : `contact`
   * Primary key query string : `eleveid`
   * Post‑save redirect : `…/Accueil?after=eleve&done=<eleveid>&remaining=<ids restants>`

3. **Étape P2\_EDIT** (Mode : **Modifier**)

   * Table : `contact`
   * Primary key query string : `parent2id`
   * Post‑save redirect : `…/Accueil?after=parent2`

4. **Étape P2\_CREATE** (Mode : **Insérer**)

   * Table : `contact`
   * **Référence associée** : `parentcustomerid` (Contact → Account)

     * Type de source : **Chaîne de requête**
     * Nom du paramètre : `accountid` (**primary key** : Oui)
   * Post‑save redirect : `…/Accueil?after=parent2`

 > **Note** : l’étape **Élève** est appelée en boucle sur chaque enfant. L’ordre global peut rester « Parent1 → Enfant(s) → Parent2 ».

### Router JavaScript

Un router JavaScript orchestre ces étapes. Après la sauvegarde de **Parent1**, il récupère la liste des enfants via l’API, boucle sur chacun d’eux en appelant **ELEVE_EDIT** puis décide de poursuivre vers **P2_EDIT** ou **P2_CREATE** selon l’existence d’un Parent 2.

---

## 3) Parcours utilisateur – vue d’ensemble

Exemple de séquence d’écrans : **Parent1** → **liste/édition des enfants** → **décision Parent2** → **récap/validation**.

```
Entrée (Parent1 authentifié)
   ↓ (router JS)
Parent1_EDIT (record = parent1)
   ↓ redirect after=parent1
Lister enfants Famille (via Web API)
   ├─ 0 enfant → saute la boucle → Parent2 decision
   └─ N>0 enfants → construire remaining = [e1,e2,…]
        ├─ Prendre e1 → ELEVE_EDIT(eleveid=e1)
        │    ↓ redirect after=eleve (retour Accueil avec done=e1, remaining=[…])
        ├─ Prendre e2 → ELEVE_EDIT(eleveid=e2) …
        └─ remaining vide → Parent2 decision
               ├─ P2 existe → P2_EDIT(parent2id)
               └─ P2 absent → P2_CREATE(accountid)
                       ↓ after=parent2
Fin de parcours → bouton “Valider” → Flow Power Automate (PDF + Signature + MAJ Opportunité)
```

---

## 4) Documentation technique

* **Constantes option-set** : `Parent=100000001`, `Enfant=100000000`.
* **API utilisée** : `/_api/contacts`.
* **Paramètres de query string** : `parent1id`, `eleveid`, `parent2id`, `accountid`.

---

## 5) Algorithme de routage (pseudocode)

1. **Pré‑flight** : récupérer `accountId` & `parent1Id`.

   * (A) Tentative Liquid : `user.parentcustomerid.id`, `user.id`.
   * (B) Fallback Web API : `GET /_api/contacts({userId})?$select=_parentcustomerid_value,emailaddress1`.
2. **Si `stepid` absent** → rediriger vers **PARENT1\_EDIT** avec `?parent1id={userId}`.
3. **Si `after=parent1`** → charger enfants :

   * `GET /_api/contacts?$select=contactid,fullname&$filter=new_typedecontact eq ENFANT and _parentcustomerid_value eq {accountId}`
   * Si `count==0` → **Parent2 decision** (voir 5).
   * Sinon, construire `remaining` = liste de `contactid`.
   * Rediriger vers **ELEVE\_EDIT** avec `eleveid = remaining[0]` + `remaining` (csv).
4. **Si `after=eleve`** :

   * Lire `done` et `remaining` depuis la query.
   * Retirer `done` de `remaining`.
   * Si `remaining` non vide → **ELEVE\_EDIT** sur `remaining[0]`.
   * Si vide → **Parent2 decision**.
5. **Parent2 decision** :

   * `GET /_api/contacts?$select=contactid&$top=1&$filter=new_typedecontact eq PARENT and _parentcustomerid_value eq {accountId} and emailaddress1 ne '{parent1Email}'`
   * **Si trouvé** → **P2\_EDIT** `?parent2id={id}`
   * **Sinon** → **P2\_CREATE** `?accountid={accountId}`
6. **Après P2** : afficher page récap + bouton **Valider** qui déclenche un **Flow** (PDF, e‑sign, MAJ Opportunité).

---

## 6) UX – écrans

* **Accueil/router** : écran transitoire “Préparation du formulaire…”, invisible après redirection.
* **Parent1\_EDIT** : champs Parent1 en **Edit**, champs sensibles **ReadOnly**.
* **Séquence Élève(s)** : pas de listing à l’écran si on enchaîne automatiquement les formulaires. Option : page intermédiaire “Vous avez N enfants, nous allons les vérifier un par un”.
* **Parent2 decision** : logique silencieuse → mène à Edit ou Create.
* **Récap/Validation** : confirme les changements et propose l’envoi pour signature.

---

## 7) Power Automate – chaîne documentaire

1. **Trigger** : bouton “Valider” (HTTP request ou action Dataverse).
2. **Get records** : Parent1, Parent2 (si existe), enfants, opportunité.
3. **Générer** : Word → PDF (modèle avec placeholders).
4. **Signature** : créer enveloppe DocuSign/SignNow (Parent1→Parent2), récupérer status, lien.
5. **MAJ** : stocker PDF (SharePoint ou Note), MAJ Opportunité (status, URLs, dates).

---

## 8) Sécurité & règles

* **Table Permissions** :

  * Contact : lecture/modif **Self** + **même Famille** (via `parentcustomerid`).
  * Account : lecture restreinte à la Famille du Parent1.
  * Contact (Create) : autoriser création Parent2 avec `parentcustomerid` = Famille.
* **Form Metadata** : champs Year/Degree/Options → **ReadOnly**.
* **Validation** : emails uniques, formats, etc.

---

## 9) Tests (acceptance)

* **Aucun enfant** : après `after=parent1`, le router saute directement à la décision Parent2.
* **Plusieurs enfants** : la boucle traite chaque enfant et s’arrête uniquement quand `remaining` est vide.
* **Parent2 existant** : la décision Parent2 redirige vers **P2\_EDIT** avec le `parent2id` détecté.
* **Parent2 à créer** : absence de Parent2 déclenche **P2\_CREATE** avec `accountid` pré‑rempli.

---

# PROMPT ULTRA DÉTAILLÉ POUR CODEX

Tu es un assistant de développement qui va **écrire** d’une page Power Pages « Accueil.html » pour implémenter un **router multi‑étapes** de pré‑inscription.

## Contexte technique

* Environnement : **Power Pages** (Portals) → Liquid + HTML + JavaScript (ES6).
* Données : Dataverse Tables `contact`, `account`.
* Distinction des contacts par `new_typedecontact` (valeurs numériques : **Parent=100000001**, **Enfant=100000000** — ajustables via constantes).
* Relations : `contact.parentcustomerid` → `account` (Famille).
* API : **Portals Web API** (`/_api/contacts`, `/_api/opportunities`, …). Toujours encoder `$filter` via `encodeURIComponent`.
* Sécurité : les requêtes Web API doivent fonctionner avec Table Permissions.
* Champs à étape multiple "One-Page"


## Acceptation

* Cas 1 : Famille avec 2+ enfants → passage séquentiel sur chaque enfant (menu déroulant de la liste des enfants lié à la famille), puis Parent2 decision.
* Cas 2 : Famille sans Parent2 → création Parent2 avec `accountid` auto.
* Cas 3 : Famille avec Parent2 existant → modification Parent2.
* Les redirections **n’affichent jamais** un Web Form sans `recordId` attendu.
* Les champs sensibles restent **ReadOnly** conformément à la Form Metadata.

## Contraintes de style/code

* JS clair, commenté, pas de framework externe.
* Pas d’inline CSS superflu (uniquement le loader minimal).
* Noms de variables : `camelCase`.
* **Aucune** dépendance à des librairies (jQuery, etc.).

## À livrer
* Logs `console.log` lisibles pour le debug (prefix `[Pré-inscription]`).
