# PaddleForOcean 🌊 (Expo + Firebase)

**Live Demo:** https://paddle4-ocean.vercel.app  


## What it is
A community app for organizing small paddle cleanups: create trips, join with one tap, and track impact.

## Highlights
-  Firestore & Storage rules (capacity-safe, auth-gated writes)
-  Image uploads to Cloud Storage
-  Transactional “Join trip” (no double booking)
-  Static web export (Expo → Vercel)

## Tech
Expo (React Native Web), Firebase (Auth, Firestore, Storage), TypeScript/JS.

## Screens
- Trip list & details
- Create trip (cover photo)
- Join/Leave with capacity lock

## Run locally
```bash
npm i
npx expo start
# web:  press "w"  |  android: "a"  |  ios: "i" (macOS)
