import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

const FONT = 'Roboto'

const dr = (start, end, ongoing) => {
  if (!start && !end) return ''
  if (ongoing) return `${start || ''} – Günümüz`
  if (!end || end === start) return start || ''
  return `${start} – ${end}`
}
const loc = (city, district) => [district, city].filter(Boolean).join(', ')

const s = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 9,
    backgroundColor: '#ffffff',
    flexDirection: 'column',
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 22,
    paddingBottom: 16,
    gap: 16,
  },
  headerBorder: {
    height: 3,
    marginHorizontal: 0,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    flexShrink: 0,
  },
  photoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e8f0fd',
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 3,
    lineHeight: 1.15,
  },
  role: {
    fontSize: 10,
    color: '#555',
    marginBottom: 7,
    fontWeight: 400,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  contactItem: {
    fontSize: 8,
    color: '#444',
    marginRight: 12,
    marginBottom: 2,
  },

  /* ── Body ── */
  body: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 24,
  },

  /* ── Section ── */
  sec: { marginBottom: 10 },
  secTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  secBar: {
    width: 3,
    height: 11,
    borderRadius: 2,
    flexShrink: 0,
  },
  secLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 0.9,
  },
  secLine: {
    flex: 1,
    height: 0.75,
    opacity: 0.2,
  },
  para: {
    fontSize: 8.5,
    color: '#333',
    lineHeight: 1.6,
  },

  /* ── Entry ── */
  entry: {
    marginBottom: 7,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  entryHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 1.5,
  },
  entryTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: '#111',
    flex: 1,
    marginRight: 8,
  },
  entryDate: {
    fontSize: 7.5,
    color: '#666',
    flexShrink: 0,
  },
  entryMeta: {
    fontSize: 7.5,
    color: '#555',
    marginBottom: 2,
  },
  entryNote: {
    fontSize: 7.5,
    color: '#666',
    marginTop: 1,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 2,
    marginTop: 2,
  },
  bulletDot: {
    fontSize: 7.5,
    color: '#9ca3af',
    marginRight: 4,
    marginTop: 0.5,
  },
  bulletTxt: {
    fontSize: 8,
    color: '#333',
    flex: 1,
    lineHeight: 1.45,
  },

  /* ── Bottom 2-col ── */
  bottomGrid: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  bottomCol: {
    flex: 1,
  },

  /* ── Tags ── */
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 3,
  },
  tag: {
    borderRadius: 3,
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    marginBottom: 3,
  },
  tagTxt: {
    fontSize: 7,
    fontWeight: 500,
  },

  /* ── References ── */
  refGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  refCard: {
    borderWidth: 0.5,
    borderColor: '#e8ecf0',
    borderRadius: 4,
    padding: 6,
    minWidth: 120,
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  refName: {
    fontSize: 8,
    fontWeight: 700,
    color: '#111',
    marginBottom: 2,
  },
  refMeta: {
    fontSize: 7,
    color: '#666',
    marginBottom: 1,
  },
})

const Bullet = ({ t }) => (
  <View style={s.bulletRow} wrap={false}>
    <Text style={s.bulletDot}>•</Text>
    <Text style={s.bulletTxt}>{t}</Text>
  </View>
)

const SecTitle = ({ label, ac }) => (
  <View style={s.secTitleRow}>
    <View style={[s.secBar, { backgroundColor: ac }]} />
    <Text style={[s.secLabel, { color: ac }]}>{label.toUpperCase()}</Text>
    <View style={[s.secLine, { backgroundColor: ac }]} />
  </View>
)

export default function PdfClassic({ cvData }) {
  const {
    accent = '#1e5aad', avatar, name = '', title = '',
    city, district, phone, email,
    birthDay, birthMonth, birthYear, websiteUrl,
    objective, experience = [], education = [], projects = [], activities = [],
    certificates = [], skills = [], languages = [], competencies = [], interests = [],
    references = [],
  } = cvData

  const ac = accent || '#1e5aad'
  const bday = [birthDay, birthMonth, birthYear].filter(Boolean).join(' ')
  const hasBottom = skills.length || languages.length || competencies.length || interests.length

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ── HEADER ── */}
        <View style={s.header}>
          {avatar
            ? <Image src={avatar} style={s.photo} />
            : null}
          <View style={s.headerInfo}>
            <Text style={s.name}>{name || 'Ad Soyad'}</Text>
            {title ? <Text style={s.role}>{title}</Text> : null}
            <View style={s.contactRow}>
              {(city || district) ? <Text style={s.contactItem}>📍 {loc(city, district)}</Text> : null}
              {phone ? <Text style={s.contactItem}>📞 {phone}</Text> : null}
              {email ? <Text style={s.contactItem}>✉ {email}</Text> : null}
              {bday ? <Text style={s.contactItem}>🎂 {bday}</Text> : null}
              {websiteUrl ? <Text style={s.contactItem}>🔗 {websiteUrl}</Text> : null}
            </View>
          </View>
        </View>
        <View style={[s.headerBorder, { backgroundColor: ac }]} />

        {/* ── BODY ── */}
        <View style={s.body}>
          {objective ? (
            <View style={s.sec} wrap={false}>
              <SecTitle label="Özet" ac={ac} />
              <Text style={s.para}>{objective}</Text>
            </View>
          ) : null}

          {education.length > 0 && (
            <View style={s.sec}>
              <SecTitle label="Eğitim" ac={ac} />
              {education.map((e, i) => (
                <View key={i} style={s.entry} wrap={false}>
                  <View style={s.entryHead}>
                    <Text style={s.entryTitle}>{e.school}</Text>
                    <Text style={s.entryDate}>{dr(e.startDate, e.endDate, e.ongoing)}</Text>
                  </View>
                  {(e.department || loc(e.city, e.district)) ? (
                    <Text style={s.entryMeta}>{[e.department, loc(e.city, e.district)].filter(Boolean).join(' · ')}</Text>
                  ) : null}
                  {e.note ? <Text style={s.entryNote}>GPA: {e.note}</Text> : null}
                </View>
              ))}
            </View>
          )}

          {experience.length > 0 && (
            <View style={s.sec}>
              <SecTitle label="İş Deneyimi" ac={ac} />
              {experience.map((e, i) => (
                <View key={i} style={s.entry} wrap={false}>
                  <View style={s.entryHead}>
                    <Text style={s.entryTitle}>{e.company}</Text>
                    <Text style={s.entryDate}>{dr(e.startDate, e.endDate, e.ongoing)}</Text>
                  </View>
                  {loc(e.city, e.district) ? <Text style={s.entryMeta}>📍 {loc(e.city, e.district)}</Text> : null}
                  {e.details?.map((d, j) => <Bullet key={j} t={d} />)}
                </View>
              ))}
            </View>
          )}

          {projects.length > 0 && (
            <View style={s.sec}>
              <SecTitle label="Projeler" ac={ac} />
              {projects.map((p, i) => (
                <View key={i} style={s.entry} wrap={false}>
                  <View style={s.entryHead}>
                    <Text style={s.entryTitle}>{p.name}</Text>
                    <Text style={s.entryDate}>{dr(p.startDate, p.endDate, p.ongoing)}</Text>
                  </View>
                  {p.details?.map((d, j) => <Bullet key={j} t={d} />)}
                </View>
              ))}
            </View>
          )}

          {activities.length > 0 && (
            <View style={s.sec}>
              <SecTitle label="Aktiviteler" ac={ac} />
              {activities.map((a, i) => (
                <View key={i} style={s.entry} wrap={false}>
                  <View style={s.entryHead}>
                    <Text style={s.entryTitle}>{a.name}</Text>
                    <Text style={s.entryDate}>{dr(a.startDate, a.endDate, a.ongoing)}</Text>
                  </View>
                  {loc(a.city, a.district) ? <Text style={s.entryMeta}>📍 {loc(a.city, a.district)}</Text> : null}
                  {a.details?.map((d, j) => <Bullet key={j} t={d} />)}
                </View>
              ))}
            </View>
          )}

          {certificates.length > 0 && (
            <View style={s.sec}>
              <SecTitle label="Sertifikalar" ac={ac} />
              {certificates.map((c, i) => (
                <View key={i} style={s.entry} wrap={false}>
                  <View style={s.entryHead}>
                    <Text style={s.entryTitle}>{c.name}</Text>
                    <Text style={s.entryDate}>{c.date}</Text>
                  </View>
                  {c.org ? <Text style={s.entryMeta}>{c.org}</Text> : null}
                </View>
              ))}
            </View>
          )}

          {hasBottom ? (
            <View style={s.bottomGrid}>
              {/* Left column */}
              <View style={s.bottomCol}>
                {skills.length > 0 && (
                  <View style={s.sec}>
                    <SecTitle label="Teknik Beceriler" ac={ac} />
                    <View style={s.tagsRow}>
                      {skills.map((sk, i) => (
                        <View key={i} style={[s.tag, { backgroundColor: `${ac}18`, borderColor: `${ac}40`, borderWidth: 0.5 }]}>
                          <Text style={[s.tagTxt, { color: ac }]}>{sk}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {languages.length > 0 && (
                  <View style={s.sec}>
                    <SecTitle label="Yabancı Diller" ac={ac} />
                    {languages.map((l, i) => {
                      const label = l.lang || l.name || ''
                      return (
                        <Text key={i} style={s.entryMeta}>
                          {'\u2022'} {label}{l.level ? ` \u2014 ${l.level}` : ''}
                        </Text>
                      )
                    })}
                  </View>
                )}
              </View>

              {/* Right column */}
              <View style={s.bottomCol}>
                {competencies.length > 0 && (
                  <View style={s.sec}>
                    <SecTitle label="Yetkinlikler" ac={ac} />
                    <View style={s.tagsRow}>
                      {competencies.map((c, i) => (
                        <View key={i} style={[s.tag, { backgroundColor: `${ac}18`, borderColor: `${ac}40`, borderWidth: 0.5 }]}>
                          <Text style={[s.tagTxt, { color: ac }]}>{c}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {interests.length > 0 && (
                  <View style={s.sec}>
                    <SecTitle label="İlgi Alanları" ac={ac} />
                    <View style={s.tagsRow}>
                      {interests.map((it, i) => (
                        <View key={i} style={[s.tag, { backgroundColor: `${ac}18`, borderColor: `${ac}40`, borderWidth: 0.5 }]}>
                          <Text style={[s.tagTxt, { color: ac }]}>{it}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          ) : null}

          {references?.length > 0 && (
            <View style={s.sec}>
              <SecTitle label="Referanslar" ac={ac} />
              <View style={s.refGrid}>
                {references.map((r, i) => (
                  <View key={i} style={s.refCard} wrap={false}>
                    <Text style={s.refName}>{r.name}</Text>
                    {(r.title || r.company) ? <Text style={s.refMeta}>{[r.title, r.company].filter(Boolean).join(' · ')}</Text> : null}
                    {(r.phone || r.email) ? <Text style={s.refMeta}>{[r.phone, r.email].filter(Boolean).join(' | ')}</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </Page>
    </Document>
  )
}
