import { createContext, createElement, useContext, useMemo } from 'react'

/**
 * Radar-B in two languages.
 *
 * Every user-facing string lives here, keyed by a dotted name, with Romanian as
 * the source of truth and the fallback: a key missing from `en` renders its
 * Romanian text rather than the raw key, so a half-finished translation degrades
 * to "some Romanian" instead of to "some `detail.sources` debris".
 *
 * What is deliberately NOT translated:
 *   - **Event content** — names, summaries, venues. It's Bucharest data written
 *     in Romanian by Romanian sources; machine-translating it in the client would
 *     be inventing text the sources never said.
 *   - **Category and area values** (`concert`, `centru vechi`). They're a closed
 *     Notion vocabulary shared with Wanderlist and the skill; the words on the
 *     chips ARE the stored values, and renaming them in one app would make the
 *     filter chips stop matching what's in the database.
 *   - **`Radar-B`, `Wanderlist`, `Notion`, `/recommend in Bucharest`** — names.
 */

export const LANGS = [
  { id: 'ro', label: 'Română' },
  { id: 'en', label: 'English' },
]

export const DEFAULT_LANG = 'ro'

const RO = {
  // The active language id, exposed as a normal key so pure helpers (dates.js)
  // can ask a translator which language it is without needing React context.
  __lang__: 'ro',

  // ── Shell ────────────────────────────────────────────────────────────────
  'app.refresh': 'Reîmprospătează',
  'app.refreshing': 'se actualizează…',
  'app.updated': 'actualizat {when}',
  'app.notion': 'notion',
  'app.demo': 'mod demo',
  'app.search': 'Caută',
  'app.searchPlaceholder': 'titlu, loc, cartier, sursă…',
  'app.filters': 'Filtre',
  'app.settings': 'Setări',
  'app.guide': 'Ghid',
  'app.guideTitle': 'Cum funcționează Radar-B',
  'app.lenses': 'Perspective',
  'app.anytime': 'Oricând',
  'app.askSkill': 'Întreabă Recommend in Bucharest despre astea',
  'app.weekSources': 'Din ce s-a construit săptămâna',
  'app.notPublished': 'încă nepublicat',
  'app.undo': 'Anulează',

  'empty.title': 'Liniște',
  'empty.filtersActive': 'Sau ai filtre active.',
  'empty.tonight': 'Nimic în seara asta — încearcă weekendul sau ce e în curs.',
  'empty.tomorrow': 'Nimic mâine deocamdată.',
  'empty.weekend': 'Weekendul nu s-a umplut încă. Sursele publică joi–vineri.',
  'empty.week': 'Săptămâna e goală. Rulează /recommend in Bucharest ca să o populezi.',
  'empty.later': 'Nimic programat mai încolo.',
  'empty.running': 'Nicio expoziție deschisă acum.',
  'empty.new': 'Ai văzut tot ce a apărut la ultima actualizare.',

  'toast.hiddenEverywhere': 'Ascuns peste tot.',
  'toast.hiddenHere': 'Ascuns doar aici.',
  'toast.hiddenHereError': 'Ascuns doar aici — {error}',
  'toast.restored': 'Adus înapoi.',
  'toast.saved': 'Salvat în Wanderlist.',
  'toast.copied': 'Copiat — lipește-l în conversația cu Claude.',
  'toast.copyFailed': 'Nu s-a putut copia.',

  // ── Lenses ───────────────────────────────────────────────────────────────
  'view.tonight': 'Azi',
  'view.tomorrow': 'Mâine',
  'view.weekend': 'Weekend',
  'view.week': 'Săptămâna',
  'view.later': 'Mai încolo',
  'view.running': 'În curs',
  'view.new': 'Noi',

  // ── Signals ──────────────────────────────────────────────────────────────
  'signal.recommended': 'recomandat',
  'signal.free': 'gratuit',
  'signal.family': 'cu copii',
  'signal.outdoor': 'în aer liber',
  'signal.new-venue': 'loc nou',
  'signal.recurring': 'recurent',
  'signal.long-run': 'se vede oricând',
  'signal.ticketed': 'bilet',
  'signal.sold-out': 'sold out',
  'signal.mainstream': 'mainstream',

  // ── Card ─────────────────────────────────────────────────────────────────
  'card.inWanderlist': 'în wanderlist',
  'card.sources': '{n} surse',
  'card.lei': '{n} lei',

  // ── Detail ───────────────────────────────────────────────────────────────
  'detail.back': 'Înapoi',
  'detail.hide': 'Ascunde',
  'detail.uncertain': 'Informație aproximativă — o singură sursă, fără confirmare de la organizator. Verifică înainte să pleci de acasă.',
  'detail.when': 'Când',
  'detail.where': 'Unde',
  'detail.cost': 'Cât',
  'detail.who': 'Cine',
  'detail.timeUnconfirmed': 'ora neconfirmată',
  'detail.openMaps': 'Deschide în Maps',
  'detail.free': 'Gratuit',
  'detail.priceUnknown': 'Preț necunoscut',
  'detail.recommendedBy': 'Recomandat de {names}.',
  'detail.provenance': 'De unde știm',
  'detail.noSources': 'Fără sursă înregistrată.',
  'detail.neverChecked': 'Nu se știe când a fost verificată ultima oară.',
  'detail.checkedAgo': 'Verificat {when}.',
  'detail.mayBeStale': 'Poate fi depășit — confirmă la sursă.',
  'detail.mergedFrom': 'Reunit din {n} înregistrări.',
  'detail.tickets': 'Bilete',
  'detail.eventPage': 'Pagina evenimentului',
  'detail.alreadySaved': 'Deja în Wanderlist',
  'detail.save': 'Salvează în Wanderlist',
  'detail.saving': 'Se salvează…',
  'kind.recommendation': 'recomandare',
  'kind.saved': 'wanderlist',
  'kind.editorial': 'menționat',

  'wl.heading': 'În Wanderlist',
  'wl.going': 'Mergi',
  'wl.undecided': 'Încă nedecis',
  'wl.hasTickets': 'Bilete la tine',
  'wl.expires': 'expiră {date}',
  'wl.noPlannedDate': 'fără dată planificată',
  'wl.open': 'Deschide în Wanderlist',

  // ── Filters ──────────────────────────────────────────────────────────────
  'filters.title': 'Filtre',
  'filters.what': 'Ce fel',
  'filters.where': 'Unde',
  'filters.signals': 'Semnale',
  'filters.price': 'Preț',
  'filters.anyPrice': 'orice preț',
  'filters.free': 'gratuit',
  'filters.upTo': 'până în {n} lei',
  'filters.unpricedNote': 'Evenimentele fără preț menționat nu se încadrează automat — sunt excluse, nu presupuse gratuite.',
  'filters.clear': 'Șterge filtrele',
  'filters.done': 'Gata',

  // ── Save sheet ───────────────────────────────────────────────────────────
  'save.title': 'Salvează în Wanderlist',
  'save.name': 'Nume',
  'save.description': 'Descriere',
  'save.category': 'Categorie',
  'save.place': 'Loc',
  'save.placeHint': 'Adresa completă — Wanderlist pune pinul pe hartă din acest text.',
  'save.placePlaceholder': 'Nume, stradă, București',
  'save.link': 'Link',
  'save.expires': 'Expiră',
  'save.expiresHint': 'Termenul până la care poți acționa. Gol dacă nu există unul real.',
  'save.note': 'Se creează un rând nou în Findings, cu Going și Attended nebifate. Restul (dată planificată, bilete, poză) se editează în Wanderlist.',
  'save.cancel': 'Renunță',
  'save.confirm': 'Salvează',

  // ── Settings ─────────────────────────────────────────────────────────────
  'settings.title': 'Setări',
  'settings.intake': 'Ce intră în Radar',
  'settings.intakeIntro': 'Radar-B citește și Wanderlist, care e mai larg decât „ce se întâmplă săptămâna asta”. Toate filtrele sunt pornite implicit — stinge unul și evenimentele revin.',
  'settings.hideAttended': 'Ascunde ce am bifat ca Attended',
  'settings.hideAttendedHint': 'Ai fost deja — nu mai e ceva la care să mergi',
  'settings.hideIdeas': 'Ascunde Ideas',
  'settings.hideIdeasHint': 'Fără dată planificată și fără termen — un „cândva”, nu un eveniment',
  'settings.hideNonEvents': 'Ascunde locuri și descoperiri',
  'settings.hideNonEventsHint': 'Categoriile venue, idea și discovery — locuri și piste, nu evenimente cu oră',
  'settings.hideDismissed': 'Ascunde ce am ascuns eu',
  'settings.hideDismissedHint': 'Se sincronizează prin Notion, deci e la fel pe telefon și pe laptop',
  'settings.hiddenNow': '{n} ascunse acum',
  'settings.connection': 'Conexiune Notion',
  'settings.token': 'Token',
  'settings.tokenHint': 'Rămâne doar în acest browser. Gol = mod demo, pe date de exemplu.',
  'settings.radarDb': 'Baza Radar',
  'settings.radarDbHint': 'Evenimentele scrise de /recommend in Bucharest.',
  'settings.findingsDb': 'Baza Findings (Wanderlist)',
  'settings.findingsDbHint': 'Unde se salvează și de unde se citește starea (Going, dată planificată).',
  'settings.suggestedPage': 'Pagina „Suggested events”',
  'settings.suggestedPageHint': 'Citită doar pentru lista de articole din care s-a construit săptămâna.',
  'settings.idPlaceholder': 'Link sau ID Notion',
  'settings.appearance': 'Aspect',
  'settings.theme': 'Temă',
  'settings.themeSystem': 'ca sistemul',
  'settings.themeLight': 'luminos',
  'settings.themeDark': 'întunecat',
  'settings.language': 'Limbă',
  'settings.help': 'Ajutor',
  'settings.guideNote': 'Ghidul complet — cum funcționează /recommend in Bucharest, dedublarea, provenance-ul și legătura cu Wanderlist — {link}.',
  'settings.guideLink': 'e aici',
  'settings.test': 'Testează',
  'settings.testing': 'Se testează…',
  'settings.testOk': 'Conexiune reușită.',
  'settings.save': 'Salvează',

  // ── Dates ────────────────────────────────────────────────────────────────
  'date.noDate': 'fără dată',
  'date.today': 'azi',
  'date.tomorrow': 'mâine',
  'date.yesterday': 'ieri',
  'date.daysAgo': 'acum {n} zile',
  'date.until': 'până pe {date}',
  'date.todayHeading': 'Azi',
  'date.tomorrowHeading': 'Mâine',
  'date.noDateHeading': 'Fără dată',

  // ── Brief handed to the skill ────────────────────────────────────────────
  'brief.heading': 'Evenimente în Radar-B — {view}:',
  'brief.question': 'Care dintre ele mi s-ar potrivi?',
}

const EN = {
  __lang__: 'en',

  'app.refresh': 'Refresh',
  'app.refreshing': 'refreshing…',
  'app.updated': 'updated {when}',
  'app.notion': 'notion',
  'app.demo': 'demo mode',
  'app.search': 'Search',
  'app.searchPlaceholder': 'title, venue, area, source…',
  'app.filters': 'Filters',
  'app.settings': 'Settings',
  'app.guide': 'Guide',
  'app.guideTitle': 'How Radar-B works',
  'app.lenses': 'Lenses',
  'app.anytime': 'Anytime',
  'app.askSkill': 'Ask Recommend in Bucharest about these',
  'app.weekSources': 'What this week was built from',
  'app.notPublished': 'not published yet',
  'app.undo': 'Undo',

  'empty.title': 'All quiet',
  'empty.filtersActive': 'Or you have filters on.',
  'empty.tonight': 'Nothing tonight — try the weekend, or what’s running now.',
  'empty.tomorrow': 'Nothing tomorrow yet.',
  'empty.weekend': 'The weekend hasn’t filled up yet. Sources publish Thursday–Friday.',
  'empty.week': 'This week is empty. Run /recommend in Bucharest to fill it.',
  'empty.later': 'Nothing further out.',
  'empty.running': 'No exhibitions open right now.',
  'empty.new': 'You’ve seen everything from the last refresh.',

  'toast.hiddenEverywhere': 'Hidden everywhere.',
  'toast.hiddenHere': 'Hidden on this device only.',
  'toast.hiddenHereError': 'Hidden here only — {error}',
  'toast.restored': 'Brought back.',
  'toast.saved': 'Saved to Wanderlist.',
  'toast.copied': 'Copied — paste it into your chat with Claude.',
  'toast.copyFailed': 'Couldn’t copy.',

  'view.tonight': 'Today',
  'view.tomorrow': 'Tomorrow',
  'view.weekend': 'Weekend',
  'view.week': 'This week',
  'view.later': 'Later',
  'view.running': 'Running',
  'view.new': 'New',

  'signal.recommended': 'recommended',
  'signal.free': 'free',
  'signal.family': 'with kids',
  'signal.outdoor': 'outdoors',
  'signal.new-venue': 'new venue',
  'signal.recurring': 'recurring',
  'signal.long-run': 'see it anytime',
  'signal.ticketed': 'ticket',
  'signal.sold-out': 'sold out',
  'signal.mainstream': 'mainstream',

  'card.inWanderlist': 'in wanderlist',
  'card.sources': '{n} sources',
  'card.lei': '{n} lei',

  'detail.back': 'Back',
  'detail.hide': 'Hide',
  'detail.uncertain': 'Approximate information — a single source, unconfirmed by the organiser. Check before you leave the house.',
  'detail.when': 'When',
  'detail.where': 'Where',
  'detail.cost': 'Cost',
  'detail.who': 'Who',
  'detail.timeUnconfirmed': 'time unconfirmed',
  'detail.openMaps': 'Open in Maps',
  'detail.free': 'Free',
  'detail.priceUnknown': 'Price unknown',
  'detail.recommendedBy': 'Recommended by {names}.',
  'detail.provenance': 'How we know',
  'detail.noSources': 'No source recorded.',
  'detail.neverChecked': 'No record of when this was last checked.',
  'detail.checkedAgo': 'Checked {when}.',
  'detail.mayBeStale': 'May be out of date — confirm at the source.',
  'detail.mergedFrom': 'Merged from {n} records.',
  'detail.tickets': 'Tickets',
  'detail.eventPage': 'Event page',
  'detail.alreadySaved': 'Already in Wanderlist',
  'detail.save': 'Save to Wanderlist',
  'detail.saving': 'Saving…',
  'kind.recommendation': 'recommendation',
  'kind.saved': 'wanderlist',
  'kind.editorial': 'mentioned',

  'wl.heading': 'In Wanderlist',
  'wl.going': 'Going',
  'wl.undecided': 'Undecided',
  'wl.hasTickets': 'You have tickets',
  'wl.expires': 'expires {date}',
  'wl.noPlannedDate': 'no planned date',
  'wl.open': 'Open in Wanderlist',

  'filters.title': 'Filters',
  'filters.what': 'What kind',
  'filters.where': 'Where',
  'filters.signals': 'Signals',
  'filters.price': 'Price',
  'filters.anyPrice': 'any price',
  'filters.free': 'free',
  'filters.upTo': 'up to {n} lei',
  'filters.unpricedNote': 'Events with no stated price don’t qualify automatically — they’re excluded, not assumed free.',
  'filters.clear': 'Clear filters',
  'filters.done': 'Done',

  'save.title': 'Save to Wanderlist',
  'save.name': 'Name',
  'save.description': 'Description',
  'save.category': 'Category',
  'save.place': 'Place',
  'save.placeHint': 'Full address — Wanderlist drops its map pin from this text.',
  'save.placePlaceholder': 'Name, street, București',
  'save.link': 'Link',
  'save.expires': 'Expires',
  'save.expiresHint': 'The deadline to act. Leave blank if there isn’t a real one.',
  'save.note': 'Creates a new Findings row with Going and Attended unchecked. The rest (planned date, tickets, photo) is edited in Wanderlist.',
  'save.cancel': 'Cancel',
  'save.confirm': 'Save',

  'settings.title': 'Settings',
  'settings.intake': 'What gets into Radar',
  'settings.intakeIntro': 'Radar-B also reads Wanderlist, which is broader than “what’s on this week”. Every filter is on by default — switch one off and those events come back.',
  'settings.hideAttended': 'Hide anything marked Attended',
  'settings.hideAttendedHint': 'You’ve been — it isn’t something to go to any more',
  'settings.hideIdeas': 'Hide Ideas',
  'settings.hideIdeasHint': 'No planned date and no deadline — a “someday”, not an event',
  'settings.hideNonEvents': 'Hide places and discoveries',
  'settings.hideNonEventsHint': 'The venue, idea and discovery categories — places and leads, not things with a time',
  'settings.hideDismissed': 'Hide what I’ve hidden',
  'settings.hideDismissedHint': 'Synced through Notion, so it’s the same on your phone and your laptop',
  'settings.hiddenNow': '{n} hidden right now',
  'settings.connection': 'Notion connection',
  'settings.token': 'Token',
  'settings.tokenHint': 'Stays in this browser only. Empty = demo mode, on sample data.',
  'settings.radarDb': 'Radar database',
  'settings.radarDbHint': 'The events written by /recommend in Bucharest.',
  'settings.findingsDb': 'Findings database (Wanderlist)',
  'settings.findingsDbHint': 'Where saves go, and where state is read from (Going, planned date).',
  'settings.suggestedPage': '“Suggested events” page',
  'settings.suggestedPageHint': 'Read only for the list of articles this week was built from.',
  'settings.idPlaceholder': 'Notion link or ID',
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.themeSystem': 'match system',
  'settings.themeLight': 'light',
  'settings.themeDark': 'dark',
  'settings.language': 'Language',
  'settings.help': 'Help',
  'settings.guideNote': 'The full guide — how /recommend in Bucharest works, the deduplication, the provenance and the Wanderlist link — {link}.',
  'settings.guideLink': 'is here',
  'settings.test': 'Test',
  'settings.testing': 'Testing…',
  'settings.testOk': 'Connected.',
  'settings.save': 'Save',

  'date.noDate': 'no date',
  'date.today': 'today',
  'date.tomorrow': 'tomorrow',
  'date.yesterday': 'yesterday',
  'date.daysAgo': '{n} days ago',
  'date.until': 'until {date}',
  'date.todayHeading': 'Today',
  'date.tomorrowHeading': 'Tomorrow',
  'date.noDateHeading': 'No date',

  'brief.heading': 'Events in Radar-B — {view}:',
  'brief.question': 'Which of these would suit me?',
}

/** The string tables themselves. Exported so the parity test can compare key
 *  sets; app code should go through `makeT` / `useT` instead. */
export const STRINGS = { ro: RO, en: EN }

export function isLang(id) {
  return Object.prototype.hasOwnProperty.call(STRINGS, id)
}

function interpolate(template, vars) {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    (Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole))
}

/** Build a translator. Romanian is the fallback for any key `en` hasn't got, so
 *  an incomplete translation shows Romanian rather than a raw key. */
export function makeT(lang = DEFAULT_LANG) {
  const table = STRINGS[lang] ?? RO
  return (key, vars) => interpolate(table[key] ?? RO[key] ?? key, vars)
}

const LangContext = createContext(DEFAULT_LANG)

export function LangProvider({ lang, children }) {
  return createElement(LangContext.Provider, { value: isLang(lang) ? lang : DEFAULT_LANG }, children)
}

export function useLang() {
  return useContext(LangContext)
}

export function useT() {
  const lang = useLang()
  return useMemo(() => makeT(lang), [lang])
}
