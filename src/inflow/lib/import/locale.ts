/**
 * The words a bank statement may use in another language (Release 2, experimental).
 *
 * Revolut's community reports that a CSV export follows the app's language: headers translated,
 * and numbers written the local way (a French export: comma decimals, spaces between thousands,
 * semicolons). Revolut publishes none of the translated names, so everything here is the plain
 * translation in each language, an assumption, never evidence. That is why it is only ever used
 * to *recognise* a column or a value: anything not found here goes to manual mapping (columns) or
 * is asked (state values), never guessed.
 *
 * Languages: English, Romanian, German, French, Spanish, Italian, Portuguese, Polish, Dutch,
 * Hungarian, Czech. All compared folded: lower case, accents removed, punctuation as spaces.
 */
import type { Field } from './revolut'

/** Lower case, accents gone, anything not a letter or digit (in any script) a single space. */
export const fold = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** Header names per field, beyond English and Romanian (which `ALIASES` in revolut.ts holds). */
export const HEADER_WORDS: Partial<Record<Field, string[]>> = {
  type: [
    'typ', 'transaktionstyp', // de, pl, cs
    'type de transaction', 'type d operation', // fr
    'tipo', 'tipo de transaccion', 'tipo di transazione', 'tipo de transacao', // es, it, pt
    'rodzaj', 'rodzaj transakcji', 'transactietype', 'soort', 'tipus', 'tranzakcio tipusa', 'typ transakce',
  ],
  product: ['produkt', 'produit', 'producto', 'prodotto', 'produto', 'termek'],
  started: [
    'startdatum', 'datum', 'buchungsdatum', 'transaktionsdatum', // de, nl, cs
    'date de debut', 'date', 'date d operation', 'date de l operation', // fr
    'fecha de inicio', 'fecha', 'fecha de operacion', // es
    'data di inizio', 'data operazione', 'data de inicio', 'data da transacao', // it, pt
    'data rozpoczecia', 'data transakcji', 'data operacji', // pl
    'begindatum', 'transactiedatum', 'kezdes datuma', 'kezdo datum', 'datum zahajeni', 'datum transakce', 'datum',
  ],
  completed: [
    'abschlussdatum', 'datum des abschlusses', 'abgeschlossen am', 'wertstellung', 'valutadatum',
    'date de fin', 'date d achevement', 'date de finalisation', 'date de valeur',
    'fecha de finalizacion', 'fecha de finalizacion de la transaccion', 'fecha completada', 'fecha valor',
    'data di completamento', 'data di fine', 'data valuta', 'data de conclusao', 'data de conclusao da transacao', 'data valor',
    'data zakonczenia', 'data ksiegowania', 'einddatum', 'voltooiingsdatum', 'datum voltooid', 'rentedatum',
    'befejezes datuma', 'teljesites datuma', 'konyvelesi datum', 'datum dokonceni', 'datum zauctovani',
  ],
  description: ['beschreibung', 'verwendungszweck', 'descripcion', 'concepto', 'descrizione', 'causale', 'descricao', 'opis', 'omschrijving', 'beschrijving', 'mededelingen', 'leiras', 'kozlemeny', 'popis'],
  counterparty: [
    'empfanger', 'auftraggeber', 'zahler', 'gegenpartei', 'beguenstigter', 'begunstigter',
    'beneficiaire', 'contrepartie', 'emetteur', 'payeur',
    'beneficiario', 'ordenante', 'contraparte', 'controparte', 'pagatore',
    'odbiorca', 'nadawca', 'kontrahent', 'naam', 'naam omschrijving', 'naam tegenpartij', 'tegenpartij', 'partner', 'kedvezmenyezett', 'protistrana', 'prijemce', 'platce',
  ],
  amount: ['betrag', 'montant', 'importe', 'cantidad', 'importo', 'valor', 'montante', 'kwota', 'bedrag', 'osszeg', 'castka', 'suma'],
  moneyIn: ['eingang', 'gutschrift', 'eingange', 'entrees', 'credit', 'ingresos', 'abono', 'entrate', 'accrediti', 'entradas', 'creditos', 'wplywy', 'uznania', 'bij', 'jovairas', 'jovairasok', 'prijem', 'prijmy'],
  moneyOut: ['ausgang', 'lastschrift', 'ausgange', 'sorties', 'debit', 'gastos', 'cargo', 'uscite', 'addebiti', 'saidas', 'debitos', 'wydatki', 'obciazenia', 'af', 'terheles', 'terhelesek', 'vydaj', 'vydaje'],
  fee: ['gebuhr', 'gebuhren', 'entgelt', 'frais', 'commission', 'comision', 'comisiones', 'commissione', 'commissioni', 'tarifa', 'taxa', 'taxas', 'oplata', 'prowizja', 'kosten', 'dij', 'jutalek', 'poplatek', 'poplatky'],
  feeCurrency: ['gebuhrenwahrung', 'devise des frais', 'divisa de la comision', 'valuta commissione', 'moeda da taxa', 'waluta oplaty'],
  currency: ['wahrung', 'devise', 'monnaie', 'divisa', 'moneda', 'valuta', 'moeda', 'waluta', 'penznem', 'deviza', 'mena'],
  state: ['status', 'zustand', 'etat', 'statut', 'estado', 'stato', 'stan', 'allapot', 'stav'],
  balance: ['saldo', 'kontostand', 'solde', 'balance', 'egyenleg', 'zustatek', 'stan konta'],
  id: ['transaktions id', 'transaktionsnummer', 'id de transaction', 'id de transaccion', 'id transazione', 'id da transacao', 'id transakcji', 'transactie id', 'tranzakcio azonosito', 'id transakce'],
  reference: ['referenz', 'zahlungsreferenz', 'reference de paiement', 'referencia', 'riferimento', 'tytul', 'tytul przelewu', 'kenmerk', 'betalingskenmerk', 'referencia', 'hivatkozas', 'variabilni symbol', 'zprava'],
  rate: ['wechselkurs', 'kurs', 'taux de change', 'taux', 'tipo de cambio', 'tasso di cambio', 'cambio', 'taxa de cambio', 'kurs wymiany', 'wisselkoers', 'koers', 'arfolyam', 'kurz', 'smenny kurz'],
  origAmount: ['ursprunglicher betrag', 'originalbetrag', 'montant d origine', 'importe original', 'importo originale', 'valor original', 'kwota oryginalna', 'oorspronkelijk bedrag', 'eredeti osszeg', 'puvodni castka'],
  origCurrency: ['ursprungliche wahrung', 'originalwahrung', 'devise d origine', 'divisa original', 'valuta originale', 'moeda original', 'waluta oryginalna', 'oorspronkelijke valuta', 'eredeti penznem', 'puvodni mena'],
}

/** A column that says which way an unsigned amount went (Dutch "Af Bij", "Debit/Credit", German "Soll/Haben"). */
export const DIRECTION_HEADERS = ['af bij', 'bij af', 'debit credit', 'credit debit', 'd c', 'c d', 'dr cr', 'cr dr', 'soll haben', 'haben soll', 'sens', 'direction', 'richtung', 'in out', 'sentido', 'directie', 'kierunek', 'irany', 'smer']
export const DIRECTION_IN = ['bij', 'credit', 'c', 'cr', 'haben', 'h', 'in', 'incoming', 'gutschrift', 'credito', 'abono', 'entrada', 'uznanie', 'jovairas', 'prijem', 'intrare']
export const DIRECTION_OUT = ['af', 'debit', 'd', 'dr', 'soll', 's', 'out', 'outgoing', 'lastschrift', 'debito', 'cargo', 'saida', 'obciazenie', 'terheles', 'vydaj', 'iesire']

export type StateWord = 'COMPLETED' | 'PENDING' | 'REVERTED' | 'DECLINED' | 'FAILED' | 'CANCELLED'

/** Transaction states in each language; an unknown one is asked, never assumed completed. */
export const STATE_WORDS: Record<StateWord, string[]> = {
  COMPLETED: [
    'completed', 'complete', 'settled', 'booked', 'done',
    'finalizat', 'finalizata', 'finalizate', 'efectuat', 'efectuata', 'completat', 'completata', 'decontat',
    'abgeschlossen', 'ausgefuhrt', 'gebucht', 'erledigt',
    'termine', 'terminee', 'effectue', 'effectuee', 'complete', 'completee',
    'completado', 'completada', 'finalizado', 'finalizada', 'realizado', 'realizada',
    'completato', 'completata', 'eseguito', 'eseguita', 'contabilizzato',
    'concluido', 'concluida', 'efetuado', 'efetuada',
    'zakonczono', 'zakonczona', 'zakonczone', 'zrealizowano', 'zrealizowana', 'wykonano', 'zaksiegowano',
    'voltooid', 'afgerond', 'uitgevoerd', 'geboekt',
    'teljesitett', 'teljesitve', 'befejezett', 'konyvelt',
    'dokonceno', 'dokoncena', 'provedeno', 'provedena', 'zauctovano',
  ],
  PENDING: [
    'pending', 'in progress', 'processing', 'authorised', 'authorized',
    'in asteptare', 'in curs', 'in procesare', 'in procesare',
    'ausstehend', 'in bearbeitung', 'vorgemerkt', 'autorisiert',
    'en attente', 'en cours', 'autorise', 'autorisee',
    'pendiente', 'en curso', 'en proceso', 'autorizado', 'autorizada',
    'in sospeso', 'in attesa', 'in corso', 'autorizzato', 'autorizzata',
    'pendente', 'em curso', 'em processamento', 'autorizado',
    'oczekujace', 'oczekujaca', 'oczekuje', 'w toku', 'w trakcie realizacji', 'autoryzowana',
    'in behandeling', 'in afwachting', 'gereserveerd',
    'fuggoben', 'feldolgozas alatt', 'folyamatban', 'engedelyezett',
    'cekajici', 'ceka', 'zpracovava se', 'autorizovano',
  ],
  REVERTED: [
    'reverted', 'reversed', 'refunded', 'returned',
    'anulat', 'anulata', 'returnat', 'stornat', 'stornata', 'inversat',
    'storniert', 'ruckgangig gemacht', 'zuruckgebucht', 'erstattet',
    'annule par la banque', 'rembourse', 'remboursee', 'contrepasse', 'extourne',
    'revertido', 'revertida', 'devuelto', 'devuelta', 'reembolsado', 'reembolsada', 'anulado', 'anulada',
    'stornato', 'stornata', 'rimborsato', 'rimborsata', 'annullato', 'annullata',
    'revertido', 'estornado', 'estornada', 'reembolsado',
    'cofnieto', 'cofnieta', 'zwrocono', 'zwrocona', 'anulowano', 'anulowana',
    'teruggedraaid', 'teruggeboekt', 'terugbetaald', 'gestorneerd',
    'visszavonva', 'visszaforditva', 'visszaterítve', 'stornozva', 'storno',
    'vraceno', 'vracena', 'stornovano', 'stornovana',
  ],
  DECLINED: [
    'declined', 'rejected', 'refused',
    'respins', 'respinsa', 'refuzat', 'refuzata',
    'abgelehnt', 'zuruckgewiesen',
    'refuse', 'refusee', 'rejete', 'rejetee', 'decline', 'declinee',
    'rechazado', 'rechazada', 'denegado', 'denegada',
    'rifiutato', 'rifiutata', 'respinto', 'respinta',
    'recusado', 'recusada', 'rejeitado', 'rejeitada',
    'odrzucono', 'odrzucona', 'odmowa', 'odmowiono',
    'geweigerd', 'afgewezen',
    'elutasitva', 'elutasitott',
    'zamitnuto', 'zamitnuta', 'odmitnuto',
  ],
  FAILED: ['failed', 'esuat', 'esuata', 'fehlgeschlagen', 'echoue', 'echouee', 'fallido', 'fallida', 'non riuscito', 'fallito', 'falhou', 'falhado', 'nieudana', 'nieudane', 'mislukt', 'sikertelen', 'neuspesne', 'nezdarilo se'],
  CANCELLED: ['cancelled', 'canceled', 'abgebrochen', 'annule', 'annulee', 'cancelado', 'cancelada', 'cancellato', 'cancellata', 'anulowane', 'geannuleerd', 'megszakitva', 'torolve', 'zruseno', 'zrusena', 'anulat de client'],
}

/** Transaction types in each language, to Revolut's English codes. Types only steer suggestions. */
export const TYPE_WORDS: Record<string, string[]> = {
  CARD_PAYMENT: ['card payment', 'plata cu cardul', 'plata card', 'kartenzahlung', 'paiement par carte', 'paiement carte', 'pago con tarjeta', 'pago tarjeta', 'pagamento con carta', 'pagamento carta', 'pagamento com cartao', 'pagamento cartao', 'platnosc karta', 'transakcja karta', 'kaartbetaling', 'betaalpas', 'kartyas fizetes', 'kartyas vasarlas', 'platba kartou'],
  TRANSFER: ['transfer', 'bank transfer', 'transfer bancar', 'uberweisung', 'virement', 'transferencia', 'bonifico', 'trasferimento', 'transferencia bancaria', 'przelew', 'overboeking', 'overschrijving', 'atutalas', 'prevod', 'platba'],
  EXCHANGE: ['exchange', 'currency exchange', 'schimb valutar', 'schimb', 'umtausch', 'wahrungsumtausch', 'wechsel', 'change', 'echange', 'cambio', 'cambio de divisa', 'cambio valuta', 'conversione', 'cambio de moeda', 'wymiana', 'wymiana walut', 'omwisseling', 'valutawissel', 'penzvaltas', 'valutavaltas', 'smena', 'smena men'],
  TOPUP: ['topup', 'top up', 'alimentare', 'incarcare', 'aufladung', 'aufladen', 'rechargement', 'recharge', 'recarga', 'ricarica', 'carregamento', 'doladowanie', 'zasilenie', 'opwaardering', 'opwaarderen', 'feltoltes', 'dobiti', 'nabiti'],
  FEE: ['fee', 'charge', 'comision', 'taxa', 'gebuhr', 'entgelt', 'frais', 'commissione', 'tarifa', 'oplata', 'prowizja', 'kosten', 'dij', 'poplatek'],
  CARD_REFUND: ['card refund', 'refund', 'rambursare', 'rambursare card', 'erstattung', 'ruckerstattung', 'kartenruckerstattung', 'remboursement', 'remboursement carte', 'reembolso', 'devolucion', 'rimborso', 'reembolso de cartao', 'zwrot', 'zwrot na karte', 'terugbetaling', 'visszaterites', 'vraceni', 'refundace'],
  ATM: ['atm', 'cash withdrawal', 'retragere numerar', 'retragere', 'bargeldabhebung', 'geldautomat', 'retrait', 'retrait d especes', 'retirada de efectivo', 'cajero', 'prelievo', 'prelievo contanti', 'levantamento', 'wyplata z bankomatu', 'wyplata gotowki', 'bankomat', 'geldopname', 'geldautomaat', 'keszpenzfelvetel', 'penzfelvetel', 'vyber z bankomatu', 'vyber hotovosti'],
}

/** "Payment from X" in each language: the words before the other party's name. Generic one-word prepositions ("von", "van", "od") are left out: they begin real names. */
export const FROM_PHRASES = [
  'payment from', 'transfer from', 'money added from', 'top up by', 'topup by', 'from',
  'plata de la', 'transfer de la', 'incasare de la', 'de la',
  'zahlung von', 'uberweisung von', 'gutschrift von', 'geld erhalten von',
  'paiement de', 'virement de', 'virement recu de', 'recu de',
  'pago de', 'transferencia de', 'recibido de',
  'pagamento da', 'bonifico da', 'ricevuto da',
  'pagamento de', 'transferencia recebida de', 'recebido de',
  'platnosc od', 'przelew od', 'wplata od',
  'betaling van', 'overboeking van', 'ontvangen van',
  'utalas toltol', 'jovairas toltol',
  'platba od', 'prichozi platba od',
]

/** "To X" in each language. Single letters ("a", "à") are left out: they start too many names. */
export const TO_PHRASES = [
  'swift transfer to', 'sepa transfer to', 'transfer to', 'payment to', 'to',
  'plata catre', 'transfer catre', 'catre',
  'zahlung an', 'uberweisung an',
  'paiement a', 'virement a', 'virement vers', 'vers',
  'pago a', 'transferencia a', 'pagamento a', 'bonifico a', 'transferencia para', 'pagamento para',
  'platnosc do', 'przelew do',
  'betaling aan', 'overboeking naar',
  'platba pro',
]

/**
 * Month names and abbreviations, folded, to their number. Polish and Czech genitives ("5 marca",
 * "5. března") are listed as written in dates.
 */
export const MONTH_WORDS: Record<string, number> = (() => {
  const m: Record<string, number> = {}
  const add = (n: number, ...words: string[]) => { for (const w of words) m[fold(w)] = n }
  add(1, 'january', 'jan', 'ianuarie', 'ian', 'januar', 'janvier', 'janv', 'enero', 'ene', 'gennaio', 'gen', 'janeiro', 'styczen', 'stycznia', 'sty', 'januari', 'januar', 'leden', 'ledna', 'led')
  add(2, 'february', 'feb', 'februarie', 'febr', 'februar', 'feber', 'fevrier', 'fevr', 'fev', 'febrero', 'febbraio', 'fevereiro', 'luty', 'lutego', 'lut', 'februari', 'unor', 'unora', 'uno')
  add(3, 'march', 'mar', 'martie', 'marz', 'maerz', 'mars', 'marzo', 'marco', 'marzec', 'marca', 'maart', 'mrt', 'marcius', 'marc', 'brezen', 'brezna', 'bre')
  add(4, 'april', 'apr', 'aprilie', 'avril', 'avr', 'abril', 'abr', 'aprile', 'kwiecien', 'kwietnia', 'kwi', 'aprilis', 'duben', 'dubna', 'dub')
  add(5, 'may', 'mai', 'mai', 'mai', 'mayo', 'may', 'maggio', 'mag', 'maio', 'maj', 'maja', 'mei', 'majus', 'kveten', 'kvetna', 'kve')
  add(6, 'june', 'jun', 'iunie', 'iun', 'juni', 'juin', 'junio', 'giugno', 'giu', 'junho', 'czerwiec', 'czerwca', 'cze', 'junius', 'cerven', 'cervna', 'cvn')
  add(7, 'july', 'jul', 'iulie', 'iul', 'juli', 'juillet', 'juil', 'julio', 'luglio', 'lug', 'julho', 'lipiec', 'lipca', 'lip', 'julius', 'cervenec', 'cervence', 'cvc')
  add(8, 'august', 'aug', 'august', 'aout', 'agosto', 'ago', 'sierpien', 'sierpnia', 'sie', 'augustus', 'augusztus', 'srpen', 'srpna', 'srp')
  add(9, 'september', 'sep', 'sept', 'septembrie', 'septembre', 'septiembre', 'setiembre', 'settembre', 'set', 'setembro', 'wrzesien', 'wrzesnia', 'wrz', 'szeptember', 'szept', 'zari', 'zar')
  add(10, 'october', 'oct', 'octombrie', 'oktober', 'okt', 'octobre', 'octubre', 'ottobre', 'ott', 'outubro', 'out', 'pazdziernik', 'pazdziernika', 'paz', 'oktober', 'rijen', 'rijna', 'rij')
  add(11, 'november', 'nov', 'noiembrie', 'noi', 'novembre', 'noviembre', 'novembro', 'listopad', 'listopada', 'lis', 'listopadu')
  add(12, 'december', 'dec', 'decembrie', 'dezember', 'dez', 'decembre', 'diciembre', 'dic', 'dicembre', 'dezembro', 'grudzien', 'grudnia', 'gru', 'prosinec', 'prosince', 'pro')
  return m
})()

/** Words around a date to skip: "de", "del", "the", "of"… */
export const DATE_FILLER = new Set(['de', 'del', 'of', 'the', 'le', 'el', 'il', 'den', 'am', 'ev', 'r', 'roku'])

/**
 * Columns that name the other party from one side only. Money in comes *from* the payer; money
 * out goes *to* the payee. A column of the other side holds you, never the counterparty.
 */
export const PAYER_HEADERS = ['payer', 'platitor', 'zahler', 'auftraggeber', 'ordenante', 'payeur', 'emetteur', 'pagatore', 'platce', 'nadawca', 'sender', 'from']
export const PAYEE_HEADERS = ['beneficiary', 'payee', 'beneficiar', 'empfanger', 'beguenstigter', 'begunstigter', 'beneficiaire', 'beneficiario', 'odbiorca', 'prijemce', 'kedvezmenyezett', 'recipient', 'to']
