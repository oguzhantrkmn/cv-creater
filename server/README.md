# CV Creator - Backend Server

## Kurulum

1. Paketleri yükle:
```bash
cd server
npm install
```

2. `.env` dosyası oluştur:
```env
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLIENT_URL=http://localhost:5173
PORT=3001
```

3. Stripe API Key'lerini al:
   - Test modu için: https://dashboard.stripe.com/test/apikeys
   - Canlı mod için: https://dashboard.stripe.com/apikeys

4. Server'ı başlat:
```bash
npm run dev
```

## API Endpoints

- `POST /api/create-checkout-session` - Ödeme oturumu oluştur
- `GET /api/check-payment/:sessionId` - Ödeme durumunu kontrol et

