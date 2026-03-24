import { useMemo, useRef, useState, useEffect, useCallback, forwardRef } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import './App.css'
import turkeyLocationsData from './data/turkey-locations.json'

// Backend API URL
const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.MODE === 'production' 
    ? 'https://your-backend-url.herokuapp.com' // Backend URL'inizi buraya yazın
    : 'http://localhost:3001')

// Türkiye illeri ve ilçeleri - JSON dosyasından yükleniyor
const turkeyLocations = turkeyLocationsData

// Türkiye 81 ili (il seçiminde eksiksiz liste)
const turkeyProvinces = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin', 'Aydın', 'Balıkesir',
  'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli',
  'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkâri',
  'Hatay', 'Isparta', 'Mersin', 'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir',
  'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş', 'Nevşehir',
  'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Tekirdağ', 'Tokat',
  'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman',
  'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye',
  'Düzce'
]

const normalizeTr = (s) => (s || '').toLocaleLowerCase('tr-TR').trim()

// Aylar
const months = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
]

// Yıllar (1950-2030)
const years = Array.from({ length: 81 }, (_, i) => 2030 - i)

// Meslek kategorilerine göre beceriler
const skillCategories = {
  'Yazılım Geliştirici': [
    'JavaScript', 'TypeScript', 'React', 'Vue.js', 'Angular', 'Node.js', 'Python',
    'Java', 'C#', 'PHP', 'SQL', 'MongoDB', 'Git', 'Docker', 'AWS', 'REST API',
    'GraphQL', 'HTML/CSS', 'Tailwind CSS', 'Next.js', 'Express.js', 'PostgreSQL'
  ],
  'Tasarımcı': [
    'Figma', 'Adobe Photoshop', 'Adobe Illustrator', 'Adobe XD', 'Sketch',
    'UI/UX Design', 'Wireframing', 'Prototyping', 'Typography', 'Color Theory',
    'Design Systems', 'User Research', 'Interaction Design', 'Motion Design',
    'Brand Design', 'InVision', 'Zeplin', 'Responsive Design'
  ],
  'Pazarlama / Dijital': [
    'Google Analytics', 'Google Ads', 'Facebook Ads', 'SEO', 'SEM', 'Content Marketing',
    'Email Marketing', 'Social Media Marketing', 'CRM', 'HubSpot', 'Mailchimp',
    'A/B Testing', 'Conversion Optimization', 'Copywriting', 'Market Research',
    'Brand Management', 'Influencer Marketing', 'Video Marketing'
  ],
  'İnsan Kaynakları': [
    'İşe Alım', 'Mülakat Teknikleri', 'Performans Yönetimi', 'Eğitim ve Gelişim',
    'Bordro Yönetimi', 'Çalışan İlişkileri', 'Yetenek Yönetimi', 'İK Yazılımları',
    'Özlük İşleri', 'İş Hukuku', 'Ücret Yönetimi', 'Organizasyonel Gelişim'
  ],
  'Finans / Muhasebe': [
    'Excel İleri Seviye', 'Finansal Analiz', 'Bütçe Yönetimi', 'SAP', 'Logo',
    'Muhasebe', 'Vergi Mevzuatı', 'Finansal Raporlama', 'ERP Sistemleri',
    'Maliyet Analizi', 'Nakit Akış Yönetimi', 'Denetim', 'IFRS', 'Risk Yönetimi'
  ],
  'Proje Yönetimi': [
    'Agile', 'Scrum', 'Kanban', 'Jira', 'Trello', 'Asana', 'MS Project',
    'Risk Yönetimi', 'Bütçe Planlama', 'Stakeholder Yönetimi', 'PMP',
    'Waterfall', 'Sprint Planning', 'Retrospective', 'Gantt Chart'
  ],
  'Genel Yetkinlikler': [
    'Microsoft Office', 'İletişim Becerileri', 'Problem Çözme', 'Takım Çalışması',
    'Liderlik', 'Zaman Yönetimi', 'Sunum Becerileri', 'Analitik Düşünme',
    'Karar Verme', 'Müşteri İlişkileri', 'Organizasyon', 'Yaratıcılık',
    'Adaptasyon', 'Stres Yönetimi', 'Networking'
  ]
}

// Dil seçenekleri
const languageOptions = [
  'İngilizce', 'Almanca', 'Fransızca', 'İspanyolca', 'İtalyanca', 'Rusça',
  'Çince', 'Japonca', 'Korece', 'Arapça', 'Portekizce', 'Hollandaca'
]

const languageLevels = ['Başlangıç', 'Orta', 'İleri', 'Ana Dil']

// Yetkinlik kategorileri
const competencyCategories = {
  'İletişim': ['Yazılı İletişim', 'Sözlü İletişim', 'Sunum', 'Müzakere', 'İkna'],
  'Liderlik': ['Takım Yönetimi', 'Motivasyon', 'Delegasyon', 'Mentorluk', 'Karar Alma'],
  'Analitik': ['Veri Analizi', 'Problem Çözme', 'Kritik Düşünme', 'Araştırma', 'Stratejik Planlama'],
  'Kişisel': ['Zaman Yönetimi', 'Stres Yönetimi', 'Adaptasyon', 'Öğrenme İsteği', 'Yaratıcılık']
}

const defaultData = {
  accent: '#FF6D1F',
  avatar: '',
  avatarShape: 'rounded',
  name: '',
  title: '',
  city: '',
  district: '',
  phone: '',
  email: '',
  birthDay: '',
  birthMonth: '',
  birthYear: '',
  objective: '',
  websiteUrl: '',
  education: [],
  experience: [],
  projects: [],
  activities: [],
  certificates: [],
  skills: [],
  languages: [],
  competencies: [],
  interests: [],
  references: [],
}

// Örnek CV'ler
const exampleCVs = [
  {
    id: 1,
    title: 'Yazılımcı',
    icon: '💻',
    color: '#FF6D1F',
    data: {
      accent: '#FF6D1F',
      avatar: '/avatars/avatar-dev.svg',
      avatarShape: 'rounded',
      name: 'Ahmet Yıldırım',
      title: 'Senior Full Stack Developer',
      city: 'İstanbul',
      district: 'Kadıköy',
      phone: '0 123 456 78 91',
      email: 'ahmet.yildirim@email.com',
      birthDay: '15',
      birthMonth: 'Mart',
      birthYear: '1992',
      objective: '8 yıllık yazılım geliştirme deneyimimle, modern web teknolojileri kullanarak ölçeklenebilir ve kullanıcı dostu uygulamalar geliştiriyorum. Agile metodolojilere hakimim ve takım liderliği konusunda deneyimliyim.',
      education: [
        { id: 1, school: 'İstanbul Teknik Üniversitesi - Bilgisayar Mühendisliği', city: 'İstanbul', district: 'Sarıyer', startDate: '2010', endDate: '2014', ongoing: false, note: 'GPA: 3.45/4.00' },
        { id: 2, school: 'Kadıköy Anadolu Lisesi', city: 'İstanbul', district: 'Kadıköy', startDate: '2006', endDate: '2010', ongoing: false, note: '' }
      ],
      experience: [
        { id: 1, company: 'Senior Full Stack Developer - Teknoloji A.Ş.', city: 'İstanbul', district: 'Şişli', startDate: 'Ocak 2021', endDate: '', ongoing: true, details: ['React ve Node.js ile kurumsal web uygulamaları geliştirdim', '5 kişilik geliştirici ekibine teknik liderlik yaptım', 'Mikroservis mimarisine geçiş projesini yönettim', 'CI/CD pipeline kurarak deployment süresini %60 azalttım'] },
        { id: 2, company: 'Full Stack Developer - StartUp Inc.', city: 'İstanbul', district: 'Beşiktaş', startDate: 'Haziran 2017', endDate: 'Aralık 2020', ongoing: false, details: ['E-ticaret platformunun frontend ve backend geliştirmesini yaptım', 'MongoDB ve PostgreSQL veritabanı tasarımı gerçekleştirdim', 'RESTful API tasarımı ve dokümantasyonu oluşturdum'] },
        { id: 3, company: 'Junior Developer - Yazılım Ltd.', city: 'İstanbul', district: 'Ataşehir', startDate: 'Temmuz 2014', endDate: 'Mayıs 2017', ongoing: false, details: ['PHP ve Laravel ile web uygulamaları geliştirdim', 'MySQL veritabanı optimizasyonu yaptım'] }
      ],
      projects: [
        { id: 1, name: 'E-Ticaret Platformu', startDate: 'Ocak 2023', endDate: 'Haziran 2023', ongoing: false, details: ['Next.js, TypeScript, Prisma kullanarak full-stack e-ticaret çözümü', 'Stripe entegrasyonu ve gerçek zamanlı stok takibi'] },
        { id: 2, name: 'Task Management App', startDate: 'Mart 2022', endDate: 'Mayıs 2022', ongoing: false, details: ['React Native ile cross-platform mobil uygulama', 'Firebase authentication ve real-time database'] }
      ],
      activities: [
        { id: 1, name: 'Mentor - Kodluyoruz Bootcamp', city: 'İstanbul', district: 'Online', startDate: 'Eylül 2022', endDate: '', ongoing: true, details: ['Yazılım bootcamp öğrencilerine mentorluk yapıyorum'] }
      ],
      certificates: [
        { id: 1, name: 'AWS Certified Solutions Architect', org: 'Amazon Web Services', date: 'Mart 2023' },
        { id: 2, name: 'Meta Front-End Developer Certificate', org: 'Meta (Coursera)', date: 'Ocak 2022' }
      ],
      skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Next.js', 'PostgreSQL', 'MongoDB', 'Docker', 'AWS', 'Git'],
      languages: [{ lang: 'İngilizce', level: 'İleri' }, { lang: 'Almanca', level: 'Orta' }],
      competencies: ['Problem Çözme', 'Takım Yönetimi', 'Analitik Düşünme', 'Mentorluk'],
      interests: ['Açık kaynak projeler', 'Yapay zeka', 'Teknoloji blogları', 'Satranç']
    }
  },
  {
    id: 2,
    title: 'Tasarımcı',
    icon: '🎨',
    color: '#FF6D1F',
    data: {
      accent: '#FF6D1F',
      avatar: '/avatars/avatar-designer.svg',
      avatarShape: 'circle',
      name: 'Elif Kaya',
      title: 'UI/UX Designer',
      city: 'İzmir',
      district: 'Konak',
      phone: '0 123 456 78 91',
      email: 'elif.kaya@design.com',
      birthDay: '22',
      birthMonth: 'Temmuz',
      birthYear: '1995',
      objective: 'Kullanıcı odaklı tasarım anlayışıyla dijital ürünler tasarlıyorum. 5 yıllık deneyimimle mobil ve web arayüzleri konusunda uzmanlaştım. Design thinking metodolojisine hakimim.',
      education: [
        { id: 1, school: 'Dokuz Eylül Üniversitesi - Görsel İletişim Tasarımı', city: 'İzmir', district: 'Konak', startDate: '2013', endDate: '2017', ongoing: false, note: 'Fakülte birincisi' },
      ],
      experience: [
        { id: 1, company: 'Lead UI/UX Designer - Digital Agency', city: 'İzmir', district: 'Bayraklı', startDate: 'Mart 2022', endDate: '', ongoing: true, details: ['Kurumsal müşteriler için UI/UX tasarımları oluşturuyorum', 'Tasarım sistemleri ve component library geliştirdim', 'Junior tasarımcılara mentorluk yapıyorum', 'Kullanıcı araştırmaları ve A/B testleri yönetiyorum'] },
        { id: 2, company: 'UI Designer - Tech Startup', city: 'İstanbul', district: 'Levent', startDate: 'Haziran 2019', endDate: 'Şubat 2022', ongoing: false, details: ['Mobil uygulama arayüzleri tasarladım', 'Figma ile interaktif prototipler oluşturdum', 'Kullanıcı testleri düzenleyip raporladım'] },
        { id: 3, company: 'Graphic Designer - Reklam Ajansı', city: 'İzmir', district: 'Alsancak', startDate: 'Eylül 2017', endDate: 'Mayıs 2019', ongoing: false, details: ['Marka kimlikleri ve logo tasarımları yaptım', 'Sosyal medya görselleri hazırladım'] }
      ],
      projects: [
        { id: 1, name: 'Fintech App Redesign', startDate: 'Eylül 2023', endDate: 'Kasım 2023', ongoing: false, details: ['Bankacılık uygulaması için komple UI yenileme', 'Kullanıcı memnuniyetinde %35 artış sağlandı'] },
        { id: 2, name: 'E-Sağlık Platformu', startDate: 'Ocak 2023', endDate: 'Nisan 2023', ongoing: false, details: ['Online randevu ve telemedicine platformu tasarımı', 'Erişilebilirlik standartlarına uygun tasarım'] }
      ],
      activities: [
        { id: 1, name: 'Konuşmacı - Design Meetup İzmir', city: 'İzmir', district: 'Konak', startDate: 'Ocak 2023', endDate: '', ongoing: true, details: ['UI/UX konularında aylık sunumlar yapıyorum'] }
      ],
      certificates: [
        { id: 1, name: 'Google UX Design Certificate', org: 'Google (Coursera)', date: 'Haziran 2022' },
        { id: 2, name: 'Interaction Design Specialization', org: 'UC San Diego (Coursera)', date: 'Ocak 2021' }
      ],
      skills: ['Figma', 'Adobe XD', 'Adobe Photoshop', 'Adobe Illustrator', 'UI/UX Design', 'Prototyping', 'User Research', 'Design Systems'],
      languages: [{ lang: 'İngilizce', level: 'İleri' }],
      competencies: ['Yaratıcılık', 'Sunum', 'Problem Çözme', 'Kritik Düşünme'],
      interests: ['Tipografi', 'Fotoğrafçılık', 'Sanat galerileri', 'Minimalizm']
    }
  },
  {
    id: 3,
    title: 'Pazarlamacı',
    icon: '📈',
    color: '#FF6D1F',
    data: {
      accent: '#FF6D1F',
      avatar: '/avatars/avatar-marketer.svg',
      avatarShape: 'rounded',
      name: 'Mehmet Demir',
      title: 'Dijital Pazarlama Uzmanı',
      city: 'Ankara',
      district: 'Çankaya',
      phone: '0 123 456 78 91',
      email: 'mehmet.demir@marketing.com',
      birthDay: '08',
      birthMonth: 'Kasım',
      birthYear: '1990',
      objective: '10 yıllık dijital pazarlama deneyimimle markaların online varlığını güçlendiriyorum. SEO, SEM ve sosyal medya stratejileri konusunda uzmanım. Veri odaklı yaklaşımla ROI maksimizasyonu sağlıyorum.',
      education: [
        { id: 1, school: 'Ankara Üniversitesi - İşletme', city: 'Ankara', district: 'Cebeci', startDate: '2008', endDate: '2012', ongoing: false, note: '' },
        { id: 2, school: 'Dijital Pazarlama Yüksek Lisans - Bilkent Üniversitesi', city: 'Ankara', district: 'Bilkent', startDate: '2015', endDate: '2017', ongoing: false, note: '' }
      ],
      experience: [
        { id: 1, company: 'Dijital Pazarlama Müdürü - E-Ticaret A.Ş.', city: 'Ankara', district: 'Çankaya', startDate: 'Şubat 2020', endDate: '', ongoing: true, details: ['Yıllık 5M TL pazarlama bütçesini yönetiyorum', 'Organik trafiği %200 artırdım', '8 kişilik pazarlama ekibine liderlik ediyorum', 'Marketing automation sistemleri kurdum'] },
        { id: 2, company: 'Senior Digital Marketing Specialist - Ajans X', city: 'İstanbul', district: 'Maslak', startDate: 'Mart 2016', endDate: 'Ocak 2020', ongoing: false, details: ['50+ müşteri için dijital kampanyalar yönettim', 'Google Ads ve Facebook Ads hesapları optimize ettim', 'İçerik stratejisi ve SEO çalışmaları yürüttüm'] },
        { id: 3, company: 'Marketing Coordinator - Retail Co.', city: 'Ankara', district: 'Kızılay', startDate: 'Haziran 2012', endDate: 'Şubat 2016', ongoing: false, details: ['Sosyal medya hesaplarını yönettim', 'E-mail marketing kampanyaları hazırladım'] }
      ],
      projects: [
        { id: 1, name: 'Black Friday Kampanyası 2023', startDate: 'Ekim 2023', endDate: 'Aralık 2023', ongoing: false, details: ['360° dijital kampanya yönetimi', 'Önceki yıla göre %150 satış artışı'] },
        { id: 2, name: 'Marka Bilinirliği Projesi', startDate: 'Ocak 2023', endDate: 'Haziran 2023', ongoing: false, details: ['Influencer marketing stratejisi', 'Brand awareness %80 artış'] }
      ],
      activities: [
        { id: 1, name: 'Eğitmen - Dijital Pazarlama Akademisi', city: 'Ankara', district: 'Online', startDate: 'Eylül 2021', endDate: '', ongoing: true, details: ['SEO ve Google Ads eğitimleri veriyorum'] }
      ],
      certificates: [
        { id: 1, name: 'Google Ads Certification', org: 'Google', date: 'Mart 2023' },
        { id: 2, name: 'HubSpot Inbound Marketing', org: 'HubSpot Academy', date: 'Ocak 2023' },
        { id: 3, name: 'Meta Blueprint Certification', org: 'Meta', date: 'Eylül 2022' }
      ],
      skills: ['Google Analytics', 'Google Ads', 'Facebook Ads', 'SEO', 'SEM', 'Content Marketing', 'Email Marketing', 'HubSpot', 'A/B Testing'],
      languages: [{ lang: 'İngilizce', level: 'İleri' }, { lang: 'Almanca', level: 'Başlangıç' }],
      competencies: ['Stratejik Planlama', 'Veri Analizi', 'Liderlik', 'İkna'],
      interests: ['Girişimcilik', 'Podcast', 'Yatırım', 'Koşu']
    }
  }
]

function App() {
  const [cvData, setCvData] = useState(defaultData)
  const [mode, setMode] = useState('edit')
  const [isExampleMode, setIsExampleMode] = useState(false)
  const [hasPaid, setHasPaid] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [activeSkillCategory, setActiveSkillCategory] = useState('')
  const [activeCompetencyCategory, setActiveCompetencyCategory] = useState('')
  const [customSkill, setCustomSkill] = useState('')
  const [customCompetency, setCustomCompetency] = useState('')
  const [customLanguage, setCustomLanguage] = useState('')
  const [showCropModal, setShowCropModal] = useState(false)
  const [imageToCrop, setImageToCrop] = useState(null)
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [imageScale, setImageScale] = useState(1)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState(null)
  const cropContainerRef = useRef(null)
  const cropImageRef = useRef(null)
  const cvRef = useRef(null)
  const fileInputRef = useRef(null)
  const profilePopoverRef = useRef(null)
  const userPillRef = useRef(null)
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [showLogin, setShowLogin] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [userCvs, setUserCvs] = useState([])
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadMessage, setDownloadMessage] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [template, setTemplate] = useState('classic')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [showAtsPanel, setShowAtsPanel] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true')
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [aiAvailable, setAiAvailable] = useState(false)
  const [aiLoading, setAiLoading] = useState('')
  const [toast, setToast] = useState(null)
  const [cvParseLoading, setCvParseLoading] = useState(false)
  const cvUploadRef = useRef(null)

  // PDF dosya adı
  const pdfFileName = useMemo(
    () => `${cvData.name?.toLowerCase().replace(/\s+/g, '-') || 'cv'}.pdf`,
    [cvData.name]
  )

  // ATS Uyum Skoru
  const showToast = useCallback((message, type = 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }, [])

  // AI: CV dosyasını yükle ve parse et
  const handleCvFileUpload = useCallback(async (file) => {
    if (!file) return
    if (!aiAvailable) {
      showToast('AI özelliği aktif değil. Sunucuda OPENAI_API_KEY gerekli.', 'warning')
      return
    }
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
    if (!allowed.includes(file.type)) {
      showToast('Sadece PDF veya Word (.docx) dosyası yükleyebilirsiniz.', 'warning')
      return
    }
    setCvParseLoading(true)
    try {
      const formData = new FormData()
      formData.append('cv', file)
      const res = await fetch(`${API_URL}/api/ai/parse-cv`, { method: 'POST', body: formData })
      const json = await res.json()
      if (json.error) { showToast(json.error); return }

      const d = json.data
      // Mevcut CV verisini yapay zekanın bulduklarıyla birleştir
      setCvData(prev => ({
        ...prev,
        name:        d.name        || prev.name,
        title:       d.title       || prev.title,
        email:       d.email       || prev.email,
        phone:       d.phone       || prev.phone,
        city:        d.city        || prev.city,
        district:    d.district    || prev.district,
        birthDay:    d.birthDay    || prev.birthDay,
        birthMonth:  d.birthMonth  || prev.birthMonth,
        birthYear:   d.birthYear   || prev.birthYear,
        websiteUrl:  d.websiteUrl  || prev.websiteUrl,
        objective:   d.objective   || prev.objective,
        skills:      d.skills?.length      ? d.skills      : prev.skills,
        languages:   d.languages?.length   ? d.languages.map((l, i) => ({ id: Date.now() + i, name: l.name || l, level: l.level || '' })) : prev.languages,
        experience:  d.experience?.length  ? d.experience.map((e, i) => ({ id: Date.now() + i + 100, company: e.company || '', position: e.position || '', startDate: e.startDate || '', endDate: e.endDate || '', details: e.details || [] })) : prev.experience,
        education:   d.education?.length   ? d.education.map((e, i) => ({ id: Date.now() + i + 200, school: e.school || '', department: e.department || '', degree: e.degree || '', startDate: e.startDate || '', endDate: e.endDate || '', gpa: e.gpa || '' })) : prev.education,
        certificates: d.certificates?.length ? d.certificates.map((c, i) => ({ id: Date.now() + i + 300, name: c.name || c, issuer: c.issuer || '', date: c.date || '' })) : prev.certificates,
        references:  d.references?.length  ? d.references.map((r, i) => ({ id: Date.now() + i + 400, name: r.name || '', title: r.title || '', company: r.company || '', phone: r.phone || '', email: r.email || '' })) : prev.references,
      }))
      showToast('CV başarıyla okundu ve form dolduruldu!', 'info')
    } catch {
      showToast('Bağlantı hatası. Sunucuyu kontrol edin.')
    } finally {
      setCvParseLoading(false)
      if (cvUploadRef.current) cvUploadRef.current.value = ''
    }
  }, [aiAvailable, showToast])

  const atsScore = useMemo(() => {
    let score = 0
    const issues = []
    const tips = []

    if (cvData.name.trim()) score += 8; else issues.push('Ad Soyad girilmemiş')
    if (cvData.email.trim()) score += 8; else issues.push('E-posta girilmemiş')
    if (cvData.phone.trim()) score += 5; else issues.push('Telefon girilmemiş')
    if (cvData.title.trim()) score += 7; else issues.push('Ünvan/Pozisyon girilmemiş')
    if (cvData.city) score += 4; else issues.push('Konum belirtilmemiş')
    if (cvData.email.includes('@') && cvData.email.includes('.')) score += 3

    const objWords = (cvData.objective || '').trim().split(/\s+/).filter(Boolean).length
    if (objWords >= 50) score += 12
    else if (objWords >= 20) { score += 6; tips.push('Kariyer hedefini 50+ kelimeye çıkarın') }
    else issues.push('Kariyer hedefi eksik veya çok kısa')

    if (cvData.experience.length >= 2) score += 13
    else if (cvData.experience.length === 1) { score += 7; tips.push('Birden fazla iş deneyimi ekleyin') }
    else issues.push('İş deneyimi eklenmemiş')

    const hasDetailedExp = cvData.experience.some(e => (e.details || []).length >= 3)
    if (hasDetailedExp) score += 8
    else if (cvData.experience.length > 0) tips.push('İş deneyimi maddelerini 3+ satıra çıkarın')

    if (cvData.education.length > 0) score += 10; else issues.push('Eğitim bilgisi eklenmemiş')

    if (cvData.skills.length >= 8) score += 10
    else if (cvData.skills.length >= 3) { score += 5; tips.push('En az 8 teknik beceri ekleyin') }
    else issues.push('Teknik beceriler eksik (en az 3 ekleyin)')

    if (cvData.languages.length > 0) score += 5; else tips.push('Yabancı dil ekleyin')
    if (cvData.certificates.length > 0) score += 7

    return { score: Math.min(score, 100), issues, tips }
  }, [cvData])

  // CV Tamamlanma Yüzdesi
  const cvCompletion = useMemo(() => {
    const checks = [
      { label: 'Ad Soyad', done: !!cvData.name.trim() },
      { label: 'E-posta', done: !!cvData.email.trim() },
      { label: 'Telefon', done: !!cvData.phone.trim() },
      { label: 'Ünvan/Pozisyon', done: !!cvData.title.trim() },
      { label: 'Konum', done: !!cvData.city },
      { label: 'Kariyer Hedefi', done: (cvData.objective || '').trim().length > 20 },
      { label: 'Profil Fotoğrafı', done: !!cvData.avatar },
      { label: 'İş Deneyimi', done: cvData.experience.length > 0 },
      { label: 'Eğitim', done: cvData.education.length > 0 },
      { label: 'Teknik Beceriler', done: cvData.skills.length >= 3 },
      { label: 'Yabancı Dil', done: cvData.languages.length > 0 },
    ]
    const doneCount = checks.filter(c => c.done).length
    return {
      percentage: Math.round((doneCount / checks.length) * 100),
      missing: checks.filter(c => !c.done).map(c => c.label),
    }
  }, [cvData])

  // PDF indirme fonksiyonu
  const exportToPdf = useCallback(async () => {
    if (!cvRef.current) {
      console.error('CV ref bulunamadı')
      alert('PDF oluşturulamadı. Lütfen sayfayı yenileyin.')
      return
    }

    try {
      // Tüm görsellerin yüklendiğinden emin ol
      const images = cvRef.current.querySelectorAll('img')
      await Promise.all(
        Array.from(images).map((img) => {
          if (img.complete) return Promise.resolve()
          return new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = () => {
              // Görsel yüklenemezse devam et
              resolve()
            }
            // Timeout ekle
            setTimeout(resolve, 5000)
          })
        })
      )

      // Önizlemedeki görünümü aynen PDF'e aktar
      const canvas = await html2canvas(cvRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: false,
        imageTimeout: 30000,
        removeContainer: true,
        ignoreElements: (element) => {
          // Logo yüklenemezse ignore et
          if (element.tagName === 'IMG' && element.src && element.src.includes('logo.png')) {
            return !element.complete || element.naturalHeight === 0
          }
          return false
        },
        onclone: (clonedDoc) => {
          // Logo görüntülerini kontrol et ve hata yönetimi yap
          const logos = clonedDoc.querySelectorAll('img[src*="logo.png"], .brand__logo, .login-modal__logo')
          logos.forEach((logo) => {
            // Logo yüklenemezse görünmez yap
            if (!logo.complete || logo.naturalHeight === 0) {
              logo.style.display = 'none'
              logo.src = '' // Boş src ile hata önle
            }
          })

          // Avatar görüntülerinin doğru render edilmesini sağla
          const avatars = clonedDoc.querySelectorAll('.avatar img')
          avatars.forEach((img) => {
            const container = img.parentElement
            if (container) {
              // Container'ın boyutunu garantile
              container.style.width = '120px'
              container.style.height = '120px'
              container.style.minWidth = '120px'
              container.style.minHeight = '120px'
              container.style.maxWidth = '120px'
              container.style.maxHeight = '120px'
              
              // Image'i absolute positioning ile ortala ve kare yap
              img.style.position = 'absolute'
              img.style.top = '50%'
              img.style.left = '50%'
              img.style.transform = 'translate(-50%, -50%)'
              img.style.width = '120px'
              img.style.height = '120px'
              img.style.objectFit = 'cover'
              img.style.objectPosition = 'center'
              img.style.minWidth = '120px'
              img.style.minHeight = '120px'
              img.style.maxWidth = 'none'
              img.style.maxHeight = 'none'
            }
          })
        }
      })
      
      // DOM'dan gerçek içerik yüksekliğini hesapla
      const getActualContentHeight = (element) => {
        if (!element) return null
        
        // Tüm görünür child elementleri al
        const getAllElements = (el) => {
          const elements = []
          const walker = document.createTreeWalker(
            el,
            NodeFilter.SHOW_ELEMENT,
            {
              acceptNode: (node) => {
                // Görünmez elementleri atla
                const style = window.getComputedStyle(node)
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                  return NodeFilter.FILTER_REJECT
                }
                return NodeFilter.FILTER_ACCEPT
              }
            }
          )
          
          let node
          while (node = walker.nextNode()) {
            elements.push(node)
          }
          return elements
        }
        
        const allElements = getAllElements(element)
        if (allElements.length === 0) {
          // Eğer element yoksa, scrollHeight'ı kontrol et
          const hasText = element.textContent && element.textContent.trim().length > 0
          return hasText ? element.scrollHeight : null
        }
        
        // En alttaki elementin bottom pozisyonunu bul
        let maxBottom = 0
        const elementRect = element.getBoundingClientRect()
        
        allElements.forEach((el) => {
          const elRect = el.getBoundingClientRect()
          const bottom = elRect.bottom - elementRect.top
          maxBottom = Math.max(maxBottom, bottom)
        })
        
        // Margin ve padding için biraz ekle (yaklaşık 30px)
        return maxBottom > 0 ? maxBottom + 30 : null
      }

      // Önce DOM'dan hesapla
      const domContentHeight = getActualContentHeight(cvRef.current)
      
      let actualFinalHeight
      if (domContentHeight && domContentHeight > 0) {
        // Canvas scale ile çarp (scale: 2 olduğu için)
        const scaledDomHeight = domContentHeight * 2
        
        // Canvas yüksekliği ile karşılaştır, küçük olanı kullan
        actualFinalHeight = Math.min(scaledDomHeight, canvas.height)
        
        // Minimum yükseklik kontrolü - çok küçükse muhtemelen yanlış hesaplanmıştır
        // Ama gerçek içerik varsa (text uzunluğu kontrolü) kullan
        const hasRealContent = cvRef.current.textContent && cvRef.current.textContent.trim().length > 20
        if (actualFinalHeight < 300 && !hasRealContent) {
          // Gerçek içerik yoksa canvas yüksekliğini kullan
          actualFinalHeight = canvas.height
        } else if (actualFinalHeight < 300 && hasRealContent) {
          // Gerçek içerik varsa hesaplanan yüksekliği kullan (minimum 300px)
          actualFinalHeight = Math.max(actualFinalHeight, 300)
        }
      } else {
        // DOM'dan hesaplanamazsa canvas yüksekliğini kullan
        actualFinalHeight = canvas.height
      }
      
      // Sadece içerik kısmını al
      const contentCanvas = document.createElement('canvas')
      contentCanvas.width = canvas.width
      contentCanvas.height = actualFinalHeight
      const contentCtx = contentCanvas.getContext('2d')
      contentCtx.drawImage(canvas, 0, 0, canvas.width, actualFinalHeight, 0, 0, canvas.width, actualFinalHeight)
      
      let imgData
      try {
        imgData = contentCanvas.toDataURL('image/png')
      } catch (error) {
        console.error('Canvas toDataURL PNG hatası:', error)
        // PNG hatası varsa JPEG olarak dene
        imgData = contentCanvas.toDataURL('image/jpeg', 0.95)
      }
      
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgHeight = (actualFinalHeight * pdfWidth) / canvas.width
      
      // Eğer içerik tek sayfaya sığıyorsa
      if (imgHeight <= pdfHeight) {
        try {
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight)
        } catch (error) {
          console.error('PDF addImage hatası:', error)
          // PNG hatası varsa JPEG olarak dene
          const jpegData = contentCanvas.toDataURL('image/jpeg', 0.95)
          pdf.addImage(jpegData, 'JPEG', 0, 0, pdfWidth, imgHeight)
        }
      } else {
        // İçerik birden fazla sayfaya yayılıyorsa
        // Canvas pixel yüksekliği ile PDF mm yüksekliği arasındaki oran
        const pixelToMmRatio = imgHeight / actualFinalHeight
        
        let position = 0
        let pageNumber = 0
        
        while (position < imgHeight) {
          if (pageNumber > 0) {
            pdf.addPage()
          }
          
          // Bu sayfada gösterilecek yükseklik
          const remainingHeight = imgHeight - position
          const pageContentHeight = Math.min(pdfHeight, remainingHeight)
          
          // Canvas'tan bu bölümü al (pixel cinsinden)
          const sourceY = position / pixelToMmRatio
          const sourceHeight = pageContentHeight / pixelToMmRatio
          
          // Canvas'tan bu bölümü yeni bir canvas'a kopyala
          const pageCanvas = document.createElement('canvas')
          pageCanvas.width = contentCanvas.width
          pageCanvas.height = sourceHeight
          const ctx = pageCanvas.getContext('2d')
          ctx.drawImage(contentCanvas, 0, sourceY, contentCanvas.width, sourceHeight, 0, 0, contentCanvas.width, sourceHeight)
          
          let pageImgData
          try {
            pageImgData = pageCanvas.toDataURL('image/png')
          } catch (error) {
            console.error('Page canvas toDataURL PNG hatası:', error)
            pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95)
          }
          
          // PDF'e ekle
          try {
            pdf.addImage(pageImgData, 'PNG', 0, 0, pdfWidth, pageContentHeight)
          } catch (error) {
            console.error('PDF addImage PNG hatası:', error)
            // PNG hatası varsa JPEG olarak dene
            if (pageImgData.includes('data:image/png')) {
              const jpegData = pageCanvas.toDataURL('image/jpeg', 0.95)
              pdf.addImage(jpegData, 'JPEG', 0, 0, pdfWidth, pageContentHeight)
            } else {
              throw error
            }
          }
          
          position += pdfHeight
          pageNumber++
        }
      }

      pdf.save(pdfFileName)
      console.log('PDF başarıyla indirildi:', pdfFileName)
      return true
    } catch (error) {
      console.error('PDF oluşturma hatası:', error)
      // Hata mesajını daha detaylı göster
      const errorMessage = error.message || 'Bilinmeyen hata'
      console.error('Hata detayı:', errorMessage)
      
      // PNG signature hatası özel durumu
      if (errorMessage.includes('PNG signature') || errorMessage.includes('wrong PNG')) {
        // Logo sorunu - logo olmadan tekrar dene
        try {
          const canvasWithoutLogo = await html2canvas(cvRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            allowTaint: false,
            imageTimeout: 30000,
            removeContainer: true,
            ignoreElements: (element) => {
              // Tüm logoları ignore et
              return element.tagName === 'IMG' && element.src && element.src.includes('logo.png')
            }
          })
          
          const imgData = canvasWithoutLogo.toDataURL('image/jpeg', 0.95)
          const pdf = new jsPDF('p', 'mm', 'a4')
          const pdfWidth = pdf.internal.pageSize.getWidth()
          const pdfHeight = pdf.internal.pageSize.getHeight()
          const imgHeight = (canvasWithoutLogo.height * pdfWidth) / canvasWithoutLogo.width
          
          if (imgHeight <= pdfHeight) {
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight)
          } else {
            // Çok sayfalı PDF için
            const pixelToMmRatio = imgHeight / canvasWithoutLogo.height
            let position = 0
            let pageNumber = 0
            
            while (position < imgHeight) {
              if (pageNumber > 0) {
                pdf.addPage()
              }
              
              const remainingHeight = imgHeight - position
              const pageContentHeight = Math.min(pdfHeight, remainingHeight)
              const sourceY = position / pixelToMmRatio
              const sourceHeight = pageContentHeight / pixelToMmRatio
              
              const pageCanvas = document.createElement('canvas')
              pageCanvas.width = canvasWithoutLogo.width
              pageCanvas.height = sourceHeight
              const ctx = pageCanvas.getContext('2d')
              ctx.drawImage(canvasWithoutLogo, 0, sourceY, canvasWithoutLogo.width, sourceHeight, 0, 0, canvasWithoutLogo.width, sourceHeight)
              
              const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95)
              pdf.addImage(pageImgData, 'JPEG', 0, 0, pdfWidth, pageContentHeight)
              
              position += pdfHeight
              pageNumber++
            }
          }
          
          pdf.save(pdfFileName)
          console.log('PDF başarıyla indirildi (logo olmadan):', pdfFileName)
          return true
        } catch (retryError) {
          console.error('PDF oluşturma retry hatası:', retryError)
          alert('PDF oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.')
          return false
        }
      } else {
        alert('PDF oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.')
        return false
      }
    }
  }, [pdfFileName])

  // PayTR: ödeme sonrası doğrula, gerekirse CV kaydet, PDF indir
  const handlePaytrSuccess = useCallback(
    async (merchantOid, planHint) => {
      try {
        const savedCvData = localStorage.getItem('cvDataForPayment')
        if (savedCvData) {
          try {
            setCvData(JSON.parse(savedCvData))
          } catch (error) {
            console.error('CV data yüklenemedi:', error)
          }
        }

        let paid = false
        let plan = planHint || localStorage.getItem('paytr_plan') || 'download_only'
        for (let i = 0; i < 30; i++) {
          const response = await fetch(`${API_URL}/api/paytr/verify/${encodeURIComponent(merchantOid)}`)
          const data = await response.json()
          if (data.paid) {
            paid = true
            plan = data.plan || plan
            break
          }
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        if (!paid) {
          alert(
            'Ödeme onayı sunucudan henüz gelmedi. PayTR bildirim URL ayarını kontrol edin veya bir dakika sonra sayfayı yenileyin.'
          )
          return
        }

        localStorage.setItem('paidTimestamp', Date.now().toString())
        setMode('preview')
        setHasPaid(true)

        if (plan === 'save_download' && savedCvData) {
          const token = localStorage.getItem('cvToken')
          if (token) {
            try {
              const cv = JSON.parse(savedCvData)
              const res = await fetch(`${API_URL}/api/cv`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ title: cv.name || 'CV', data: cv }),
              })
              if (res.ok) {
                const refresh = await fetch(`${API_URL}/api/cv`, {
                  headers: { Authorization: `Bearer ${token}` },
                })
                if (refresh.ok) {
                  const list = await refresh.json()
                  setUserCvs(Array.isArray(list.cvs) ? list.cvs : [])
                }
              }
            } catch (e) {
              console.error('CV kayıt hatası:', e)
            }
          }
        }

        setTimeout(async () => {
          let retries = 0
          while (!cvRef.current && retries < 15) {
            await new Promise((resolve) => setTimeout(resolve, 300))
            retries++
          }
          if (cvRef.current) {
            await exportToPdf()
            setHasPaid(false)
            localStorage.removeItem('paytr_merchant_oid')
            localStorage.removeItem('paytr_plan')
            localStorage.removeItem('paidTimestamp')
            localStorage.removeItem('cvDataForPayment')
          } else {
            alert('Ödeme başarılı! PDF otomatik inmedi; Canlı Önizleme üzerinden tekrar deneyin.')
          }
        }, 2500)
      } catch (error) {
        console.error('PayTR success handler:', error)
        alert('Ödeme doğrulanamadı.')
        localStorage.removeItem('cvDataForPayment')
      }
    },
    [exportToPdf]
  )

  // Sayfa yüklendiğinde localStorage'dan cvData'yı yükle
  useEffect(() => {
    const savedCvData = localStorage.getItem('cvDataForPayment')
    if (savedCvData) {
      try {
        const parsedData = JSON.parse(savedCvData)
        setCvData(parsedData)
      } catch (error) {
        console.error('CV data yüklenemedi:', error)
      }
    }
  }, [])

  // URL'den PayTR dönüşünü işle
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const paymentStatus = urlParams.get('payment')

    if (paymentStatus === 'paytr_ok') {
      const oid = localStorage.getItem('paytr_merchant_oid')
      const plan = localStorage.getItem('paytr_plan')
      window.history.replaceState({}, document.title, window.location.pathname)
      if (oid) {
        setTimeout(() => handlePaytrSuccess(oid, plan), 100)
      } else {
        alert('Oturum bilgisi bulunamadı. Lütfen tekrar ödeme yapın.')
      }
    } else if (paymentStatus === 'paytr_fail') {
      alert('Ödeme tamamlanamadı veya iptal edildi.')
      localStorage.removeItem('cvDataForPayment')
      localStorage.removeItem('paytr_merchant_oid')
      localStorage.removeItem('paytr_plan')
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [handlePaytrSuccess, exportToPdf])

  const handlePayment = async () => {
    // PDF indirme modalını aç
    setShowPdfModal(true)
  }

  const handleSaveAndDownload = async () => {
    if (!user) {
      setShowLogin(true)
      setShowPdfModal(false)
      return
    }

    try {
      const token = localStorage.getItem('cvToken')
      if (!token) {
        setShowLogin(true)
        setShowPdfModal(false)
        return
      }

      localStorage.setItem('cvDataForPayment', JSON.stringify(cvData))
      const response = await fetch(`${API_URL}/api/paytr/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: 'save_download' }),
      })
      const data = await response.json()
      if (!response.ok) {
        alert(data.error || 'Ödeme başlatılamadı')
        return
      }
      localStorage.setItem('paytr_merchant_oid', data.merchant_oid)
      localStorage.setItem('paytr_plan', 'save_download')
      setShowPdfModal(false)
      window.location.href = `https://www.paytr.com/odeme/guvenli/${data.token}`
    } catch (error) {
      console.error('PayTR başlatma hatası:', error)
      alert('Ödeme sayfası açılamadı. Lütfen tekrar deneyin.')
    }
  }

  const handleDownloadOnly = async () => {
    const email = (cvData.email || '').trim()
    if (!email || !email.includes('@')) {
      alert('Sadece indir (50 TL) için lütfen formda E-posta alanını doldurun.')
      return
    }
    try {
      localStorage.setItem('cvDataForPayment', JSON.stringify(cvData))
      const response = await fetch(`${API_URL}/api/paytr/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'download_only',
          email,
          userName: cvData.name || 'Müşteri',
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        alert(data.error || 'Ödeme başlatılamadı')
        return
      }
      localStorage.setItem('paytr_merchant_oid', data.merchant_oid)
      localStorage.setItem('paytr_plan', 'download_only')
      setShowPdfModal(false)
      window.location.href = `https://www.paytr.com/odeme/guvenli/${data.token}`
    } catch (error) {
      console.error('PayTR başlatma hatası:', error)
      alert('Ödeme sayfası açılamadı. Lütfen tekrar deneyin.')
    }
  }

  const handleFieldChange = (field, value) => {
    setCvData((prev) => ({ ...prev, [field]: value }))
  }

  const handleArrayChange = (section, id, key, value) => {
    setCvData((prev) => ({
      ...prev,
      [section]: prev[section].map((item) =>
        item.id === id ? { ...item, [key]: value } : item
      ),
    }))
  }

  const handleDetailsChange = (section, id, text) => {
    const details = text.split('\n').map((item) => item.trim()).filter(Boolean)
    handleArrayChange(section, id, 'details', details)
  }

  const addItem = (section, itemTemplate) => {
    const existing = cvData[section] || []
    const newId = Math.max(0, ...existing.map((i) => i.id)) + 1
    setCvData((prev) => ({
      ...prev,
      [section]: [...(prev[section] || []), { ...itemTemplate, id: newId }],
    }))
  }

  const removeItem = (section, id) => {
    setCvData((prev) => ({
      ...prev,
      [section]: prev[section].filter((item) => item.id !== id),
    }))
  }

  const toggleSkill = (skill) => {
    setCvData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }))
  }

  const addCustomSkill = () => {
    if (customSkill.trim() && !cvData.skills.includes(customSkill.trim())) {
      setCvData((prev) => ({
        ...prev,
        skills: [...prev.skills, customSkill.trim()],
      }))
      setCustomSkill('')
    }
  }

  const toggleCompetency = (comp) => {
    setCvData((prev) => ({
      ...prev,
      competencies: prev.competencies.includes(comp)
        ? prev.competencies.filter((c) => c !== comp)
        : [...prev.competencies, comp],
    }))
  }

  const addCustomCompetency = () => {
    if (customCompetency.trim() && !cvData.competencies.includes(customCompetency.trim())) {
      setCvData((prev) => ({
        ...prev,
        competencies: [...prev.competencies, customCompetency.trim()],
      }))
      setCustomCompetency('')
    }
  }

  const addLanguage = (lang) => {
    if (!cvData.languages.find((l) => l.lang === lang)) {
      setCvData((prev) => ({
        ...prev,
        languages: [...prev.languages, { lang, level: 'Orta' }],
      }))
    }
  }

  const addCustomLanguage = () => {
    if (customLanguage.trim() && !cvData.languages.find((l) => l.lang === customLanguage.trim())) {
      setCvData((prev) => ({
        ...prev,
        languages: [...prev.languages, { lang: customLanguage.trim(), level: 'Orta' }],
      }))
      setCustomLanguage('')
    }
  }

  const removeLanguage = (lang) => {
    setCvData((prev) => ({
      ...prev,
      languages: prev.languages.filter((l) => l.lang !== lang),
    }))
  }

  const updateLanguageLevel = (lang, level) => {
    setCvData((prev) => ({
      ...prev,
      languages: prev.languages.map((l) =>
        l.lang === lang ? { ...l, level } : l
      ),
    }))
  }

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImageToCrop(reader.result)
        setShowCropModal(true)
      }
      reader.readAsDataURL(file)
    }
  }

  const initCropArea = () => {
    if (!cropContainerRef.current || !cropImageRef.current) return
    
    const container = cropContainerRef.current
    const img = cropImageRef.current
    const containerRect = container.getBoundingClientRect()
    const imgRect = img.getBoundingClientRect()
    
    const size = Math.min(containerRect.width, containerRect.height) * 0.8
    const x = (containerRect.width - size) / 2
    const y = (containerRect.height - size) / 2
    
    setCropArea({ x, y, width: size, height: size })
    
    // Fotoğrafı ortalayalım
    const imgWidth = imgRect.width
    const imgHeight = imgRect.height
    const scale = Math.max(size / imgWidth, size / imgHeight) * 1.2
    setImageScale(scale)
    setImagePosition({ 
      x: (containerRect.width - imgWidth * scale) / 2,
      y: (containerRect.height - imgHeight * scale) / 2
    })
  }

  useEffect(() => {
    if (showCropModal && imageToCrop) {
      setTimeout(() => {
        initCropArea()
      }, 100)
    }
  }, [showCropModal, imageToCrop])

  const handleCropAreaMouseDown = (e) => {
    if (e.target.classList.contains('crop-area') || e.target.closest('.crop-area')) {
      if (e.target.classList.contains('crop-handle')) return
      setIsDragging(true)
      const container = cropContainerRef.current
      const rect = container.getBoundingClientRect()
      setDragStart({ 
        x: e.clientX - rect.left - cropArea.x, 
        y: e.clientY - rect.top - cropArea.y 
      })
    }
  }

  const handleMouseMove = (e) => {
    if (isResizing) {
      handleResizeMove(e)
      return
    }
    
    if (!isDragging || !cropContainerRef.current) return
    
    const container = cropContainerRef.current
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left - dragStart.x
    const y = e.clientY - rect.top - dragStart.y
    
    setCropArea(prev => ({
      ...prev,
      x: Math.max(0, Math.min(x, rect.width - prev.width)),
      y: Math.max(0, Math.min(y, rect.height - prev.height))
    }))
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
    setResizeHandle(null)
  }

  const handleImageMouseDown = (e) => {
    e.stopPropagation()
    setIsDragging(true)
    setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y })
  }

  const handleImageMouseMove = (e) => {
    if (!isDragging || isResizing || !cropImageRef.current || !cropContainerRef.current) return
    
    const container = cropContainerRef.current
    const rect = container.getBoundingClientRect()
    const img = cropImageRef.current
    const imgRect = img.getBoundingClientRect()
    const scaledWidth = imgRect.width
    const scaledHeight = imgRect.height
    
    let x = e.clientX - rect.left - dragStart.x
    let y = e.clientY - rect.top - dragStart.y
    
    // Sınırları kontrol et
    const maxX = rect.width - scaledWidth
    const maxY = rect.height - scaledHeight
    
    x = Math.max(maxX, Math.min(0, x))
    y = Math.max(maxY, Math.min(0, y))
    
    setImagePosition({ x, y })
  }

  const handleResizeStart = (handle, e) => {
    e.stopPropagation()
    setIsResizing(true)
    setResizeHandle(handle)
    const container = cropContainerRef.current
    const rect = container.getBoundingClientRect()
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      cropX: cropArea.x,
      cropY: cropArea.y,
      cropWidth: cropArea.width,
      cropHeight: cropArea.height
    })
  }

  const handleResizeMove = (e) => {
    if (!isResizing || !resizeHandle || !cropContainerRef.current) return
    
    const container = cropContainerRef.current
    const rect = container.getBoundingClientRect()
    const deltaX = e.clientX - rect.left - dragStart.x
    const deltaY = e.clientY - rect.top - dragStart.y
    
    let newArea = { ...cropArea }
    const minSize = 50
    
    switch (resizeHandle) {
      case 'se':
        newArea.width = Math.max(minSize, dragStart.cropWidth + deltaX)
        newArea.height = Math.max(minSize, dragStart.cropHeight + deltaY)
        if (newArea.x + newArea.width > rect.width) {
          newArea.width = rect.width - newArea.x
        }
        if (newArea.y + newArea.height > rect.height) {
          newArea.height = rect.height - newArea.y
        }
        break
      case 'sw':
        newArea.width = Math.max(minSize, dragStart.cropWidth - deltaX)
        newArea.height = Math.max(minSize, dragStart.cropHeight + deltaY)
        newArea.x = Math.max(0, dragStart.cropX + deltaX)
        if (newArea.y + newArea.height > rect.height) {
          newArea.height = rect.height - newArea.y
        }
        break
      case 'ne':
        newArea.width = Math.max(minSize, dragStart.cropWidth + deltaX)
        newArea.height = Math.max(minSize, dragStart.cropHeight - deltaY)
        newArea.y = Math.max(0, dragStart.cropY + deltaY)
        if (newArea.x + newArea.width > rect.width) {
          newArea.width = rect.width - newArea.x
        }
        break
      case 'nw':
        newArea.width = Math.max(minSize, dragStart.cropWidth - deltaX)
        newArea.height = Math.max(minSize, dragStart.cropHeight - deltaY)
        newArea.x = Math.max(0, dragStart.cropX + deltaX)
        newArea.y = Math.max(0, dragStart.cropY + deltaY)
        break
    }
    
    setCropArea(newArea)
  }

  const handleZoom = (delta) => {
    const zoomFactor = delta > 0 ? 1.1 : 0.9
    setImageScale(prev => Math.max(0.5, Math.min(3, prev * zoomFactor)))
  }

  const applyCrop = () => {
    if (!imageToCrop || !cropContainerRef.current || !cropImageRef.current) return
    
    const container = cropContainerRef.current
    const img = cropImageRef.current
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    const containerRect = container.getBoundingClientRect()
    const imgRect = img.getBoundingClientRect()
    
    // Canvas boyutunu crop alanına göre ayarla
    canvas.width = cropArea.width
    canvas.height = cropArea.height
    
    // Orijinal görüntüyü yükle
    const originalImg = new Image()
    originalImg.onload = () => {
      // Ölçek ve pozisyon hesaplamaları
      const scaleX = originalImg.width / imgRect.width
      const scaleY = originalImg.height / imgRect.height
      
      const sourceX = (cropArea.x - imagePosition.x) * scaleX
      const sourceY = (cropArea.y - imagePosition.y) * scaleY
      const sourceWidth = cropArea.width * scaleX
      const sourceHeight = cropArea.height * scaleY
      
      ctx.drawImage(
        originalImg,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, canvas.width, canvas.height
      )
      
      const croppedImage = canvas.toDataURL('image/png')
      setCvData((prev) => ({ ...prev, avatar: croppedImage }))
      setShowCropModal(false)
      setImageToCrop(null)
    }
    originalImg.src = imageToCrop
  }

  const cancelCrop = () => {
    setShowCropModal(false)
    setImageToCrop(null)
  }

  const formatDateRange = (startDate, endDate, ongoing) => {
    if (ongoing) return `${startDate} - Devam Ediyor`
    if (startDate === endDate) return startDate
    return `${startDate} - ${endDate}`
  }

  const formatLocation = (city, district) => {
    if (city && district) return `${district}, ${city}`
    if (city) return city
    return ''
  }

  const formatBirthDate = () => {
    const { birthDay, birthMonth, birthYear } = cvData
    if (birthDay && birthMonth && birthYear) {
      return `${birthDay} ${birthMonth} ${birthYear}`
    }
    return ''
  }

  const getAvatarClass = () => {
    switch (cvData.avatarShape) {
      case 'circle': return 'avatar--circle'
      case 'square': return 'avatar--square'
      default: return 'avatar--rounded'
    }
  }

  const renderCv = (innerRef = null) => {
    if (template === 'modern') return renderModernCv(innerRef)
    if (template === 'creative') return renderCreativeCv(innerRef)
    if (template === 'compact') return renderCompactCv(innerRef)
    return (
      <div className={`cv-page${template === 'minimal' ? ' cv-page--minimal' : ''}`} ref={innerRef}>
        <div className="cv__header" style={{ borderColor: template === 'minimal' ? '#ccc' : cvData.accent }}>
          {cvData.avatar && (
            <div className={`avatar ${getAvatarClass()}`} style={{ borderColor: template === 'minimal' ? '#ccc' : cvData.accent }}>
              <img src={cvData.avatar} alt={`${cvData.name || 'Aday'} avatar`} width="120" height="120" style={{ display: 'block' }} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <h1>{cvData.name || 'Ad Soyad'}</h1>
            <p className="cv__title">{cvData.title || 'Hedef Pozisyon / Ünvan'}</p>
            <div className="meta">
              {(cvData.city || cvData.district) && <span>📍 {formatLocation(cvData.city, cvData.district)}</span>}
              {cvData.phone && <span>📞 {cvData.phone}</span>}
              {cvData.email && <span>✉️ {cvData.email}</span>}
              {formatBirthDate() && <span>🎂 {formatBirthDate()}</span>}
              {cvData.websiteUrl && <span>🔗 {cvData.websiteUrl}</span>}
            </div>
          </div>
          {qrDataUrl && (
            <div className="cv__qr">
              <img src={qrDataUrl} alt="QR Kod" width="72" height="72" />
            </div>
          )}
        </div>

        {cvData.objective && (
          <Section title="Özet" accent={template === 'minimal' ? '#555' : cvData.accent}>
            <p className="muted">{cvData.objective}</p>
          </Section>
        )}

        {cvData.education.length > 0 && (
          <Section title="Eğitim" accent={template === 'minimal' ? '#555' : cvData.accent}>
            {cvData.education.map((item) => (
              <Item key={item.id} title={item.school} subtitle={formatDateRange(item.startDate, item.endDate, item.ongoing)} location={formatLocation(item.city, item.district)}>
                {item.note && <p className="muted">{item.note}</p>}
              </Item>
            ))}
          </Section>
        )}

        {cvData.experience.length > 0 && (
          <Section title="İş Deneyimi" accent={template === 'minimal' ? '#555' : cvData.accent}>
            {cvData.experience.map((item) => (
              <Item key={item.id} title={item.company} subtitle={formatDateRange(item.startDate, item.endDate, item.ongoing)} location={formatLocation(item.city, item.district)}>
                {item.details.length > 0 && <ul>{item.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
              </Item>
            ))}
          </Section>
        )}

        {cvData.projects.length > 0 && (
          <Section title="Projeler" accent={template === 'minimal' ? '#555' : cvData.accent}>
            {cvData.projects.map((item) => (
              <Item key={item.id} title={item.name} subtitle={formatDateRange(item.startDate, item.endDate, item.ongoing)}>
                {item.details.length > 0 && <ul>{item.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
              </Item>
            ))}
          </Section>
        )}

        {cvData.activities.length > 0 && (
          <Section title="Aktiviteler" accent={template === 'minimal' ? '#555' : cvData.accent}>
            {cvData.activities.map((item) => (
              <Item key={item.id} title={item.name} subtitle={formatDateRange(item.startDate, item.endDate, item.ongoing)} location={formatLocation(item.city, item.district)}>
                {item.details.length > 0 && <ul>{item.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
              </Item>
            ))}
          </Section>
        )}

        {cvData.certificates.length > 0 && (
          <Section title="Sertifikalar" accent={template === 'minimal' ? '#555' : cvData.accent}>
            {cvData.certificates.map((item) => (
              <Item key={item.id} title={item.name} subtitle={`${item.org} • ${item.date}`} />
            ))}
          </Section>
        )}

        <div className="inline-grid">
          {cvData.skills.length > 0 && (
            <Section title="Teknik Beceriler" accent={template === 'minimal' ? '#555' : cvData.accent}>
              <ul className="pill-list">{cvData.skills.map((s) => <li key={s}>{s}</li>)}</ul>
            </Section>
          )}
          {cvData.competencies.length > 0 && (
            <Section title="Yetkinlikler" accent={template === 'minimal' ? '#555' : cvData.accent}>
              <ul className="pill-list">{cvData.competencies.map((c) => <li key={c}>{c}</li>)}</ul>
            </Section>
          )}
        </div>

        <div className="inline-grid">
          {cvData.languages.length > 0 && (
            <Section title="Yabancı Diller" accent={template === 'minimal' ? '#555' : cvData.accent}>
              <ul>{cvData.languages.map((item) => <li key={item.lang}>{item.lang} ({item.level})</li>)}</ul>
            </Section>
          )}
          {cvData.interests.length > 0 && (
            <Section title="İlgi Alanları" accent={template === 'minimal' ? '#555' : cvData.accent}>
              <ul className="pill-list soft">{cvData.interests.map((i) => <li key={i}>{i}</li>)}</ul>
            </Section>
          )}
        </div>

        {cvData.references && cvData.references.length > 0 && (
          <Section title="Referanslar" accent={template === 'minimal' ? '#555' : cvData.accent}>
            <div className="inline-grid">
              {cvData.references.map((ref, i) => (
                <div key={i} className="reference-item">
                  <p className="item__title">{ref.name}</p>
                  {ref.title && <p className="muted" style={{ margin: '2px 0' }}>{ref.title}{ref.company ? ` • ${ref.company}` : ''}</p>}
                  <p className="muted" style={{ fontSize: '0.82em' }}>
                    {[ref.phone, ref.email].filter(Boolean).join(' | ')}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    )
  }

  const renderModernCv = (innerRef = null) => (
    <div className="cv-page cv-page--modern" ref={innerRef}>
      <div className="cv-modern__header" style={{ backgroundColor: cvData.accent }}>
        {cvData.avatar && (
          <div className={`avatar avatar--modern ${getAvatarClass()}`}>
            <img src={cvData.avatar} alt={cvData.name || 'Aday'} width="100" height="100" style={{ display: 'block' }} />
          </div>
        )}
        <div className="cv-modern__header-text">
          <h1>{cvData.name || 'Ad Soyad'}</h1>
          <p className="cv__title">{cvData.title || 'Hedef Pozisyon / Ünvan'}</p>
        </div>
        {qrDataUrl && <div className="cv__qr cv__qr--modern"><img src={qrDataUrl} alt="QR" width="64" height="64" /></div>}
      </div>

      <div className="cv-modern__body">
        <aside className="cv-modern__sidebar" style={{ borderColor: cvData.accent }}>
          <div className="cv-modern__sidebar-section">
            <h4 style={{ color: cvData.accent }}>İletişim</h4>
            {(cvData.city || cvData.district) && <p>📍 {formatLocation(cvData.city, cvData.district)}</p>}
            {cvData.phone && <p>📞 {cvData.phone}</p>}
            {cvData.email && <p>✉️ {cvData.email}</p>}
            {formatBirthDate() && <p>🎂 {formatBirthDate()}</p>}
            {cvData.websiteUrl && <p>🔗 {cvData.websiteUrl}</p>}
          </div>

          {cvData.skills.length > 0 && (
            <div className="cv-modern__sidebar-section">
              <h4 style={{ color: cvData.accent }}>Teknik Beceriler</h4>
              <ul className="pill-list pill-list--sidebar">
                {cvData.skills.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          )}

          {cvData.competencies.length > 0 && (
            <div className="cv-modern__sidebar-section">
              <h4 style={{ color: cvData.accent }}>Yetkinlikler</h4>
              <ul className="pill-list pill-list--sidebar">
                {cvData.competencies.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          )}

          {cvData.languages.length > 0 && (
            <div className="cv-modern__sidebar-section">
              <h4 style={{ color: cvData.accent }}>Yabancı Diller</h4>
              {cvData.languages.map((item) => (
                <div key={item.lang} className="cv-modern__lang-item">
                  <span>{item.lang}</span>
                  <span className="cv-modern__lang-level">{item.level}</span>
                </div>
              ))}
            </div>
          )}

          {cvData.interests.length > 0 && (
            <div className="cv-modern__sidebar-section">
              <h4 style={{ color: cvData.accent }}>İlgi Alanları</h4>
              <p className="muted" style={{ fontSize: '0.82em', lineHeight: 1.6 }}>{cvData.interests.join(', ')}</p>
            </div>
          )}
        </aside>

        <main className="cv-modern__main">
          {cvData.objective && (
            <div className="cv-modern__section">
              <h3 style={{ color: cvData.accent }}>Özet</h3>
              <p className="muted">{cvData.objective}</p>
            </div>
          )}

          {cvData.experience.length > 0 && (
            <div className="cv-modern__section">
              <h3 style={{ color: cvData.accent }}>İş Deneyimi</h3>
              {cvData.experience.map((item) => (
                <Item key={item.id} title={item.company} subtitle={formatDateRange(item.startDate, item.endDate, item.ongoing)} location={formatLocation(item.city, item.district)}>
                  {item.details.length > 0 && <ul>{item.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
                </Item>
              ))}
            </div>
          )}

          {cvData.education.length > 0 && (
            <div className="cv-modern__section">
              <h3 style={{ color: cvData.accent }}>Eğitim</h3>
              {cvData.education.map((item) => (
                <Item key={item.id} title={item.school} subtitle={formatDateRange(item.startDate, item.endDate, item.ongoing)} location={formatLocation(item.city, item.district)}>
                  {item.note && <p className="muted">{item.note}</p>}
                </Item>
              ))}
            </div>
          )}

          {cvData.projects.length > 0 && (
            <div className="cv-modern__section">
              <h3 style={{ color: cvData.accent }}>Projeler</h3>
              {cvData.projects.map((item) => (
                <Item key={item.id} title={item.name} subtitle={formatDateRange(item.startDate, item.endDate, item.ongoing)}>
                  {item.details.length > 0 && <ul>{item.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
                </Item>
              ))}
            </div>
          )}

          {cvData.activities.length > 0 && (
            <div className="cv-modern__section">
              <h3 style={{ color: cvData.accent }}>Aktiviteler</h3>
              {cvData.activities.map((item) => (
                <Item key={item.id} title={item.name} subtitle={formatDateRange(item.startDate, item.endDate, item.ongoing)} location={formatLocation(item.city, item.district)}>
                  {item.details.length > 0 && <ul>{item.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
                </Item>
              ))}
            </div>
          )}

          {cvData.certificates.length > 0 && (
            <div className="cv-modern__section">
              <h3 style={{ color: cvData.accent }}>Sertifikalar</h3>
              {cvData.certificates.map((item) => (
                <Item key={item.id} title={item.name} subtitle={`${item.org} • ${item.date}`} />
              ))}
            </div>
          )}

          {cvData.references && cvData.references.length > 0 && (
            <div className="cv-modern__section">
              <h3 style={{ color: cvData.accent }}>Referanslar</h3>
              <div className="inline-grid">
                {cvData.references.map((ref, i) => (
                  <div key={i} className="reference-item">
                    <p className="item__title">{ref.name}</p>
                    {ref.title && <p className="muted" style={{ margin: '2px 0' }}>{ref.title}{ref.company ? ` • ${ref.company}` : ''}</p>}
                    <p className="muted" style={{ fontSize: '0.82em' }}>{[ref.phone, ref.email].filter(Boolean).join(' | ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )

  const renderCreativeCv = (innerRef = null) => (
    <div className="cv-page cv-page--creative" ref={innerRef}>
      <div className="cv-creative__sidebar" style={{ backgroundColor: cvData.accent }}>
        {cvData.avatar && (
          <div className={`avatar avatar--creative ${getAvatarClass()}`}>
            <img src={cvData.avatar} alt={cvData.name || 'Aday'} width="90" height="90" style={{ display: 'block' }} />
          </div>
        )}
        <div className="cv-creative__sidebar-name">
          <h1>{cvData.name || 'Ad Soyad'}</h1>
          <p>{cvData.title || 'Pozisyon'}</p>
        </div>

        <div className="cv-creative__sidebar-section">
          <h4>İletişim</h4>
          {(cvData.city || cvData.district) && <p>📍 {formatLocation(cvData.city, cvData.district)}</p>}
          {cvData.phone && <p>📞 {cvData.phone}</p>}
          {cvData.email && <p>✉️ {cvData.email}</p>}
          {formatBirthDate() && <p>🎂 {formatBirthDate()}</p>}
          {cvData.websiteUrl && <p>🔗 {cvData.websiteUrl}</p>}
          {qrDataUrl && <img src={qrDataUrl} alt="QR" width="64" height="64" className="cv-creative__qr" />}
        </div>

        {cvData.skills.length > 0 && (
          <div className="cv-creative__sidebar-section">
            <h4>Beceriler</h4>
            {cvData.skills.map(s => <span key={s} className="cv-creative__skill-tag">{s}</span>)}
          </div>
        )}

        {cvData.languages.length > 0 && (
          <div className="cv-creative__sidebar-section">
            <h4>Diller</h4>
            {cvData.languages.map(l => (
              <div key={l.lang} className="cv-creative__lang">
                <span>{l.lang}</span><span className="cv-creative__lang-lvl">{l.level}</span>
              </div>
            ))}
          </div>
        )}

        {cvData.interests.length > 0 && (
          <div className="cv-creative__sidebar-section">
            <h4>İlgi Alanları</h4>
            <p style={{ fontSize: '0.8em', lineHeight: 1.6, opacity: 0.85 }}>{cvData.interests.join(' · ')}</p>
          </div>
        )}
      </div>

      <div className="cv-creative__main">
        {cvData.objective && (
          <div className="cv-creative__section">
            <h3 style={{ color: cvData.accent }}>Özet</h3>
            <p className="muted">{cvData.objective}</p>
          </div>
        )}
        {cvData.experience.length > 0 && (
          <div className="cv-creative__section">
            <h3 style={{ color: cvData.accent }}>İş Deneyimi</h3>
            {cvData.experience.map(item => (
              <Item key={item.id} title={item.company} subtitle={formatDateRange(item.startDate, item.endDate, item.ongoing)} location={formatLocation(item.city, item.district)}>
                {item.details.length > 0 && <ul>{item.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
              </Item>
            ))}
          </div>
        )}
        {cvData.education.length > 0 && (
          <div className="cv-creative__section">
            <h3 style={{ color: cvData.accent }}>Eğitim</h3>
            {cvData.education.map(item => (
              <Item key={item.id} title={item.school} subtitle={formatDateRange(item.startDate, item.endDate, item.ongoing)} location={formatLocation(item.city, item.district)}>
                {item.note && <p className="muted">{item.note}</p>}
              </Item>
            ))}
          </div>
        )}
        {cvData.projects.length > 0 && (
          <div className="cv-creative__section">
            <h3 style={{ color: cvData.accent }}>Projeler</h3>
            {cvData.projects.map(item => (
              <Item key={item.id} title={item.name} subtitle={formatDateRange(item.startDate, item.endDate, item.ongoing)}>
                {item.details.length > 0 && <ul>{item.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
              </Item>
            ))}
          </div>
        )}
        {cvData.certificates.length > 0 && (
          <div className="cv-creative__section">
            <h3 style={{ color: cvData.accent }}>Sertifikalar</h3>
            {cvData.certificates.map(item => <Item key={item.id} title={item.name} subtitle={`${item.org} · ${item.date}`} />)}
          </div>
        )}
        {cvData.competencies.length > 0 && (
          <div className="cv-creative__section">
            <h3 style={{ color: cvData.accent }}>Yetkinlikler</h3>
            <ul className="pill-list">{cvData.competencies.map(c => <li key={c}>{c}</li>)}</ul>
          </div>
        )}
        {cvData.references && cvData.references.length > 0 && (
          <div className="cv-creative__section">
            <h3 style={{ color: cvData.accent }}>Referanslar</h3>
            <div className="inline-grid">
              {cvData.references.map((ref, i) => (
                <div key={i} className="reference-item">
                  <p className="item__title">{ref.name}</p>
                  {ref.title && <p className="muted" style={{ margin: '2px 0' }}>{ref.title}{ref.company ? ` • ${ref.company}` : ''}</p>}
                  <p className="muted" style={{ fontSize: '0.82em' }}>{[ref.phone, ref.email].filter(Boolean).join(' | ')}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderCompactCv = (innerRef = null) => (
    <div className="cv-page cv-page--compact" ref={innerRef}>
      <div className="cv-compact__header" style={{ borderBottomColor: cvData.accent }}>
        <div className="cv-compact__header-left">
          {cvData.avatar && (
            <div className={`avatar avatar--compact ${getAvatarClass()}`}>
              <img src={cvData.avatar} alt={cvData.name || 'Aday'} width="70" height="70" style={{ display: 'block' }} />
            </div>
          )}
          <div>
            <h1 className="cv-compact__name">{cvData.name || 'Ad Soyad'}</h1>
            <p className="cv-compact__title" style={{ color: cvData.accent }}>{cvData.title || 'Pozisyon'}</p>
          </div>
        </div>
        <div className="cv-compact__contact">
          {cvData.email && <span>✉ {cvData.email}</span>}
          {cvData.phone && <span>📞 {cvData.phone}</span>}
          {(cvData.city || cvData.district) && <span>📍 {formatLocation(cvData.city, cvData.district)}</span>}
          {cvData.websiteUrl && <span>🔗 {cvData.websiteUrl}</span>}
          {qrDataUrl && <img src={qrDataUrl} alt="QR" width="50" height="50" style={{ borderRadius: 4 }} />}
        </div>
      </div>

      {cvData.objective && (
        <div className="cv-compact__section">
          <h3 style={{ color: cvData.accent }}>Özet</h3>
          <p className="muted cv-compact__text">{cvData.objective}</p>
        </div>
      )}

      <div className="cv-compact__two-col">
        <div className="cv-compact__col-main">
          {cvData.experience.length > 0 && (
            <div className="cv-compact__section">
              <h3 style={{ color: cvData.accent }}>Deneyim</h3>
              {cvData.experience.map(item => (
                <div key={item.id} className="cv-compact__item">
                  <div className="cv-compact__item-head">
                    <strong>{item.company}</strong>
                    <span className="cv-compact__date">{formatDateRange(item.startDate, item.endDate, item.ongoing)}</span>
                  </div>
                  {formatLocation(item.city, item.district) && <p className="cv-compact__loc">📍 {formatLocation(item.city, item.district)}</p>}
                  {item.details.length > 0 && <ul className="cv-compact__bullets">{item.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
                </div>
              ))}
            </div>
          )}
          {cvData.education.length > 0 && (
            <div className="cv-compact__section">
              <h3 style={{ color: cvData.accent }}>Eğitim</h3>
              {cvData.education.map(item => (
                <div key={item.id} className="cv-compact__item">
                  <div className="cv-compact__item-head">
                    <strong>{item.school}</strong>
                    <span className="cv-compact__date">{formatDateRange(item.startDate, item.endDate, item.ongoing)}</span>
                  </div>
                  {item.note && <p className="muted cv-compact__text">{item.note}</p>}
                </div>
              ))}
            </div>
          )}
          {cvData.projects.length > 0 && (
            <div className="cv-compact__section">
              <h3 style={{ color: cvData.accent }}>Projeler</h3>
              {cvData.projects.map(item => (
                <div key={item.id} className="cv-compact__item">
                  <div className="cv-compact__item-head">
                    <strong>{item.name}</strong>
                    <span className="cv-compact__date">{formatDateRange(item.startDate, item.endDate, item.ongoing)}</span>
                  </div>
                  {item.details.length > 0 && <ul className="cv-compact__bullets">{item.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cv-compact__col-side">
          {cvData.skills.length > 0 && (
            <div className="cv-compact__section">
              <h3 style={{ color: cvData.accent }}>Beceriler</h3>
              <div className="cv-compact__tags">{cvData.skills.map(s => <span key={s} className="cv-compact__tag" style={{ borderColor: cvData.accent }}>{s}</span>)}</div>
            </div>
          )}
          {cvData.languages.length > 0 && (
            <div className="cv-compact__section">
              <h3 style={{ color: cvData.accent }}>Diller</h3>
              {cvData.languages.map(l => (
                <div key={l.lang} className="cv-compact__lang">
                  <span>{l.lang}</span><span style={{ color: cvData.accent, fontSize: '0.8em' }}>{l.level}</span>
                </div>
              ))}
            </div>
          )}
          {cvData.certificates.length > 0 && (
            <div className="cv-compact__section">
              <h3 style={{ color: cvData.accent }}>Sertifikalar</h3>
              {cvData.certificates.map(item => (
                <div key={item.id} className="cv-compact__item">
                  <strong style={{ fontSize: '0.83em' }}>{item.name}</strong>
                  <p className="muted cv-compact__text">{item.org} · {item.date}</p>
                </div>
              ))}
            </div>
          )}
          {cvData.competencies.length > 0 && (
            <div className="cv-compact__section">
              <h3 style={{ color: cvData.accent }}>Yetkinlikler</h3>
              <div className="cv-compact__tags">{cvData.competencies.map(c => <span key={c} className="cv-compact__tag" style={{ borderColor: cvData.accent }}>{c}</span>)}</div>
            </div>
          )}
          {cvData.interests.length > 0 && (
            <div className="cv-compact__section">
              <h3 style={{ color: cvData.accent }}>İlgi Alanları</h3>
              <p className="muted cv-compact__text" style={{ fontSize: '0.82em' }}>{cvData.interests.join(', ')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const loadExampleCV = (exampleData) => {
    setCvData(exampleData)
    setMode('preview')
    setIsExampleMode(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goToHomePage = () => {
    setCvData(defaultData)
    setMode('edit')
    setIsExampleMode(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleReset = () => {
    setCvData(defaultData)
    setShowConfirmModal(false)
  }

  // Dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', darkMode)
  }, [darkMode])

  // QR Kod oluştur
  useEffect(() => {
    if (!cvData.websiteUrl) { setQrDataUrl(''); return }
    QRCode.toDataURL(cvData.websiteUrl, { width: 80, margin: 1 })
      .then(url => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''))
  }, [cvData.websiteUrl])

  // AI: Kariyer hedefi yaz
  const handleAiObjective = async () => {
    setAiLoading('objective')
    try {
      const res = await fetch(`${API_URL}/api/ai/objective`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cvData.name, title: cvData.title, experience: cvData.experience, education: cvData.education }),
      })
      const data = await res.json()
      if (data.error) { showToast(data.error); return }
      handleFieldChange('objective', data.text)
    } catch { showToast('Bağlantı hatası. Sunucuyu kontrol edin.') }
    finally { setAiLoading('') }
  }

  // AI: Beceri öner
  const handleAiSuggestSkills = async () => {
    if (!cvData.title.trim()) { showToast('Önce Ünvan/Pozisyon alanını doldurun.', 'warning'); return }
    setAiLoading('skills')
    try {
      const res = await fetch(`${API_URL}/api/ai/suggest-skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: cvData.title, existing: cvData.skills }),
      })
      const data = await res.json()
      if (data.error) { showToast(data.error); return }
      const newSkills = data.skills.filter(s => !cvData.skills.includes(s))
      setCvData(prev => ({ ...prev, skills: [...prev.skills, ...newSkills] }))
    } catch { showToast('Bağlantı hatası. Sunucuyu kontrol edin.') }
    finally { setAiLoading('') }
  }

  // AI: Deneyim maddesi iyileştir
  const handleAiImproveBullet = async (expId, bulletIndex, bulletText) => {
    if (!bulletText.trim()) return
    setAiLoading(`bullet-${expId}-${bulletIndex}`)
    try {
      const exp = cvData.experience.find(e => e.id === expId)
      const res = await fetch(`${API_URL}/api/ai/improve-bullet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bullet: bulletText, position: exp?.company }),
      })
      const data = await res.json()
      if (data.error) { showToast(data.error); return }
      const newDetails = [...(exp?.details || [])]
      newDetails[bulletIndex] = data.text
      handleArrayChange('experience', expId, 'details', newDetails)
    } catch { showToast('Bağlantı hatası. Sunucuyu kontrol edin.') }
    finally { setAiLoading('') }
  }

  // AI durumunu kontrol et
  useEffect(() => {
    fetch(`${API_URL}/api/ai/status`)
      .then(r => r.json())
      .then(d => setAiAvailable(d.available))
      .catch(() => setAiAvailable(false))
  }, [])

  // JWT token ile backend'den kullanıcı bilgisini çek
  useEffect(() => {
    const initAuth = async () => {
      try {
        const url = new URL(window.location.href)
        const tokenFromUrl = url.searchParams.get('token')
        let token = tokenFromUrl || localStorage.getItem('cvToken')

        if (tokenFromUrl) {
          localStorage.setItem('cvToken', tokenFromUrl)
          url.searchParams.delete('token')
          window.history.replaceState({}, document.title, url.toString())
        }

        if (!token) {
          setAuthLoading(false)
          return
        }

        const res = await fetch(`${API_URL}/api/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) {
          localStorage.removeItem('cvToken')
          setAuthLoading(false)
          return
        }

        const data = await res.json()
        setUser(data.user)
        setIsLoggingIn(false)
      } catch (err) {
        console.error('Auth init error:', err)
        setIsLoggingIn(false)
      } finally {
        setAuthLoading(false)
      }
    }

    initAuth()
  }, [])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    // Animasyon için kısa bir bekleme
    await new Promise(resolve => setTimeout(resolve, 500))
    setUser(null)
    setShowProfile(false)
    setIsLoggingOut(false)
    localStorage.removeItem('cvToken')
  }

  // Profil popover dışına tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfile && 
          profilePopoverRef.current && 
          userPillRef.current &&
          !profilePopoverRef.current.contains(event.target) &&
          !userPillRef.current.contains(event.target)) {
        setShowProfile(false)
      }
    }

    if (showProfile) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showProfile])

  const handleGoogleLogin = () => {
    setIsLoggingIn(true)
    // Backend hazır olduğunda bu endpoint'e yönlendireceğiz
    window.location.href = `${API_URL}/auth/google`
  }

  const handleDeleteCv = async (cvId, e) => {
    e.stopPropagation() // CV'yi yüklemeyi engelle
    if (!confirm('Bu CV\'yi silmek istediğinize emin misiniz?')) {
      return
    }

    try {
      const token = localStorage.getItem('cvToken')
      if (!token) return

      const response = await fetch(`${API_URL}/api/cv/${cvId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('CV silinemedi')
      }

      // CV listesini yenile
      await loadUserCvs()
    } catch (error) {
      console.error('CV silme hatası:', error)
      alert('CV silinemedi. Lütfen tekrar deneyin.')
    }
  }

  const loadUserCvs = async () => {
    try {
      const token = localStorage.getItem('cvToken')
      if (!token) return
      const res = await fetch(`${API_URL}/api/cv`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) return
      const data = await res.json()
      setUserCvs(Array.isArray(data.cvs) ? data.cvs : [])
    } catch (err) {
      console.error('CV list load error:', err)
    }
  }

  const handleLoadCv = (cv) => {
    if (!cv || !cv.data) return
    try {
      const parsed = typeof cv.data === 'string' ? JSON.parse(cv.data) : cv.data
      setCvData(parsed)
      setMode('edit')
      setIsExampleMode(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error('CV parse error:', err)
      alert('Bu CV yüklenirken bir hata oluştu.')
    }
  }

  // Form üzerinde herhangi bir yere tıklandığında login zorunlu olsun
  const handleEditorClickCapture = (e) => {
    if (!authLoading && !user) {
      e.preventDefault()
      e.stopPropagation()
      alert('Devam etmek için önce giriş yapmalısınız.')
      setShowLogin(true)
    }
  }

  return (
    <div className="page">
      {/* Toast Bildirim */}
      {toast && (
        <div className={`toast toast--${toast.type}`} onClick={() => setToast(null)}>
          <span className="toast__icon">{toast.type === 'error' ? '⚠️' : toast.type === 'warning' ? '💡' : 'ℹ️'}</span>
          <span className="toast__msg">{toast.message}</span>
          {toast.type === 'error' && toast.message.includes('kota') && (
            <a href="https://platform.openai.com/settings/billing" target="_blank" rel="noreferrer" className="toast__link" onClick={e => e.stopPropagation()}>Kredi Ekle →</a>
          )}
          <button className="toast__close">✕</button>
        </div>
      )}
      {/* CV Yükle (AI Parse) */}
      {mode === 'edit' && (
        <div className="cv-upload-bar">
          <input
            ref={cvUploadRef}
            type="file"
            accept=".pdf,.doc,.docx"
            style={{ display: 'none' }}
            onChange={e => handleCvFileUpload(e.target.files?.[0])}
          />
          <div className="cv-upload-bar__info">
            <span className="cv-upload-bar__icon">📄</span>
            <div>
              <p className="cv-upload-bar__title">Mevcut CV&apos;nizi Yükleyin</p>
              <p className="cv-upload-bar__desc">PDF veya Word dosyanızı yükleyin, AI tüm alanları otomatik doldursun</p>
            </div>
          </div>
          <button
            className={`btn-cv-upload ${cvParseLoading ? 'loading' : ''} ${!aiAvailable ? 'disabled' : ''}`}
            onClick={() => aiAvailable ? cvUploadRef.current?.click() : showToast('AI aktif değil. Sunucuda OPENAI_API_KEY gerekli.', 'warning')}
            disabled={cvParseLoading}
            title={aiAvailable ? 'CV yükle ve otomatik doldur' : 'AI özelliği aktif değil'}
          >
            {cvParseLoading
              ? <><span className="spinner" />AI Okuyor...</>
              : <>{aiAvailable ? '✨' : '🔒'} CV Yükle &amp; Doldur</>}
          </button>
        </div>
      )}

      {/* Floating Örnek CV Kutucukları */}
      {mode === 'edit' && (
        <div className="floating-examples">
          <div className="floating-examples__label">Örnek CV'ler</div>
          {exampleCVs.map((example, index) => (
            <button
              key={example.id}
              className="floating-card"
              style={{ 
                '--card-color': example.color,
                '--card-delay': `${index * 0.5}s`
              }}
              onClick={() => loadExampleCV(example.data)}
              title={`${example.title} örneğini yükle`}
            >
              <span className="floating-card__icon">{example.icon}</span>
              <span className="floating-card__title">{example.title}</span>
            </button>
          ))}
        </div>
      )}

      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="CV Creater Logo" className="brand__logo" />
      <div>
            <p className="eyebrow">Profesyonel CV</p>
            <h1>CV Creater</h1>
      </div>
        </div>
        <div className="topbar__actions">
          <button
            className={`btn-premium-badge ${aiAvailable ? 'btn-premium-badge--active' : ''}`}
            onClick={() => setShowPremiumModal(true)}
            title={aiAvailable ? 'AI özellikleri aktif' : 'AI özelliklerini etkinleştir'}
          >
            {aiAvailable ? '🤖 AI Aktif' : '👑 Premium'}
          </button>
          <button
            className="btn ghost dark-toggle"
            onClick={() => setDarkMode(d => !d)}
            title={darkMode ? 'Aydınlık mod' : 'Karanlık mod'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          {mode === 'edit' && (
            <button 
              className="btn ghost reset-btn" 
              onClick={() => setShowConfirmModal(true)}
              title="Tüm formu sıfırla"
            >
              🔄 Formu Sıfırla
            </button>
          )}
          {user && !authLoading ? (
            <div className="user-area">
              <button
                ref={userPillRef}
                className="user-pill"
                type="button"
                onClick={async () => {
                  const next = !showProfile
                  setShowProfile(next)
                  if (next && userCvs.length === 0) {
                    await loadUserCvs()
                  }
                }}
              >
                <span className="user-pill__avatar">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </span>
                <span className="user-pill__name">{user.name}</span>
              </button>
              {showProfile && (
                <ProfilePopover
                  ref={profilePopoverRef}
                  user={user}
                  cvs={userCvs}
                  onLogout={handleLogout}
                  onLoadCv={handleLoadCv}
                  onDeleteCv={handleDeleteCv}
                />
              )}
            </div>
          ) : !authLoading ? (
            <button className="btn ghost" onClick={() => setShowLogin(true)}>
              Giriş Yap
            </button>
          ) : null}
          <button className={`btn ${mode === 'edit' ? 'primary' : 'ghost'}`} onClick={() => setMode('edit')}>
            Düzenle
        </button>
          <button className={`btn ${mode === 'preview' ? 'primary' : 'ghost'}`} onClick={() => setMode('preview')}>
            Canlı Önizleme / PDF
          </button>
      </div>
      </header>

      {mode === 'edit' && (
        <>
          {/* Doluluk + ATS Skoru Paneli */}
          {(() => {
            const cColor = cvCompletion.percentage >= 80 ? '#22c55e' : cvCompletion.percentage >= 50 ? '#f59e0b' : '#ef4444'
            const aColor = atsScore.score >= 75 ? '#22c55e' : atsScore.score >= 50 ? '#f59e0b' : '#ef4444'
            return (
              <div className="cv-stats-panel">
                <div className="cv-stats-panel__item">
                  <div className="cv-stats-ring">
                    <svg viewBox="0 0 72 72" width="74" height="74">
                      <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
                      <circle cx="36" cy="36" r="30" fill="none" stroke={cColor} strokeWidth="7"
                        strokeDasharray={`${(cvCompletion.percentage / 100) * 188.5} 188.5`} strokeLinecap="round" transform="rotate(-90 36 36)" />
                    </svg>
                    <div className="cv-stats-ring__text" style={{ color: cColor }}>
                      %{cvCompletion.percentage}
                    </div>
                  </div>
                  <div>
                    <span className="cv-stats-panel__label">Doluluk</span>
                    {cvCompletion.missing.length > 0 && (
                      <span className="cv-stats-panel__sub">{cvCompletion.missing.length} eksik alan</span>
                    )}
                  </div>
                </div>
                <div className="cv-stats-panel__divider" />
                <button className="cv-stats-panel__item cv-stats-panel__ats-btn" onClick={() => setShowAtsPanel(true)}>
                  <div className="cv-stats-ring">
                    <svg viewBox="0 0 72 72" width="74" height="74">
                      <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
                      <circle cx="36" cy="36" r="30" fill="none" stroke={aColor} strokeWidth="7"
                        strokeDasharray={`${(atsScore.score / 100) * 188.5} 188.5`} strokeLinecap="round" transform="rotate(-90 36 36)" />
                    </svg>
                    <div className="cv-stats-ring__text" style={{ color: aColor }}>
                      {atsScore.score}
                    </div>
                  </div>
                  <div>
                    <span className="cv-stats-panel__label">ATS Skoru</span>
                    <span className="cv-stats-panel__sub cv-stats-panel__sub--link">Detayları gör →</span>
                  </div>
                </button>
              </div>
            )
          })()}

          <div className="edit-layout">
            <main className="editor" onClickCapture={handleEditorClickCapture}>
            {/* Fotoğraf Yükleme */}
            <FormSection title="Profil Fotoğrafı" icon="📷">
              <div className="photo-upload">
                <div className="photo-upload__preview">
                  <div className={`photo-preview ${getAvatarClass()}`}>
                    {cvData.avatar ? (
                      <img src={cvData.avatar} alt="Profil" />
                    ) : (
                      <span className="photo-placeholder">📷</span>
                    )}
                  </div>
                  <div className="photo-upload__actions">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                    <button className="btn primary" onClick={() => fileInputRef.current?.click()}>
                      Fotoğraf Yükle
                    </button>
                    {cvData.avatar && (
                      <>
                        <button className="btn ghost" onClick={() => {
                          setImageToCrop(cvData.avatar)
                          setShowCropModal(true)
                        }}>
                          Kırp
                        </button>
                        <button className="btn ghost" onClick={() => handleFieldChange('avatar', '')}>
                          Kaldır
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="photo-shape-selector">
                  <p className="photo-shape-selector__label">Fotoğraf şekli:</p>
                  <div className="shape-options">
                    <button
                      className={`shape-option ${cvData.avatarShape === 'circle' ? 'active' : ''}`}
                      onClick={() => handleFieldChange('avatarShape', 'circle')}
                    >
                      <span className="shape-demo shape-demo--circle"></span>
                      Daire
                    </button>
                    <button
                      className={`shape-option ${cvData.avatarShape === 'rounded' ? 'active' : ''}`}
                      onClick={() => handleFieldChange('avatarShape', 'rounded')}
                    >
                      <span className="shape-demo shape-demo--rounded"></span>
                      Yuvarlak Köşe
                    </button>
                    <button
                      className={`shape-option ${cvData.avatarShape === 'square' ? 'active' : ''}`}
                      onClick={() => handleFieldChange('avatarShape', 'square')}
                    >
                      <span className="shape-demo shape-demo--square"></span>
                      Kare
                    </button>
                  </div>
                </div>
              </div>
            </FormSection>

            {/* Kimlik ve İletişim */}
            <FormSection title="Kimlik ve İletişim" icon="👤">
              <div className="grid four">
                <Input label="Ad Soyad" value={cvData.name} onChange={(v) => handleFieldChange('name', v)} />
                <Input label="Ünvan / Pozisyon" value={cvData.title} onChange={(v) => handleFieldChange('title', v)} />
                <Input label="Telefon" value={cvData.phone} onChange={(v) => handleFieldChange('phone', v)} />
                <Input label="E-posta" value={cvData.email} onChange={(v) => handleFieldChange('email', v)} />
              </div>

              <div className="grid two">
                <LocationSelector
                  label="Konum"
                  city={cvData.city}
                  district={cvData.district}
                  onCityChange={(v) => {
                    handleFieldChange('city', v)
                    handleFieldChange('district', '')
                  }}
                  onDistrictChange={(v) => handleFieldChange('district', v)}
                />
                <DateSelector
                  label="Doğum Tarihi"
                  day={cvData.birthDay}
                  month={cvData.birthMonth}
                  year={cvData.birthYear}
                  onDayChange={(v) => handleFieldChange('birthDay', v)}
                  onMonthChange={(v) => handleFieldChange('birthMonth', v)}
                  onYearChange={(v) => handleFieldChange('birthYear', v)}
                />
              </div>

              <Input
                label="Website / LinkedIn URL (QR Kod için)"
                value={cvData.websiteUrl || ''}
                onChange={(v) => handleFieldChange('websiteUrl', v)}
                placeholder="Örn: linkedin.com/in/adiniz veya github.com/adiniz"
              />

              <div className="ai-field-wrapper">
                <Textarea
                  label="Kariyer Hedefi / Özet"
                  rows={3}
                  value={cvData.objective}
                  onChange={(v) => handleFieldChange('objective', v)}
                  placeholder="Kendinizi kısaca tanıtın ve kariyer hedeflerinizi belirtin..."
                />
                <button
                  className={`btn-ai ${aiLoading === 'objective' ? 'loading' : ''}`}
                  onClick={handleAiObjective}
                  disabled={aiLoading === 'objective'}
                  title="AI ile otomatik yaz"
                >
                  {aiLoading === 'objective' ? '⏳ Yazıyor...' : '✨ AI ile Yaz'}
                </button>
              </div>
            </FormSection>

            {/* Deneyimler */}
            <FormSection
              title="İş Deneyimi"
              icon="💼"
              onAdd={() => addItem('experience', {
                company: '',
                city: '',
                district: '',
                startDate: '',
                endDate: '',
                ongoing: false,
                details: [],
              })}
            >
              {cvData.experience.map((item) => (
                <div className="card" key={item.id}>
                  <button className="card__remove" onClick={() => removeItem('experience', item.id)} title="Sil">×</button>
                  <Input
                    label="Pozisyon / Şirket"
                    value={item.company}
                    onChange={(v) => handleArrayChange('experience', item.id, 'company', v)}
                    placeholder="Örn: Yazılım Geliştirici, ABC Teknoloji"
                  />
                  <LocationSelector
                    label="Çalışma Yeri"
                    city={item.city}
                    district={item.district}
                    onCityChange={(v) => {
                      handleArrayChange('experience', item.id, 'city', v)
                      handleArrayChange('experience', item.id, 'district', '')
                    }}
                    onDistrictChange={(v) => handleArrayChange('experience', item.id, 'district', v)}
                  />
                  <DateRangeInput
                    startDate={item.startDate}
                    endDate={item.endDate}
                    ongoing={item.ongoing}
                    onStartChange={(v) => handleArrayChange('experience', item.id, 'startDate', v)}
                    onEndChange={(v) => handleArrayChange('experience', item.id, 'endDate', v)}
                    onOngoingChange={(v) => handleArrayChange('experience', item.id, 'ongoing', v)}
                  />
                  <Textarea
                    label="Sorumluluklar ve Başarılar (her satıra bir madde)"
                    rows={3}
                    value={item.details.join('\n')}
                    onChange={(v) => handleDetailsChange('experience', item.id, v)}
                    placeholder="• Proje yönettim&#10;• Satışları %20 artırdım"
                  />
                  {item.details.length > 0 && (
                    <div className="ai-bullets-row">
                      {item.details.map((bullet, bi) => (
                        <button
                          key={bi}
                          className={`btn-ai btn-ai--small ${aiLoading === `bullet-${item.id}-${bi}` ? 'loading' : ''}`}
                          onClick={() => handleAiImproveBullet(item.id, bi, bullet)}
                          disabled={!!aiLoading}
                          title={`"${bullet.slice(0, 40)}..." maddesini AI ile iyileştir`}
                        >
                          {aiLoading === `bullet-${item.id}-${bi}` ? '⏳' : '✨'} Madde {bi + 1}&apos;i İyileştir
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </FormSection>

            {/* Eğitim */}
            <FormSection
              title="Eğitim"
              icon="🎓"
              onAdd={() => addItem('education', {
                school: '',
                city: '',
                district: '',
                startDate: '',
                endDate: '',
                ongoing: false,
                note: '',
              })}
            >
              {cvData.education.map((item) => (
                <div className="card" key={item.id}>
                  <button className="card__remove" onClick={() => removeItem('education', item.id)} title="Sil">×</button>
                  <Input
                    label="Okul / Program"
                    value={item.school}
                    onChange={(v) => handleArrayChange('education', item.id, 'school', v)}
                    placeholder="Örn: İstanbul Üniversitesi, Bilgisayar Mühendisliği"
                  />
                  <LocationSelector
                    label="Okul Konumu"
                    city={item.city}
                    district={item.district}
                    onCityChange={(v) => {
                      handleArrayChange('education', item.id, 'city', v)
                      handleArrayChange('education', item.id, 'district', '')
                    }}
                    onDistrictChange={(v) => handleArrayChange('education', item.id, 'district', v)}
                  />
                  <DateRangeInput
                    startDate={item.startDate}
                    endDate={item.endDate}
                    ongoing={item.ongoing}
                    onStartChange={(v) => handleArrayChange('education', item.id, 'startDate', v)}
                    onEndChange={(v) => handleArrayChange('education', item.id, 'endDate', v)}
                    onOngoingChange={(v) => handleArrayChange('education', item.id, 'ongoing', v)}
                  />
                  <Input
                    label="Not (GPA, Onur derecesi vb.)"
                    value={item.note}
                    onChange={(v) => handleArrayChange('education', item.id, 'note', v)}
                    placeholder="İsteğe bağlı"
                  />
                </div>
              ))}
            </FormSection>

            {/* Projeler */}
            <FormSection
              title="Projeler"
              icon="🚀"
              onAdd={() => addItem('projects', {
                name: '',
                startDate: '',
                endDate: '',
                ongoing: false,
                details: [],
              })}
            >
              {cvData.projects.map((item) => (
                <div className="card" key={item.id}>
                  <button className="card__remove" onClick={() => removeItem('projects', item.id)} title="Sil">×</button>
                  <Input
                    label="Proje Adı"
                    value={item.name}
                    onChange={(v) => handleArrayChange('projects', item.id, 'name', v)}
                    placeholder="Örn: E-ticaret Web Uygulaması"
                  />
                  <DateRangeInput
                    startDate={item.startDate}
                    endDate={item.endDate}
                    ongoing={item.ongoing}
                    onStartChange={(v) => handleArrayChange('projects', item.id, 'startDate', v)}
                    onEndChange={(v) => handleArrayChange('projects', item.id, 'endDate', v)}
                    onOngoingChange={(v) => handleArrayChange('projects', item.id, 'ongoing', v)}
                  />
                  <Textarea
                    label="Proje Detayları (her satıra bir madde)"
                    rows={2}
                    value={item.details.join('\n')}
                    onChange={(v) => handleDetailsChange('projects', item.id, v)}
                    placeholder="• Kullanılan teknolojiler&#10;• Elde edilen sonuçlar"
                  />
                </div>
              ))}
            </FormSection>

            {/* Aktiviteler */}
            <FormSection
              title="Aktiviteler / Gönüllülük"
              icon="🤝"
              onAdd={() => addItem('activities', {
                name: '',
                city: '',
                district: '',
                startDate: '',
                endDate: '',
                ongoing: false,
                details: [],
              })}
            >
              {cvData.activities.map((item) => (
                <div className="card" key={item.id}>
                  <button className="card__remove" onClick={() => removeItem('activities', item.id)} title="Sil">×</button>
                  <Input
                    label="Kulüp / Rol"
                    value={item.name}
                    onChange={(v) => handleArrayChange('activities', item.id, 'name', v)}
                    placeholder="Örn: Başkan, Yazılım Kulübü"
                  />
                  <LocationSelector
                    label="Konum"
                    city={item.city}
                    district={item.district}
                    onCityChange={(v) => {
                      handleArrayChange('activities', item.id, 'city', v)
                      handleArrayChange('activities', item.id, 'district', '')
                    }}
                    onDistrictChange={(v) => handleArrayChange('activities', item.id, 'district', v)}
                  />
                  <DateRangeInput
                    startDate={item.startDate}
                    endDate={item.endDate}
                    ongoing={item.ongoing}
                    onStartChange={(v) => handleArrayChange('activities', item.id, 'startDate', v)}
                    onEndChange={(v) => handleArrayChange('activities', item.id, 'endDate', v)}
                    onOngoingChange={(v) => handleArrayChange('activities', item.id, 'ongoing', v)}
                  />
                  <Textarea
                    label="Katkılar (her satıra bir madde)"
                    rows={2}
                    value={item.details.join('\n')}
                    onChange={(v) => handleDetailsChange('activities', item.id, v)}
                  />
                </div>
              ))}
            </FormSection>

            {/* Sertifikalar */}
            <FormSection
              title="Sertifikalar"
              icon="📜"
              onAdd={() => addItem('certificates', {
                name: '',
                org: '',
                date: '',
              })}
            >
              {cvData.certificates.map((item) => (
                <div className="card" key={item.id}>
                  <button className="card__remove" onClick={() => removeItem('certificates', item.id)} title="Sil">×</button>
                  <div className="grid two">
                    <Input
                      label="Sertifika Adı"
                      value={item.name}
                      onChange={(v) => handleArrayChange('certificates', item.id, 'name', v)}
                      placeholder="Örn: AWS Solutions Architect"
                    />
                    <Input
                      label="Veren Kurum"
                      value={item.org}
                      onChange={(v) => handleArrayChange('certificates', item.id, 'org', v)}
                      placeholder="Örn: Amazon Web Services"
                    />
                  </div>
                  <Input
                    label="Tarih"
                    value={item.date}
                    onChange={(v) => handleArrayChange('certificates', item.id, 'date', v)}
                    placeholder="Örn: Mart 2024"
                  />
                </div>
              ))}
            </FormSection>

            {/* Referanslar */}
            <FormSection
              title="Referanslar"
              icon="🤝"
              onAdd={() => addItem('references', { name: '', title: '', company: '', phone: '', email: '' })}
            >
              {(cvData.references || []).map((item) => (
                <div className="card" key={item.id}>
                  <button className="card__remove" onClick={() => removeItem('references', item.id)} title="Sil">×</button>
                  <div className="grid two">
                    <Input label="Ad Soyad" value={item.name} onChange={(v) => handleArrayChange('references', item.id, 'name', v)} placeholder="Örn: Mehmet Yılmaz" />
                    <Input label="Ünvan" value={item.title} onChange={(v) => handleArrayChange('references', item.id, 'title', v)} placeholder="Örn: Yazılım Müdürü" />
                  </div>
                  <div className="grid three">
                    <Input label="Şirket" value={item.company} onChange={(v) => handleArrayChange('references', item.id, 'company', v)} placeholder="Örn: ABC Teknoloji" />
                    <Input label="Telefon" value={item.phone} onChange={(v) => handleArrayChange('references', item.id, 'phone', v)} placeholder="Örn: 0532 xxx xx xx" />
                    <Input label="E-posta" value={item.email} onChange={(v) => handleArrayChange('references', item.id, 'email', v)} placeholder="Örn: mehmet@abc.com" />
                  </div>
                </div>
              ))}
            </FormSection>

            {/* Beceriler */}
            <FormSection title="Teknik Beceriler" icon="⚡">
              <div className="skill-selector">
                <div className="ai-skills-header">
                  <p className="skill-selector__label">Meslek kategorisi seçin ve becerileri ekleyin:</p>
                  <button
                    className={`btn-ai ${aiLoading === 'skills' ? 'loading' : ''}`}
                    onClick={handleAiSuggestSkills}
                    disabled={!!aiLoading}
                    title="Pozisyonunuza göre AI beceri önerisi alın"
                  >
                    {aiLoading === 'skills' ? '⏳ Öneriliyor...' : '✨ AI ile Öner'}
                  </button>
                </div>
                <div className="category-tabs">
                  {Object.keys(skillCategories).map((cat) => (
                    <button
                      key={cat}
                      className={`category-tab ${activeSkillCategory === cat ? 'active' : ''}`}
                      onClick={() => setActiveSkillCategory(activeSkillCategory === cat ? '' : cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {activeSkillCategory && (
                  <div className="skill-chips">
                    {skillCategories[activeSkillCategory].map((skill) => (
                      <button
                        key={skill}
                        className={`chip ${cvData.skills.includes(skill) ? 'selected' : ''}`}
                        onClick={() => toggleSkill(skill)}
                      >
                        {skill}
                        {cvData.skills.includes(skill) ? ' ✓' : ' +'}
                      </button>
                    ))}
                  </div>
                )}

                <div className="custom-add">
                  <p className="custom-add__label">Listede yok mu? Manuel ekleyin:</p>
                  <div className="custom-add__row">
                    <input
                      type="text"
                      value={customSkill}
                      onChange={(e) => setCustomSkill(e.target.value)}
                      placeholder="Beceri adı yazın..."
                      onKeyDown={(e) => e.key === 'Enter' && addCustomSkill()}
                    />
                    <button className="btn-add-small" onClick={addCustomSkill}>+ Ekle</button>
                  </div>
                </div>

                <div className="selected-items">
                  <p className="selected-items__label">Seçili beceriler:</p>
                  <div className="selected-chips">
                    {cvData.skills.length === 0 ? (
                      <span className="empty-text">Henüz beceri seçilmedi</span>
                    ) : (
                      cvData.skills.map((skill) => (
                        <span key={skill} className="chip selected">
                          {skill}
                          <button className="chip__remove" onClick={() => toggleSkill(skill)}>×</button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </FormSection>

            {/* Yetkinlikler */}
            <FormSection title="Kişisel Yetkinlikler" icon="🎯">
              <div className="skill-selector">
                <p className="skill-selector__label">Kategori seçin ve yetkinliklerinizi ekleyin:</p>
                <div className="category-tabs">
                  {Object.keys(competencyCategories).map((cat) => (
                    <button
                      key={cat}
                      className={`category-tab ${activeCompetencyCategory === cat ? 'active' : ''}`}
                      onClick={() => setActiveCompetencyCategory(activeCompetencyCategory === cat ? '' : cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {activeCompetencyCategory && (
                  <div className="skill-chips">
                    {competencyCategories[activeCompetencyCategory].map((comp) => (
                      <button
                        key={comp}
                        className={`chip ${cvData.competencies.includes(comp) ? 'selected' : ''}`}
                        onClick={() => toggleCompetency(comp)}
                      >
                        {comp}
                        {cvData.competencies.includes(comp) ? ' ✓' : ' +'}
                      </button>
                    ))}
                  </div>
                )}

                <div className="custom-add">
                  <p className="custom-add__label">Listede yok mu? Manuel ekleyin:</p>
                  <div className="custom-add__row">
                    <input
                      type="text"
                      value={customCompetency}
                      onChange={(e) => setCustomCompetency(e.target.value)}
                      placeholder="Yetkinlik adı yazın..."
                      onKeyDown={(e) => e.key === 'Enter' && addCustomCompetency()}
                    />
                    <button className="btn-add-small" onClick={addCustomCompetency}>+ Ekle</button>
                  </div>
                </div>

                <div className="selected-items">
                  <p className="selected-items__label">Seçili yetkinlikler:</p>
                  <div className="selected-chips">
                    {cvData.competencies.length === 0 ? (
                      <span className="empty-text">Henüz yetkinlik seçilmedi</span>
                    ) : (
                      cvData.competencies.map((comp) => (
                        <span key={comp} className="chip selected">
                          {comp}
                          <button className="chip__remove" onClick={() => toggleCompetency(comp)}>×</button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </FormSection>

            {/* Diller */}
            <FormSection title="Yabancı Diller" icon="🌍">
              <div className="skill-selector">
                <p className="skill-selector__label">Dil seçin ve seviyesini belirleyin:</p>
                <div className="skill-chips">
                  {languageOptions.map((lang) => (
                    <button
                      key={lang}
                      className={`chip ${cvData.languages.find((l) => l.lang === lang) ? 'selected' : ''}`}
                      onClick={() => cvData.languages.find((l) => l.lang === lang) ? removeLanguage(lang) : addLanguage(lang)}
                    >
                      {lang}
                      {cvData.languages.find((l) => l.lang === lang) ? ' ✓' : ' +'}
                    </button>
                  ))}
                </div>

                <div className="custom-add">
                  <p className="custom-add__label">Listede yok mu? Manuel ekleyin:</p>
                  <div className="custom-add__row">
                    <input
                      type="text"
                      value={customLanguage}
                      onChange={(e) => setCustomLanguage(e.target.value)}
                      placeholder="Dil adı yazın..."
                      onKeyDown={(e) => e.key === 'Enter' && addCustomLanguage()}
                    />
                    <button className="btn-add-small" onClick={addCustomLanguage}>+ Ekle</button>
                  </div>
                </div>

                <div className="selected-items">
                  <p className="selected-items__label">Seçili diller ve seviyeler:</p>
                  <div className="language-list">
                    {cvData.languages.length === 0 ? (
                      <span className="empty-text">Henüz dil seçilmedi</span>
                    ) : (
                      cvData.languages.map((item) => (
                        <div key={item.lang} className="language-item">
                          <span className="language-item__name">{item.lang}</span>
                          <select
                            value={item.level}
                            onChange={(e) => updateLanguageLevel(item.lang, e.target.value)}
                            className="language-item__select"
                          >
                            {languageLevels.map((lvl) => (
                              <option key={lvl} value={lvl}>{lvl}</option>
                            ))}
                          </select>
                          <button className="language-item__remove" onClick={() => removeLanguage(item.lang)}>×</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </FormSection>

            {/* İlgi Alanları */}
            <FormSection title="İlgi Alanları" icon="❤️">
              <Textarea
                label="İlgi alanlarınız (virgülle ayırın)"
                rows={2}
                value={cvData.interests.join(', ')}
                onChange={(v) => handleFieldChange('interests', v.split(',').map((i) => i.trim()).filter(Boolean))}
                placeholder="Örn: Teknoloji, Spor, Müzik, Seyahat"
              />
            </FormSection>
          </main>
          </div>

          {/* Hero - Sayfa Altında */}
          <div className="hero">
            <div className="hero__text">
              <p className="eyebrow">Sade • Modern • PDF Hazır</p>
              <h2>Profesyonel CV'nizi dakikalar içinde oluşturun</h2>
              <p className="lede">
                Kategorilere ayrılmış alanları doldurun, becerilerinizi seçin ve tek tıkla PDF indirin.
              </p>
              <div className="hero__cta">
                <button className="btn primary" onClick={() => setMode('preview')}>
                  Canlı Önizlemeye geç
                </button>
                <div className="color-input">
                  <label htmlFor="accent">Tema rengi</label>
                  <input
                    id="accent"
                    type="color"
                    value={cvData.accent}
                    onChange={(e) => handleFieldChange('accent', e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="hero__glow" />
            <div className="hero__orb" />
          </div>
        </>
      )}

      {/* Crop Modal */}
      {showCropModal && imageToCrop && (
        <div className="crop-modal-overlay" onClick={cancelCrop}>
          <div className="crop-modal" onClick={(e) => e.stopPropagation()}>
            <div className="crop-modal__header">
              <h3>Fotoğrafı Kırp</h3>
              <button className="crop-modal__close" onClick={cancelCrop}>×</button>
            </div>
            <div 
              className="crop-container"
              ref={cropContainerRef}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={(e) => {
                e.preventDefault()
                handleZoom(e.deltaY)
              }}
            >
              <img
                ref={cropImageRef}
                src={imageToCrop}
                alt="Crop"
                className="crop-image"
                style={{
                  transform: `scale(${imageScale}) translate(${imagePosition.x / imageScale}px, ${imagePosition.y / imageScale}px)`,
                  transformOrigin: 'top left'
                }}
                onMouseDown={handleImageMouseDown}
                onMouseMove={handleImageMouseMove}
                onMouseUp={handleMouseUp}
              />
              <div
                className="crop-overlay"
                style={{
                  left: `${cropArea.x}px`,
                  top: `${cropArea.y}px`,
                  width: `${cropArea.width}px`,
                  height: `${cropArea.height}px`
                }}
              />
              <div 
                className="crop-area"
                style={{
                  left: `${cropArea.x}px`,
                  top: `${cropArea.y}px`,
                  width: `${cropArea.width}px`,
                  height: `${cropArea.height}px`
                }}
                onMouseDown={handleCropAreaMouseDown}
              >
                <div 
                  className="crop-handle crop-handle--nw" 
                  onMouseDown={(e) => handleResizeStart('nw', e)}
                />
                <div 
                  className="crop-handle crop-handle--ne" 
                  onMouseDown={(e) => handleResizeStart('ne', e)}
                />
                <div 
                  className="crop-handle crop-handle--sw" 
                  onMouseDown={(e) => handleResizeStart('sw', e)}
                />
                <div 
                  className="crop-handle crop-handle--se" 
                  onMouseDown={(e) => handleResizeStart('se', e)}
                />
              </div>
            </div>
            <div className="crop-modal__controls">
              <div className="crop-zoom-controls">
                <button className="btn ghost" onClick={() => handleZoom(-1)}>🔍-</button>
                <span>{Math.round(imageScale * 100)}%</span>
                <button className="btn ghost" onClick={() => handleZoom(1)}>🔍+</button>
              </div>
              <div className="crop-modal__actions">
                <button className="btn ghost" onClick={cancelCrop}>İptal</button>
                <button className="btn primary" onClick={applyCrop}>Uygula</button>
              </div>
            </div>
            <p className="crop-help-text">
              💡 Fotoğrafı sürükleyerek konumlandırın, fare tekerleği ile yakınlaştırın/uzaklaştırın
            </p>
          </div>
        </div>
      )}

      {mode === 'preview' && (
        <div className="preview-screen">
          <div className="preview-actions">
            {isExampleMode ? (
              <button className="btn ghost" onClick={goToHomePage}>
                ← Ana sayfaya dön
              </button>
            ) : (
              <>
                <button className="btn ghost" onClick={() => setMode('edit')}>
                  ← Düzenlemeye dön
                </button>
                <button className="btn primary" onClick={handlePayment}>
                  📄 PDF İndir
                </button>
              </>
            )}
            {isExampleMode && (
              <span className="example-badge">Örnek CV - Sadece Görüntüleme</span>
            )}
          </div>

          <div className="preview-template-bar">
            <span className="preview-template-bar__label">Şablon:</span>
            {[
              { id: 'classic', label: 'Klasik', icon: '📋' },
              { id: 'modern', label: 'Modern', icon: '🗂️' },
              { id: 'minimal', label: 'Minimal', icon: '🤍' },
              { id: 'creative', label: 'Yaratıcı', icon: '🎨' },
              { id: 'compact', label: 'Kompakt', icon: '⚡' },
            ].map((t) => (
              <button
                key={t.id}
                className={`preview-template-btn ${template === t.id ? 'active' : ''}`}
                onClick={() => setTemplate(t.id)}
              >
                <span className="preview-template-btn__icon">{t.icon}</span>
                <span className="preview-template-btn__name">{t.label}</span>
              </button>
            ))}
            <div className="preview-template-bar__color">
              <label htmlFor="accent-preview">🎨</label>
              <input
                id="accent-preview"
                type="color"
                value={cvData.accent}
                onChange={(e) => handleFieldChange('accent', e.target.value)}
              />
            </div>
          </div>

          <div className="cv-wrapper">
            {renderCv(cvRef)}
          </div>
        </div>
      )}
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onGoogleLogin={handleGoogleLogin}
        />
      )}
      {showPdfModal && (
        <PdfDownloadModal
          onClose={() => setShowPdfModal(false)}
          onSaveAndDownload={handleSaveAndDownload}
          onDownloadOnly={handleDownloadOnly}
          isLoggedIn={!!user}
        />
      )}
      {isLoggingIn && (
        <LoadingOverlay message="Giriş yapılıyor..." />
      )}
      {isDownloading && (
        <LoadingOverlay message={downloadMessage} />
      )}
      {isLoggingOut && (
        <LoadingOverlay message="Çıkış yapılıyor..." />
      )}
      {showConfirmModal && (
        <ConfirmModal
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleReset}
          title="Formu Sıfırla"
          message="Tüm form verilerini sıfırlamak istediğinize emin misiniz? Bu işlem geri alınamaz."
        />
      )}
      {showAtsPanel && (
        <AtsModal score={atsScore} onClose={() => setShowAtsPanel(false)} />
      )}
      {showPremiumModal && (
        <PremiumModal aiAvailable={aiAvailable} onClose={() => setShowPremiumModal(false)} onUpgrade={() => { setShowPremiumModal(false); handlePayment() }} />
      )}
    </div>
  )
}

function Section({ title, accent, children }) {
  return (
    <div className="section">
      <h3 style={{ color: accent }}>{title}</h3>
      <div className="section__content">{children}</div>
    </div>
  )
}

function LoginModal({ onClose, onGoogleLogin }) {
  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <div className="login-modal__header">
          <div className="login-modal__brand">
            <img src="/logo.png" alt="CV Creater Logo" className="login-modal__logo" />
            <h3>Giriş Yap</h3>
          </div>
          <button className="login-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="login-modal__body">
          <p className="login-modal__text">
            CV oluşturmak ve kaydetmek için önce giriş yapmalısınız.
          </p>
          <button className="btn primary login-modal__button" onClick={onGoogleLogin}>
            Google ile Giriş Yap
          </button>
        </div>
      </div>
    </div>
  )
}

function PdfDownloadModal({ onClose, onSaveAndDownload, onDownloadOnly, isLoggedIn }) {
  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <div className="login-modal__header">
          <div className="login-modal__brand">
            <img src="/logo.png" alt="CV Creater Logo" className="login-modal__logo" />
            <h3>PDF İndir</h3>
          </div>
          <button className="login-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="login-modal__body">
          <p className="login-modal__text">
            CV'nizi kaydetmek ve indirmek için bir seçenek belirleyin.
          </p>
          {isLoggedIn && (
            <p className="login-modal__warning">
              ⚠️ Kaydedilen CV'ler 1 hafta sonra otomatik olarak silinir.
            </p>
          )}
          <div className="pdf-modal__buttons">
            {isLoggedIn && (
              <button className="btn primary login-modal__button" onClick={onSaveAndDownload}>
                💾 Kaydet ve İndir — <strong>100 TL</strong>
              </button>
            )}
            <button className="btn ghost login-modal__button" onClick={onDownloadOnly}>
              📄 Sadece İndir — <strong>50 TL</strong>
            </button>
          </div>
          {!isLoggedIn && (
            <p className="login-modal__info">
              CV'nizi kaydetmek için giriş yapmanız gerekiyor.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadingOverlay({ message }) {
  return (
    <div className="loading-overlay">
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p className="loading-message">{message}</p>
      </div>
    </div>
  )
}

function ConfirmModal({ onClose, onConfirm, title, message }) {
  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <div className="login-modal__header">
          <div className="login-modal__brand">
            <img src="/logo.png" alt="CV Creater Logo" className="login-modal__logo" />
            <h3>{title}</h3>
          </div>
          <button className="login-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="login-modal__body">
          <p className="login-modal__text">
            {message}
          </p>
          <div className="pdf-modal__buttons">
            <button className="btn primary login-modal__button" onClick={onConfirm}>
              ✓ Evet, Sıfırla
            </button>
            <button className="btn ghost login-modal__button" onClick={onClose}>
              ✗ İptal
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const ProfilePopover = forwardRef(({ user, cvs, onLogout, onLoadCv, onDeleteCv }, ref) => {
  return (
    <div className="profile-popover" ref={ref}>
      <div className="profile-popover__top">
        <div className="profile-popover__avatar">
          {user.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="profile-popover__info">
          <p className="profile-popover__name">{user.name}</p>
          <p className="profile-popover__email">{user.email}</p>
          {user.is_admin && (
            <span className="profile-popover__badge">
              <span className="profile-popover__badge-icon">👑</span>
              Admin
            </span>
          )}
        </div>
      </div>
      <div className="profile-popover__section">
        <div className="profile-popover__section-header">
          <span className="profile-popover__section-icon">📄</span>
          <p className="profile-popover__section-title">Kayıtlı CV&#39;ler</p>
        </div>
        <div className="profile-popover__cv-list">
          {(!cvs || cvs.length === 0) && (
            <div className="profile-popover__cv-empty">
              <span className="profile-popover__cv-empty-icon">📭</span>
              <span>Henüz kayıtlı CV&#39;niz yok.</span>
            </div>
          )}
          {cvs && cvs.map((cv) => (
            <div
              key={cv.id}
              className="profile-popover__cv-item-wrapper"
            >
              <button
                type="button"
                className="profile-popover__cv-item"
                onClick={() => onLoadCv(cv)}
              >
                <div className="profile-popover__cv-item-content">
                  <span className="profile-popover__cv-title">{cv.title || 'İsimsiz CV'}</span>
                  {cv.updated_at && (
                    <span className="profile-popover__cv-date">
                      📅 {new Date(cv.updated_at).toLocaleDateString('tr-TR')}
                    </span>
                  )}
                </div>
              </button>
              <button
                type="button"
                className="profile-popover__cv-delete"
                onClick={(e) => onDeleteCv(cv.id, e)}
                title="CV'yi Sil"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="profile-popover__footer">
        <button className="btn ghost profile-popover__logout" onClick={onLogout}>
          <span className="profile-popover__logout-icon">🚪</span>
          Çıkış Yap
        </button>
      </div>
    </div>
  )
})

ProfilePopover.displayName = 'ProfilePopover'

function Item({ title, subtitle, location, children }) {
  return (
    <div className="item">
      <div className="item__head">
        <div className="item__info">
          <p className="item__title">{title}</p>
          {location && <span className="item__location">📍 {location}</span>}
        </div>
        {subtitle && <span className="item__subtitle">{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

function FormSection({ title, icon, children, onAdd }) {
  return (
    <section className="form-section">
      <div className="form-section__head">
        <div className="form-section__title">
          {icon && <span className="form-section__icon">{icon}</span>}
          <h3>{title}</h3>
        </div>
        {onAdd && (
          <button className="btn-add" onClick={onAdd} title="Yeni ekle">
            <span>+</span> Ekle
        </button>
        )}
      </div>
      <div className="form-section__body">{children}</div>
    </section>
  )
}

function Input({ label, value, onChange, placeholder }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

function Textarea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

function LocationSelector({ label, city, district, onCityChange, onDistrictChange }) {
  const cities = useMemo(() => {
    // 81 il + (varsa) Yurt Dışı
    const extras = turkeyLocations['Yurt Dışı'] ? ['Yurt Dışı'] : []
    return [...turkeyProvinces, ...extras]
  }, [])

  const districts = city ? turkeyLocations[city] || [] : []

  return (
    <div className="location-selector">
      <span className="field-label">{label}</span>
      <div className="location-selector__row">
        <div className="location-selector__col">
          <select value={city} onChange={(e) => onCityChange(e.target.value)}>
            <option value="">İl Seçin</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="location-selector__col">
          <select value={district} onChange={(e) => onDistrictChange(e.target.value)} disabled={!city || districts.length === 0}>
            <option value="">{city ? (districts.length ? 'İlçe Seçin' : 'Bu il için ilçe listesi yok') : 'İlçe Seçin'}</option>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

function DateSelector({ label, day, month, year, onDayChange, onMonthChange, onYearChange }) {
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))

  return (
    <div className="date-selector">
      <span className="field-label">{label}</span>
      <div className="date-selector__row">
        <select value={day} onChange={(e) => onDayChange(e.target.value)}>
          <option value="">Gün</option>
          {days.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={month} onChange={(e) => onMonthChange(e.target.value)}>
          <option value="">Ay</option>
          {months.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select value={year} onChange={(e) => onYearChange(e.target.value)}>
          <option value="">Yıl</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function PremiumModal({ onClose, aiAvailable }) {
  const features = [
    { icon: '✨', title: 'AI ile Kariyer Hedefi', desc: 'Tek tıkla profesyonel özet oluştur', ai: true },
    { icon: '⚡', title: 'AI Beceri Önerisi', desc: 'Pozisyonuna göre beceri listesi al', ai: true },
    { icon: '🔥', title: 'AI Deneyim İyileştirme', desc: 'Her maddeyi güçlü cümlelerle yenile', ai: true },
    { icon: '📄', title: '5 Farklı Şablon', desc: 'Tüm CV tasarımlarını kullan', ai: false },
    { icon: '🎯', title: 'ATS Uyum Skoru', desc: 'Gerçek zamanlı analiz', ai: false },
    { icon: '📊', title: 'CV Doluluk Takibi', desc: 'Ne kadar eksiğin var gör', ai: false },
    { icon: '🔗', title: 'QR Kod', desc: 'LinkedIn/GitHub bağlantısı', ai: false },
    { icon: '👥', title: 'Referanslar Bölümü', desc: 'Referans kişilerini ekle', ai: false },
  ]

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="premium-modal" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal__close premium-modal__close" onClick={onClose}>×</button>
        <div className="premium-modal__header">
          <span className="premium-modal__crown">{aiAvailable ? '🤖' : '👑'}</span>
          <h2>CV Creater {aiAvailable ? 'AI Aktif' : 'Premium'}</h2>
          <p>{aiAvailable ? 'Tüm AI özellikleri kullanıma hazır!' : 'AI destekli özelliklerle CV\'nizi bir üst seviyeye taşıyın'}</p>
        </div>
        <div className="premium-modal__features">
          {features.map((f, i) => {
            const isUnlocked = !f.ai || aiAvailable
            return (
              <div key={i} className={`premium-modal__feature ${!isUnlocked ? 'premium-modal__feature--premium' : ''}`}>
                <span className="premium-modal__feature-icon">{f.icon}</span>
                <div>
                  <p className="premium-modal__feature-title">{f.title} {f.ai && <span className="ai-tag">AI</span>}</p>
                  <p className="premium-modal__feature-desc">{f.desc}</p>
                </div>
                <span className={`premium-modal__feature-status ${isUnlocked ? 'free' : 'locked'}`}>
                  {isUnlocked ? '✓ Aktif' : '🔒 API Key Gerekli'}
                </span>
              </div>
            )
          })}
        </div>
        {aiAvailable ? (
          <div className="premium-modal__pricing premium-modal__pricing--active">
            <div className="premium-modal__active-badge">✅ AI Bağlantısı Aktif</div>
            <p className="premium-modal__price-note">Sunucunuzda OpenAI API Key tanımlı. Tüm AI özellikleri çalışıyor.</p>
            <button className="btn primary premium-modal__btn" onClick={onClose}>Düzenlemeye Devam Et</button>
          </div>
        ) : (
          <div className="premium-modal__pricing">
            <p className="premium-modal__price-note">AI özelliklerini kullanmak için sunucunuzdaki <code>.env</code> dosyasına <code>OPENAI_API_KEY</code> ekleyin.</p>
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="btn primary premium-modal__btn"
            >
              OpenAI API Key Oluştur →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function AtsModal({ score, onClose }) {
  const { score: s, issues, tips } = score
  const color = s >= 75 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444'
  const label = s >= 75 ? 'İyi' : s >= 50 ? 'Orta' : 'Zayıf'

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="ats-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ats-modal__header">
          <h3>ATS Uyum Skoru</h3>
          <button className="login-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="ats-modal__body">
          <div className="ats-modal__score-ring">
            <svg viewBox="0 0 100 100" width="120" height="120">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="10" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke={color} strokeWidth="10"
                strokeDasharray={`${(s / 100) * 263.9} 263.9`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="ats-modal__score-text">
              <span className="ats-modal__score-number" style={{ color }}>{s}</span>
              <span className="ats-modal__score-label" style={{ color }}>{label}</span>
            </div>
          </div>

          <p className="ats-modal__desc">ATS (Başvuru Takip Sistemi) tarama skoru — değer ne kadar yüksekse CV&apos;niz otomatik sistemlerden o kadar kolay geçer.</p>

          {issues.length > 0 && (
            <div className="ats-modal__section">
              <h4 className="ats-modal__section-title ats-modal__section-title--error">Kritik Eksikler</h4>
              {issues.map((issue, i) => (
                <div key={i} className="ats-modal__item ats-modal__item--error">
                  <span>✗</span> {issue}
                </div>
              ))}
            </div>
          )}

          {tips.length > 0 && (
            <div className="ats-modal__section">
              <h4 className="ats-modal__section-title ats-modal__section-title--warn">İyileştirme Önerileri</h4>
              {tips.map((tip, i) => (
                <div key={i} className="ats-modal__item ats-modal__item--warn">
                  <span>⚡</span> {tip}
                </div>
              ))}
            </div>
          )}

          {issues.length === 0 && tips.length === 0 && (
            <div className="ats-modal__item ats-modal__item--success">
              <span>✓</span> CV&apos;niz ATS sistemleri için mükemmel durumda!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DateRangeInput({ startDate, endDate, ongoing, onStartChange, onEndChange, onOngoingChange }) {
  // Parse existing date string to month and year
  const parseDate = (dateStr) => {
    if (!dateStr) return { month: '', year: '' }
    const parts = dateStr.split(' ')
    if (parts.length === 2) {
      return { month: parts[0], year: parts[1] }
    }
    // If only year
    if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
      return { month: '', year: parts[0] }
    }
    return { month: '', year: '' }
  }

  const startParsed = parseDate(startDate)
  const endParsed = parseDate(endDate)

  const handleStartMonthChange = (month) => {
    const newDate = month && startParsed.year ? `${month} ${startParsed.year}` : (startParsed.year || '')
    onStartChange(newDate)
  }

  const handleStartYearChange = (year) => {
    const newDate = startParsed.month && year ? `${startParsed.month} ${year}` : year
    onStartChange(newDate)
  }

  const handleEndMonthChange = (month) => {
    const newDate = month && endParsed.year ? `${month} ${endParsed.year}` : (endParsed.year || '')
    onEndChange(newDate)
  }

  const handleEndYearChange = (year) => {
    const newDate = endParsed.month && year ? `${endParsed.month} ${year}` : year
    onEndChange(newDate)
  }

  return (
    <div className="date-range">
      <div className="date-range__selectors">
        <div className="date-range__group">
          <span className="field-label">Başlangıç</span>
          <div className="date-range__row">
            <select value={startParsed.month} onChange={(e) => handleStartMonthChange(e.target.value)}>
              <option value="">Ay</option>
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select value={startParsed.year} onChange={(e) => handleStartYearChange(e.target.value)}>
              <option value="">Yıl</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="date-range__group">
          <span className="field-label">Bitiş</span>
          <div className="date-range__row">
            <select 
              value={endParsed.month} 
              onChange={(e) => handleEndMonthChange(e.target.value)}
              disabled={ongoing}
            >
              <option value="">Ay</option>
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select 
              value={endParsed.year} 
              onChange={(e) => handleEndYearChange(e.target.value)}
              disabled={ongoing}
            >
              <option value="">Yıl</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={ongoing}
          onChange={(e) => onOngoingChange(e.target.checked)}
        />
        <span>Devam ediyor</span>
      </label>
    </div>
  )
}

export default App
