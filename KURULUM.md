# 🚀 Hızlı Kurulum Rehberi

## Backend Server'ı Başlatma

### 1. Server Klasörüne Git
```bash
cd server
```

### 2. .env Dosyasını Kontrol Et
`server/.env` dosyasında şunlar olmalı:
```env
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
CLIENT_URL=http://localhost:5173
PORT=3001
```

### 3. Stripe API Key'lerini Al
1. [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) → Test API keys
2. Secret Key'i kopyala ve `.env` dosyasına yapıştır

### 4. Server'ı Başlat
```bash
npm run dev
```

**Başarılı olursa şunu göreceksin:**
```
🚀 Server running on port 3001
💳 Stripe mode: TEST
```

### 5. Frontend'i Başlat (Yeni Terminal)
```bash
npm run dev
```

## 🔍 Sorun Giderme

### "Backend sunucusuna bağlanılamadı" Hatası

**Çözüm 1:** Backend çalışıyor mu kontrol et
- Terminal'de `cd server` → `npm run dev` çalıştır
- `http://localhost:3001/api/health` adresini tarayıcıda aç
- `{"status":"ok"}` görüyorsan backend çalışıyor ✅

**Çözüm 2:** .env dosyasını kontrol et
- `server/.env` dosyası var mı?
- `STRIPE_SECRET_KEY` dolu mu?
- Key `sk_test_` ile başlıyor mu?

**Çözüm 3:** Port çakışması
- 3001 portu kullanılıyor mu?
- Başka bir uygulama çalışıyor mu?

## ✅ Test Etme

1. Backend çalışıyor mu?
   ```bash
   curl http://localhost:3001/api/health
   ```
   Cevap: `{"status":"ok","message":"Server çalışıyor!"}`

2. Frontend çalışıyor mu?
   - Tarayıcıda `http://localhost:5173` açılmalı

3. Ödeme testi
   - CV oluştur → "PDF İndir (50 TL)" tıkla
   - Stripe test kartı: `4242 4242 4242 4242`
   - Tarih: `12/25`, CVC: `123`

