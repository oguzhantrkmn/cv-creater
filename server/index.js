import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import session from 'express-session'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import jwt from 'jsonwebtoken'
import OpenAI from 'openai'
import multer from 'multer'
import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

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
// Google OAuth: callback tam olarak bu URL olmalı (Google Console'da birebir aynısı)
const SERVER_URL = (process.env.SERVER_URL || 'http://localhost:3001').replace(/\/+$/, '')

// PayTR (https://dev.paytr.com)
const PAYTR_MERCHANT_ID = (process.env.PAYTR_MERCHANT_ID || '').trim()
const PAYTR_MERCHANT_KEY = (process.env.PAYTR_MERCHANT_KEY || '').trim()
const PAYTR_MERCHANT_SALT = (process.env.PAYTR_MERCHANT_SALT || '').trim()
const PAYTR_TEST_MODE =
  process.env.PAYTR_TEST_MODE === '1' || process.env.PAYTR_TEST_MODE === 'true' ? '1' : '0'
const paytrConfigured = !!(PAYTR_MERCHANT_ID && PAYTR_MERCHANT_KEY && PAYTR_MERCHANT_SALT)

if (!paytrConfigured) {
  console.warn('⚠️ PayTR yapılandırılmadı. PDF ücretli indirme çalışmayacak (PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT)')
} else {
  console.log(`✅ PayTR hazır (test_mode=${PAYTR_TEST_MODE})`)
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.length) {
    return xf.split(',')[0].trim().replace('::ffff:', '').slice(0, 39)
  }
  const raw = req.socket?.remoteAddress || '127.0.0.1'
  return String(raw).replace('::ffff:', '').slice(0, 39)
}

// CORS — CLIENT_URL Render'da tam olarak tarayıcıdaki adresle aynı olmalı (https, www, netlify önizleme)
function normalizeOrigin(url) {
  if (!url) return ''
  return String(url).trim().replace(/\/+$/, '')
}
const extraCors = (process.env.CORS_EXTRA_ORIGINS || '')
  .split(',')
  .map((s) => normalizeOrigin(s))
  .filter(Boolean)
const allowedOrigins = new Set(
  [
    normalizeOrigin(CLIENT_URL),
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://cv-creater.online',
    'https://www.cv-creater.online',
    'http://cv-creater.online',
    'http://www.cv-creater.online',
    ...extraCors,
  ].filter(Boolean)
)

function isAllowedOrigin(origin) {
  if (!origin) return true
  const o = normalizeOrigin(origin)
  if (allowedOrigins.has(o)) return true
  // Netlify ana site ve önizleme adresleri (branch deploy)
  if (/^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(o)) return true
  if (/^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/i.test(o)) return true
  return false
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true)
      console.warn(`CORS reddedildi: "${origin}" — Render'da CLIENT_URL veya CORS_EXTRA_ORIGINS ile ekleyin`)
      callback(null, false)
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
)
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS paytr_orders (
        merchant_oid VARCHAR(64) PRIMARY KEY,
        plan_type VARCHAR(32) NOT NULL,
        user_id INT NULL,
        amount_kurus INT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        unlock_template_id VARCHAR(32) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    try {
      await pool.query('ALTER TABLE paytr_orders ADD COLUMN unlock_template_id VARCHAR(32) NULL')
    } catch (alterErr) {
      if (alterErr.code !== 'ER_DUP_FIELDNAME') {
        console.warn('paytr_orders unlock_template_id migration:', alterErr.message)
      }
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS paytr_callback_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        merchant_oid VARCHAR(64) NULL,
        status VARCHAR(20) NULL,
        total_amount INT NULL,
        hash_ok TINYINT(1) NOT NULL DEFAULT 0,
        payload JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        callbackURL: `${SERVER_URL}/auth/google/callback`,
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
            const shouldBeAdmin = email && process.env.ADMIN_EMAIL === email ? 1 : 0
            if (rows[0].is_admin !== shouldBeAdmin) {
              await pool.query('UPDATE users SET is_admin = ? WHERE id = ?', [shouldBeAdmin, rows[0].id])
              rows[0].is_admin = shouldBeAdmin
            }
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
  console.log('🔐 Google OAuth callback URL (Google Cloud Console → Authorized redirect URIs):')
  console.log(`   ${SERVER_URL}/auth/google/callback`)
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

// Admin: PayTR callback logları (yalnızca admin)
app.get('/api/admin/paytr-logs', authMiddleware, async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin yetkisi gerekiyor' })
    }
    if (!pool) {
      return res.status(503).json({ error: 'Veritabanı yok' })
    }
    const [rows] = await pool.query(
      `SELECT id, merchant_oid, status, total_amount, hash_ok, created_at
       FROM paytr_callback_logs
       ORDER BY id DESC
       LIMIT 50`
    )
    res.json({ logs: rows })
  } catch (err) {
    console.error('Admin paytr logs error:', err)
    res.status(500).json({ error: 'PayTR logları getirilemedi' })
  }
})

/** PDF fiyatına eklenecek şablon ek ücreti (kuruş); tüm şablonlar 50 TL */
const PAYTR_TEMPLATE_SURCHARGE_KURUS = {
  classic: 5000,
  minimal: 5000,
  modern: 5000,
  creative: 5000,
  compact: 5000,
}
const PAYTR_TEMPLATE_LABEL = {
  classic: 'Klasik',
  minimal: 'Minimal',
  modern: 'Modern',
  creative: 'Yaratıcı',
  compact: 'Kompakt',
}
const PAYTR_ALLOWED_TEMPLATE_IDS = new Set(['classic', 'minimal', 'modern', 'creative', 'compact'])

function normalizePaytrTemplateId(raw) {
  const tid = typeof raw === 'string' ? raw.trim() : ''
  if (PAYTR_ALLOWED_TEMPLATE_IDS.has(tid)) return tid
  return 'classic'
}

function templateSurchargeKurus(templateId) {
  return PAYTR_TEMPLATE_SURCHARGE_KURUS[templateId] ?? 5000
}

// PayTR: ödeme başlat (iFrame token)
app.post('/api/paytr/init', async (req, res) => {
  try {
    if (!paytrConfigured) {
      return res.status(503).json({ error: 'Ödeme sistemi yapılandırılmamış. PAYTR_MERCHANT_ID, KEY ve SALT ekleyin.' })
    }
    if (!pool) {
      return res.status(503).json({ error: 'Veritabanı bağlantısı gerekli.' })
    }

    const { plan, email: bodyEmail, userName, templateId: bodyTemplateId } = req.body
    if (!['save_download', 'download_only', 'template_unlock'].includes(plan)) {
      return res.status(400).json({ error: 'Geçersiz plan' })
    }

    let userId = null
    let email = typeof bodyEmail === 'string' ? bodyEmail.trim() : ''
    let name = typeof userName === 'string' ? userName.trim() : 'Müşteri'
    let orderTemplateId = null

    if (plan === 'save_download') {
      const authHeader = req.headers.authorization || ''
      const tok = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
      if (!tok) return res.status(401).json({ error: 'Kaydet ve indir için giriş gerekli' })
      try {
        const payload = jwt.verify(tok, JWT_SECRET)
        userId = payload.id
        if (payload.email) email = String(payload.email).trim()
        if (payload.name) name = String(payload.name).trim().slice(0, 60)
      } catch {
        return res.status(401).json({ error: 'Oturum geçersiz' })
      }
      orderTemplateId = normalizePaytrTemplateId(bodyTemplateId)
    } else if (plan === 'download_only') {
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Sadece indir için geçerli bir e-posta gerekli (formdaki E-posta alanı).' })
      }
      orderTemplateId = normalizePaytrTemplateId(bodyTemplateId)
    } else if (plan === 'template_unlock') {
      const tid = typeof bodyTemplateId === 'string' ? bodyTemplateId.trim() : ''
      if (!PAYTR_ALLOWED_TEMPLATE_IDS.has(tid)) {
        return res.status(400).json({ error: 'Geçersiz şablon' })
      }
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Premium şablon için geçerli bir e-posta gerekli (formdaki E-posta alanı).' })
      }
      orderTemplateId = tid
    }

    if (!email || email.length > 100) {
      return res.status(400).json({ error: 'Geçerli e-posta gerekli' })
    }

    let amount
    let basket
    if (plan === 'save_download') {
      const extra = templateSurchargeKurus(orderTemplateId)
      amount = 10000 + extra
      basket = [['CV Kaydet ve PDF İndir', '100.00', 1]]
      {
        const lab = PAYTR_TEMPLATE_LABEL[orderTemplateId] || orderTemplateId
        basket.push([`Şablon: ${lab}`, (extra / 100).toFixed(2), 1])
      }
    } else if (plan === 'download_only') {
      const extra = templateSurchargeKurus(orderTemplateId)
      amount = 5000 + extra
      basket = [['CV PDF İndir', '50.00', 1]]
      {
        const lab = PAYTR_TEMPLATE_LABEL[orderTemplateId] || orderTemplateId
        basket.push([`Şablon: ${lab}`, (extra / 100).toFixed(2), 1])
      }
    } else {
      amount = templateSurchargeKurus(orderTemplateId)
      const label = PAYTR_TEMPLATE_LABEL[orderTemplateId] || orderTemplateId
      const tl = (amount / 100).toFixed(2)
      basket = [[`CV Şablon: ${label}`, tl, 1]]
    }
    const user_basket = Buffer.from(JSON.stringify(basket), 'utf8').toString('base64')

    const merchant_oid = `CV${Date.now()}${crypto.randomBytes(4).toString('hex')}`.slice(0, 64)
    const user_ip = getClientIp(req)
    const payment_amount = String(amount)
    const no_installment = '1'
    const max_installment = '0'
    const currency = 'TL'

    const hashStr =
      PAYTR_MERCHANT_ID +
      user_ip +
      merchant_oid +
      email +
      payment_amount +
      user_basket +
      no_installment +
      max_installment +
      currency +
      PAYTR_TEST_MODE
    const paytr_token = crypto
      .createHmac('sha256', PAYTR_MERCHANT_KEY)
      .update(hashStr + PAYTR_MERCHANT_SALT)
      .digest('base64')

    const merchant_ok_url = `${CLIENT_URL.replace(/\/+$/, '')}?payment=paytr_ok`
    const merchant_fail_url = `${CLIENT_URL.replace(/\/+$/, '')}?payment=paytr_fail`

    const params = new URLSearchParams({
      merchant_id: PAYTR_MERCHANT_ID,
      user_ip,
      merchant_oid,
      email,
      payment_amount,
      paytr_token,
      user_basket,
      debug_on: '1',
      no_installment,
      max_installment,
      user_name: name.slice(0, 60),
      user_address: 'Türkiye',
      user_phone: '05000000000',
      merchant_ok_url,
      merchant_fail_url,
      timeout_limit: '30',
      currency,
      test_mode: PAYTR_TEST_MODE,
    })

    const payRes = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const result = await payRes.json()
    if (result.status !== 'success') {
      console.error('PayTR get-token:', result)
      return res.status(400).json({ error: result.reason || 'PayTR token alınamadı' })
    }

    await pool.query(
      `INSERT INTO paytr_orders (merchant_oid, plan_type, user_id, amount_kurus, status, unlock_template_id) VALUES (?, ?, ?, ?, 'pending', ?)`,
      [merchant_oid, plan, userId, amount, orderTemplateId]
    )

    res.json({ token: result.token, merchant_oid })
  } catch (error) {
    console.error('PayTR init error:', error)
    res.status(500).json({ error: error.message })
  }
})

// PayTR bildirim URL (mağaza panelinde: https://SUNUCU/api/paytr/callback)
// GET: Tarayıcıdan kontrol için — gerçek bildirim PayTR'nin POST isteğidir
app.get('/api/paytr/callback', (req, res) => {
  res
    .type('text/plain; charset=utf-8')
    .send(
      'CV Creater — PayTR bildirim adresi aktif.\n' +
        'PayTR bu adrese POST ile ödeme sonucunu gönderir; tarayıcıdan GET ile test normalde boş görünür (hata değil).\n' +
        'Panelde Bildirim URL tam olarak: ' +
        SERVER_URL +
        '/api/paytr/callback'
    )
})

app.post('/api/paytr/callback', express.urlencoded({ extended: false, limit: '64kb' }), async (req, res) => {
  if (!paytrConfigured || !pool) {
    return res.status(200).send('OK')
  }
  const post = req.body
  const merchant_oid = post.merchant_oid
  const status = post.status
  const total_amount = post.total_amount
  const hash = post.hash

  if (!merchant_oid || !status || !hash || total_amount === undefined) {
    console.error('PayTR callback: eksik alan', Object.keys(post))
    return res.status(200).send('OK')
  }

  const calcHash = crypto
    .createHmac('sha256', PAYTR_MERCHANT_KEY)
    .update(merchant_oid + PAYTR_MERCHANT_SALT + status + total_amount)
    .digest('base64')
  const hashOk = calcHash === hash

  try {
    await pool.query(
      `INSERT INTO paytr_callback_logs (merchant_oid, status, total_amount, hash_ok, payload)
       VALUES (?, ?, ?, ?, ?)`,
      [
        merchant_oid || null,
        status || null,
        Number(total_amount) || null,
        hashOk ? 1 : 0,
        JSON.stringify(post || {}),
      ]
    )
  } catch (e) {
    console.error('PayTR callback log insert error:', e)
  }

  if (!hashOk) {
    console.error('PayTR callback: hash uyuşmazlığı')
    return res.status(200).send('HASH_FAIL')
  }

  try {
    if (status === 'success') {
      await pool.query(
        `UPDATE paytr_orders SET status = 'paid' WHERE merchant_oid = ? AND status = 'pending'`,
        [merchant_oid]
      )
    } else if (status === 'failed') {
      await pool.query(`UPDATE paytr_orders SET status = 'failed' WHERE merchant_oid = ?`, [merchant_oid])
    }
  } catch (e) {
    console.error('PayTR callback DB:', e)
  }
  res.send('OK')
})

// PayTR ödeme doğrulama (istemci yönlendirme sonrası polling)
app.get('/api/paytr/verify/:merchantOid', async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ paid: false, error: 'Veritabanı yok' })
    const { merchantOid } = req.params
    const [rows] = await pool.query(
      'SELECT plan_type, status, unlock_template_id FROM paytr_orders WHERE merchant_oid = ?',
      [merchantOid]
    )
    if (!rows.length) return res.json({ paid: false })
    const row = rows[0]
    res.json({
      paid: row.status === 'paid',
      plan: row.plan_type,
      unlockTemplateId: row.unlock_template_id || null,
    })
  } catch (error) {
    console.error('PayTR verify error:', error)
    res.status(500).json({ paid: false, error: error.message })
  }
})

// ===== AI ENDPOINTLERİ =====

// Multer - bellekte tut (diske yazma)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Sadece PDF veya Word (.docx) dosyası yükleyebilirsiniz.'))
  }
})

// AI durum kontrolü
app.get('/api/ai/status', (req, res) => {
  res.json({ available: !!openai })
})

// AI: CV Dosyası Yükle ve Parse Et
app.post('/api/ai/parse-cv', upload.single('cv'), async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'AI yapılandırılmamış. Lütfen OPENAI_API_KEY ekleyin.' })
  if (!req.file) return res.status(400).json({ error: 'Dosya yüklenmedi.' })

  try {
    // Dosya içeriğini metin olarak çıkar
    let text = ''
    if (req.file.mimetype === 'application/pdf') {
      try {
        const uint8 = new Uint8Array(req.file.buffer)
        const loadingTask = pdfjsLib.getDocument({ data: uint8, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true })
        const pdf = await loadingTask.promise
        const pages = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          pages.push(content.items.map(item => item.str).join(' '))
        }
        text = pages.join('\n')
        console.log(`PDF okundu: ${pdf.numPages} sayfa, ${text.length} karakter`)
      } catch (pdfErr) {
        console.error('PDF parse error:', pdfErr.message)
        return res.status(400).json({ error: 'PDF okunamadı. Dosyanızı Word (.docx) formatında deneyin.' })
      }
    } else {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer })
      text = result.value
    }

    if (!text || text.trim().length < 50) {
      return res.status(400).json({ error: 'CV dosyasından metin okunamadı. Lütfen metin tabanlı bir PDF veya Word dosyası kullanın.' })
    }

    // Metni 6000 karakterle sınırla (token tasarrufu)
    const truncated = text.slice(0, 6000)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Aşağıdaki CV metnini analiz et ve JSON formatında yapılandırılmış veri döndür.

CV METNİ:
${truncated}

Şu JSON yapısını döndür (Türkçe veya İngilizce CV olabilir, tüm alanları doldurmaya çalış, bulamazsan boş bırak):
{
  "name": "Ad Soyad",
  "title": "Ünvan / Pozisyon",
  "email": "email@ornek.com",
  "phone": "telefon numarası",
  "city": "Şehir",
  "district": "İlçe (varsa)",
  "birthDay": "gün sayısı veya boş",
  "birthMonth": "ay adı Türkçe (Ocak, Şubat vb.) veya boş",
  "birthYear": "yıl veya boş",
  "websiteUrl": "website veya LinkedIn URL",
  "objective": "Kariyer hedefi veya özet paragrafı",
  "skills": ["beceri1", "beceri2"],
  "languages": [{"name": "Dil", "level": "Seviye"}],
  "experience": [
    {
      "company": "Şirket Adı",
      "position": "Pozisyon",
      "startDate": "Başlangıç tarihi",
      "endDate": "Bitiş tarihi veya Devam Ediyor",
      "details": ["madde1", "madde2"]
    }
  ],
  "education": [
    {
      "school": "Okul Adı",
      "department": "Bölüm",
      "degree": "Derece (Lisans, Yüksek Lisans vb.)",
      "startDate": "Başlangıç",
      "endDate": "Bitiş veya Devam Ediyor",
      "gpa": "Not ortalaması (varsa)"
    }
  ],
  "certificates": [{"name": "Sertifika adı", "issuer": "Veren kurum", "date": "Tarih"}],
  "references": [{"name": "Ad Soyad", "title": "Ünvan", "company": "Şirket", "phone": "", "email": ""}]
}

Sadece geçerli JSON döndür, başka açıklama ekleme.`
      }],
      max_tokens: 2000,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })

    const raw = completion.choices[0].message.content.trim()
    const parsed = JSON.parse(raw)
    res.json({ data: parsed })

  } catch (err) {
    console.error('CV parse error:', err)
    const msg = err.status === 429
      ? 'OpenAI kota aşıldı. Lütfen platform.openai.com adresinden hesabınıza kredi ekleyin.'
      : err.status === 401 ? 'OpenAI API Key geçersiz.' : err.message
    res.status(err.status || 500).json({ error: msg })
  }
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
  if (paytrConfigured) {
    console.log(`🔗 PayTR bildirim URL (panelde kaydedin): ${SERVER_URL}/api/paytr/callback`)
  }
})

