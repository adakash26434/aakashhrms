/**
 * Nepal Administrative Divisions — Provinces, Districts, and Local Levels (Palikas).
 * Up-to-date with current Nepal Government structure:
 * - 7 Provinces
 * - 77 Districts
 * - 753 Local Levels (6 Metropolitan, 11 Sub-Metropolitan, 276 Municipalities, 460 Rural Municipalities)
 */

export interface Province {
  id: string;
  name: string;
  nameNepali: string;
}

export interface District {
  id: string;
  name: string;
  nameNepali: string;
  provinceId: string;
}

export interface LocalLevel {
  id: string;
  name: string;
  type: "Metropolitan" | "Sub-Metropolitan" | "Municipality" | "Rural Municipality";
  districtId: string;
}

export interface StructuredAddress {
  province: string;
  district: string;
  localLevel: string;
  wardNo: string;
  tole: string;
}

export const PROVINCES: Province[] = [
  { id: "P1", name: "Koshi Province", nameNepali: "कोशी प्रदेश" },
  { id: "P2", name: "Madhesh Province", nameNepali: "मधेश प्रदेश" },
  { id: "P3", name: "Bagmati Province", nameNepali: "बागमती प्रदेश" },
  { id: "P4", name: "Gandaki Province", nameNepali: "गण्डकी प्रदेश" },
  { id: "P5", name: "Lumbini Province", nameNepali: "लुम्बिनी प्रदेश" },
  { id: "P6", name: "Karnali Province", nameNepali: "कर्णाली प्रदेश" },
  { id: "P7", name: "Sudurpashchim Province", nameNepali: "सुदूरपश्चिम प्रदेश" },
];

export const DISTRICTS: District[] = [
  // Koshi Province (14 Districts)
  { id: "Bhojpur", name: "Bhojpur", nameNepali: "भोजपुर", provinceId: "P1" },
  { id: "Dhankuta", name: "Dhankuta", nameNepali: "धनकुटा", provinceId: "P1" },
  { id: "Ilam", name: "Ilam", nameNepali: "इलाम", provinceId: "P1" },
  { id: "Jhapa", name: "Jhapa", nameNepali: "झापा", provinceId: "P1" },
  { id: "Khotang", name: "Khotang", nameNepali: "खोटाङ", provinceId: "P1" },
  { id: "Morang", name: "Morang", nameNepali: "मोरङ", provinceId: "P1" },
  { id: "Okhaldhunga", name: "Okhaldhunga", nameNepali: "ओखलढुङ्गा", provinceId: "P1" },
  { id: "Panchthar", name: "Panchthar", nameNepali: "पाँचथर", provinceId: "P1" },
  { id: "Sankhuwasabha", name: "Sankhuwasabha", nameNepali: "संखुवासभा", provinceId: "P1" },
  { id: "Solukhumbu", name: "Solukhumbu", nameNepali: "सोलुखुम्बु", provinceId: "P1" },
  { id: "Sunsari", name: "Sunsari", nameNepali: "सुनसरी", provinceId: "P1" },
  { id: "Taplejung", name: "Taplejung", nameNepali: "ताप्लेजुङ", provinceId: "P1" },
  { id: "Terhathum", name: "Terhathum", nameNepali: "तेह्रथुम", provinceId: "P1" },
  { id: "Udayapur", name: "Udayapur", nameNepali: "उदयपुर", provinceId: "P1" },

  // Madhesh Province (8 Districts)
  { id: "Bara", name: "Bara", nameNepali: "बारा", provinceId: "P2" },
  { id: "Dhanusha", name: "Dhanusha", nameNepali: "धनुषा", provinceId: "P2" },
  { id: "Mahottari", name: "Mahottari", nameNepali: "महोत्तरी", provinceId: "P2" },
  { id: "Parsa", name: "Parsa", nameNepali: "पर्सा", provinceId: "P2" },
  { id: "Rautahat", name: "Rautahat", nameNepali: "रौतहट", provinceId: "P2" },
  { id: "Saptari", name: "Saptari", nameNepali: "सप्तरी", provinceId: "P2" },
  { id: "Sarlahi", name: "Sarlahi", nameNepali: "सर्लाही", provinceId: "P2" },
  { id: "Siraha", name: "Siraha", nameNepali: "सिराहा", provinceId: "P2" },

  // Bagmati Province (13 Districts)
  { id: "Bhaktapur", name: "Bhaktapur", nameNepali: "भक्तपुर", provinceId: "P3" },
  { id: "Chitwan", name: "Chitwan", nameNepali: "चितवन", provinceId: "P3" },
  { id: "Dhading", name: "Dhading", nameNepali: "धादिङ", provinceId: "P3" },
  { id: "Dolakha", name: "Dolakha", nameNepali: "दोलखा", provinceId: "P3" },
  { id: "Kathmandu", name: "Kathmandu", nameNepali: "काठमाडौँ", provinceId: "P3" },
  { id: "Kavrepalanchok", name: "Kavrepalanchok", nameNepali: "काभ्रेपलाञ्चोक", provinceId: "P3" },
  { id: "Lalitpur", name: "Lalitpur", nameNepali: "ललितपुर", provinceId: "P3" },
  { id: "Makwanpur", name: "Makwanpur", nameNepali: "मकवानपुर", provinceId: "P3" },
  { id: "Nuwakot", name: "Nuwakot", nameNepali: "नुवाकोट", provinceId: "P3" },
  { id: "Ramechhap", name: "Ramechhap", nameNepali: "रामेछाप", provinceId: "P3" },
  { id: "Rasuwa", name: "Rasuwa", nameNepali: "रसुवा", provinceId: "P3" },
  { id: "Sindhuli", name: "Sindhuli", nameNepali: "सिन्धुली", provinceId: "P3" },
  { id: "Sindhupalchok", name: "Sindhupalchok", nameNepali: "सिन्धुपाल्चोक", provinceId: "P3" },

  // Gandaki Province (11 Districts)
  { id: "Baglung", name: "Baglung", nameNepali: "बागलुङ", provinceId: "P4" },
  { id: "Gorkha", name: "Gorkha", nameNepali: "गोरखा", provinceId: "P4" },
  { id: "Kaski", name: "Kaski", nameNepali: "कास्की", provinceId: "P4" },
  { id: "Lamjung", name: "Lamjung", nameNepali: "लमजुङ", provinceId: "P4" },
  { id: "Manang", name: "Manang", nameNepali: "मनाङ", provinceId: "P4" },
  { id: "Mustang", name: "Mustang", nameNepali: "मुस्ताङ", provinceId: "P4" },
  { id: "Myagdi", name: "Myagdi", nameNepali: "म्याग्दी", provinceId: "P4" },
  { id: "Nawalpur", name: "Nawalpur (Nawalparasi East)", nameNepali: "नवलपुर", provinceId: "P4" },
  { id: "Parbat", name: "Parbat", nameNepali: "पर्वत", provinceId: "P4" },
  { id: "Syangja", name: "Syangja", nameNepali: "स्याङ्जा", provinceId: "P4" },
  { id: "Tanahun", name: "Tanahun", nameNepali: "तनहुँ", provinceId: "P4" },

  // Lumbini Province (12 Districts)
  { id: "Arghakhanchi", name: "Arghakhanchi", nameNepali: "अर्घाखाँची", provinceId: "P5" },
  { id: "Banke", name: "Banke", nameNepali: "बाँके", provinceId: "P5" },
  { id: "Bardiya", name: "Bardiya", nameNepali: "बर्दिया", provinceId: "P5" },
  { id: "Dang", name: "Dang", nameNepali: "दाङ", provinceId: "P5" },
  { id: "Gulmi", name: "Gulmi", nameNepali: "गुल्मी", provinceId: "P5" },
  { id: "Kapilvastu", name: "Kapilvastu", nameNepali: "कपिलवस्तु", provinceId: "P5" },
  { id: "Parasi", name: "Parasi (Nawalparasi West)", nameNepali: "परासी", provinceId: "P5" },
  { id: "Palpa", name: "Palpa", nameNepali: "पाल्पा", provinceId: "P5" },
  { id: "Pyuthan", name: "Pyuthan", nameNepali: "प्युठान", provinceId: "P5" },
  { id: "Rolpa", name: "Rolpa", nameNepali: "रोल्पा", provinceId: "P5" },
  { id: "RukumEast", name: "Rukum East", nameNepali: "पूर्वी रुकुम", provinceId: "P5" },
  { id: "Rupandehi", name: "Rupandehi", nameNepali: "रुपन्देही", provinceId: "P5" },

  // Karnali Province (10 Districts)
  { id: "Dailekh", name: "Dailekh", nameNepali: "दैलेख", provinceId: "P6" },
  { id: "Dolpa", name: "Dolpa", nameNepali: "डोल्पा", provinceId: "P6" },
  { id: "Humla", name: "Humla", nameNepali: "हुम्ला", provinceId: "P6" },
  { id: "Jajarkot", name: "Jajarkot", nameNepali: "जाजरकोट", provinceId: "P6" },
  { id: "Jumla", name: "Jumla", nameNepali: "जुम्ला", provinceId: "P6" },
  { id: "Kalikot", name: "Kalikot", nameNepali: "कालिकोट", provinceId: "P6" },
  { id: "Mugu", name: "Mugu", nameNepali: "मुगु", provinceId: "P6" },
  { id: "RukumWest", name: "Rukum West", nameNepali: "पश्चिम रुकुम", provinceId: "P6" },
  { id: "Salyan", name: "Salyan", nameNepali: "सल्यान", provinceId: "P6" },
  { id: "Surkhet", name: "Surkhet", nameNepali: "सुर्खेत", provinceId: "P6" },

  // Sudurpashchim Province (9 Districts)
  { id: "Achham", name: "Achham", nameNepali: "अछाम", provinceId: "P7" },
  { id: "Baitadi", name: "Baitadi", nameNepali: "बैतडी", provinceId: "P7" },
  { id: "Bajhang", name: "Bajhang", nameNepali: "बझाङ", provinceId: "P7" },
  { id: "Bajura", name: "Bajura", nameNepali: "बाजुरा", provinceId: "P7" },
  { id: "Dadeldhura", name: "Dadeldhura", nameNepali: "डडेलधुरा", provinceId: "P7" },
  { id: "Darchula", name: "Darchula", nameNepali: "दार्चुला", provinceId: "P7" },
  { id: "Doti", name: "Doti", nameNepali: "डोटी", provinceId: "P7" },
  { id: "Kailali", name: "Kailali", nameNepali: "कैलाली", provinceId: "P7" },
  { id: "Kanchanpur", name: "Kanchanpur", nameNepali: "कञ्चनपुर", provinceId: "P7" },
];

export const LOCAL_LEVELS_MAP: Record<string, string[]> = {
  // Bagmati
  Kathmandu: [
    "Kathmandu Metropolitan City",
    "Kirtipur Municipality",
    "Budhanilkantha Municipality",
    "Chandragiri Municipality",
    "Tokha Municipality",
    "Tarakeshwor Municipality",
    "Gokarneshwor Municipality",
    "Nagarjun Municipality",
    "Kageshwari Manohara Municipality",
    "Shankharapur Municipality",
    "Dakshinkali Municipality",
  ],
  Lalitpur: [
    "Lalitpur Metropolitan City",
    "Mahalaxmi Municipality",
    "Godawari Municipality",
    "Konjyosom Rural Municipality",
    "Bagmati Rural Municipality",
    "Mahankal Rural Municipality",
  ],
  Bhaktapur: [
    "Bhaktapur Municipality",
    "Madhyapur Thimi Municipality",
    "Suryabinayak Municipality",
    "Changunarayan Municipality",
  ],
  Chitwan: [
    "Bharatpur Metropolitan City",
    "Ratnanagar Municipality",
    "Khairahani Municipality",
    "Rapti Municipality",
    "Kalika Municipality",
    "Madi Municipality",
    "Ichchhakamana Rural Municipality",
  ],
  Makwanpur: [
    "Hetauda Sub-Metropolitan City",
    "Thaha Municipality",
    "Bhimfedi Rural Municipality",
    "Makawanpurgadhi Rural Municipality",
    "Manahari Rural Municipality",
    "Raksirang Rural Municipality",
    "Bakaiya Rural Municipality",
    "Bagmati Rural Municipality",
    "Kailash Rural Municipality",
    "Indrasarowar Rural Municipality",
  ],
  Kavrepalanchok: [
    "Dhulikhel Municipality",
    "Banepa Municipality",
    "Panauti Municipality",
    "Panchkhal Municipality",
    "Namobuddha Municipality",
    "Mandandeupur Municipality",
    "Roshi Rural Municipality",
    "Temal Rural Municipality",
    "Bethanchowk Rural Municipality",
    "Chaurideurali Rural Municipality",
    "Mahabharat Rural Municipality",
    "Khanikhola Rural Municipality",
    "Bhumlu Rural Municipality",
  ],
  Dhading: [
    "Nilkantha Municipality",
    "Dhunibeshi Municipality",
    "Galchhi Rural Municipality",
    "Gajuri Rural Municipality",
    "Benighat Rorang Rural Municipality",
    "Siddhalek Rural Municipality",
    "Tripurasundari Rural Municipality",
    "Gangajamuna Rural Municipality",
    "Jwalamukhi Rural Municipality",
    "Khaniyabas Rural Municipality",
    "Netrawati Dabjong Rural Municipality",
    "Rubi Valley Rural Municipality",
    "Thakre Rural Municipality",
  ],
  Nuwakot: [
    "Bidur Municipality",
    "Belkotgadhi Municipality",
    "Kakani Rural Municipality",
    "Panchakanya Rural Municipality",
    "Likhu Rural Municipality",
    "Suryagadhi Rural Municipality",
    "Tadi Rural Municipality",
    "Tarakeshwor Rural Municipality",
    "Dupcheshwar Rural Municipality",
    "Shivapuri Rural Municipality",
    "Kispang Rural Municipality",
    "Myagang Rural Municipality",
  ],
  Sindhupalchok: [
    "Chautara Sangachokgadhi Municipality",
    "Melamchi Municipality",
    "Barhabise Municipality",
    "Indrawati Rural Municipality",
    "Panchpokhari Thangpal Rural Municipality",
    "Helambu Rural Municipality",
    "Bhotekoshi Rural Municipality",
    "Lisankhu Pakhar Rural Municipality",
    "Sunkoshi Rural Municipality",
    "Balephi Rural Municipality",
    "Tripurasundari Rural Municipality",
    "Jugal Rural Municipality",
  ],
  Dolakha: [
    "Bhimeshwor Municipality",
    "Jiri Municipality",
    "Kalinchok Rural Municipality",
    "Sailung Rural Municipality",
    "Baiteshwor Rural Municipality",
    "Gaurishankar Rural Municipality",
    "Bigu Rural Municipality",
    "Tamakoshi Rural Municipality",
    "Melung Rural Municipality",
  ],
  Ramechhap: [
    "Manthali Municipality",
    "Ramechhap Municipality",
    "Umakunda Rural Municipality",
    "Khandadevi Rural Municipality",
    "Gokulganga Rural Municipality",
    "Doramba Sailung Rural Municipality",
    "Likhu Tamakoshi Rural Municipality",
    "Sunapati Rural Municipality",
  ],
  Sindhuli: [
    "Kamalamai Municipality",
    "Dudhauli Municipality",
    "Golanjor Rural Municipality",
    "Tinpatan Rural Municipality",
    "Marin Rural Municipality",
    "Hariharpurgadhi Rural Municipality",
    "Sunkoshi Rural Municipality",
    "Ghyanglekh Rural Municipality",
    "Phikkal Rural Municipality",
  ],
  Rasuwa: [
    "Uttargaya Rural Municipality",
    "Kalika Rural Municipality",
    "Gosaikunda Rural Municipality",
    "Naukunda Rural Municipality",
    "Aamachhodingmo Rural Municipality",
  ],

  // Koshi
  Morang: [
    "Biratnagar Metropolitan City",
    "Sundarharaicha Municipality",
    "Belbari Municipality",
    "Pathari Sanischare Municipality",
    "Ratuwamai Municipality",
    "Urlabari Municipality",
    "Rangeli Municipality",
    "Sunwarshi Municipality",
    "Letang Municipality",
    "Kanepokhari Rural Municipality",
    "Katahari Rural Municipality",
    "Gramthan Rural Municipality",
    "Jahada Rural Municipality",
    "Dhanpalthan Rural Municipality",
    "Budhiganga Rural Municipality",
    "Kerabari Rural Municipality",
    "Miklajung Rural Municipality",
  ],
  Sunsari: [
    "Dharan Sub-Metropolitan City",
    "Itahari Sub-Metropolitan City",
    "Inaruwa Municipality",
    "Duhabi Municipality",
    "Ramdhuni Municipality",
    "Barahachhetra Municipality",
    "Koshi Rural Municipality",
    "Gadhi Rural Municipality",
    "Barju Rural Municipality",
    "Bhokraha Narsing Rural Municipality",
    "Harinagar Rural Municipality",
    "Dewanganj Rural Municipality",
  ],
  Jhapa: [
    "Birtamod Municipality",
    "Damak Municipality",
    "Mechinagar Municipality",
    "Bhadrapur Municipality",
    "Arjundhara Municipality",
    "Kankai Municipality",
    "Shivasatakshi Municipality",
    "Gauradaha Municipality",
    "Buddhashanti Rural Municipality",
    "Haldibari Rural Municipality",
    "Kachankawal Rural Municipality",
    "Barhadashi Rural Municipality",
    "Jhapa Rural Municipality",
    "Gaurigunj Rural Municipality",
    "Kamal Rural Municipality",
  ],
  Ilam: [
    "Ilam Municipality",
    "Deumai Municipality",
    "Mai Municipality",
    "Suryodaya Municipality",
    "Fakphokthum Rural Municipality",
    "Chulachuli Rural Municipality",
    "Maijogmai Rural Municipality",
    "Mangsebung Rural Municipality",
    "Rong Rural Municipality",
    "Sandakpur Rural Municipality",
  ],
  Dhankuta: [
    "Dhankuta Municipality",
    "Pakhribas Municipality",
    "Mahalaxmi Municipality",
    "Sangurigadhi Rural Municipality",
    "Khalanga Rural Municipality",
    "Chhathar Jorpati Rural Municipality",
    "Shahidbhumi Rural Municipality",
  ],
  Bhojpur: [
    "Bhojpur Municipality",
    "Shadananda Municipality",
    "Hatuwagadhi Rural Municipality",
    "Ramprasad Rai Rural Municipality",
    "Aamchok Rural Municipality",
    "Tyamke Maiyum Rural Municipality",
    "Arun Rural Municipality",
    "Pauwadungma Rural Municipality",
    "Salpasilichho Rural Municipality",
  ],
  Khotang: [
    "Diktel Rupakot Majhuwagadhi Municipality",
    "Halesi Tuwachung Municipality",
    "Khotehang Rural Municipality",
    "Diprung Chuichumma Rural Municipality",
    "Aiselukharka Rural Municipality",
    "Jantedhunga Rural Municipality",
    "Kepilasgadhi Rural Municipality",
    "Barahapokhari Rural Municipality",
    "Rawabesi Rural Municipality",
    "Sakela Rural Municipality",
  ],
  Okhaldhunga: [
    "Siddhicharan Municipality",
    "Manebhanjyang Rural Municipality",
    "Champadevi Rural Municipality",
    "Sunkoshi Rural Municipality",
    "Molung Rural Municipality",
    "Chisankhugadhi Rural Municipality",
    "Khijidemba Rural Municipality",
    "Likhu Rural Municipality",
  ],
  Panchthar: [
    "Phidim Municipality",
    "Falelung Rural Municipality",
    "Falgunanda Rural Municipality",
    "Hilihang Rural Municipality",
    "Kummayak Rural Municipality",
    "Miklajung Rural Municipality",
    "Tumbewa Rural Municipality",
    "Yangwarak Rural Municipality",
  ],
  Sankhuwasabha: [
    "Khandbari Municipality",
    "Chainpur Municipality",
    "Dharmadevi Municipality",
    "Madi Municipality",
    "Panchakhapan Municipality",
    "Bhotkhola Rural Municipality",
    "Chichila Rural Municipality",
    "Makalu Rural Municipality",
    "Savapokhari Rural Municipality",
    "Silichong Rural Municipality",
  ],
  Solukhumbu: [
    "Solududhkunda Municipality",
    "Dudhkaushika Rural Municipality",
    "Nechasalyan Rural Municipality",
    "Dudhkoshi Rural Municipality",
    "Maha Kulung Rural Municipality",
    "Sotang Rural Municipality",
    "Likhu Pike Rural Municipality",
    "Khumbu Pasang Lhamu Rural Municipality",
  ],
  Taplejung: [
    "Phungling Municipality",
    "Aathrai Tribeni Rural Municipality",
    "Sidingba Rural Municipality",
    "Faktanglung Rural Municipality",
    "Mikwakhola Rural Municipality",
    "Meringden Rural Municipality",
    "Maiwakhola Rural Municipality",
    "Pathivara Yangwarak Rural Municipality",
    "Sirijangha Rural Municipality",
  ],
  Terhathum: [
    "Myanglung Municipality",
    "Laligurans Municipality",
    "Aathrai Rural Municipality",
    "Chhathar Rural Municipality",
    "Phedap Rural Municipality",
    "Menchayayem Rural Municipality",
  ],
  Udayapur: [
    "Triyuga Municipality",
    "Katari Municipality",
    "Chaudandigadhi Municipality",
    "Belaka Municipality",
    "Udayapurgadhi Rural Municipality",
    "Rauta Mai Rural Municipality",
    "Tapli Rural Municipality",
    "Limchungbung Rural Municipality",
  ],

  // Madhesh
  Parsa: [
    "Birgunj Metropolitan City",
    "Bahudaramai Municipality",
    "Parsagadhi Municipality",
    "Pokhariya Municipality",
    "Bindabasini Rural Municipality",
    "Chhipaharmai Rural Municipality",
    "Dhobini Rural Municipality",
    "Jagarnathpur Rural Municipality",
    "Jirabhawani Rural Municipality",
    "Kalikamai Rural Municipality",
    "Pakahamainpur Rural Municipality",
    "Paterwasugauli Rural Municipality",
    "SakhuwaPrasauni Rural Municipality",
    "Thori Rural Municipality",
  ],
  Dhanusha: [
    "Janakpurdham Sub-Metropolitan City",
    "Chhireshwarnath Municipality",
    "Ganeshman Charnath Municipality",
    "Dhanusadham Municipality",
    "Nagarain Municipality",
    "Bideha Municipality",
    "Mithila Municipality",
    "Shahidnagar Municipality",
    "Sabaila Municipality",
    "Kamala Municipality",
    "Mithila Bihari Municipality",
    "Hansapur Municipality",
    "Janaknandani Rural Municipality",
    "Bateshwar Rural Municipality",
    "Mukhiyapatti Musharniya Rural Municipality",
    "Lakshminiya Rural Municipality",
    "Aurahi Rural Municipality",
    "Dhanauji Rural Municipality",
  ],
  Bara: [
    "Kalaiya Sub-Metropolitan City",
    "Jitpursimara Sub-Metropolitan City",
    "Kolhabi Municipality",
    "Nijgadh Municipality",
    "Mahagadhimai Municipality",
    "Simraungadh Municipality",
    "Pacharauta Municipality",
    "Adarshakotwal Rural Municipality",
    "Karaiyamai Rural Municipality",
    "Devtal Rural Municipality",
    "Parwanipur Rural Municipality",
    "Prasauni Rural Municipality",
    "Feta Rural Municipality",
    "Pheta Rural Municipality",
    "Suwarna Rural Municipality",
    "Bishrampur Rural Municipality",
  ],
  Mahottari: [
    "Jaleshwor Municipality",
    "Bardibas Municipality",
    "Gaushala Municipality",
    "Loharpatti Municipality",
    "Ramgopalpur Municipality",
    "Manra Siswa Municipality",
    "Matihani Municipality",
    "Bhangaha Municipality",
    "Balwa Municipality",
    "Aurahi Municipality",
    "Pipra Rural Municipality",
    "Samsi Rural Municipality",
    "Sonaama Rural Municipality",
    "Mahottari Rural Municipality",
    "Ekdara Rural Municipality",
  ],
  Rautahat: [
    "Gaur Municipality",
    "Garuda Municipality",
    "Chandrapur Municipality",
    "Dewahi Gonahi Municipality",
    "Brindaban Municipality",
    "Gujara Municipality",
    "Fatuwa Bijaypur Municipality",
    "Maulapur Municipality",
    "Madhav Narayan Municipality",
    "Katahariya Municipality",
    "Paroha Municipality",
    "Ishnath Municipality",
    "Rajpur Municipality",
    "Gadhimai Municipality",
    "Rajdevi Municipality",
    "Baudhimai Municipality",
    "Durga Bhagwati Rural Municipality",
    "Yamunamai Rural Municipality",
  ],
  Saptari: [
    "Rajbiraj Municipality",
    "Kanchanrup Municipality",
    "Dakneshwori Municipality",
    "Bodebarsain Municipality",
    "Khadak Municipality",
    "Shambhunath Municipality",
    "Surunga Municipality",
    "Hanumannagar Kankalini Municipality",
    "Saptakoshi Municipality",
    "Agnisair Krishna Savaran Rural Municipality",
    "Chhinnamasta Rural Municipality",
    "Mahadeva Rural Municipality",
    "Tirhut Rural Municipality",
    "Tilathi Koiladi Rural Municipality",
    "Rupani Rural Municipality",
    "Balan Bihul Rural Municipality",
    "Bishnupur Rural Municipality",
    "Rajgadh Rural Municipality",
  ],
  Sarlahi: [
    "Malangwa Municipality",
    "Hariwan Municipality",
    "Lalbandi Municipality",
    "Ishworpur Municipality",
    "Barahathwa Municipality",
    "Haripur Municipality",
    "Bagmati Municipality",
    "Kabilasi Municipality",
    "Godaita Municipality",
    "Balara Municipality",
    "Haripurwa Municipality",
    "Chandranagar Rural Municipality",
    "Brahmapuri Rural Municipality",
    "Ramnagar Rural Municipality",
    "Chakraghatta Rural Municipality",
    "Kaudena Rural Municipality",
    "Dhankaul Rural Municipality",
    "Parsa Rural Municipality",
    "Bishnu Rural Municipality",
    "Basbariya Rural Municipality",
  ],
  Siraha: [
    "Siraha Municipality",
    "Lahan Municipality",
    "Golbazar Municipality",
    "Mirchaiya Municipality",
    "Kalyanpur Municipality",
    "Dhangadhimai Municipality",
    "Sukhipur Municipality",
    "Karjanha Municipality",
    "Bhagwanpur Rural Municipality",
    "Aurahi Rural Municipality",
    "Bishnupur Rural Municipality",
    "Bariyarpatti Rural Municipality",
    "Lakshmipur Patari Rural Municipality",
    "Naraha Rural Municipality",
    "Sakhuwanankarkatti Rural Municipality",
    "Arnama Rural Municipality",
    "Navarajpur Rural Municipality",
  ],

  // Gandaki
  Kaski: [
    "Pokhara Metropolitan City",
    "Annapurna Rural Municipality",
    "Machhapuchhre Rural Municipality",
    "Madi Rural Municipality",
    "Rupa Rural Municipality",
  ],
  Tanahun: [
    "Byas Municipality",
    "Shuklagandaki Municipality",
    "Bhimad Municipality",
    "Bhanu Municipality",
    "Myagde Rural Municipality",
    "Aanbookhaireni Rural Municipality",
    "Bandipur Rural Municipality",
    "Rishing Rural Municipality",
    "Devghat Rural Municipality",
    "Ghiring Rural Municipality",
  ],
  Syangja: [
    "Putalibazar Municipality",
    "Waling Municipality",
    "Chapakot Municipality",
    "Galyang Municipality",
    "Bhirkot Municipality",
    "Arjunchhauk Rural Municipality",
    "Kaligandaki Rural Municipality",
    "Phedikhola Rural Municipality",
    "Harinas Rural Municipality",
    "Biruwa Rural Municipality",
    "Aandhikhola Rural Municipality",
  ],
  Baglung: [
    "Baglung Municipality",
    "Galkot Municipality",
    "Jaimuni Municipality",
    "Dhorpatan Municipality",
    "Bareng Rural Municipality",
    "Kathekhola Rural Municipality",
    "Tamankhola Rural Municipality",
    "Tarakhola Rural Municipality",
    "Nisikhola Rural Municipality",
    "Badigad Rural Municipality",
  ],
  Gorkha: [
    "Gorkha Municipality",
    "Palungtar Municipality",
    "Sulikot Rural Municipality",
    "Siranchok Rural Municipality",
    "Ajirkot Rural Municipality",
    "Aarughat Rural Municipality",
    "Gandaki Rural Municipality",
    "Bhimsenthapa Rural Municipality",
    "Sahid Lakhan Rural Municipality",
    "Dharche Rural Municipality",
    "Chumanubri Rural Municipality",
  ],
  Lamjung: [
    "Besisahar Municipality",
    "Sundarbazar Municipality",
    "Rainas Municipality",
    "MadhyaNepal Municipality",
    "Kwhlosothar Rural Municipality",
    "Marsyangdi Rural Municipality",
    "Dordi Rural Municipality",
    "Dudhpokhari Rural Municipality",
  ],
  Nawalpur: [
    "Kawasoti Municipality",
    "Gaindakot Municipality",
    "Devachuli Municipality",
    "Madhyabindu Municipality",
    "Baudikali Rural Municipality",
    "Bulingtar Rural Municipality",
    "Binayi Tribeni Rural Municipality",
    "Hupsekot Rural Municipality",
  ],
  Parbat: [
    "Kushma Municipality",
    "Phalebas Municipality",
    "Jaljala Rural Municipality",
    "Paiyun Rural Municipality",
    "Mahashila Rural Municipality",
    "Modi Rural Municipality",
    "Bihadi Rural Municipality",
  ],
  Myagdi: [
    "Beni Municipality",
    "Annapurna Rural Municipality",
    "Dhaulagiri Rural Municipality",
    "Mangala Rural Municipality",
    "Malika Rural Municipality",
    "Raghuganga Rural Municipality",
  ],
  Manang: [
    "Chame Rural Municipality",
    "Narpa Bhumi Rural Municipality",
    "Nasong Rural Municipality",
    "Manang Ngisyang Rural Municipality",
  ],
  Mustang: [
    "Gharapjhong Rural Municipality",
    "Thasang Rural Municipality",
    "Baragung Muktichhetra Rural Municipality",
    "Lomanthang Rural Municipality",
    "Lo-Ghekar Damodarkunda Rural Municipality",
  ],

  // Lumbini
  Rupandehi: [
    "Butwal Sub-Metropolitan City",
    "Siddharthanagar Municipality",
    "Tilottama Municipality",
    "Sainamaina Municipality",
    "Devdaha Municipality",
    "Lumbini Sanskritik Municipality",
    "Gaidahawa Rural Municipality",
    "Kanchan Rural Municipality",
    "Kotahimai Rural Municipality",
    "Marchawari Rural Municipality",
    "Mayadevi Rural Municipality",
    "Omsatiya Rural Municipality",
    "Rohini Rural Municipality",
    "Sammarimai Rural Municipality",
    "Siyari Rural Municipality",
    "Suddhodhan Rural Municipality",
  ],
  Dang: [
    "Ghorahi Sub-Metropolitan City",
    "Tulsipur Sub-Metropolitan City",
    "Lamahi Municipality",
    "Babai Rural Municipality",
    "Gadhawa Rural Municipality",
    "Rajpur Rural Municipality",
    "Rapti Rural Municipality",
    "Shantinagar Rural Municipality",
    "Dangisharan Rural Municipality",
    "Banglachuli Rural Municipality",
  ],
  Banke: [
    "Nepalgunj Sub-Metropolitan City",
    "Kohalpur Municipality",
    "Baijanath Rural Municipality",
    "Rapti Sonari Rural Municipality",
    "Narainapur Rural Municipality",
    "Duduwa Rural Municipality",
    "Janki Rural Municipality",
    "Khajura Rural Municipality",
  ],
  Bardiya: [
    "Gulariya Municipality",
    "Madhuwan Municipality",
    "Rajapur Municipality",
    "Thakurbaba Municipality",
    "Bansgadhi Municipality",
    "Barbardiya Municipality",
    "Badhaiyatal Rural Municipality",
    "Geruwa Rural Municipality",
  ],
  Kapilvastu: [
    "Kapilvastu Municipality",
    "Banganga Municipality",
    "Buddhabhumi Municipality",
    "Shivaraj Municipality",
    "Krishnanagar Municipality",
    "Maharajgunj Municipality",
    "Mayadevi Rural Municipality",
    "Yashodhara Rural Municipality",
    "Suddhodhan Rural Municipality",
    "Bijayanagar Rural Municipality",
  ],
  Palpa: [
    "Tansen Municipality",
    "Rampur Municipality",
    "Nisdi Rural Municipality",
    "Purbakhola Rural Municipality",
    "Rambha Rural Municipality",
    "Mathagadhi Rural Municipality",
    "Tinau Rural Municipality",
    "Bagnaskali Rural Municipality",
    "Ribdikot Rural Municipality",
    "Rainadevi Chhahara Rural Municipality",
  ],
  Arghakhanchi: [
    "Sandhikharka Municipality",
    "Sitganga Municipality",
    "Bhumikasthan Municipality",
    "Chhatradev Rural Municipality",
    "Panini Rural Municipality",
    "Malarani Rural Municipality",
  ],
  Gulmi: [
    "Tamghas (Resunga) Municipality",
    "Musikot Municipality",
    "Isma Rural Municipality",
    "Kaligandaki Rural Municipality",
    "Gulmidarbar Rural Municipality",
    "Satyawati Rural Municipality",
    "Chandrakot Rural Municipality",
    "Ruru Rural Municipality",
    "Chhatrakot Rural Municipality",
    "Dhurkot Rural Municipality",
    "Madane Rural Municipality",
    "Malika Rural Municipality",
  ],
  Parasi: [
    "Ramgram Municipality",
    "Sunwal Municipality",
    "Bardaghat Municipality",
    "Palhinandan Rural Municipality",
    "Sarawal Rural Municipality",
    "Pratappur Rural Municipality",
    "Susta Rural Municipality",
  ],
  Pyuthan: [
    "Pyuthan Municipality",
    "Swargadwari Municipality",
    "Gaumukhi Rural Municipality",
    "Mandavi Rural Municipality",
    "Sarumarani Rural Municipality",
    "Mallarani Rural Municipality",
    "Naubahini Rural Municipality",
    "Jhimruk Rural Municipality",
    "Airawati Rural Municipality",
  ],
  Rolpa: [
    "Rolpa Municipality",
    "Runtigadhi Rural Municipality",
    "Triveni Rural Municipality",
    "Sunil Smriti Rural Municipality",
    "Lungri Rural Municipality",
    "Duikhola Rural Municipality",
    "Thabang Rural Municipality",
    "Madi Rural Municipality",
    "Ghorahi Rural Municipality",
    "Sukidaha Rural Municipality",
  ],
  RukumEast: [
    "Putha Uttarganga Rural Municipality",
    "Bhume Rural Municipality",
    "Sisne Rural Municipality",
  ],

  // Karnali
  Surkhet: [
    "Birendranagar Municipality",
    "Bheriganga Municipality",
    "Gurbhakot Municipality",
    "Panchapuri Municipality",
    "Lekbeshi Municipality",
    "Chaukune Rural Municipality",
    "Barahatal Rural Municipality",
    "Chingad Rural Municipality",
    "Simta Rural Municipality",
  ],
  Dailekh: [
    "Narayan Municipality",
    "Dullu Municipality",
    "Chamunda Bindrasaini Municipality",
    "Aathbis Municipality",
    "Bhagawatimai Rural Municipality",
    "Gurans Rural Municipality",
    "Dungeshwar Rural Municipality",
    "Naumule Rural Municipality",
    "Mahabu Rural Municipality",
    "Bhairabi Rural Municipality",
    "Thantikandh Rural Municipality",
  ],
  Jajarkot: [
    "Bheri Municipality",
    "Chhedagad Municipality",
    "Nalgad Municipality",
    "Kuse Rural Municipality",
    "Barekot Rural Municipality",
    "Shivalaya Rural Municipality",
    "Junichande Rural Municipality",
  ],
  Salyan: [
    "Sharada Municipality",
    "Bagchaur Municipality",
    "Bangad Kupinde Municipality",
    "Kalimati Rural Municipality",
    "Triveni Rural Municipality",
    "Kapurkot Rural Municipality",
    "Chatreshwari Rural Municipality",
    "Siddha Kumakh Rural Municipality",
    "Kumakh Rural Municipality",
    "Darma Rural Municipality",
  ],
  RukumWest: [
    "Musikot Municipality",
    "Chaurjahari Municipality",
    "Aathbiskot Municipality",
    "Sanibheri Rural Municipality",
    "Tribeni Rural Municipality",
    "Banfikot Rural Municipality",
  ],
  Jumla: [
    "Chandannath Municipality",
    "Kankasundari Rural Municipality",
    "Sinja Rural Municipality",
    "Hima Rural Municipality",
    "Tila Rural Municipality",
    "Guthichaur Rural Municipality",
    "Tatopani Rural Municipality",
    "Patarasi Rural Municipality",
  ],
  Kalikot: [
    "Khandachakra Municipality",
    "Raskot Municipality",
    "Tilagufa Municipality",
    "Pachaljharana Rural Municipality",
    "Sanni Triveni Rural Municipality",
    "Narharinath Rural Municipality",
    "Shubha Kalika Rural Municipality",
    "Mahawai Rural Municipality",
    "Palata Rural Municipality",
  ],
  Dolpa: [
    "Thuli Bheri Municipality",
    "Tripurasundari Municipality",
    "Dolpo Buddha Rural Municipality",
    "Shey Phoksundo Rural Municipality",
    "Jagadulla Rural Municipality",
    "Mudkechula Rural Municipality",
    "Kaike Rural Municipality",
    "Chharka Tangsong Rural Municipality",
  ],
  Humla: [
    "Simkot Rural Municipality",
    "Namkha Rural Municipality",
    "Kharpunath Rural Municipality",
    "Sarkegad Rural Municipality",
    "Chankheli Rural Municipality",
    "Adanchuli Rural Municipality",
    "Tanjakot Rural Municipality",
  ],
  Mugu: [
    "Chhayanath Rara Municipality",
    "Mugum Karmarong Rural Municipality",
    "Soru Rural Municipality",
    "Khatyad Rural Municipality",
  ],

  // Sudurpashchim
  Kailali: [
    "Dhangadhi Sub-Metropolitan City",
    "Tikapur Municipality",
    "Godawari Municipality",
    "Lamkichuha Municipality",
    "Ghodaghodi Municipality",
    "Bhajani Municipality",
    "Gauriganga Municipality",
    "Janaki Rural Municipality",
    "Bardgoriya Rural Municipality",
    "Mohanyal Rural Municipality",
    "Kailari Rural Municipality",
    "Joshipur Rural Municipality",
    "Chure Rural Municipality",
  ],
  Kanchanpur: [
    "Bhimdatta Municipality",
    "Bedkot Municipality",
    "Shuklaphanta Municipality",
    "Mahakali (Doddhara-Chandani) Municipality",
    "Krishnapur Municipality",
    "Punarbas Municipality",
    "Belauri Municipality",
    "Laljhadi Rural Municipality",
    "Beldandi Rural Municipality",
  ],
  Achham: [
    "Mangalsen Municipality",
    "Kamalbazar Municipality",
    "Sanfebagar Municipality",
    "Panchadewal Binayak Municipality",
    "Chaurpati Rural Municipality",
    "Mellekh Rural Municipality",
    "Bannigadhi Jayagadh Rural Municipality",
    "Ramaroshan Rural Municipality",
    "Dhakari Rural Municipality",
    "Turmakhand Rural Municipality",
  ],
  Baitadi: [
    "Dasharathchand Municipality",
    "Patan Municipality",
    "Melauni Municipality",
    "Purchaudi Municipality",
    "Sunarya Rural Municipality",
    "Sigas Rural Municipality",
    "Shivanath Rural Municipality",
    "Pancheshwar Rural Municipality",
    "Dogadakedar Rural Municipality",
    "Dilasaini Rural Municipality",
  ],
  Bajhang: [
    "Jayaprithvi Municipality",
    "Bungal Municipality",
    "Talkot Rural Municipality",
    "Masta Rural Municipality",
    "Khaptadchhanna Rural Municipality",
    "Thalara Rural Municipality",
    "Bitthadchir Rural Municipality",
    "Surma Rural Municipality",
    "Chhabispathibhera Rural Municipality",
    "Durgathali Rural Municipality",
    "Kedarsyu Rural Municipality",
    "Saipal Rural Municipality",
  ],
  Bajura: [
    "Badimalika Municipality",
    "Triveni Municipality",
    "Budhiganga Municipality",
    "Budhinanda Municipality",
    "Gaumul Rural Municipality",
    "Pandavgufa Rural Municipality",
    "Swami Kartik Khapar Rural Municipality",
    "Chhededaha Rural Municipality",
    "Himali Rural Municipality",
  ],
  Dadeldhura: [
    "Amargadhi Municipality",
    "Parshuram Municipality",
    "Aalital Rural Municipality",
    "Bhageshwar Rural Municipality",
    "Navadurga Rural Municipality",
    "Ajaymeru Rural Municipality",
    "Ganyapdhura Rural Municipality",
  ],
  Darchula: [
    "Mahakali Municipality",
    "Shailyashikhar Municipality",
    "Malikarjun Rural Municipality",
    "Apihimal Rural Municipality",
    "Duhun Rural Municipality",
    "Naugad Rural Municipality",
    "Marma Rural Municipality",
    "Lekam Rural Municipality",
    "Byas Rural Municipality",
  ],
  Doti: [
    "Dipayal Silgadhi Municipality",
    "Shikhar Municipality",
    "Purbichauki Rural Municipality",
    "Badikedar Rural Municipality",
    "Jorayal Rural Municipality",
    "Sayal Rural Municipality",
    "Aadarsha Rural Municipality",
    "K.I. Singh Rural Municipality",
    "Bogatan Phudsil Rural Municipality",
  ],
};

// ---------------------------------------------------------------------------
// Public Helpers
// ---------------------------------------------------------------------------

export function getProvinces(): Province[] {
  return PROVINCES;
}

export function getDistrictsByProvince(provinceId: string): District[] {
  return DISTRICTS.filter((d) => d.provinceId === provinceId);
}

export function getPalikasByDistrict(districtNameOrId: string): string[] {
  if (!districtNameOrId) return [];
  // Support both ID ("Kathmandu") and formatted strings
  const found = Object.keys(LOCAL_LEVELS_MAP).find(
    (k) => k.toLowerCase() === districtNameOrId.toLowerCase()
  );
  return found ? LOCAL_LEVELS_MAP[found] : ["Central Municipality / Palika"];
}

export function getAllDistricts(): District[] {
  return DISTRICTS;
}

export function findProvinceByDistrict(districtName: string): Province | undefined {
  const dist = DISTRICTS.find(
    (d) => d.name.toLowerCase() === districtName.toLowerCase() || d.id.toLowerCase() === districtName.toLowerCase()
  );
  if (!dist) return undefined;
  return PROVINCES.find((p) => p.id === dist.provinceId);
}

/**
 * Parses stored address string or JSON into a structured address object.
 */
export function parseStructuredAddress(raw: string | null | undefined): StructuredAddress {
  const empty: StructuredAddress = {
    province: "",
    district: "",
    localLevel: "",
    wardNo: "",
    tole: "",
  };

  if (!raw || !raw.trim()) return empty;

  try {
    if (raw.trim().startsWith("{") && raw.trim().endsWith("}")) {
      const parsed = JSON.parse(raw);
      return {
        province: parsed.province || "",
        district: parsed.district || "",
        localLevel: parsed.localLevel || "",
        wardNo: parsed.wardNo ? String(parsed.wardNo) : "",
        tole: parsed.tole || "",
      };
    }
  } catch {}

  // Fallback for legacy plain text addresses: e.g. "Patan, Lalitpur" or "Ward-4, Lalitpur Metropolitan City, Lalitpur, Bagmati Province"
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 1) {
    return { ...empty, tole: parts[0] };
  }

  // Try to extract district from parts
  let foundDistrict = "";
  let foundProvince = "";
  for (const part of parts) {
    const dMatch = DISTRICTS.find((d) => d.name.toLowerCase() === part.toLowerCase());
    if (dMatch) {
      foundDistrict = dMatch.name;
      foundProvince = dMatch.provinceId;
    }
  }

  return {
    province: foundProvince,
    district: foundDistrict,
    localLevel: parts[1] || "",
    wardNo: "",
    tole: parts[0] || "",
  };
}

/**
 * Formats a structured address into a clean, human-readable address line.
 * e.g. "Kumaripati-4, Lalitpur Metropolitan City, Lalitpur, Bagmati Province"
 */
export function formatStructuredAddress(addr: StructuredAddress): string {
  const parts: string[] = [];
  if (addr.tole && addr.wardNo) {
    parts.push(`${addr.tole}-${addr.wardNo}`);
  } else {
    if (addr.tole) parts.push(addr.tole);
    if (addr.wardNo) parts.push(`Ward No. ${addr.wardNo}`);
  }

  if (addr.localLevel) parts.push(addr.localLevel);
  if (addr.district) parts.push(addr.district);

  if (addr.province) {
    const prov = PROVINCES.find((p) => p.id === addr.province || p.name === addr.province);
    if (prov) parts.push(prov.name);
    else parts.push(addr.province);
  }

  return parts.join(", ");
}

/**
 * Serializes a structured address into JSON for lossless database storage.
 */
export function serializeStructuredAddress(addr: StructuredAddress): string {
  return JSON.stringify({
    province: addr.province.trim(),
    district: addr.district.trim(),
    localLevel: addr.localLevel.trim(),
    wardNo: addr.wardNo.trim(),
    tole: addr.tole.trim(),
    formatted: formatStructuredAddress(addr),
  });
}
