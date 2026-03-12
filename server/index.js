import express from 'express'
import cors from 'cors'
import Stripe from 'stripe'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import session from 'express-session'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import jwt from 'jsonwebtoken'
import OpenAI from 'openai'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// OpenAI başlat (isteğe bağlı)
let openai = null
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  console.log('✅ OpenAI bağlantısı hazır')
} else {
  console.warn('⚠️ OPENAI_API_KEY bulunamadı. AI özellikleri çalışmayacak.')
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret'
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

// Stripe'ı başlat
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ HATA: STRIPE_SECRET_KEY bulunamadı!')
  console.error('📝 Lütfen server/.env dosyasını oluşturun ve STRIPE_SECRET_KEY ekleyin.')
  process.exit(1)
}

// Stripe key formatını kontrol et
const stripeKey = process.env.STRIPE_SECRET_KEY.trim()
if (!stripeKey.startsWith('sk_test_') && !stripeKey.startsWith('sk_live_')) {
  console.error('❌ HATA: Geçersiz Stripe Secret Key formatı!')
  console.error('📝 Stripe Secret Key "sk_test_" veya "sk_live_" ile başlamalı.')
  console.error(`📝 Mevcut key: ${stripeKey.substring(0, 10)}...`)
  console.error('📝 Doğru key\'i almak için: https://dashboard.stripe.com/test/apikeys')
  process.exit(1)
}

const stripe = new Stripe(stripeKey)

// CORS ayarları
const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:5173',
  'https://cv-creater.online',
  'https://www.cv-creater.online',
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error('CORS: İzin verilmeyen origin'))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))
app.use(express.json())

// Session & Passport (Google OAuth için)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-session-secret',
    resave: false,
    saveUninitialized: false,
  })
)
app.use(passport.initialize())
app.use(passport.session())

// MySQL bağlantısı
let pool
try {
  const dbHost = process.env.DB_HOST || process.env.MYSQLHOST
  const dbUser = process.env.DB_USER || process.env.MYSQLUSER
  const dbPassword = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD
  const dbName = process.env.DB_NAME || process.env.MYSQLDATABASE
  const dbPort = process.env.DB_PORT || process.env.MYSQLPORT || 3306

  console.log('🔍 MySQL bağlantı bilgileri:')
  console.log('Host:', dbHost || 'localhost')
  console.log('User:', dbUser || 'root')
  console.log('Database:', dbName || 'cv_creator')
  console.log('Port:', dbPort)

  if (!dbHost) {
    console.warn('⚠️ MySQL host bulunamadı! DB_HOST veya MYSQLHOST environment variable ayarlanmalı.')
  }

  pool = await mysql.createPool({
    host: dbHost || 'localhost',
    user: dbUser || 'root',
    password: dbPassword || '',
    database: dbName || 'cv_creator',
    port: parseInt(dbPort) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 10000, // 10 saniye timeout
  })
  console.log('✅ MySQL bağlantısı başarılı')
} catch (error) {
  console.error('❌ MySQL bağlantı hatası:', error.message)
  console.error('Error code:', error.code)
  console.error('DB_HOST:', process.env.DB_HOST || process.env.MYSQLHOST || 'YOK')
  console.error('DB_USER:', process.env.DB_USER || process.env.MYSQLUSER || 'YOK')
  console.error('DB_NAME:', process.env.DB_NAME || process.env.MYSQLDATABASE || 'YOK')
  console.error('DB_PORT:', process.env.DB_PORT || process.env.MYSQLPORT || 'YOK')
  // Bağlantı hatası olsa bile server'ı çalıştırmaya devam et
  pool = null
}

// Basit tablo oluşturma (jenerik, production için migration kullanın)
if (pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        provider VARCHAR(50) NOT NULL,
        provider_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        is_admin TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_provider (provider, provider_id)
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cvs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255),
        data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS visits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        visited_at DATE NOT NULL,
        count INT NOT NULL DEFAULT 0,
        UNIQUE KEY unique_date (visited_at)
      )
    `)
    console.log('✅ Veritabanı tabloları hazır')
  } catch (error) {
    console.error('❌ Tablo oluşturma hatası:', error.message)
  }
} else {
  console.warn('⚠️ MySQL bağlantısı yok, veritabanı işlemleri çalışmayacak')
}

// Ziyaret sayacı (istatistik için)
app.use(async (req, res, next) => {
  if (pool) {
    try {
      const today = new Date().toISOString().slice(0, 10)
      await pool.query(
        `
        INSERT INTO visits (visited_at, count)
        VALUES (?, 1)
        ON DUPLICATE KEY UPDATE count = count + 1
      `,
        [today]
      )
    } catch (err) {
      console.error('Visit log error:', err.message)
    }
  }
  next()
})

// Passport Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.SERVER_URL || 'http://localhost:3001'}/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value || ''
          const name = profile.displayName || 'Kullanıcı'
          const providerId = profile.id

          const [rows] = await pool.query(
            'SELECT * FROM users WHERE provider = ? AND provider_id = ?',
            ['google', providerId]
          )

          let user
          if (rows.length > 0) {
            user = rows[0]
          } else {
            const isAdmin = email && process.env.ADMIN_EMAIL === email ? 1 : 0
            const [result] = await pool.query(
              'INSERT INTO users (provider, provider_id, name, email, is_admin) VALUES (?, ?, ?, ?, ?)',
              ['google', providerId, name, email, isAdmin]
            )
            user = { id: result.insertId, provider: 'google', provider_id: providerId, name, email, is_admin: isAdmin }
          }

          done(null, user)
        } catch (err) {
          done(err)
        }
      }
    )
  )

  passport.serializeUser((user, done) => {
    done(null, user.id)
  })

  passport.deserializeUser(async (id, done) => {
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id])
      done(null, rows[0] || null)
    } catch (err) {
      done(err)
    }
  })
}

const signToken = (user) =>
  jwt.sign({ id: user.id, name: user.name, email: user.email, is_admin: !!user.is_admin }, JWT_SECRET, {
    expiresIn: '7d',
  })

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Yetkisiz erişim' })

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token' })
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server çalışıyor!' })
})

// Google OAuth giriş
app.get('/auth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Google OAuth yapılandırılmamış. GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET .env dosyasına eklenmeli.' })
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next)
})

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: `${CLIENT_URL}?login=failed`, session: false }),
  (req, res) => {
    const token = signToken(req.user)
    res.redirect(`${CLIENT_URL}?token=${token}`)
  }
)

// Me endpoint (frontend kullanıcı bilgisini almak için)
app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: req.user })
})

// CV kaydetme
app.post('/api/cv', authMiddleware, async (req, res) => {
  try {
    const { title, data } = req.body
    await pool.query(
      'INSERT INTO cvs (user_id, title, data) VALUES (?, ?, ?)',
      [req.user.id, title || 'CV', JSON.stringify(data || {})]
    )
    res.json({ status: 'ok' })
  } catch (err) {
    console.error('CV save error:', err)
    res.status(500).json({ error: 'CV kaydedilemedi' })
  }
})

// Kullanıcının tüm CV'lerini getir (son eklenenler önce, 1 haftadan eski olanları filtrele)
app.get('/api/cv', authMiddleware, async (req, res) => {
  try {
    // 1 haftadan eski CV'leri sil
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    
    await pool.query(
      'DELETE FROM cvs WHERE user_id = ? AND updated_at < ?',
      [req.user.id, oneWeekAgo]
    )

    // Kalan CV'leri getir
    const [rows] = await pool.query(
      'SELECT id, title, data, updated_at FROM cvs WHERE user_id = ? ORDER BY updated_at DESC LIMIT 10',
      [req.user.id]
    )
    res.json({ cvs: rows })
  } catch (err) {
    console.error('CV list error:', err)
    res.status(500).json({ error: 'CV listesi getirilemedi' })
  }
})

// Kullanıcının son CV'sini getir
app.get('/api/cv/latest', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM cvs WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
      [req.user.id]
    )
    if (!rows.length) return res.json({ cv: null })
    const cv = rows[0]
    res.json({ cv: { id: cv.id, title: cv.title, data: cv.data } })
  } catch (err) {
    console.error('CV fetch error:', err)
    res.status(500).json({ error: 'CV getirilemedi' })
  }
})

// CV silme
app.delete('/api/cv/:id', authMiddleware, async (req, res) => {
  try {
    const cvId = parseInt(req.params.id)
    const [result] = await pool.query(
      'DELETE FROM cvs WHERE id = ? AND user_id = ?',
      [cvId, req.user.id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'CV bulunamadı' })
    }
    res.json({ status: 'ok' })
  } catch (err) {
    console.error('CV delete error:', err)
    res.status(500).json({ error: 'CV silinemedi' })
  }
})

// Admin istatistikleri
app.get('/api/admin/stats', authMiddleware, async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin yetkisi gerekiyor' })
    }

    const [[{ totalVisits = 0 } = {}]] = await pool.query(
      'SELECT SUM(count) AS totalVisits FROM visits'
    )

    const today = new Date().toISOString().slice(0, 10)
    const [[{ todayVisits = 0 } = {}]] = await pool.query(
      'SELECT count AS todayVisits FROM visits WHERE visited_at = ?',
      [today]
    )

    const [last7Days] = await pool.query(
      'SELECT visited_at AS date, count FROM visits ORDER BY visited_at DESC LIMIT 7'
    )

    const [[{ userCount = 0 } = {}]] = await pool.query(
      'SELECT COUNT(*) AS userCount FROM users'
    )

    const [[{ cvCount = 0 } = {}]] = await pool.query('SELECT COUNT(*) AS cvCount FROM cvs')

    res.json({
      totalVisits,
      todayVisits,
      last7Days,
      userCount,
      cvCount,
    })
  } catch (err) {
    console.error('Admin stats error:', err)
    res.status(500).json({ error: 'İstatistikler getirilemedi' })
  }
})

// Ödeme oturumu oluştur
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { cvName } = req.body

    // Stripe key kontrolü
    if (!stripeKey.startsWith('sk_test_') && !stripeKey.startsWith('sk_live_')) {
      return res.status(400).json({ 
        error: 'Geçersiz Stripe API Key. Key "sk_test_" veya "sk_live_" ile başlamalı.',
        hint: 'Stripe Dashboard\'dan doğru key\'i alın: https://dashboard.stripe.com/test/apikeys'
      })
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'try',
            product_data: {
              name: 'CV PDF İndirme',
              description: `${cvName || 'CV'} PDF dosyasını indir`,
            },
            unit_amount: 5000, // 50 TL = 5000 kuruş
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${CLIENT_URL}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}?payment=cancel`,
      metadata: {
        cvName: cvName || 'CV',
      },
    })

    res.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error('Stripe error:', error)
    
    // Daha açıklayıcı hata mesajları
    let errorMessage = error.message
    if (error.type === 'StripeAuthenticationError') {
      errorMessage = 'Stripe API Key geçersiz. Lütfen server/.env dosyasındaki STRIPE_SECRET_KEY\'i kontrol edin.'
    } else if (error.type === 'StripeInvalidRequestError') {
      errorMessage = 'Stripe isteği geçersiz: ' + error.message
    }
    
    res.status(500).json({ 
      error: errorMessage,
      type: error.type || 'UnknownError'
    })
  }
})

// Ödeme durumunu kontrol et
app.get('/api/check-payment/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    res.json({
      paid: session.payment_status === 'paid',
      status: session.payment_status,
    })
  } catch (error) {
    console.error('Payment check error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ===== AI ENDPOINTLERİ =====

// AI durum kontrolü
app.get('/api/ai/status', (req, res) => {
  res.json({ available: !!openai })
})

// AI: Kariyer Hedefi Oluştur
app.post('/api/ai/objective', async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'AI yapılandırılmamış. Lütfen OPENAI_API_KEY ekleyin.' })
  const { name, title, experience, education } = req.body
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Türkçe, profesyonel ve ATS uyumlu bir kariyer hedefi/özet yaz. 2-3 cümle, birinci şahıs olmayan biçimde. Güçlü eylem fiilleri kullan.
Ad: ${name || 'Belirtilmemiş'}
Pozisyon: ${title || 'Belirtilmemiş'}
Deneyimler: ${(experience || []).map(e => e.company).filter(Boolean).slice(0, 3).join(', ') || 'Belirtilmemiş'}
Eğitim: ${(education || []).map(e => e.school).filter(Boolean).slice(0, 2).join(', ') || 'Belirtilmemiş'}
Sadece özet metnini ver, başka açıklama ekleme.`
      }],
      max_tokens: 250,
      temperature: 0.7,
    })
    res.json({ text: completion.choices[0].message.content.trim() })
  } catch (err) {
    console.error('AI objective error:', err)
    const msg = err.status === 429
      ? 'OpenAI kota aşıldı. Lütfen platform.openai.com adresinden hesabınıza kredi ekleyin.'
      : err.status === 401 ? 'OpenAI API Key geçersiz.' : err.message
    res.status(err.status || 500).json({ error: msg })
  }
})

// AI: İş Deneyimi Maddesini İyileştir
app.post('/api/ai/improve-bullet', async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'AI yapılandırılmamış. Lütfen OPENAI_API_KEY ekleyin.' })
  const { bullet, position } = req.body
  if (!bullet) return res.status(400).json({ error: 'Madde metni gerekli' })
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Aşağıdaki iş deneyimi maddesini daha etkileyici ve ATS uyumlu hale getir. Güçlü eylem fiili ile başlat, mümkünse ölçülebilir sonuç ekle. Türkçe yaz. Sadece düzenlenmiş tek cümleyi ver.
Pozisyon: ${position || 'Belirtilmemiş'}
Madde: "${bullet}"`
      }],
      max_tokens: 120,
      temperature: 0.7,
    })
    res.json({ text: completion.choices[0].message.content.trim().replace(/^["']|["']$/g, '') })
  } catch (err) {
    console.error('AI improve error:', err)
    const msg = err.status === 429
      ? 'OpenAI kota aşıldı. Lütfen platform.openai.com adresinden hesabınıza kredi ekleyin.'
      : err.status === 401 ? 'OpenAI API Key geçersiz.' : err.message
    res.status(err.status || 500).json({ error: msg })
  }
})

// AI: Pozisyona Göre Beceri Öner
app.post('/api/ai/suggest-skills', async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'AI yapılandırılmamış. Lütfen OPENAI_API_KEY ekleyin.' })
  const { title, existing } = req.body
  if (!title) return res.status(400).json({ error: 'Pozisyon başlığı gerekli' })
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `"${title}" pozisyonu için en önemli 8-10 teknik beceriyi Türkçe ve/veya İngilizce olarak listele.${existing?.length ? ` Şunları hariç tut: ${existing.join(', ')}` : ''} Sadece virgülle ayrılmış beceri isimlerini ver, numara veya açıklama ekleme.`
      }],
      max_tokens: 150,
      temperature: 0.5,
    })
    const skills = completion.choices[0].message.content
      .split(',')
      .map(s => s.trim().replace(/^\d+\.\s*/, ''))
      .filter(s => s.length > 0 && s.length < 40)
    res.json({ skills })
  } catch (err) {
    console.error('AI skills error:', err)
    const msg = err.status === 429
      ? 'OpenAI kota aşıldı. Lütfen platform.openai.com adresinden hesabınıza kredi ekleyin.'
      : err.status === 401 ? 'OpenAI API Key geçersiz.' : err.message
    res.status(err.status || 500).json({ error: msg })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`💳 Stripe mode: ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_test') ? 'TEST' : 'LIVE'}`)
})

