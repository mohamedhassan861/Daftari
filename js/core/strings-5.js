/* Every screen text in Arabic and English. (part 5 of 5; continues from strings-4.js) */
    willLastHint: [
      'بنبدأ من الكاش والبنوك اللي معاك النهارده، ونمشي بالترتيب على كل اللي لسه هيدخل أو يطلع. الباقي من حد كل بند بنحسبه كأنه اتصرف من أول الشهر (أو النهارده)، والمستحق اللي فات ميعاده بنحطه النهارده. سداد الكارت في يومه. آخر كل شهر مكتوب اللي هيفضل، وهو نفس رقم "المتوقع آخر الشهر" في الرئيسية.',
      'Starts from your cash and banks now and walks day by day through planned income and spending still to come. Category budgets are spread over the remaining days; card bills land on their due day.'
    ],
    inCardPay: ['بيتحسب في سداد الكارت', 'counted in the card payment'],
    overPlan: ['الفعلي عدّى المتوقع ومحسوب في الرصيد', 'Actual went past the plan, included in the balance'],
    cardEx: ['لو اشتريت %b تسدد %p', 'Bought %b → pay %p'],
    cardDaysNeed: [
      'اكتب يوم قفل الكشف ويوم السداد علشان مواعيد سداد الكارت تتحسب صح.',
      'Enter the statement and payment days so card payments land on the right date.'
    ],
    cardSetDays: [
      '⚠️ حدد يوم قفل الكشف ويوم السداد للكارت، وإلا السداد بيتحسب تقريبي الشهر اللي بعد الشرا.',
      '⚠️ Set the card statement and payment days; until then payment is assumed the month after purchase.'
    ],
    budLeft: ['الباقي من', 'Left of'],
    lateFrom: ['متأخر من', 'overdue from'],
    lateWord: ['متأخر', 'overdue'],
    restOf: ['باقي', 'rest of'],
    availStart: ['المتاح أول', 'available at start of'],
    whereFrom: ['المتاح أول الشهر جاي منين؟', 'Where the opening comes from'],
    remQ: ['الباقي', 'The rest'],
    remKeep: ['يفضل مستحق في ميعاده', 'Keep it due'],
    remDrop: ['اتلغى (المدفوع هو النهائي)', 'Cancel it (this payment is final)'],
    regularIn: ['المرتب والدخل المتكرر', 'Salary & recurring income'],
    regularOut: ['مصاريف متكررة', 'Recurring expenses'],
    monthlySpend: ['مصاريف الشهر (حد البنود)', 'Monthly spending (category limits)'],
    install: ['ثبّت البرنامج على الموبايل', 'Install on this phone'],
    shareDrive: ['احفظ نسخة على Google Drive', 'Save a copy to Google Drive'],
    shareHint: [
      'هتظهرلك قايمة المشاركة، اختار منها Drive واحفظ في الفولدر اللي يريحك. النسخة متشفرة بالرقم السري.',
      'The share menu opens; choose Drive and pick a folder. The copy is encrypted with your PIN.'
    ],
    remindBk: ['عدّى أكتر من يوم على آخر نسخة احتياطية.', 'It has been over a day since your last backup.'],
    shareUnsupported: [
      'المتصفح ده مش بيدعم المشاركة، هننزّل الملف بدالها.',
      'This browser cannot share files, so the file will download instead.'
    ],
    loading: ['بيحمّل...', 'Loading...'],
    lockNow: ['اقفل البرنامج دلوقتي', 'Lock now']
  };
  let LANG = 'ar';
  try {
    LANG = localStorage.getItem('daftar-elbeit-lang') || 'ar';
  } catch (e) {}
