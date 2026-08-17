export interface ToolDef {
  id: string;
  name: string;
  desc: string;
  category: "pdf" | "util";
  requiresFileLimit: boolean;
  icon: string;
  group: string;
  intro: string;
  usage: string[];
  tips?: string[];
}

export type MembershipTier = "day" | "month" | "half_year" | "year" | "three_year" | "forever";

export const MEMBERSHIP_TIERS: {
  id: MembershipTier;
  name: string;
  days: number;
  badge: string;
  color: string;
}[] = [
  { id: "day", name: "日卡", days: 1, badge: "日", color: "bg-green-100 text-green-700" },
  { id: "month", name: "月卡", days: 30, badge: "月", color: "bg-blue-100 text-blue-700" },
  { id: "half_year", name: "半年卡", days: 180, badge: "半年", color: "bg-cyan-100 text-cyan-700" },
  { id: "year", name: "年卡", days: 365, badge: "年", color: "bg-violet-100 text-violet-700" },
  { id: "three_year", name: "3年卡", days: 365 * 3, badge: "3年", color: "bg-purple-100 text-purple-700" },
  { id: "forever", name: "永久会员", days: 0, badge: "永久", color: "bg-amber-100 text-amber-700" },
];

export const TOOLS: ToolDef[] = [
  // ===== PDF 工具 =====
  {
    id: "merge", name: "PDF 合并", desc: "多个 PDF 合并为一个",
    category: "pdf", requiresFileLimit: true, icon: "merge", group: "PDF 工具",
    intro: "免费在线 PDF 合并工具，可将多个 PDF 文件按顺序合并为一个 PDF 文件。支持拖拽上传、文件排序，适用于合并发票、合同、扫描件等场景。所有操作在浏览器本地完成，文件不会上传到服务器。",
    usage: [
      "点击「添加文件」按钮选择多个 PDF 文件，或直接拖拽文件到上传区域。",
      "在文件列表中通过拖拽调整顺序，或点击删除不需要的文件。",
      "确认文件顺序后，点击「开始合并」按钮。",
      "合并完成后自动下载生成的 PDF 文件到浏览器默认下载目录。",
    ],
    tips: ["支持一次性合并数十个 PDF 文件", "加密的 PDF 需先输入密码解密后才能合并", "合并后的文件大小不能超过浏览器内存限制"],
  },
  {
    id: "split", name: "PDF 拆分", desc: "按范围拆分为多个文件",
    category: "pdf", requiresFileLimit: true, icon: "split", group: "PDF 工具",
    intro: "免费在线 PDF 拆分工具，可将一个 PDF 按页码范围、每页独立、每 N 页一组等方式拆分成多个小文件。支持批量下载为 ZIP 压缩包，方便文件分发和文档整理。",
    usage: [
      "上传需要拆分的 PDF 文件。",
      "选择拆分方式：按页码范围（如 1-3,5-7）、每页独立拆分、每 N 页一组。",
      "设置页码范围或每组页数，系统自动计算拆分结果。",
      "点击「开始拆分」，完成后下载 ZIP 压缩包或单个文件。",
    ],
    tips: ["页码范围格式：用逗号分隔，如 1-3,5,7-10", "拆分后的文件会打包为 ZIP 格式下载", "支持最大 500 页的 PDF 文件"],
  },
  {
    id: "rotate", name: "PDF 旋转排序", desc: "旋转页面 / 调整顺序",
    category: "pdf", requiresFileLimit: true, icon: "rotate", group: "PDF 工具",
    intro: "在线 PDF 页面旋转与排序工具，可视化预览每一页，支持 0°/90°/180°/270° 旋转，以及拖拽调整页面顺序。适用于扫描件方向纠正、页面重新排序等场景。",
    usage: [
      "上传 PDF 文件后，系统渲染所有页面为缩略图。",
      "点击每页上的旋转按钮（向左/向右 90°、180°）调整方向。",
      "长按并拖拽页面缩略图调整顺序。",
      "确认所有修改后点击「应用更改」，下载处理后的 PDF。",
    ],
    tips: ["旋转操作可反复进行，每次都是基于原始方向", "缩略图加载需要一点时间，请耐心等待全部渲染完成", "支持最大 200 页 PDF"],
  },
  {
    id: "watermark", name: "PDF 加水印", desc: "添加文字或图片水印",
    category: "pdf", requiresFileLimit: true, icon: "watermark", group: "PDF 工具",
    intro: "在线 PDF 加水印工具，支持文字水印和图片水印两种模式。可自定义字体大小、颜色、透明度、旋转角度以及水印位置，实时预览效果，一键批量应用到所有页面。",
    usage: [
      "上传 PDF 文件。",
      "选择水印类型：文字水印或图片水印。",
      "文字水印：输入水印内容，设置字体大小、颜色、透明度、旋转角度。图片水印：上传图片文件。",
      "选择水印位置（平铺/居中/角落），实时预览效果。",
      "点击「开始添加」，下载带水印的 PDF 文件。",
    ],
    tips: ["透明度建议设置在 20%-40% 之间，既不影响阅读又能起到标识作用", "图片水印建议使用 PNG 透明背景", "中文字体自动嵌入，无需额外设置"],
  },
  {
    id: "remove-watermark", name: "PDF 去水印", desc: "自动识别并移除水印",
    category: "pdf", requiresFileLimit: true, icon: "eraser", group: "PDF 工具",
    intro: "在线 PDF 去水印工具，使用智能算法自动识别 PDF 中的水印图片（包括 Image XObject 和 Form XObject 类型），通过评分系统筛选疑似水印并支持手动调整。适用于去除文档中的「试用水印」「机密」等标识。",
    usage: [
      "上传 PDF 文件，系统自动分析所有页面的图片对象。",
      "在结果列表中勾选要移除的水印，支持查看每张图片的预览。",
      "点击「移除选中水印」按钮。",
      "处理完成后预览效果，确认无误后下载新文件。",
    ],
    tips: ["自动识别准确率约 80%，建议人工复核后再下载", "扫描件类 PDF 的水印属于图片内容，需要用图片编辑方式去除", "不支持加密 PDF 和电子印章类水印"],
  },
  {
    id: "extract-image", name: "PDF 提取图片", desc: "导出 PDF 中的所有图片",
    category: "pdf", requiresFileLimit: true, icon: "image", group: "PDF 工具",
    intro: "在线 PDF 提取图片工具，可一键导出 PDF 文件中嵌入的所有图片。支持彩色、灰度、CMYK 等多种颜色空间转换，保持原始分辨率和画质，批量下载为 ZIP 压缩包。",
    usage: [
      "上传 PDF 文件，系统自动扫描所有页面中的图片对象。",
      "查看已提取图片的预览列表，可单独下载或批量下载。",
      "点击「全部下载」将所有图片打包为 ZIP 文件。",
    ],
    tips: ["提取的图片保持原始分辨率，不会压缩", "CMYK 颜色空间自动转换为 RGB", "装饰性小图标可能不需要，可以跳过下载"],
  },
  {
    id: "compress", name: "PDF 压缩", desc: "重编码图片减小体积",
    category: "pdf", requiresFileLimit: true, icon: "compress", group: "PDF 工具",
    intro: "在线 PDF 压缩工具，通过重新编码 PDF 中的图片来减小文件体积。支持调节渲染分辨率和 JPEG 压缩质量，可大幅缩小扫描件、图片型 PDF 的体积，方便邮件发送和在线分享。",
    usage: [
      "上传需要压缩的 PDF 文件。",
      "选择压缩级别：轻度（75% 质量）、标准（50% 质量）、强力（25% 质量）。",
      "点击「开始压缩」，等待处理完成。",
      "查看压缩前后的大小对比，满意后下载。",
    ],
    tips: ["文字型 PDF 压缩效果有限，图片型 PDF 效果显著", "压缩级别越高文件越小，但图片画质下降越明显", "建议先试用标准级别，不满意再换强力级别"],
  },
  {
    id: "to-image", name: "PDF 转图片", desc: "每页导出为 PNG/JPEG",
    category: "pdf", requiresFileLimit: true, icon: "image", group: "PDF 工具",
    intro: "在线 PDF 转图片工具，将 PDF 的每一页渲染为高清图片。支持 PNG（无损）和 JPEG（有损压缩）两种格式，可调节导出分辨率，批量下载为 ZIP 压缩包。",
    usage: [
      "上传 PDF 文件。",
      "选择输出格式（PNG / JPEG）和缩放比例（1x / 2x / 3x）。",
      "点击「开始转换」，实时查看每页的渲染进度。",
      "全部完成后点击「下载全部」保存为 ZIP 文件。",
    ],
    tips: ["2x 缩放适合屏幕查看，3x 适合打印", "PNG 格式文件较大但无损，JPEG 文件小但有损", "大文件转换需要较多内存，建议分批次处理"],
  },
  {
    id: "ocr", name: "OCR 文字识别", desc: "提取 PDF 中的文字",
    category: "pdf", requiresFileLimit: true, icon: "text", group: "PDF 工具",
    intro: "在线 PDF OCR 文字识别工具，结合 pdf.js 文本提取和 Tesseract.js 光学字符识别技术。对于已有文本层的 PDF 可直接快速提取，对于扫描件 PDF 自动启用 OCR 识别，支持中英文。",
    usage: [
      "上传 PDF 文件。",
      "系统自动判断是否为扫描件：文本型直接提取，图片型启用 OCR。",
      "选择识别语言（中文 / 英文 / 中英混合）。",
      "查看识别结果，可一键复制或下载为 TXT 文件。",
    ],
    tips: ["文本型 PDF 提取速度快、准确率高", "扫描件首次使用需要下载语言包（约 15-30MB）", "手写体、艺术字体识别准确率较低"],
  },

  // ===== 编码解码 =====
  {
    id: "json-format", name: "JSON 格式化", desc: "美化 / 压缩 / 校验 JSON",
    category: "util", requiresFileLimit: false, icon: "code", group: "编码解码",
    intro: "免费在线 JSON 工具，支持 JSON 格式化美化、压缩为单行、语法校验和错误定位。开发者调试 API 返回数据、查看配置文件时非常实用，完全在浏览器本地运行。",
    usage: [
      "在左侧输入框中粘贴或输入 JSON 字符串。",
      "点击「格式化」按钮自动美化缩进，或点击「压缩」转为单行。",
      "如果 JSON 有语法错误，系统会提示具体错误位置。",
      "格式化结果支持一键复制。",
    ],
  },
  {
    id: "base64", name: "Base64 编解码", desc: "文本 ↔ Base64 互转",
    category: "util", requiresFileLimit: false, icon: "lock", group: "编码解码",
    intro: "免费在线 Base64 编解码工具，支持文本与 Base64 字符串互转。可用于电子邮件附件编码、图片嵌入 HTML、API 参数传输等场景，支持 UTF-8 中文字符。",
    usage: [
      "在输入框中输入要编码或解码的内容。",
      "点击「编码」将文本转为 Base64，或点击「解码」将 Base64 还原为文本。",
      "结果实时显示，支持一键复制。",
    ],
  },
  {
    id: "url-encode", name: "URL 编解码", desc: "URL 安全编码 / 解码",
    category: "util", requiresFileLimit: false, icon: "link", group: "编码解码",
    intro: "免费在线 URL 编解码工具，按照 RFC 3986 标准对 URL 中的特殊字符进行百分号编码或解码。适用于处理 URL 参数、中文字符转义、API 请求调试等场景。",
    usage: [
      "在输入框中输入需要处理的 URL 或字符串。",
      "点击「编码」对特殊字符进行 %XX 转义，或点击「解码」还原。",
      "支持中文、空格、&、=、? 等特殊字符的正确处理。",
    ],
  },
  {
    id: "hash", name: "哈希生成器", desc: "MD5 / SHA1 / SHA256 计算",
    category: "util", requiresFileLimit: false, icon: "fingerprint", group: "编码解码",
    intro: "免费在线哈希计算工具，支持 MD5、SHA-1、SHA-256、SHA-384、SHA-512 等多种哈希算法。可用于文件完整性校验、密码存储、数字签名等场景，使用 Web Crypto API 计算，安全快速。",
    usage: [
      "在输入框中输入要计算哈希的文本。",
      "选择哈希算法（MD5 / SHA-1 / SHA-256 / SHA-384 / SHA-512）。",
      "点击「计算」按钮，结果实时显示。",
      "支持一键复制结果。",
    ],
    tips: ["MD5 已不推荐用于安全场景，建议使用 SHA-256 及以上", "相同输入一定产生相同输出，适合做校验", "如果需要文件哈希，先将文件转为 Base64 再计算"],
  },
  {
    id: "number-base", name: "进制转换", desc: "二 / 八 / 十 / 十六进制互转",
    category: "util", requiresFileLimit: false, icon: "hex", group: "编码解码",
    intro: "免费在线进制转换工具，支持二进制、八进制、十进制、十六进制之间的实时互转。适合程序员调试、网络地址计算、颜色值转换等开发场景，内置常用进制对照表方便查阅。",
    usage: [
      "在输入框中输入数字。",
      "从下拉框选择当前数字的进制。",
      "其他进制的结果自动实时显示。",
      "点击任意结果可复制对应进制的数值。",
    ],
  },

  // ===== 开发调试 =====
  {
    id: "timestamp", name: "时间戳转换", desc: "Unix 时间戳 ↔ 日期",
    category: "util", requiresFileLimit: false, icon: "clock", group: "开发调试",
    intro: "免费在线时间戳转换工具，支持 Unix 时间戳与人类可读日期之间的互转。支持秒级和毫秒级时间戳，可一键获取当前时间戳，适合开发调试、日志分析、数据库字段排查等场景。",
    usage: [
      "在输入框中输入时间戳数字或日期字符串。",
      "系统自动识别输入类型并转换。",
      "可点击「当前时间」按钮快速填充当前时间戳。",
      "支持秒级（10 位）和毫秒级（13 位）两种格式。",
    ],
  },
  {
    id: "color", name: "颜色转换", desc: "HEX / RGB / HSL 互转",
    category: "util", requiresFileLimit: false, icon: "palette", group: "开发调试",
    intro: "免费在线颜色值转换工具，支持 HEX、RGB、HSL 三种常用颜色格式之间的实时互转。可用于前端开发颜色调试、设计稿颜色值提取、配色方案验证等场景。",
    usage: [
      "在任意输入框中输入颜色值（如 #FF5733、rgb(255,87,51)、hsl(11,100%,60%)）。",
      "其他格式的颜色值实时同步更新。",
      "左侧显示颜色预览方块，方便目视确认。",
      "点击任意结果可复制。",
    ],
  },
  {
    id: "regex", name: "正则测试", desc: "在线测试正则表达式",
    category: "util", requiresFileLimit: false, icon: "search", group: "开发调试",
    intro: "免费在线正则表达式测试工具，支持实时匹配高亮、捕获组查看、常用正则模板。开发者调试邮箱验证、手机号匹配、URL 提取等场景时非常方便，支持 JavaScript 正则语法。",
    usage: [
      "在正则表达式输入框中输入要测试的模式（不需要两侧的 / 分隔符）。",
      "在测试文本框中输入要匹配的文本。",
      "匹配结果实时高亮显示，捕获组单独列出。",
      "常用正则模板可快速填充，如邮箱、手机号、URL 等。",
    ],
  },

  // ===== 文本处理 =====
  {
    id: "text-tools", name: "文本工具箱", desc: "大小写转换 / 统计 / 去重",
    category: "util", requiresFileLimit: false, icon: "type", group: "文本处理",
    intro: "免费在线文本处理工具箱，集成大小写转换、首字母大写、字数统计、去除空行、去除空格、行去重等 7 种常用文本操作。适合内容编辑、数据清洗、格式化整理等场景。",
    usage: [
      "在左侧输入框中粘贴或输入要处理的文本。",
      "点击上方功能按钮（转大写、转小写、统计字数、去重行等）。",
      "处理结果实时显示在右侧输出框中。",
      "可点击「交换」将结果作为新输入继续处理，或一键复制。",
    ],
  },
  {
    id: "unit-convert", name: "单位换算", desc: "长度 / 重量 / 面积 / 温度",
    category: "util", requiresFileLimit: false, icon: "ruler", group: "文本处理",
    intro: "免费在线单位换算器，支持长度、重量、面积、温度、体积、时间 6 大类共 20+ 种常用单位的一键互转。实时计算、支持常用换算，适合购物海淘、装修计算、物理计算等场景。",
    usage: [
      "点击顶部类别按钮切换换算类型（长度/重量/面积/温度/体积/时间）。",
      "在左侧输入数值并选择源单位。",
      "在右侧选择目标单位，换算结果自动实时显示。",
      "点击中间 ⇅ 按钮可快速交换源单位和目标单位。",
    ],
    tips: ["温度换算有特殊公式（非线性），与长度/重量的比例换算不同", "支持华氏度 °F ↔ 摄氏度 °C ↔ 开尔文 K", "所有换算基于国际标准单位制"],
  },

  // ===== 实用工具 =====
  {
    id: "qrcode", name: "二维码生成", desc: "文字 / 链接 → 二维码",
    category: "util", requiresFileLimit: false, icon: "qr", group: "实用工具",
    intro: "免费在线二维码生成器，支持将网址、文本、联系方式等内容转为标准 QR Code 二维码图片。可调节纠错级别和尺寸，支持 PNG 下载，适合活动海报、名片、产品标签等场景。",
    usage: [
      "在输入框中输入要生成二维码的内容（网址、文本、WiFi 信息等）。",
      "调节纠错级别（L/M/Q/H）和图片尺寸。",
      "点击「生成」按钮，右侧即时显示二维码图片。",
      "点击「下载 PNG」保存到本地。",
    ],
    tips: ["纠错级别越高，二维码越复杂但抗污损能力越强", "包含汉字或长文本时建议选择 H 级别", "生成的二维码符合 ISO/IEC 18004 标准"],
  },
  {
    id: "password", name: "密码生成器", desc: "安全随机密码",
    category: "util", requiresFileLimit: false, icon: "key", group: "实用工具",
    intro: "免费在线密码生成器，使用浏览器 crypto.getRandomValues 生成密码，比 Math.random 更安全。可自定义长度、字符类型，实时显示密码强度，适合注册账号、WiFi 设置等场景。",
    usage: [
      "拖动滑块选择密码长度（4-64 位）。",
      "勾选需要包含的字符类型（大写字母、小写字母、数字、特殊符号）。",
      "点击「生成密码」按钮，随机生成符合要求的密码。",
      "密码强度实时评估（弱/中/强/非常强），一键复制。",
    ],
    tips: ["至少 12 位且包含 3 种以上字符类型才安全", "所有密码在本地生成，不会传输到任何服务器", "建议每个账号使用不同密码"],
  },
  {
    id: "random", name: "随机数生成", desc: "指定范围随机数 / 随机抽签",
    category: "util", requiresFileLimit: false, icon: "dice", group: "实用工具",
    intro: "免费在线随机数生成器，支持指定范围生成一个或多个随机数、不重复随机、排序输出，还内置随机抽签功能（滚动动画）。适合抽奖、分组、教学演示、游戏等场景。",
    usage: [
      "切换到「随机数」模式：设置最小值、最大值、生成数量，点击「生成随机数」。",
      "勾选「不重复」确保所有随机数唯一，勾选「排序显示」按升序排列。",
      "切换到「随机抽签」模式：输入候选人名单（每行一个）。",
      "点击「开始抽签」，候选人滚动几秒后随机选中一位。",
    ],
  },
  {
    id: "cn-idcard", name: "身份证验证", desc: "校验身份证号 / 提取信息",
    category: "util", requiresFileLimit: false, icon: "card", group: "实用工具",
    intro: "免费在线身份证号验证工具，可校验 18 位中国居民身份证号的合法性，自动提取归属地（省/市）、出生日期、性别、年龄等信息。使用国家标准校验算法，不收集任何个人信息。",
    usage: [
      "在输入框中输入完整的 18 位身份证号。",
      "系统自动执行 3 项校验：格式校验、校验码校验、出生日期有效性校验。",
      "验证通过后显示：归属地、性别、出生日期、年龄。",
      "所有计算在本地完成，身份证号不会上传。",
    ],
    tips: ["末位为 X 时需大写", "15 位旧版身份证号需要升级为 18 位才能验证", "只做格式和校验位检查，不验证身份证号是否真实存在"],
  },

  // ===== 生活计算 =====
  {
    id: "mortgage", name: "房贷计算器", desc: "等额本息 / 等额本金",
    category: "util", requiresFileLimit: false, icon: "home", group: "生活计算",
    intro: "在线房贷计算器，支持等额本息和等额本金两种主流还款方式。输入贷款金额、期限和年利率，快速计算月供、总利息和还款总额。等额本金还能展示每月递减的还款明细。",
    usage: [
      "输入贷款金额（单位：万元）。",
      "拖动滑块选择贷款期限（1-30 年）。",
      "输入年利率（%）。",
      "选择还款方式：等额本息或等额本金。",
      "结果实时计算，显示月供、总利息、还款总额。",
    ],
    tips: ["等额本息每月还款固定，前期利息占比大", "等额本金前期月供高但总利息少，适合现金流充裕的用户", "计算结果仅供参考，实际还款以银行核算为准"],
  },
  {
    id: "currency", name: "汇率兑换", desc: "实时汇率换算",
    category: "util", requiresFileLimit: false, icon: "dollar", group: "生活计算",
    intro: "在线汇率兑换计算器，支持 160+ 种全球货币之间的换算。页面加载时自动获取最新汇率，可用于海淘比价、出国旅游消费估算、跨境汇款参考等场景。",
    usage: [
      "输入要兑换的金额。",
      "从下拉框选择源货币和目标货币。",
      "点击「兑换」按钮，使用最新汇率计算结果。",
      "页面下方展示常见货币对的实时汇率表。",
    ],
    tips: ["汇率数据每日更新，实际交易以银行牌价为准", "支持人民币、美元、欧元、日元、英镑等主流货币", "小币种可能需要手动输入货币代码"],
  },
  {
    id: "world-time", name: "世界时间", desc: "全球主要城市时钟",
    category: "util", requiresFileLimit: false, icon: "globe", group: "生活计算",
    intro: "在线世界时钟，同时显示全球 20+ 个主要城市的当前时间。每秒自动更新，适合跨时区会议安排、国际航班查询、远程团队协作等场景，所有时间基于浏览器本地时区计算。",
    usage: [
      "页面加载后自动展示主要城市的当前时间，每秒自动更新。",
      "时钟显示包含城市名称、当前时间（时:分:秒）和日期。",
      "部分城市标记了是否使用夏令时。",
      "支持快速计算时差。",
    ],
  },
  {
    id: "bmi", name: "BMI 计算器", desc: "身体质量指数",
    category: "util", requiresFileLimit: false, icon: "heart", group: "生活计算",
    intro: "在线 BMI（Body Mass Index）身体质量指数计算器，输入身高和体重即可得出 BMI 值和健康区间。基于中国成人 BMI 标准（偏瘦/正常/偏胖/肥胖），帮助快速了解体重状况。",
    usage: [
      "输入身高（厘米）。",
      "输入体重（千克）。",
      "系统自动计算 BMI 值，并显示健康区间（偏瘦 / 正常 / 偏胖 / 肥胖）。",
      "结果下方展示详细的 BMI 范围对照表。",
    ],
    tips: ["BMI 只适用于成年人，不适用于儿童、孕妇和运动员", "中国标准：18.5 以下偏瘦，18.5-24 正常，24-28 偏胖，28 以上肥胖", "保持健康需要综合饮食和运动，BMI 仅供参考"],
  },
  {
    id: "period", name: "月经周期计算器", desc: "预测经期 / 排卵期 / 安全期",
    category: "util", requiresFileLimit: false, icon: "calendar", group: "生活计算",
    intro: "在线月经周期计算器，输入上次月经开始日期、平均周期天数和经期持续时间，自动预测下一次月经日期、排卵日、易孕期和安全期。帮助女性了解自己的生理周期，辅助备孕或避孕。",
    usage: [
      "选择上次月经开始的日期。",
      "输入平均月经周期天数（通常 21-35 天，默认 28 天）。",
      "输入每次月经持续天数（通常 2-7 天，默认 5 天）。",
      "系统自动计算并展示未来 3 个周期的预测，包括经期、排卵期、易孕期和安全期。",
    ],
    tips: ["本计算器基于平均周期推算，实际情况因人而异", "压力、饮食、运动、疾病等都可能影响月经周期", "排卵日通常在下次月经前 14 天左右", "易孕期为排卵日前 5 天至排卵日后 1 天"],
  },
];

export function getToolHref(t: ToolDef): string {
  return t.category === "pdf" ? `/pdf-${t.id}` : `/util-${t.id}`;
}

export const TOOL_MAP: Record<string, ToolDef> = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

export function getToolById(id: string): ToolDef | undefined {
  return TOOL_MAP[id];
}

export const TOOL_IDS = TOOLS.map((t) => t.id);

export const PDF_TOOLS = TOOLS.filter((t) => t.category === "pdf");
export const UTIL_TOOLS = TOOLS.filter((t) => t.category === "util");

export const TOOL_GROUPS = [
  "PDF 工具",
  "编码解码",
  "开发调试",
  "文本处理",
  "实用工具",
  "生活计算",
] as const;

export const DEFAULT_TOOL_THRESHOLDS: Record<string, { verify: number; membership: number }> = {
  ocr: { verify: 5, membership: 15 },
  compress: { verify: 5, membership: 15 },
  "to-image": { verify: 8, membership: 20 },
  "remove-watermark": { verify: 8, membership: 20 },
  merge: { verify: 10, membership: 25 },
  "extract-image": { verify: 10, membership: 25 },
  split: { verify: 15, membership: 40 },
  rotate: { verify: 15, membership: 40 },
  watermark: { verify: 15, membership: 40 },
};
