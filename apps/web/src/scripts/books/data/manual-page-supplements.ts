export type ManualBookPageSupplement = {
  bookTitle: string;
  pageNumber: number;
  chapterTitle: string;
  sectionTitle: string;
  sourceKind: "user_provided_screenshot_table";
  rows: Array<{
    category: string;
    medicineName: string;
    commonPoint: string;
    emphasis: string;
  }>;
};

const coughColdCommon =
  "疏风散寒，宣肺止咳。症见：气急，咽痒，咳嗽，咳痰稀薄色白，鼻塞流清鼻涕，头痛，肢体酸痛，或见发烧恶寒，无汗，舌苔薄白。";

const coughHeatCommon =
  "疏风清热，宣肺止咳。症见：咳嗽频剧，痰多痰黄，痰黏，咽喉肿痛，怕风，发热，头痛身体痛，流黄色鼻涕，口渴，舌苔薄黄。";

const phlegmColdCommon =
  "宣肺散寒，燥湿化痰，理气止咳。症见：咳嗽，咳声重浊，胸闷气憋，痰多且黏稠，多为白色或灰色，咳出后会感觉胸部气憋的情况缓解。伴有鼻塞、流清涕、肢体乏力酸楚等症。";

const phlegmHeatCommon =
  "清热肃肺，化痰止咳。症见：咳嗽气急，痰多色黄质稠，甚或痰中带血，难以咳出，舌红苔黄腻等。可兼见胸胁胀满，咳时引痛，面赤身热，口干而黏，欲饮水。";

const dryCoughCommon =
  "疏风清肺，润燥止咳。症见：干咳，连声作呛，喉痒，无痰或者痰少成丝，不易咳出，口干、咽干、鼻干。初期伴有鼻塞、头痛、微恶寒、身体等表证。";

const yinDeficiencyCoughCommon =
  "滋阴润肺，化痰止咳。症见：干咳，咳声短促，咳少黏白，或者痰中有血丝；低热，盗汗，口干，此时身体还会出现一些其他的阴虚症状，如五心烦热，大便干燥等。";

const foodRetentionCoughCommon =
  "消积化滞止咳。症见：咳嗽或发热，无明显外感的症状，多伴有积食，主要表现为脘腹胀满、嗳腐吞酸、大便干燥或便秘、矢气臭秽、肚腹胀满等。";

const heatConstipationCommon =
  "泻热导滞，润肠通便。症见：大便干结，腹胀腹痛，口干口臭，渴喜冷饮，面红心烦或有身热，小便短赤。";

const qiConstipationCommon =
  "顺气导滞。症见：大便干结，或不甚干结，欲便不得出，或便而不畅，肠鸣矢气，腹中胀痛，胸胁满闷，嗳气频作，饮食减少。";

const qiDeficiencyConstipationCommon =
  "补气升阳，健脾润肠。症见：大便或干或不干，也有便意，但临厕排便困难，需努挣才出，排得汗出气短，便后乏力，小便清长，体质虚弱，肢倦懒言。";

const yinBloodConstipationCommon =
  "滋阴养血，润肠通便。症见：大便干结，排出困难，如羊屎状，面色无华，心悸气短，形体消瘦，头晕耳鸣，心烦失眠。";

const coldConstipationCommon =
  "温里散寒，通便导滞。症见：大便艰涩，排出困难，腹痛拘急，胀满拒按，手足不温，畏寒呕吐。";

export const MANUAL_PAGE_SUPPLEMENTS: ManualBookPageSupplement[] = [
  {
    bookTitle: "医目了然：家庭常见病中成药使用指南",
    pageNumber: 105,
    chapterTitle: "咳嗽用药表",
    sectionTitle: "人工补页：第105页 咳嗽用药表",
    sourceKind: "user_provided_screenshot_table",
    rows: [
      { category: "寒咳", medicineName: "通宣理肺丸", commonPoint: coughColdCommon, emphasis: "长于解表散寒，一般作为风寒咳嗽首选用药，也可治疗风寒导致的感冒。" },
      { category: "寒咳", medicineName: "小青龙合剂", commonPoint: coughColdCommon, emphasis: "适用于素有水饮之人，又感受了寒邪。清水鼻涕不止，出现咳嗽甚至哮喘。" },
      { category: "寒咳", medicineName: "止咳宁嗽胶囊", commonPoint: coughColdCommon, emphasis: "止咳功能更强大。" },
      { category: "寒咳", medicineName: "风寒咳嗽颗粒", commonPoint: coughColdCommon, emphasis: "适用于外感风寒引起的感冒、咳嗽诸症，功效上更偏于止咳平喘。" },
      { category: "寒咳", medicineName: "杏苏止咳糖浆", commonPoint: coughColdCommon, emphasis: "相当于通宣理肺丸简化版，还可用于凉燥导致的咳嗽。" },
      { category: "寒咳", medicineName: "三拗片", commonPoint: coughColdCommon, emphasis: "药简力专，适用于外感风寒引起的感冒、咳嗽诸症。" },
      { category: "热咳", medicineName: "麻杏止咳糖浆", commonPoint: coughHeatCommon, emphasis: "一般作为肺热咳嗽的首选用药。" },
      { category: "热咳", medicineName: "咳喘宁口服液", commonPoint: coughHeatCommon, emphasis: "长于止咳化痰，降逆肺气——适用于久咳、咳喘见痰热症候者。" },
      { category: "热咳", medicineName: "苏黄止咳胶囊", commonPoint: coughHeatCommon, emphasis: "止咳效果好，适用于咽痒导致的咳嗽，或气急、遇冷空气、异味等因素导致突发咳嗽及或加重，或夜间晨起发剧。" },
      { category: "热咳", medicineName: "川贝枇杷糖浆", commonPoint: coughHeatCommon, emphasis: "长于清热化痰。" },
      { category: "热咳", medicineName: "急支糖浆", commonPoint: coughHeatCommon, emphasis: "长于清热解毒，消痈排脓——可治疗肺痈、急性肺炎。" },
      { category: "热咳", medicineName: "复方百部止咳颗粒", commonPoint: coughHeatCommon, emphasis: "适用于肺热咳嗽、百日咳。" },
      { category: "热咳", medicineName: "小儿咳喘灵颗粒", commonPoint: coughHeatCommon, emphasis: "长于清热化痰，适用于小儿肺热咳嗽。" },
      { category: "热咳", medicineName: "清宣止咳颗粒", commonPoint: coughHeatCommon, emphasis: "适用于小儿外感风热咳嗽或风热感冒初期。" },
    ],
  },
  {
    bookTitle: "医目了然：家庭常见病中成药使用指南",
    pageNumber: 106,
    chapterTitle: "咳嗽用药表",
    sectionTitle: "人工补页：第106页 咳嗽用药表",
    sourceKind: "user_provided_screenshot_table",
    rows: [
      { category: "寒痰", medicineName: "二陈丸", commonPoint: phlegmColdCommon, emphasis: "无论寒痰热痰皆可使用，一般作为化痰的基本用药，和其他散寒、清热或止咳的药物搭配使用。" },
      { category: "寒痰", medicineName: "橘红痰咳液", commonPoint: phlegmColdCommon, emphasis: "长于湿化寒痰。" },
      { category: "寒痰", medicineName: "桂龙咳喘宁胶囊", commonPoint: phlegmColdCommon, emphasis: "适用于外感风寒、痰湿阻肺引起的咳嗽、气喘等症。" },
      { category: "热痰", medicineName: "橘红丸", commonPoint: phlegmHeatCommon, emphasis: "长于清热化痰。" },
      { category: "热痰", medicineName: "鹭鸶咯丸", commonPoint: phlegmHeatCommon, emphasis: "长于清热化痰，对于热痰有痰、咳嗽剧烈，疗效较好。" },
      { category: "热痰", medicineName: "清肺化痰丸", commonPoint: phlegmHeatCommon, emphasis: "适用于痰浊阻肺所致的顿咳、咳嗽、痰鸣气促、痰声阻闷、百日咳等症；长于止咳平喘。" },
      { category: "热痰", medicineName: "复方鲜竹沥液", commonPoint: phlegmHeatCommon, emphasis: "为清热化痰常用药，也可用于急性支气管炎、慢性支气管炎急性发作。" },
      { category: "热痰", medicineName: "肺力咳合剂", commonPoint: phlegmHeatCommon, emphasis: "适用于出现炎症的时候，比如支气管炎，症见为痰中带血、咳嗽胸痛。" },
      { category: "热痰", medicineName: "小儿清肺化痰口服液", commonPoint: phlegmHeatCommon, emphasis: "适用于小儿肺热感冒引起的咳嗽痰喘。" },
    ],
  },
  {
    bookTitle: "医目了然：家庭常见病中成药使用指南",
    pageNumber: 107,
    chapterTitle: "咳嗽用药表",
    sectionTitle: "人工补页：第107页 咳嗽用药表",
    sourceKind: "user_provided_screenshot_table",
    rows: [
      { category: "燥咳", medicineName: "秋梨润肺膏", commonPoint: dryCoughCommon, emphasis: "长于清热润燥，最适用于温燥导致的咳嗽。" },
      { category: "燥咳", medicineName: "蛇胆川贝枇杷膏", commonPoint: dryCoughCommon, emphasis: "长于清热解毒——适用于肺部出现炎症以及燥邪犯肺导致的哮喘胸闷。" },
      { category: "燥咳", medicineName: "二母宁嗽丸", commonPoint: dryCoughCommon, emphasis: "温燥证中热证更明显时选用。" },
      { category: "燥咳", medicineName: "杏苏止咳糖浆", commonPoint: dryCoughCommon, emphasis: "温而不燥，润而不凉，适用于凉燥导致的咳嗽。" },
      { category: "阴虚咳嗽", medicineName: "百合固金片", commonPoint: yinDeficiencyCoughCommon, emphasis: "滋阴的同时兼补气养血，适用于气血两虚之人的干咳。" },
      { category: "阴虚咳嗽", medicineName: "养阴清肺膏", commonPoint: yinDeficiencyCoughCommon, emphasis: "一般作为阴虚咳嗽首选用药。" },
      { category: "积食咳嗽", medicineName: "小儿消积止咳口服液", commonPoint: foodRetentionCoughCommon, emphasis: "适用于小儿食积兼痰热蕴肺导致的咳嗽。" },
      { category: "积食咳嗽", medicineName: "保和丸", commonPoint: foodRetentionCoughCommon, emphasis: "长于消食导滞兼化痰和胃。" },
      { category: "积食咳嗽", medicineName: "大山楂丸", commonPoint: foodRetentionCoughCommon, emphasis: "功效仅为消积化滞，没有化痰或者止咳的药。" },
    ],
  },
  {
    bookTitle: "医目了然：家庭常见病中成药使用指南",
    pageNumber: 178,
    chapterTitle: "便秘用药表",
    sectionTitle: "人工补页：第178页 便秘用药表",
    sourceKind: "user_provided_screenshot_table",
    rows: [
      { category: "热秘", medicineName: "黄连上清丸", commonPoint: heatConstipationCommon, emphasis: "清热力度更强，长于清上焦之热，还可滋阴润燥理气。" },
      { category: "热秘", medicineName: "牛黄清胃丸", commonPoint: heatConstipationCommon, emphasis: "表里双解，用途较广，外感发热或肺胃实热时皆可使用。" },
      { category: "热秘", medicineName: "清泻丸", commonPoint: heatConstipationCommon, emphasis: "长于解表热，清里热——适用于表里俱实之证，即不但有高热，还有便秘、扁桃体发炎、眼睛红肿赤痛等里证。" },
      { category: "热秘", medicineName: "防风通圣丸", commonPoint: heatConstipationCommon, emphasis: "功效为清热通便，药简力专。" },
      { category: "热秘", medicineName: "排毒养颜胶囊", commonPoint: heatConstipationCommon, emphasis: "适用于气虚血瘀，热毒内盛所致的便秘、痤疮、颜面色斑。" },
      { category: "热秘", medicineName: "大黄通便片", commonPoint: heatConstipationCommon, emphasis: "组方中只有大黄一味药，可单独使用，也可搭配其他药物。" },
      { category: "热秘", medicineName: "番泻叶颗粒", commonPoint: heatConstipationCommon, emphasis: "小剂量使用，可起到缓泻的作用，还可用于习惯性便秘或者老年便秘。" },
      { category: "热秘", medicineName: "麻仁丸", commonPoint: heatConstipationCommon, emphasis: "长于润肠通便，适用于肠热津亏所致的便秘，以及习惯性便秘者。" },
      { category: "热秘", medicineName: "麻仁润肠丸", commonPoint: heatConstipationCommon, emphasis: "在麻仁丸基础上多了顺气的作用。" },
      { category: "热秘", medicineName: "舒秘胶囊", commonPoint: heatConstipationCommon, emphasis: "组方中只有芦荟一味药，可清心安神、清泻肝火。适用于功能性便秘属热秘者。" },
      { category: "热秘", medicineName: "新复方芦荟胶囊", commonPoint: heatConstipationCommon, emphasis: "与舒秘胶囊相比，镇惊安神、清肝泻火的功效更加强大，对于心肝火盛的便秘，更为适用。" },
      { category: "热秘", medicineName: "润肠丸", commonPoint: heatConstipationCommon, emphasis: "润肠通便，除湿止痛。" },
      { category: "热秘", medicineName: "通幽润燥丸", commonPoint: heatConstipationCommon, emphasis: "泻热通便，同时滋阴养血，为治疗热秘中较为温和缓的方子，可服用一段时间。" },
      { category: "热秘", medicineName: "通便灵胶囊", commonPoint: heatConstipationCommon, emphasis: "还可用于长期卧床便秘、一时性腹胀便秘、老年习惯性便秘。" },
    ],
  },
  {
    bookTitle: "医目了然：家庭常见病中成药使用指南",
    pageNumber: 179,
    chapterTitle: "便秘用药表",
    sectionTitle: "人工补页：第179页 便秘用药表",
    sourceKind: "user_provided_screenshot_table",
    rows: [
      { category: "气秘", medicineName: "木香槟榔丸", commonPoint: qiConstipationCommon, emphasis: "长于清热燥湿，适用于湿热体质的便秘。" },
      { category: "气秘", medicineName: "宽中顺气丸", commonPoint: qiConstipationCommon, emphasis: "长于活血止痛，消肿止血，适用于便秘后引起的大便干结带血，或肛门肿痛。" },
      { category: "气秘", medicineName: "四磨汤口服液", commonPoint: qiConstipationCommon, emphasis: "长于顺气降逆，适用于婴幼儿乳食内滞、积食症；或老人、腹部手术者术后出现肠气不通、便秘之症。" },
      { category: "气虚阳衰型", medicineName: "苁蓉通便口服液", commonPoint: qiDeficiencyConstipationCommon, emphasis: "以滋补为主，既可温补，又可通便。适用于老年便秘、产后便秘、组方温和，可以服用一段时间。" },
      { category: "气虚阳衰型", medicineName: "润肠通秘茶", commonPoint: qiDeficiencyConstipationCommon, emphasis: "适用于气血两虚型便秘，组方温和，可以服用一段时间。" },
      { category: "气虚阳衰型", medicineName: "补中益气丸", commonPoint: qiDeficiencyConstipationCommon, emphasis: "适用于气虚阳虚型便秘，可用于治疗气虚血亏型的各种病证，不拘病名。" },
      { category: "阴亏血少型", medicineName: "苁蓉润肠口服液", commonPoint: yinBloodConstipationCommon, emphasis: "适用于气阴两虚、脾肾不足、大肠失于濡润而致的虚证便秘。" },
      { category: "阴亏血少型", medicineName: "便乃通茶", commonPoint: yinBloodConstipationCommon, emphasis: "适用于老年体虚之人的津亏肠燥证。" },
      { category: "冷秘", medicineName: "大黄附子汤", commonPoint: coldConstipationCommon, emphasis: "一般为冷秘首选用方。" },
      { category: "冷秘", medicineName: "温脾汤", commonPoint: coldConstipationCommon, emphasis: "攻下时不伤正，温阳时补益脾气。" },
    ],
  },
];

