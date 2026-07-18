# Cin'care Beauty — PWA E-commerce

Boutique en ligne complète : catalogue produits, panier, favoris, commande finalisée sur WhatsApp, points de fidélité gamifiés (roue Glow), et espace admin pour gérer produits + commandes.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` + `app.js` | Boutique client (PWA) |
| `admin.html` + `admin.js` | Espace de gestion (produits + commandes) |
| `firebase-config.js` | Config Firebase partagée par les deux |
| `manifest.json` + `sw.js` | PWA (installable, cache offline des pages) |

## Installation — 5 étapes

### 1. Créer le projet Firebase
Va sur [console.firebase.google.com](https://console.firebase.google.com) → **Créer un projet**.

### 2. Activer Firestore
Dans le menu Firebase → **Firestore Database** → **Créer une base de données** → mode production.

### 3. Activer Authentication (pour l'admin)
Menu → **Authentication** → **Sign-in method** → active **Email/Mot de passe**.
Puis onglet **Users** → **Ajouter un utilisateur** → crée ton compte admin (ex: `admin@cincare.com`).

### 4. Récupérer la config
Paramètres du projet (⚙️) → **Vos applications** → **Web** (`</>`) → copie l'objet `firebaseConfig`.
Colle-le dans `firebase-config.js` à la place des valeurs `TON_...`.

### 5. Configurer WhatsApp et les règles Firestore

Dans Firestore, crée un document `config/boutique` :
```
whatsapp: "50948599749"   (ton numéro, format international sans le +)
nomBoutique: "Cin'care Beauty"
```

**Règles Firestore** (onglet Règles) — à adapter :
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /produits/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /commandes/{doc} {
      allow create: if true;
      allow read, update: if request.auth != null;
    }
    match /config/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Ajouter des produits

Deux façons :
- **Via l'admin** (`admin.html`) : connecte-toi, onglet Produits → bouton **+**, colle un lien d'image (imgur, postimages, Google Drive en lien direct, etc.)
- **Manuellement dans Firestore** : collection `produits`, champs `nom`, `prix`, `imageURL`, `categorie`, `stock`, `actif: true`, `ordre`.

## Hébergement

Le plus simple : **Firebase Hosting** (gratuit) ou dépose les fichiers sur Netlify/Vercel. Pas de build requis — c'est du HTML/CSS/JS pur.

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## Fonctionnalités gamification

- **Points Glow** : 1 point par ~100 HTG dépensés, niveaux (Membre → Silver → Gold → Icon)
- **Roue Glow** : un tour gratuit par jour, gains en points ou réductions (stockée en `localStorage`, donc par appareil)

## Notes techniques

- Panier, favoris, points et historique de commandes sont stockés en `localStorage` (persistant même hors-ligne).
- Les commandes sont écrites dans Firestore ET envoyées via un message WhatsApp pré-rempli — double sécurité si la connexion est instable.
- Le Service Worker met en cache les pages mais **jamais** les appels Firestore (toujours données fraîches).
