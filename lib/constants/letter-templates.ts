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
];
