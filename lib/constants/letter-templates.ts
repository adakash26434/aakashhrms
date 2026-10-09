// Default HR letter templates (G2), seeded once per company on first read
// (the ensureDefaultShift pattern). System templates: editable on the
// Templates tab, never deletable. Bodies are plain text with {{merge_field}}
// placeholders from lib/engines/letter.engine.ts; blank lines separate
// paragraphs. Wording follows common Nepali sahakari / office practice; each
// company tailors its own copies.

export interface DefaultLetterTemplate {
  code: string;
  name: string;
  nameNp: string;
  subjectEn: string;
  subjectNp: string;
  bodyEn: string;
  bodyNp: string;
}

export const DEFAULT_LETTER_TEMPLATES: readonly DefaultLetterTemplate[] = [
  {
    code: 'appointment',
    name: 'Appointment letter',
    nameNp: 'नियुक्ति पत्र',
    subjectEn: 'Letter of appointment',
    subjectNp: 'नियुक्ति सम्बन्धमा',
    bodyEn: `Dear {{employee_name}},

We are pleased to appoint you to the post of {{designation}} in the {{department}} department at our {{branch}} office, with effect from {{effective_date}}. Your monthly basic salary will be NPR {{basic_salary}}, with allowances and deductions as set out in your salary structure.

{{#if probation_months}}This appointment is subject to a probation period of {{probation_months}} months from the date of joining; on satisfactory performance your service will be confirmed. {{/if}}Your terms of service are governed by the organisation's staff service bylaws and the prevailing labour laws of Nepal.

Please sign and return the enclosed copy of this letter as your acceptance, and report to the {{branch}} office on your joining date with your citizenship certificate and academic credentials.

We welcome you to {{company_name}} and wish you a successful career with us.`,
    bodyNp: `श्री {{employee_name}},

तपाईंलाई मिति {{effective_date}} देखि लागू हुने गरी यस संस्थाको {{branch}} कार्यालय, {{department}} विभाग अन्तर्गत {{designation}} पदमा नियुक्त गरिएको व्यहोरा जानकारी गराइन्छ। तपाईंको मासिक आधारभूत तलब रु. {{basic_salary}} हुनेछ र भत्ता तथा कट्टीहरू तलब संरचना बमोजिम हुनेछन्।

{{#if probation_months}}यो नियुक्ति हाजिर भएको मितिले {{probation_months}} महिनाको परीक्षणकालमा रहनेछ र कार्यसम्पादन सन्तोषजनक भएमा सेवा स्थायी गरिनेछ। {{/if}}तपाईंका सेवा शर्तहरू संस्थाको कर्मचारी सेवा विनियमावली तथा प्रचलित श्रम कानून बमोजिम हुनेछन्।

स्वीकृतिका लागि यस पत्रको प्रतिलिपिमा हस्ताक्षर गरी फिर्ता गर्नुहुन, र हाजिर हुने दिन नागरिकता प्रमाणपत्र तथा शैक्षिक योग्यताका प्रमाणपत्रसहित {{branch}} कार्यालयमा उपस्थित हुनुहुन अनुरोध छ।

{{company_name}} परिवारमा तपाईंलाई हार्दिक स्वागत गर्दछौं।`,
  },
  {
    code: 'confirmation',
    name: 'Confirmation letter',
    nameNp: 'स्थायी नियुक्ति पत्र',
    subjectEn: 'Confirmation of service',
    subjectNp: 'सेवा स्थायी गरिएको सम्बन्धमा',
    bodyEn: `Dear {{employee_name}},

We are pleased to inform you that, on the satisfactory completion of your probation period, your service as {{designation}} at the {{branch}} office has been confirmed with effect from {{effective_date}}.

All other terms of your employment remain as set out in your appointment letter and the organisation's staff service bylaws.

We appreciate your work so far and look forward to your continued contribution to {{company_name}}.`,
    bodyNp: `श्री {{employee_name}},

तपाईंको परीक्षणकाल सन्तोषजनक रूपमा पूरा भएकोले {{branch}} कार्यालयको {{designation}} पदमा तपाईंको सेवा मिति {{effective_date}} देखि लागू हुने गरी स्थायी गरिएको व्यहोरा जानकारी गराइन्छ।

तपाईंका अन्य सेवा शर्तहरू नियुक्ति पत्र तथा संस्थाको कर्मचारी सेवा विनियमावली बमोजिम नै कायम रहनेछन्।

हालसम्मको कार्यसम्पादनको कदर गर्दै {{company_name}} मा निरन्तर योगदानको अपेक्षा गर्दछौं।`,
  },
  {
    code: 'promotion',
    name: 'Promotion letter',
    nameNp: 'बढुवा पत्र',
    subjectEn: 'Letter of promotion',
    subjectNp: 'बढुवा सम्बन्धमा',
    bodyEn: `Dear {{employee_name}},

We are pleased to inform you that you have been promoted from {{previous_designation}} to {{new_designation}}{{#if new_grade}} ({{new_grade}}){{/if}}, with effect from {{effective_date}}.

Your revised salary and benefits are set out in your updated salary structure, which you will receive separately. All other terms of your employment remain unchanged under the organisation's staff service bylaws.

Congratulations on this promotion. We thank you for your service and look forward to your continued contribution to {{company_name}}.`,
    bodyNp: `श्री {{employee_name}},

तपाईंलाई मिति {{effective_date}} देखि लागू हुने गरी {{previous_designation}} पदबाट {{new_designation}}{{#if new_grade}} ({{new_grade}}){{/if}} पदमा बढुवा गरिएको व्यहोरा जानकारी गराइन्छ।

बढुवा पछिको तलब तथा सुविधाहरू परिमार्जित तलब संरचनामा उल्लेख भए बमोजिम हुनेछन्, जुन छुट्टै उपलब्ध गराइनेछ। तपाईंका अन्य सेवा शर्तहरू संस्थाको कर्मचारी सेवा विनियमावली बमोजिम नै कायम रहनेछन्।

बढुवाका लागि हार्दिक बधाई। हालसम्मको सेवाको कदर गर्दै {{company_name}} मा निरन्तर योगदानको अपेक्षा गर्दछौं।`,
  },
  {
    code: 'transfer',
    name: 'Transfer letter',
    nameNp: 'सरुवा पत्र',
    subjectEn: 'Letter of transfer',
    subjectNp: 'सरुवा सम्बन्धमा',
    bodyEn: `Dear {{employee_name}},

This is to inform you that you have been transferred from the {{previous_branch}} office to the {{new_branch}} office, with effect from {{effective_date}}. Your designation of {{designation}} and your other terms of service remain unchanged.

Please complete the handover of your current duties and report to the {{new_branch}} office on the effective date.{{#if remarks}} {{remarks}}{{/if}}

We thank you for your cooperation.`,
    bodyNp: `श्री {{employee_name}},

तपाईंलाई मिति {{effective_date}} देखि लागू हुने गरी {{previous_branch}} कार्यालयबाट {{new_branch}} कार्यालयमा सरुवा गरिएको व्यहोरा जानकारी गराइन्छ। तपाईंको {{designation}} पद तथा अन्य सेवा शर्तहरू यथावत् कायम रहनेछन्।

हालको जिम्मेवारी हस्तान्तरण गरी तोकिएको मितिमा {{new_branch}} कार्यालयमा हाजिर हुनुहुन अनुरोध छ।{{#if remarks}} {{remarks}}{{/if}}

सहयोगका लागि धन्यवाद।`,
  },
  {
    code: 'experience',
    name: 'Experience letter',
    nameNp: 'कार्य अनुभव पत्र',
    subjectEn: 'To whom it may concern',
    subjectNp: 'कार्य अनुभव सम्बन्धमा',
    bodyEn: `TO WHOM IT MAY CONCERN

This is to certify that {{employee_name}} (employee code {{employee_code}}) served at {{company_name}} as {{designation}} in the {{department}} department, {{branch}} office, from {{join_date_bs}} B.S. to {{last_working_day}}.

During this period, their work and conduct were found to be satisfactory. This letter is issued at their request for whatever purpose it may serve.

We wish them success in their future endeavours.`,
    bodyNp: `सम्बन्धित सबैलाई

श्री {{employee_name}} (कर्मचारी संकेत नं. {{employee_code}}) यस {{company_name}} को {{branch}} कार्यालय, {{department}} विभागमा {{designation}} पदमा मिति {{join_date_bs}} देखि {{last_working_day}} सम्म कार्यरत रहनुभएको व्यहोरा प्रमाणित गरिन्छ।

उक्त अवधिमा निजको कार्यसम्पादन तथा आचरण सन्तोषजनक रहेको थियो। निजकै अनुरोधमा जुनसुकै प्रयोजनका लागि प्रयोग गर्न पाउने गरी यो पत्र जारी गरिएको छ।

निजको उज्ज्वल भविष्यको कामना गर्दछौं।`,
  },
  {
    code: 'noc',
    name: 'No objection letter',
    nameNp: 'सहमति पत्र',
    subjectEn: 'No objection letter',
    subjectNp: 'सहमति सम्बन्धमा',
    bodyEn: `TO WHOM IT MAY CONCERN

This is to certify that {{employee_name}} (employee code {{employee_code}}) is currently employed at {{company_name}} as {{designation}} in the {{branch}} office.

{{company_name}} has no objection to {{purpose}}.{{#if remarks}} {{remarks}}{{/if}}

This letter is issued at the employee's request. For any verification, please contact the undersigned.`,
    bodyNp: `सम्बन्धित सबैलाई

श्री {{employee_name}} (कर्मचारी संकेत नं. {{employee_code}}) हाल यस {{company_name}} को {{branch}} कार्यालयमा {{designation}} पदमा कार्यरत रहनुभएको व्यहोरा प्रमाणित गरिन्छ।

{{purpose}} का लागि यस संस्थाको कुनै आपत्ति नरहेको व्यहोरा जानकारी गराइन्छ।{{#if remarks}} {{remarks}}{{/if}}

निजकै अनुरोधमा यो पत्र जारी गरिएको हो। थप यकिन गर्नुपरेमा तल हस्ताक्षर गर्नेसँग सम्पर्क राख्न सकिनेछ।`,
  },
  {
    code: 'kyc',
    name: 'KYC declaration',
    nameNp: 'केवाईसी घोषणा',
    subjectEn: 'Employee KYC declaration',
    subjectNp: 'कर्मचारी केवाईसी घोषणा सम्बन्धमा',
    bodyEn: `I, {{employee_name}} (employee code {{employee_code}}){{#if father_name}}, son/daughter of {{father_name}}{{/if}}{{#if grandfather_name}} and grandson/granddaughter of {{grandfather_name}}{{/if}}, permanent resident of {{employee_address}}, holder of citizenship certificate no. {{citizenship_no}}{{#if employee_mobile}} (mobile {{employee_mobile}}){{/if}}, working as {{designation}} in the {{department}} department, {{branch}} office of {{company_name}} since {{join_date_bs}} B.S., declare the following:

1. The personal details, citizenship, address, academic qualifications and work history I have given to {{company_name}} are true and complete. I will inform the organisation in writing of any change.

2. I have not been punished for any offence involving fraud, embezzlement or breach of trust, and I am not blacklisted by any bank, financial institution or cooperative.

3. I will keep the information of members, borrowers and the organisation confidential, and I will follow the organisation's KYC, anti-money-laundering and code-of-conduct policies.

4. If anything stated here is found to be false, I accept that action may be taken against me under the staff service bylaws and the prevailing laws of Nepal.`,
    bodyNp: `म {{employee_name}} (कर्मचारी संकेत नं. {{employee_code}}){{#if father_name}}, {{father_name}} को सन्तान{{/if}}{{#if grandfather_name}} तथा {{grandfather_name}} को नाति/नातिनी{{/if}}, स्थायी ठेगाना {{employee_address}}, नागरिकता प्रमाणपत्र नं. {{citizenship_no}}{{#if employee_mobile}} (मोबाइल {{employee_mobile}}){{/if}} भएको, मिति {{join_date_bs}} देखि {{company_name}} को {{branch}} कार्यालय, {{department}} विभागमा {{designation}} पदमा कार्यरत रहेकोले देहायको घोषणा गर्दछु:

१. मैले {{company_name}} लाई उपलब्ध गराएका व्यक्तिगत विवरण, नागरिकता, ठेगाना, शैक्षिक योग्यता तथा कार्य अनुभव सम्बन्धी सम्पूर्ण विवरण सत्य र पूर्ण छन्। यसमा कुनै परिवर्तन भएमा संस्थालाई लिखित जानकारी गराउनेछु।

२. मलाई ठगी, अपचलन वा विश्वासघात सम्बन्धी कुनै कसुरमा सजाय भएको छैन र म कुनै बैंक, वित्तीय संस्था वा सहकारीको कालो सूचीमा परेको छैन।

३. सदस्य, ऋणी तथा संस्थाको जानकारी गोप्य राख्नेछु र संस्थाको केवाईसी, सम्पत्ति शुद्धीकरण निवारण तथा आचारसंहिता सम्बन्धी नीतिको पालना गर्नेछु।

४. यहाँ उल्लेख गरेको कुनै कुरा झुट्टा ठहरिएमा कर्मचारी सेवा विनियमावली तथा प्रचलित नेपाल कानून बमोजिम मलाई कारबाही हुन सक्ने कुरामा मेरो मन्जुरी छ।`,
  },
  {
    code: 'dhanjamani',
    name: 'Guarantee (dhanjamani)',
    nameNp: 'धनजमानी',
    subjectEn: 'Letter of guarantee (dhanjamani)',
    subjectNp: 'धनजमानीको कागज',
    bodyEn: `I, {{guarantor_name}}{{#if guarantor_father}}, son/daughter of {{guarantor_father}}{{/if}}, permanent resident of {{guarantor_address}}, holder of citizenship certificate no. {{guarantor_citizenship}}, {{guarantor_relation}} of {{employee_name}}, state as follows:

1. {{company_name}} has appointed {{employee_name}} as {{designation}} at its {{branch}} office, and I know the employee well.

2. I stand guarantor for the honesty and faithful service of {{employee_name}}. If the employee causes any loss to {{company_name}} through fraud, embezzlement, misappropriation of cash or property, or breach of trust, I will pay the loss{{#if guarantee_amount}}, up to NPR {{guarantee_amount}},{{/if}} to {{company_name}} within the time it asks, and I will not object to it recovering the amount from me under the prevailing laws of Nepal.

3. This guarantee remains in force for as long as {{employee_name}} serves {{company_name}}, and until all dues of the employee have been settled.

4. I have signed this letter of guarantee willingly, with full understanding of its contents.`,
    bodyNp: `म {{guarantor_name}}{{#if guarantor_father}}, {{guarantor_father}} को सन्तान{{/if}}, स्थायी ठेगाना {{guarantor_address}}, नागरिकता प्रमाणपत्र नं. {{guarantor_citizenship}} भएको, {{employee_name}} को {{guarantor_relation}} ले देहाय बमोजिम धनजमानी बस्ने कागज गरिदिएको छु:

१. {{company_name}} ले {{employee_name}} लाई आफ्नो {{branch}} कार्यालयमा {{designation}} पदमा नियुक्त गरेको छ र म निजलाई राम्ररी चिन्दछु।

२. {{employee_name}} को इमान्दारिता तथा निष्ठापूर्वक सेवाको जमानी म बस्दछु। निजले ठगी, अपचलन, नगद वा जिन्सी दुरुपयोग वा विश्वासघात गरी {{company_name}} लाई कुनै हानि नोक्सानी पुर्‍याएमा त्यस्तो नोक्सानी{{#if guarantee_amount}} रु. {{guarantee_amount}} सम्म{{/if}} {{company_name}} ले तोकेको समयभित्र म आफैँले भर्पाई गर्नेछु र प्रचलित नेपाल कानून बमोजिम मबाट असुल उपर गर्न आपत्ति गर्ने छैन।

३. {{employee_name}} ले {{company_name}} मा सेवा गरिरहेसम्म र निजको सम्पूर्ण दायित्व फरफारक नभएसम्म यो धनजमानी कायम रहनेछ।

४. यो धनजमानीको कागजको व्यहोरा राम्ररी बुझी आफ्नो मर्जीले हस्ताक्षर गरिदिएको छु।`,
  },
  {
    code: 'job_description',
    name: 'Job description',
    nameNp: 'कार्यविवरण',
    subjectEn: 'Job description — {{designation}}',
    subjectNp: 'कार्यविवरण — {{designation}}',
    bodyEn: `Name: {{employee_name}} ({{employee_code}})
Post: {{designation}}
Department: {{department}}
Place of work: {{branch}} office
{{#if reports_to}}Reports to: {{reports_to}}
{{/if}}{{#if working_hours}}Working hours: {{working_hours}}
{{/if}}
Duties and responsibilities

{{duties}}

General

1. Carry out the duties above and any other lawful work assigned by the organisation, diligently and honestly.

2. Follow the staff service bylaws, the code of conduct and the directives of the management.

3. Keep records accurate and up to date, and keep the information of members and the organisation confidential.

4. This description may be revised by the organisation as the needs of the post change.`,
    bodyNp: `नाम: {{employee_name}} ({{employee_code}})
पद: {{designation}}
विभाग: {{department}}
कार्यस्थल: {{branch}} कार्यालय
{{#if reports_to}}प्रतिवेदन गर्ने: {{reports_to}}
{{/if}}{{#if working_hours}}कार्य समय: {{working_hours}}
{{/if}}
कार्य तथा जिम्मेवारी

{{duties}}

सामान्य व्यवस्था

१. माथि उल्लेखित कार्य तथा संस्थाले तोकेका अन्य कानूनसम्मत कार्यहरू इमान्दारीका साथ लगनशील भई सम्पादन गर्नुपर्नेछ।

२. कर्मचारी सेवा विनियमावली, आचारसंहिता तथा व्यवस्थापनको निर्देशनको पालना गर्नुपर्नेछ।

३. अभिलेख शुद्ध र अद्यावधिक राख्नुपर्नेछ तथा सदस्य र संस्थाको जानकारी गोप्य राख्नुपर्नेछ।

४. पदको आवश्यकता अनुसार संस्थाले यो कार्यविवरण परिमार्जन गर्न सक्नेछ।`,
  },
  {
    code: 'agreement',
    name: 'Employment agreement',
    nameNp: 'रोजगार सम्झौता',
    subjectEn: 'Employment agreement',
    subjectNp: 'रोजगार सम्झौता-पत्र',
    bodyEn: `This agreement is made on {{issue_date_bs}} B.S. between {{company_name}}, {{company_address}} (the "Employer"), and {{employee_name}}{{#if father_name}}, son/daughter of {{father_name}}{{/if}}, permanent resident of {{employee_address}}, citizenship certificate no. {{citizenship_no}} (the "Employee").

1. Appointment. The Employer appoints the Employee as {{designation}} in the {{department}} department at the {{branch}} office with effect from {{effective_date}}, and the Employee accepts.

2. Term. {{#if agreement_term}}This agreement is for a term of {{agreement_term}} and may be renewed in writing.{{/if}} Service continues until it ends under the staff service bylaws or this agreement.

3. Remuneration. The Employee's monthly basic salary is NPR {{basic_salary}}, with allowances, contributions and deductions as in the salary structure and the prevailing laws of Nepal.

4. Probation. {{#if probation_months}}The first {{probation_months}} months of service are a probation period; on satisfactory performance the service is confirmed.{{/if}}

5. Duties and conduct. The Employee will carry out the duties given in the job description and other lawful instructions, work honestly and with care, and follow the bylaws and code of conduct of the Employer.

6. Confidentiality. The Employee will not disclose or misuse information about members, accounts or business of the Employer, during service or afterwards.

7. Termination. {{#if notice_days}}Either party may end this agreement by giving {{notice_days}} days' written notice.{{/if}} The Employer may take action, including termination, for misconduct under the bylaws and the prevailing laws of Nepal.

8. Handover. On leaving, the Employee will return all property, records and cash of the Employer and complete a handover.

9. Governing law. This agreement is governed by the laws of Nepal, including the Labour Act, 2074, and the Employer's staff service bylaws.

Signed by both parties in the presence of the witnesses below.`,
    bodyNp: `यो सम्झौता मिति {{issue_date_bs}} मा {{company_address}} स्थित {{company_name}} (यस पछि "रोजगारदाता") र स्थायी ठेगाना {{employee_address}}{{#if father_name}}, {{father_name}} को सन्तान{{/if}}, नागरिकता प्रमाणपत्र नं. {{citizenship_no}} भएका {{employee_name}} (यस पछि "कर्मचारी") बीच देहाय बमोजिम भएको छ।

१. नियुक्ति: रोजगारदाताले कर्मचारीलाई मिति {{effective_date}} देखि लागू हुने गरी {{branch}} कार्यालय, {{department}} विभागमा {{designation}} पदमा नियुक्त गरेको छ र कर्मचारीले मञ्जुर गरेको छ।

२. अवधि: {{#if agreement_term}}यो सम्झौता {{agreement_term}} को अवधिको लागि हुनेछ र लिखित रूपमा नवीकरण गर्न सकिनेछ। {{/if}}सेवा कर्मचारी सेवा विनियमावली वा यस सम्झौता बमोजिम अन्त्य नभएसम्म जारी रहनेछ।

३. पारिश्रमिक: कर्मचारीको मासिक आधारभूत तलब रु. {{basic_salary}} हुनेछ र भत्ता, कोष योगदान तथा कट्टीहरू तलब संरचना र प्रचलित नेपाल कानून बमोजिम हुनेछन्।

४. परीक्षणकाल: {{#if probation_months}}सेवाको सुरुका {{probation_months}} महिना परीक्षणकाल हुनेछ र कार्यसम्पादन सन्तोषजनक भएमा सेवा स्थायी गरिनेछ।{{/if}}

५. कर्तव्य तथा आचरण: कर्मचारीले कार्यविवरणमा उल्लेख भएका कार्य तथा अन्य कानूनसम्मत निर्देशन इमान्दारी र सावधानीका साथ पालना गर्नेछ तथा रोजगारदाताको विनियमावली र आचारसंहिता मान्नेछ।

६. गोप्यता: कर्मचारीले सेवाकालमा र सेवा समाप्तिपछि पनि रोजगारदाताका सदस्य, खाता तथा व्यवसाय सम्बन्धी जानकारी प्रकट वा दुरुपयोग गर्ने छैन।

७. सम्झौता अन्त्य: {{#if notice_days}}दुवै पक्षले {{notice_days}} दिनको लिखित सूचना दिई यो सम्झौता अन्त्य गर्न सक्नेछन्। {{/if}}कर्मचारीले अनुचित आचरण गरेमा रोजगारदाताले विनियमावली र प्रचलित नेपाल कानून बमोजिम सेवा समाप्ति सहित कारबाही गर्न सक्नेछ।

८. जिम्मा फिर्ता: सेवा छोड्दा कर्मचारीले रोजगारदाताका सम्पूर्ण सम्पत्ति, अभिलेख र नगद बुझाई कार्यभार हस्तान्तरण गर्नुपर्नेछ।

९. लागू हुने कानून: यो सम्झौता श्रम ऐन, २०७४ सहित नेपालको प्रचलित कानून तथा रोजगारदाताको कर्मचारी सेवा विनियमावली बमोजिम हुनेछ।

माथि लेखिएको व्यहोरामा दुवै पक्षले तलका साक्षीहरूको रोहबरमा सहिछाप गरी दिएका छन्।`,
  },
];
