// ============================================
// CIN'CARE BEAUTY — Configuration Firebase
// ============================================
// Remplace ces valeurs par celles de TON projet Firebase
// (Console Firebase > Paramètres du projet > Général > Vos applications)



  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAFZArxf2evUjdMveN40_3A9S_Jicyz8Js",
    authDomain: "melomix-f8bba.firebaseapp.com",
    projectId: "melomix-f8bba",
    storageBucket: "melomix-f8bba.firebasestorage.app",
    messagingSenderId: "405004244678",
    appId: "1:405004244678:web:2d0df4a5e8e2f44b05a9c7",
    measurementId: "G-6M5HQYVT34"
  };

// Initialisation (compat SDK — chargé via script tags dans le HTML)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ============================================
// Structure Firestore utilisée par la plateforme
// ============================================
// Collection "produits" — chaque document :
// {
//   nom: string,
//   description: string,
//   prix: number,           // en HTG
//   prixUSD: number,        // optionnel
//   imageURL: string,       // lien direct vers image (postimages, imgur, etc.)
//   categorie: string,      // ex: "Soin visage", "Cheveux", "Parfum"
//   stock: number,
//   badge: string,          // "Nouveau" | "Populaire" | "Promo" | ""
//   actif: boolean,         // affiché ou non sur la boutique
//   ordre: number,          // position d'affichage
//   createdAt: timestamp
// }
//
// Collection "commandes" — chaque document :
// {
//   numero: string,          // ex: "CC-000123"
//   client: { nom, telephone, adresse, note },
//   items: [ { produitId, nom, prix, qty, imageURL } ],
//   sousTotal: number,
//   total: number,
//   statut: string,          // "en_attente" | "confirmee" | "preparation" | "livree" | "annulee"
//   createdAt: timestamp,
//   updatedAt: timestamp
// }
//
// Collection "config" — document unique "boutique" :
// {
//   whatsapp: string,        // numéro international sans + ex: "50948599749"
//   nomBoutique, slogan, banniereMessage, tauxChange
// }
