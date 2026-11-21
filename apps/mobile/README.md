# Android app

StockSim's Android client is a Capacitor shell around the responsive web app.

After installing dependencies and building the web app:

```bash
npm install
npm --workspace @stocksim/web run build
npm install -D @capacitor/cli @capacitor/core @capacitor/android
npx cap init StockSim io.protechcode.stocksim --web-dir apps/web/dist
npx cap add android
npx cap sync android
npx cap open android
```

Build the APK from Android Studio. The web app and Android shell share the same Supabase account and API.
