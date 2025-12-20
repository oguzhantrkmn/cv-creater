# 🔑 Stripe API Key Kurulumu

## ⚠️ ÖNEMLİ: Doğru Key Formatı

Stripe Secret Key **MUTLAKA** şu formatta olmalı:
- Test modu: `sk_test_...` ile başlamalı
- Canlı mod: `sk_live_...` ile başlamalı

**YANLIŞ:** `mk_`, `pk_`, veya başka formatlar ❌

## 📝 Adım Adım Kurulum

### 1. Stripe Hesabı Oluştur
1. [Stripe.com](https://stripe.com) → Sign Up
2. Email ile kayıt ol

### 2. Test API Key'lerini Al
1. [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) → Test API keys sekmesi
2. **Secret key** butonuna tıkla (göster butonu)
3. Key'i kopyala (şu formatta olmalı: `sk_test_51...`)

### 3. .env Dosyasını Düzenle
`server/.env` dosyasını aç ve şunu yapıştır:

```env
STRIPE_SECRET_KEY=sk_test_your_actual_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_key_here
CLIENT_URL=http://localhost:5173
PORT=3001
```

**ÖRNEK:**
```env
STRIPE_SECRET_KEY=sk_test_51AbCdEf1234567890GhIjKlMnOpQrStUvWxYz
STRIPE_PUBLISHABLE_KEY=pk_test_51AbCdEf1234567890GhIjKlMnOpQrStUvWxYz
CLIENT_URL=http://localhost:5173
PORT=3001
```

### 4. Server'ı Yeniden Başlat
```bash
cd server
npm run dev
```

**Başarılı olursa göreceksin:**
```
🚀 Server running on port 3001
💳 Stripe mode: TEST
```

## ✅ Test Et

1. Backend çalışıyor mu?
   ```
   http://localhost:3001/api/health
   ```
   Cevap: `{"status":"ok","message":"Server çalışıyor!"}`

2. Ödeme testi
   - CV oluştur → "PDF İndir (50 TL)" tıkla
   - Stripe test kartı: `4242 4242 4242 4242`
   - Tarih: `12/25`, CVC: `123`

## 🆘 Sorun Giderme

**"Invalid API Key" hatası:**
- Key `sk_test_` ile başlıyor mu kontrol et
- Key'de boşluk veya yeni satır var mı kontrol et
- Stripe Dashboard'dan yeni key oluştur

**"401 Unauthorized" hatası:**
- Key doğru mu kontrol et
- Test key kullanıyorsan test modunda olduğundan emin ol

