// Self-service language (G12 groundwork): English or Nepali for the employee
// portal, chosen per browser (cookie `ess_lang`). The dictionary is small and
// explicit — keys are what the portal says, not a translation system; pages
// outside self-service stay English (the office screens are English-only by
// the 4.6 decision). Add keys here, read them with `t(lang, key)`.

export const ESS_LANGUAGES = ['en', 'np'] as const;
export type EssLang = (typeof ESS_LANGUAGES)[number];
export const ESS_LANG_COOKIE = 'ess_lang';

export const asEssLang = (v: unknown): EssLang => (v === 'np' ? 'np' : 'en');

const DICT = {
  // navigation
  'nav.home': ['Home', 'गृह'],
  'nav.attendance': ['Attendance', 'हाजिरी'],
  'nav.leave': ['Leave', 'बिदा'],
  'nav.payslips': ['Payslips', 'तलब पर्ची'],
  'nav.profile': ['Profile', 'प्रोफाइल'],
  'nav.loans': ['Loans', 'ऋण / सापटी'],
  'nav.notices': ['Notices', 'सूचना'],
  'nav.training': ['Training', 'तालिम'],
  'nav.claims': ['Travel claims', 'भ्रमण भत्ता'],
  'nav.workspace': ['My workspace', 'मेरो कार्यक्षेत्र'],
  'nav.portal': ['Self-Service Portal', 'कर्मचारी सेवा पोर्टल'],
  'nav.signOut': ['Sign out', 'बाहिर निस्कनुहोस्'],
  'nav.language': ['Language', 'भाषा'],
  'nav.more': ['More', 'थप'],
  // home
  'home.hello': ['Hello', 'नमस्ते'],
  'home.workspace': ['Personal workspace', 'व्यक्तिगत कार्यक्षेत्र'],
  'home.applyLeave': ['Apply leave', 'बिदा माग्नुहोस्'],
  'home.applyLeaveHint': ['Request time off', 'बिदाको अनुरोध'],
  'home.viewPayslip': ['View payslip', 'तलब पर्ची हेर्नुहोस्'],
  'home.viewPayslipHint': ['Open salary statement', 'तलब विवरण खोल्नुहोस्'],
  'home.attendance': ['Attendance', 'हाजिरी'],
  'home.attendanceHint': ['Review your records', 'आफ्नो विवरण हेर्नुहोस्'],
  'home.requestLoan': ['Request loan', 'ऋण अनुरोध'],
  'home.requestLoanHint': ['Apply or view loans', 'ऋण माग्नुहोस् वा हेर्नुहोस्'],
  'home.leaveLeft': ['Leave left', 'बाँकी बिदा'],
  'home.lastNetPay': ['Last net pay', 'पछिल्लो खुद तलब'],
  'home.openRequests': ['Open requests', 'खुला अनुरोध'],
  'home.awaitingReview': ['Awaiting review', 'समीक्षा प्रतीक्षामा'],
  'home.currentMonth': ['Current month', 'यो महिना'],
  'home.noticeBoard': ['Notice board', 'सूचना पाटी'],
  'home.noNotices': ['No notices right now.', 'अहिले कुनै सूचना छैन।'],
  'home.days': ['days', 'दिन'],
  'home.takenOf': ['taken of', 'प्रयोग, जम्मा'],
  'home.allotted': ['allotted', 'उपलब्ध'],
  'home.noPayslip': ['No payslip yet', 'तलब पर्ची छैन'],
  // notices
  'notices.title': ['Notices', 'सूचना'],
  'notices.description': ['Company and branch notices addressed to you.', 'तपाईंलाई सम्बोधित संस्था र शाखाका सूचना।'],
  'notices.pinned': ['Pinned', 'पिन गरिएको'],
  // training
  'training.title': ['My training', 'मेरो तालिम'],
  'training.description': ['Programmes you were nominated to, with your result and any service bond.', 'तपाईं मनोनीत भएका तालिम, नतिजा र सेवा बन्धन।'],
  'training.none': ['You have not been nominated to any programme yet.', 'तपाईं अहिलेसम्म कुनै तालिममा मनोनीत हुनुभएको छैन।'],
  'training.programme': ['Programme', 'तालिम'],
  'training.dates': ['Dates', 'मिति'],
  'training.hours': ['Hours', 'घण्टा'],
  'training.status': ['Status', 'स्थिति'],
  'training.score': ['Score', 'अंक'],
  'training.certificate': ['Certificate', 'प्रमाणपत्र'],
  'training.bondUntil': ['Bond until', 'बन्धन अवधि'],
  'training.status.nominated': ['Nominated', 'मनोनीत'],
  'training.status.attended': ['Attended', 'उपस्थित'],
  'training.status.absent': ['Absent', 'अनुपस्थित'],
  'training.status.completed': ['Completed', 'सम्पन्न'],
  // claims
  'claims.title': ['My travel claims', 'मेरो भ्रमण भत्ता'],
  'claims.description': ['Field-visit claims from the rate card. Submit after the trip; HR approves and payroll pays.', 'दररेट अनुसार भ्रमण भत्ता। भ्रमणपछि पेश गर्नुहोस्; मानव संसाधनले स्वीकृत गर्छ र तलबसँगै भुक्तानी हुन्छ।'],
  'claims.none': ['No claims yet.', 'कुनै दाबी छैन।'],
  'claims.new': ['New claim', 'नयाँ दाबी'],
  'claims.trip': ['Trip', 'भ्रमण'],
  'claims.days': ['Days', 'दिन'],
  'claims.gross': ['Gross', 'कुल'],
  'claims.payable': ['Payable', 'भुक्तानी'],
  'claims.status': ['Status', 'स्थिति'],
  'claims.purpose': ['Purpose', 'उद्देश्य'],
  'claims.from': ['From', 'बाट'],
  'claims.to': ['To', 'सम्म'],
  'claims.start': ['Start', 'सुरु मिति'],
  'claims.end': ['End', 'अन्त्य मिति'],
  'claims.mode': ['Mode', 'साधन'],
  'claims.km': ['Kilometres', 'किलोमिटर'],
  'claims.fare': ['Fare paid', 'भाडा'],
  'claims.nights': ['Nights', 'रात'],
  'claims.lodging': ['Lodging paid', 'बास खर्च'],
  'claims.advance': ['Advance taken', 'पेश्की'],
  'claims.note': ['Note', 'कैफियत'],
  'claims.submit': ['Submit claim', 'दाबी पेश गर्नुहोस्'],
  'claims.cancel': ['Cancel', 'रद्द'],
  'claims.submitted': ['Claim submitted.', 'दाबी पेश भयो।'],
  'claims.status.draft': ['Draft', 'मस्यौदा'],
  'claims.status.submitted': ['Submitted', 'पेश गरिएको'],
  'claims.status.approved': ['Approved', 'स्वीकृत'],
  'claims.status.rejected': ['Rejected', 'अस्वीकृत'],
  'claims.status.settled': ['Paid', 'भुक्तानी भयो'],
  'claims.decision': ['Decision', 'निर्णय'],
} as const satisfies Record<string, readonly [string, string]>;

export type EssKey = keyof typeof DICT;

export function t(lang: EssLang, key: EssKey): string {
  const pair = DICT[key];
  return lang === 'np' ? pair[1] : pair[0];
}

/** Every key, for the toggle's preview and tests. */
export const ESS_KEYS = Object.keys(DICT) as EssKey[];
