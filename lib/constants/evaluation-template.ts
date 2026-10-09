// Default performance evaluation form (G1), seeded once per company on first
// read as the system template (editable, never deletable). का.स.मू.-style:
// sections → criteria with max marks (100 raw in all), supervisor 50% /
// reviewer 30% / committee 20%, and the usual grade bands. Each sahakari
// tailors its copy to its own staff bylaws on the Form tab.

import type { EvaluationForm } from '@/lib/engines/evaluation.engine';

export const DEFAULT_EVALUATION_TEMPLATE: { code: string; name: string; nameNp: string; form: EvaluationForm } = {
  code: 'default',
  name: 'Performance evaluation form',
  nameNp: 'कार्य सम्पादन मूल्याङ्कन फाराम',
  form: {
    weights: { supervisor: 50, reviewer: 30, committee: 20 },
    bands: [
      { min: 90, label: 'Outstanding', labelNp: 'उत्कृष्ट' },
      { min: 80, label: 'Very good', labelNp: 'अति उत्तम' },
      { min: 70, label: 'Good', labelNp: 'उत्तम' },
      { min: 60, label: 'Satisfactory', labelNp: 'सन्तोषजनक' },
      { min: 0, label: 'Needs improvement', labelNp: 'सुधार आवश्यक' },
    ],
    sections: [
      {
        id: 'work',
        name: 'Work performance',
        nameNp: 'कार्य सम्पादन',
        criteria: [
          { id: 'work_quantity', name: 'Volume of work completed', nameNp: 'सम्पादित कामको परिमाण', max: 10 },
          { id: 'work_quality', name: 'Quality and accuracy of work', nameNp: 'कामको गुणस्तर र शुद्धता', max: 10 },
          { id: 'work_timeliness', name: 'Completion within time', nameNp: 'तोकिएको समयभित्र सम्पादन', max: 10 },
        ],
      },
      {
        id: 'conduct',
        name: 'Personal qualities',
        nameNp: 'व्यक्तिगत गुण',
        criteria: [
          { id: 'discipline', name: 'Discipline and conduct', nameNp: 'अनुशासन र आचरण', max: 10 },
          { id: 'responsibility', name: 'Sense of responsibility', nameNp: 'जिम्मेवारीबोध', max: 10 },
          { id: 'teamwork', name: 'Teamwork and cooperation', nameNp: 'टोली कार्य र सहकार्य', max: 10 },
          { id: 'attendance', name: 'Regularity and punctuality', nameNp: 'नियमितता र समयपालन', max: 10 },
        ],
      },
      {
        id: 'capability',
        name: 'Capability',
        nameNp: 'क्षमता',
        criteria: [
          { id: 'judgement', name: 'Decision-making ability', nameNp: 'निर्णय क्षमता', max: 10 },
          { id: 'member_service', name: 'Member / customer service', nameNp: 'सदस्य तथा ग्राहक सेवा', max: 10 },
          { id: 'learning', name: 'Willingness to learn and improve', nameNp: 'सिक्ने र सुध्रिने तत्परता', max: 10 },
        ],
      },
    ],
  },
};
