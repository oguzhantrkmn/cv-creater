# 🚂 Railway ile Backend Deploy Rehberi

## Adım 1: Railway Hesabı Oluştur
1. https://railway.app → "Start a New Project"
2. GitHub hesabınızla giriş yapın

## Adım 2: Yeni Proje Oluştur
1. "New Project" butonuna tıklayın
2. **Seçenek A:** GitHub repo'nuz varsa → "Deploy from GitHub repo" → Repo'yu seçin
3. **Seçenek B:** GitHub repo yoksa → "Empty Project" → Sonra "Add Service" → "GitHub Repo" veya "Empty Service"

## Adım 3: MySQL Veritabanı Ekle
1. Railway projenizde "New" butonuna tıklayın
2. "Database" → "Add MySQL" seçin
3. MySQL servisi oluşturulduktan sonra:
   - "Variables" sekmesine gidin
   - Şu değişkenleri göreceksiniz:
     - `MYSQLHOST`
     - `MYSQLUSER`
     - `MYSQLPASSWORD`
     - `MYSQLDATABASE`
     - `MYSQLPORT`

## Adım 4: Backend Servisini Ayarla
1. Backend servisinizde "Settings" sekmesine gidin
2. **Root Directory:** `server` olarak ayarlayın (eğer repo root'tan deploy ediyorsanız)
3. **Start Command:** `npm start` (zaten package.json'da var)

## Adım 5: Environment Variables Ekle
Backend servisinizde "Variables" sekmesine gidin ve şunları ekleyin:

### Zorunlu Değişkenler:
```
STRIPE_SECRET_KEY=sk_test_... (Stripe Dashboard'dan alın)
STRIPE_PUBLISHABLE_KEY=pk_test_... (Stripe Dashboard'dan alın)
CLIENT_URL=https://cv-creater.online (Netlify URL'iniz)
SERVER_URL=https://your-app.railway.app (Railway URL'iniz - deploy sonrası alacaksınız)
JWT_SECRET=rastgele-güvenli-string-buraya
SESSION_SECRET=rastgele-güvenli-string-buraya
```

### MySQL Değişkenleri (MySQL servisinden kopyalayın):
```
DB_HOST=${{MySQL.MYSQLHOST}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
```

### Google OAuth (Google Cloud Console'dan alın):
```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Opsiyonel:
```
ADMIN_EMAIL=your-email@example.com (Admin olmak istediğiniz email)
```

## Adım 6: Google OAuth Ayarları
1. https://console.cloud.google.com → Yeni proje oluşturun
2. "APIs & Services" → "Credentials"
3. "Create Credentials" → "OAuth client ID"
4. Application type: "Web application"
5. **Authorized redirect URIs** ekleyin:
   - `https://your-app.railway.app/auth/google/callback`
6. Client ID ve Secret'ı kopyalayıp Railway'e ekleyin

## Adım 7: Deploy ve URL Al
1. Railway otomatik olarak deploy edecek
2. Deploy tamamlandıktan sonra "Settings" → "Domains" sekmesine gidin
3. "Generate Domain" butonuna tıklayın
4. Oluşan URL'i kopyalayın (örn: `https://your-app.railway.app`)
5. Bu URL'i `SERVER_URL` olarak Variables'a ekleyin

## Adım 8: Netlify'da Frontend Ayarları
1. Netlify Dashboard → Projeniz → "Site settings" → "Environment variables"
2. Şunu ekleyin:
   - Key: `VITE_API_URL`
   - Value: Railway URL'iniz (örn: `https://your-app.railway.app`)
3. Yeni bir deploy tetikleyin

## ✅ Test
1. Backend çalışıyor mu?
   - `https://your-app.railway.app/api/health` adresini açın
   - `{"status":"ok","message":"Server çalışıyor!"}` görmelisiniz

2. Frontend'den giriş yapmayı deneyin
   - Netlify URL'inizden giriş yapın
   - Google OAuth çalışmalı

## 🆘 Sorun Giderme

**Deploy başarısız oluyor:**
- Root directory `server` olarak ayarlı mı kontrol edin
- Start command `npm start` olmalı
- Logs sekmesinden hata mesajlarını kontrol edin

**MySQL bağlantı hatası:**
- MySQL servisinin Variables'ından değerleri doğru kopyaladığınızdan emin olun
- `${{MySQL.MYSQLHOST}}` formatını kullanın

**Google OAuth hatası:**
- Redirect URI'nin doğru olduğundan emin olun
- Railway URL'inizi Google Console'a eklediğinizden emin olun

