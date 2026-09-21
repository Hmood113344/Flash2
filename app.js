// ══════════════════════════════════════════════════════════════════════════
// فلاش — الموقع العسكري (ملف واحد شامل: إعدادات + موقع + بوت)
// ══════════════════════════════════════════════════════════════════════════

const express = require("express");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const mongoose = require("mongoose");
const {
    Client,
    GatewayIntentBits,
    Partials,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
    StringSelectMenuBuilder,
    AttachmentBuilder,
} = require("discord.js");

// ══════════════════════════════════════════════════════════════════════════
// 1) الإعدادات — تُقرأ من Environment Variables بلوحة الاستضافة (Render → Environment)
// ══════════════════════════════════════════════════════════════════════════
const CONFIG = {
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || "",
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || "",
    DISCORD_CALLBACK_URL: process.env.DISCORD_CALLBACK_URL || "",
    BOT_TOKEN: process.env.BOT_TOKEN || "",
    GUILD_ID: process.env.GUILD_ID || "",
    MONGO_URI: process.env.MONGO_URI || "",

    SITE_NAME: "مركز العمليات",
    // رابط الموقع (يُستخرج من رابط الكولباك تلقائياً، أو يُحدَّد يدوياً عبر SITE_URL بمتغيرات البيئة)
    SITE_URL: process.env.SITE_URL || (process.env.DISCORD_CALLBACK_URL ? process.env.DISCORD_CALLBACK_URL.replace(/\/auth\/discord\/callback.*$/, "") : "https://flash1-gtsp.onrender.com"),
    SESSION_SECRET: process.env.SESSION_SECRET || "غيّر_هذا_السر_2026",
    PORT: process.env.PORT || 7700,

    // رتب العسكر المعتمدة لتسجيل الدخول بالموقع (رولات ديسكورد)
    MILITARY_ROLE_IDS: [
        "1501158697840148540",
    ],

    // آيديات كبار المسؤولين — نفس أسلوب ملف البنك (مصفوفة ثابتة بالكود)
    SENIOR_ADMIN_IDS: [
         "1003511814140743825",
    ],

    // الرتب العسكرية الرسمية بالترتيب من الأدنى للأعلى
    MILITARY_RANKS: [
    "جندي", "جندي اول", "عريف", "وكيل رقيب", "رقيب", "رقيب اول", "رئيس رقباء",
    "ملازم", "ملازم اول", "نقيب", "رائد",
    "مقدم", "عقيد", "عميد",
    "لواء", "فريق", "فريق اول",
],
    DEFAULT_POINTS_PER_RANK: 20, // النقاط الافتراضية المطلوبة للترقية للرتبة التالية (قابلة للتعديل من لوحة كبار المسؤولين)

    // ── نظام الإجازات ──
    DEFAULT_LEAVE_BALANCE: 10, // رصيد الإجازات الافتراضي بالأيام لكل عسكري (قابل للتعديل من الإعدادات)

    // ── نظام البصمة/التحضير ──
    FP_HOLD_SECONDS: 3,   // مدة الضغط المطلوبة على البصمة
    FP_FAIL_RATE: 0.2,    // احتمال فشل البصمة عشوائياً
    // لو ما وصلت أي "نبضة" من جهاز العضو (يعني طلع من الموقع/سكر التبويب) خلال هذي المدة وهو مسجّل "حاضر"،
    // نعتبره منصرف تلقائياً ولازم يبصم من جديد. طالما الموقع مفتوح عنده ما يصير تسجيل خروج تلقائي مهما طالت المدة.
    ATTENDANCE_TIMEOUT_MS: 60 * 60 * 1000,

    VIOLATION_TYPES: [
        "تجاوز السرعة المحددة",
        "القيادة العكسية",
        "التفحيط / القيادة المتهورة",
        "تظليل كتم",
        "تظليل نيكل",
        "صدم مركبات امنيه/مواطنين",
        "هروب من رجال الامن",
        "الهروب من نقطة تفتيش",
    ],

    POINTS_ON_APPROVE: 1,
    POINTS_ON_REJECT: 1, // تُخصم (تُطرح) من نقاط العسكري عند رفض مخالفته
    MAX_PENDING_ITEMS: 5, // أقصى عدد مخالفات/تقارير قيد المراجعة بنفس الوقت لنفس العسكري
    MAX_VEHICLES_ADD: 60,
    MAX_PHOTO_MB: 3,

    // رتبة مديرية مكافحة المخدرات — تسجّل تقارير بدل المخالفات
    ANTI_DRUGS_ROLE_ID: "1500064767082233926",
    REPORT_POINTS_APPROVE: 2, // نقاط قبول تقرير مكافحة المخدرات
    REPORT_POINTS_REJECT: 1,  // نقاط خصم رفض تقرير مكافحة المخدرات

    // رولات ديسكورد تحدد عضوية كل قطاع (تُستخدم لعرض "أعضاء القطاع" لدى قادة ونواب القطاعات)
    PATROL_ROLE_ID: process.env.PATROL_ROLE_ID || "1500064443537686588",
    ROAD_SECURITY_ROLE_ID: process.env.ROAD_SECURITY_ROLE_ID || "1533192878510178304",

    // القطاعات الثلاثة الرسمية (المفتاح يُستخدم بالكود، القيمة تظهر بالواجهة)
    SECTORS: {
        patrol: "الدوريات",
        roadSecurity: "أمن الطرق",
        antiDrugs: "مكافحة المخدرات",
    },

    // ── الشرطة العسكرية ──
    MILITARY_POLICE_ROLE_ID: process.env.MILITARY_POLICE_ROLE_ID || "1545415273438249010",
    MP_SUMMON_VOICE_URL: "https://discord.com/channels/1497233353030766662/1545415195243843644",
    MP_REPORT_POINTS_APPROVE: 1, // نقاط قبول تقرير الشرطة العسكرية
    RECEPTION_POINTS: 5, // نقاط الاستلام (زر تحكم-قياده)
    RECEPTION_MAX_PER_DAY: 2, // أقصى عدد مرات لكل شخص يومياً

    // عقوبات التحذير الثالث — المسؤول يختار وحدة منها وقت إرسال التحذير الثالث لأي عسكري
    WARNING_PENALTIES: [
        { id: "deduct5",          label: "خصم 5 نقاط",                        type: "points",  value: 5 },
        { id: "deduct10",         label: "خصم 10 نقاط",                       type: "points",  value: 10 },
        { id: "resetPoints",      label: "تصفير النقاط بالكامل",              type: "resetPoints" },
        { id: "demote1",          label: "تنزيل رتبة واحدة",                  type: "demote",  ranks: 1 },
        { id: "demote2",          label: "تنزيل رتبتين",                      type: "demote",  ranks: 2 },
        { id: "demoteToFirst",    label: "تنزيل للرتبة الأولى (جندي)",        type: "demoteToFirst" },
        { id: "suspend3",         label: "إيقاف 3 أيام",                      type: "suspend", days: 3 },
        { id: "suspend5",         label: "إيقاف 5 أيام",                      type: "suspend", days: 5 },
        { id: "suspend7",         label: "إيقاف 7 أيام",                      type: "suspend", days: 7 },
        { id: "demote1_suspend3", label: "تنزيل رتبة واحدة + إيقاف 3 أيام",   type: "combo",   ranks: 1, days: 3 },
        { id: "deduct10_suspend5",label: "خصم 10 نقاط + إيقاف 5 أيام",        type: "combo",   value: 10, days: 5 },
        { id: "dismiss",          label: "فصل نهائي من الخدمة العسكرية",      type: "dismiss" },
    ],
};

// ══════════════════════════════════════════════════════════════════════════
// 2) قاعدة البيانات والموديلات
// ══════════════════════════════════════════════════════════════════════════
mongoose.connect(CONFIG.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch(err => console.log("❌ MongoDB error:", err));

const PersonnelSchema = new mongoose.Schema({
    discord: { type: String, required: true, unique: true },
    discordTag: String,
    registeredName: { type: String, default: null },
    unit: { type: String, default: null },
    rank: { type: String, default: "جندي" },
    points: { type: Number, default: 0 },
    notes: [{
        text: String, image: { type: String, default: null }, // image: احتياطي فقط لو فشل رفع الصورة لديسكورد
        imageChannelId: { type: String, default: null }, imageMessageId: { type: String, default: null },
        reviewDeadline: { type: Date, default: null }, // استحقاق مراجعة (5 أيام من الإضافة أو آخر تمديد)
        reviewNotified: { type: Boolean, default: false },
        addedBy: String, addedByTag: String,
        createdAt: { type: Date, default: Date.now }
    }],
    // ── استدعاء الشرطة العسكرية ──
    summon: {
        status: { type: String, enum: ["none", "pending", "approved"], default: "none" }, // pending: طلب استدعاء بانتظار قبول القيادة | approved: استدعاء فعّال
        mode: { type: String, default: null },       // "now" | "scheduled"
        timeLabel: { type: String, default: null },  // نص الوقت المعروض (مثال: "10:30 مساء")
        unlockAt: { type: Date, default: null },      // وقت فتح الروم فعلياً
        requestedBy: { type: String, default: null }, requestedByTag: { type: String, default: null },
        setBy: { type: String, default: null }, setByTag: { type: String, default: null }, setAt: { type: Date, default: null },
        enteredAt: { type: Date, default: null },     // وقت ضغط العضو على "دخول الاستدعاء"
    },
    // تحذيرات/إشعارات صادرة له — تظهر بوجهه كشاشة كاملة لين يتعاهد عليها
    warnings: [{
        kind: { type: String, enum: ["warning", "notice", "note-review"], default: "warning" }, // تحذير | إشعار | مراجعة ملاحظة قديمة
        reason: String,
        issuedBy: String, issuedByTag: String,
        acknowledged: { type: Boolean, default: false },
        acknowledgedAt: Date,
        // ── تصعيد التحذيرات (تُملأ فقط لو kind === "warning") ──
        warningNumber: { type: Number, default: null },   // رقم التحذير بالترتيب (أول/ثاني/ثالث...)
        pointsDeducted: { type: Number, default: 0 },      // نقاط الخصم عند التحذير الثاني
        penaltyType: { type: String, default: null },      // معرّف العقوبة عند التحذير الثالث فأكثر
        penaltyLabel: { type: String, default: null },     // اسم العقوبة المطبقة (للعرض)
        // ── مراجعة ملاحظة قديمة (تُملأ فقط لو kind === "note-review") ──
        noteReviewTargetDiscord: { type: String, default: null },
        noteReviewTargetName: { type: String, default: null },
        noteReviewNoteId: { type: String, default: null },
        noteReviewText: { type: String, default: null },
        noteReviewSectorLabel: { type: String, default: null },
        createdAt: { type: Date, default: Date.now }
    }],
    isBlocked: { type: Boolean, default: false },
    blockUntil: { type: Date, default: null },   // نهاية مدة الإيقاف المؤقت (عقوبة تحذير)، فك تلقائي بعدها
    isDismissed: { type: Boolean, default: false }, // فصل نهائي (بعد تجاوز حد التحذيرات المسموح)
    leaveBalance: { type: Number, default: 10 }, // رصيد الإجازات المتبقي بالأيام
    createdAt: { type: Date, default: Date.now }
});
const Personnel = mongoose.model("Personnel", PersonnelSchema);

const ViolationSchema = new mongoose.Schema({
    reporterDiscord: String,
    reporterTag: String,
    reporterName: String,
    reporterUnit: String,
    violationType: String,
    vehicle: String,
    vehiclePhoto: { type: String, default: null },
    plateNumber: String,
    photo: { type: String, default: null }, // احتياطي فقط — يُستخدم بس لو تعذر رفع الصورة لديسكورد (نادراً)
    photoChannelId: { type: String, default: null }, // الصورة الحقيقية محفوظة كمرفق برسالة بقناة ديسكورد، مو بقاعدة البيانات
    photoMessageId: { type: String, default: null },
    status: { type: String, default: "pending" },
    rejectReason: { type: String, default: null },
    reviewedBy: String,
    reviewedByTag: String,
    reviewedAt: Date,
    createdAt: { type: Date, default: Date.now },

    // ── حقول تقرير مكافحة المخدرات (kind: "report") ──
    kind: { type: String, enum: ["violation", "report"], default: "violation" },
    reportCategory: { type: String, default: null }, // "جنائي" أو "مخدرات"
    suspectName: { type: String, default: null },
    arrestLocation: { type: String, default: null },
    stopReason: { type: String, default: null },
    seizedItems: { type: String, default: null },
    securityActions: { type: [String], default: [] },

    // حقول خاصة بتقرير "مخدرات" فقط
    drugType: { type: String, default: null },
    drugQuantity: { type: String, default: null },
    concealMethod: { type: String, default: null },
});
ViolationSchema.index({ status: 1, reviewedAt: -1 });
ViolationSchema.index({ reporterDiscord: 1, createdAt: -1 });
const Violation = mongoose.model("Violation", ViolationSchema);

// طلبات ترقية/تنزيل أفراد يرسلها "مسؤول الأفراد" وتنتظر موافقة قائد/نائب القطاع
const PromotionRequestSchema = new mongoose.Schema({
    sector: String,
    sectorLabel: String,
    targetDiscord: String,
    targetTag: String,
    targetName: String,
    fromRank: String,
    toRank: String,
    direction: { type: String, enum: ["up", "down"] },
    reason: { type: String, default: null }, // سبب الترقية/التنزيل
    requestedBy: String,
    requestedByTag: String,
    status: { type: String, default: "pending" }, // pending | approved | rejected
    rejectReason: { type: String, default: null },
    reviewedBy: String,
    reviewedByTag: String,
    reviewedAt: Date,
    createdAt: { type: Date, default: Date.now },
});
PromotionRequestSchema.index({ sector: 1, status: 1, createdAt: -1 });
const PromotionRequest = mongoose.model("PromotionRequest", PromotionRequestSchema);

// طلبات نقاط معلّقة — أي نقاط يمنحها/يخصمها شخص غير إداري (قائد/نائب قطاع، مسؤول أفراد، قيادة شرطة عسكرية...)
// تنتظر موافقة أي إداري (كبير مسؤول أو من قائمة الإدارة) قبل ما تنطبق فعلياً على رصيد العسكري
const PointsRequestSchema = new mongoose.Schema({
    targetDiscord: String,
    targetTag: String,
    targetName: String,
    delta: { type: Number, required: true }, // موجب = إضافة، سالب = خصم
    reason: { type: String, default: "" },
    source: { type: String, default: "manual" }, // manual | violation | report | mp-report
    requestedBy: String,
    requestedByTag: String,
    status: { type: String, default: "pending" }, // pending | approved | rejected
    rejectReason: { type: String, default: null },
    reviewedBy: String,
    reviewedByTag: String,
    reviewedAt: Date,
    createdAt: { type: Date, default: Date.now },
});
PointsRequestSchema.index({ status: 1, createdAt: -1 });
const PointsRequest = mongoose.model("PointsRequest", PointsRequestSchema);

// تقارير الشرطة العسكرية (يسجلها أي شخص معه رتبة الشرطة العسكرية بدل تسجيل مخالفة)
const MPReportSchema = new mongoose.Schema({
    reporterDiscord: String, reporterTag: String, reporterName: String, reporterRank: String,
    dutyReport: String, // 1) وش سوى بالاستلام
    patrolsCount: { type: Number, default: 0 }, // 2) عدد الجولات/الدوريات خلال الشفت
    summonsCount: { type: Number, default: 0 }, // 3) عدد الاستدعاءات التي نفذها خلال الشفت
    incidents: { type: String, default: "" }, // 4) أي مخالفات أمنية أو حالات مشبوهة واجهها
    notesIssued: [{ // 5) العساكر اللي عطاهم ملاحظة/تحذير خلال الشفت
        discord: String, tag: String, name: String,
        kind: { type: String, enum: ["note", "warning"], default: "note" },
        reason: String,
    }],
    generalNotes: { type: String, default: "" }, // 6) ملاحظات أو توصيات عامة
    status: { type: String, default: "pending" }, // pending | approved | rejected
    rejectReason: { type: String, default: null },
    reviewedBy: String, reviewedByTag: String, reviewedAt: Date,
    createdAt: { type: Date, default: Date.now },
});
MPReportSchema.index({ status: 1, createdAt: -1 });
const MPReport = mongoose.model("MPReport", MPReportSchema);

// ── نظام البصمة/التحضير ──
const AttendanceStatusSchema = new mongoose.Schema({
    discord: { type: String, required: true, unique: true },
    discordTag: String,
    registeredName: String,
    unit: String,
    rank: String,
    sectorLabel: String,
    status: { type: String, enum: ["in", "out"], default: "out" },
    lastCheckInAt: { type: Date, default: null },
    lastCheckOutAt: { type: Date, default: null },
    lastHeartbeatAt: { type: Date, default: null }, // آخر نبضة وهو مسجّل حاضر — نستخدمها لكشف طلوعه من الموقع بدون ما يسجل انصراف
    todayCount: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
});
const AttendanceStatus = mongoose.model("AttendanceStatus", AttendanceStatusSchema);

const AttendanceLogSchema = new mongoose.Schema({
    discord: String,
    discordTag: String,
    registeredName: String,
    unit: String,
    rank: String,
    type: { type: String, enum: ["in", "out"] },
    at: { type: Date, default: Date.now },
});
AttendanceLogSchema.index({ at: -1 });
AttendanceLogSchema.index({ discord: 1, at: -1 });
const AttendanceLog = mongoose.model("AttendanceLog", AttendanceLogSchema);

// ── نظام الإجازات ──
const LeaveRequestSchema = new mongoose.Schema({
    discord: String,
    discordTag: String,
    name: String,
    unit: String,
    rank: String,
    sector: String,
    sectorLabel: String,
    reason: String,
    days: { type: Number, required: true },
    status: { type: String, default: "pending" }, // pending | approved | rejected | completed
    rejectReason: { type: String, default: null },
    reviewedBy: String,
    reviewedByTag: String,
    reviewedAt: Date,
    startDate: { type: Date, default: null }, // تاريخ بداية الإجازة (وقت الموافقة)
    endDate: { type: Date, default: null },   // تاريخ الانتهاء المتوقع (startDate + days)
    endedAt: { type: Date, default: null },   // وقت الإنهاء الفعلي (تلقائي أو يدوي)
    endedByTag: { type: String, default: null }, // "تلقائي (انتهت المدة)" أو "تلقائي (دخول للموقع)" أو اسم من أنهاها يدوياً
    createdAt: { type: Date, default: Date.now },
});
LeaveRequestSchema.index({ discord: 1, createdAt: -1 });
LeaveRequestSchema.index({ sector: 1, status: 1, createdAt: -1 });
const LeaveRequest = mongoose.model("LeaveRequest", LeaveRequestSchema);

const VehicleSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    photo: { type: String, default: null },
    addedBy: String,
    createdAt: { type: Date, default: Date.now }
});
const Vehicle = mongoose.model("Vehicle", VehicleSchema);

const LogSchema = new mongoose.Schema({
    discordId: { type: String, default: null },     // آيدي الشخص المتأثر بالحدث (العسكري مثلاً)
    discordTag: { type: String, default: null },
    actorId: { type: String, default: null },        // آيدي اللي سوى الإجراء
    actorTag: { type: String, default: null },
    action: String,        // نوع الحدث
    site: { type: String, default: "فلاش" },
    accountNumber: { type: String, default: null },
    details: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});
const Log = mongoose.model("Log", LogSchema);

const SettingsSchema = new mongoose.Schema({
    isMaintenance: { type: Boolean, default: false },
    disableLogin: { type: Boolean, default: false },
    disableViolations: { type: Boolean, default: false },
    adminList: { type: [String], default: [] }, // إداريون معيّنون (يقبلون/يرفضون المخالفات فقط)
    rankThresholds: { type: Map, of: Number, default: {} }, // رتبة -> نقاط مطلوبة للرتبة التالية
    // رتبة -> آيدي رول ديسكورد — أي شخص معه الرول يتسجل تلقائياً أن رتبته هذي (تعبّى من لوحة كبار المسؤولين)
    rankRoleIds: { type: Map, of: String, default: {} },
    // قادة ونواب القطاعات الثلاثة — يُعيّنهم كبار المسؤولين من الموقع (بحث عن شخص مسجل بالموقع)
    sectorLeadership: {
        patrol: {
            commanderId: { type: String, default: null }, commanderName: { type: String, default: null },
            deputyId: { type: String, default: null }, deputyName: { type: String, default: null },
            personnelOfficerId: { type: String, default: null }, personnelOfficerName: { type: String, default: null },
            attendanceOfficerId: { type: String, default: null }, attendanceOfficerName: { type: String, default: null },
        },
        roadSecurity: {
            commanderId: { type: String, default: null }, commanderName: { type: String, default: null },
            deputyId: { type: String, default: null }, deputyName: { type: String, default: null },
            personnelOfficerId: { type: String, default: null }, personnelOfficerName: { type: String, default: null },
            attendanceOfficerId: { type: String, default: null }, attendanceOfficerName: { type: String, default: null },
        },
        antiDrugs: {
            commanderId: { type: String, default: null }, commanderName: { type: String, default: null },
            deputyId: { type: String, default: null }, deputyName: { type: String, default: null },
            personnelOfficerId: { type: String, default: null }, personnelOfficerName: { type: String, default: null },
            attendanceOfficerId: { type: String, default: null }, attendanceOfficerName: { type: String, default: null },
        },
    },
    // قيادة الشرطة العسكرية (قائد/نائب يعيّنهم كبار المسؤولين، ومسؤول أفراد يعيّنه القائد/النائب)
    mpLeadership: {
        commanderId: { type: String, default: null }, commanderName: { type: String, default: null },
        deputyId: { type: String, default: null }, deputyName: { type: String, default: null },
        personnelOfficerId: { type: String, default: null }, personnelOfficerName: { type: String, default: null },
    },
    // آيديات رولات ديسكورد للقطاعات الثلاثة — يحددها كبار المسؤولين من الإعدادات (لو فاضية نستخدم الافتراضي من CONFIG)
    sectorRoleIds: {
        patrol: { type: String, default: null },
        roadSecurity: { type: String, default: null },
        antiDrugs: { type: String, default: null },
    },
    // علامة تصفير اللوق الشامل لمرة وحدة (عشان ما يتكرر المسح مع كل تشغيل)
    logWipeTag: { type: String, default: null },
    // القيادة العليا — مجموعة يعيّنها كبار المسؤولين، وظيفتها الوحيدة مراجعة طلبات الترقية/التنزيل
    highCommand: { type: [{ id: String, name: String }], default: [] },
    violationsChannelId: String,
    notesChannelId: String, // قناة رفع صور الملاحظات (نفس فكرة قناة المخالفات)
    // عقوبات التحذير الثالث — قابلة للإضافة/التعديل/الحذف من لوحة كبار المسؤولين (صفحة عقوبات التحذيرات)
    warningPenalties: { type: Array, default: [] },
    // نظام البصمة/التحضير
    lockAttendance: { type: Boolean, default: false },
    // نظام الإجازات
    leaveBalanceDefault: { type: Number, default: 10 },
    // أقل رتبة تقدر تستخدم أزرار كل أمر ببوت الأوامر (مركز العمليات) — الكبار يحددونها من الموقع
    commandPermissions: {
        violation: { type: String, default: "جندي" },   // /اصدار-مخالفة
        command: { type: String, default: "رقيب" },      // /تحكم-قيادة
        leave: { type: String, default: "جندي" },        // /اصدار-اجازة
        personnel: { type: String, default: "جندي" },    // /تحكم-الافراد
    },
}, { minimize: false });
const Settings = mongoose.model("Settings", SettingsSchema);

async function getSettings() {
    let s = await Settings.findOne();
    if (!s) {
        s = await Settings.create({ warningPenalties: CONFIG.WARNING_PENALTIES });
    } else if (!s.warningPenalties || s.warningPenalties.length === 0) {
        // أول تشغيل بعد التحديث — نبذر القائمة الافتراضية مرة وحدة، وبعدها تصير قابلة للتعديل بالكامل
        s.warningPenalties = CONFIG.WARNING_PENALTIES;
        s.markModified("warningPenalties");
        await s.save();
    }
    return s;
}

async function logEvent({ action, discordId = null, discordTag = null, actorId = null, actorTag = null, site = "فلاش", accountNumber = null, details = "" }) {
    try { await Log.create({ action, discordId, discordTag, actorId, actorTag, site, accountNumber, details }); } catch (e) { /* تجاهل */ }
}

// تصفير اللوق الشامل لمرة وحدة فقط (بطلب الإدارة) — يتحدد بعلامة محفوظة بالإعدادات، فما يتكرر مع كل تشغيل
const LOG_WIPE_TAG = "wipe-2026-09-21";
async function runOneTimeLogWipe() {
    const st = await getSettings();
    if (st.logWipeTag === LOG_WIPE_TAG) return;
    const result = await Log.deleteMany({});
    st.logWipeTag = LOG_WIPE_TAG;
    await st.save();
    await logEvent({ action: "مسح اللوق الشامل بالكامل", actorId: "نظام تلقائي", actorTag: "🤖 نظام تلقائي", details: `تم حذف ${result.deletedCount} سجل (تصفير لمرة وحدة عند التحديث)` });
    console.log(`🧹 تم تصفير اللوق الشامل (${result.deletedCount} سجل)`);
}
{
    const startWipe = () => runOneTimeLogWipe().catch(e => console.error("❌ فشل تصفير اللوق:", e.message));
    if (mongoose.connection.readyState === 1) startWipe(); else mongoose.connection.once("open", startWipe);
}

function generatePlate() {
    const letters = "أبجدهوزحطيكلمنسعفصقرشتثخذضظغ";
    const pick = () => letters[Math.floor(Math.random() * letters.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${pick()} ${pick()} ${pick()} - ${num}`;
}

function rankIndex(rank) {
    const i = CONFIG.MILITARY_RANKS.indexOf(rank);
    return i === -1 ? 0 : i;
}
function rankAtLeast(rank, minRank) {
    return rankIndex(rank) >= rankIndex(minRank);
}
// يرجع سجل العسكري، أو يسويله سجل جديد أول مرة يتفاعل مع بوت الأوامر (بدون ما يحتاج يدخل الموقع أصلاً)
async function getOrCreatePersonnel(discordId, member) {
    let p = await Personnel.findOne({ discord: discordId });
    if (!p) {
        p = await Personnel.create({
            discord: discordId,
            discordTag: member?.user?.tag || member?.user?.username || discordId,
            registeredName: member?.displayName || null,
        });
    }
    return p;
}
function arabicDateTimeParts(date) {
    const d = new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
    const t = new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hour12: true }).format(date);
    const day = new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", weekday: "long" }).format(date);
    return { date: d, time: t, day };
}
// يرسل رسالة خاصة لقائد ونائب القطاع (تستخدمها لوحة التسجيل وطلبات الإجازة الجديدة من بوت الأوامر)
async function notifySectorLeadership(settings, sectorKey, embed) {
    if (!sectorKey) return;
    const sl = (settings.sectorLeadership || {})[sectorKey];
    if (!sl) return;
    for (const id of [sl.commanderId, sl.deputyId].filter(Boolean)) dmMember(id, embed).catch(() => {});
}
// يحوّل رابط مرفق ديسكورد (صورة) إلى data-URI base64 — نفس الصيغة اللي تتوقعها postViolationToChannel
async function attachmentToBase64(url) {
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${buf.toString("base64")}`;
}

function isSeniorAdmin(userId) {
    return CONFIG.SENIOR_ADMIN_IDS.includes(userId);
}

async function isAnyAdmin(userId) {
    if (isSeniorAdmin(userId)) return true;
    const settings = await getSettings();
    return settings.adminList.includes(userId);
}

// يطبّق تغيير نقاط فوراً لو الفاعل إداري (كبير مسؤول أو من قائمة الإدارة)، وإلا يحط طلب معلّق بانتظار موافقة أي إداري.
// لو الفاعل يحاول يعطي نفسه نقاط (وهو مو إداري) نرفض العملية نهائياً بدل ما نحطها بالطلبات المعلّقة (استثناء: source === "reception" — نقاط الاستلام مسموحة للنفس ضمن حدّها اليومي، وتُطبَّق مباشرة بدون طلب لأنها مقيّدة أصلاً).
async function applyOrQueuePoints({ discordId, delta, reason, source, actorId, actorTag }) {
    if (!delta) return { applied: false, skipped: true };
    const admin = await isAnyAdmin(actorId);
    // إداري يحاول يعطي نفسه نقاط بدون مراجعة من طرف ثاني — ممنوع نهائياً (إلا نقاط الاستلام المقيّدة أصلاً)
    if (admin && source !== "reception" && discordId === actorId) {
        return { applied: false, blocked: true, error: "ما تقدر تعطي نفسك نقاط." };
    }
    if (admin || source === "reception") {
        const p = await Personnel.findOneAndUpdate({ discord: discordId }, { $inc: { points: delta } }, { new: true });
        if (p && p.points < 0) { p.points = 0; await p.save(); }
        return { applied: true, personnel: p };
    }
    const target = await Personnel.findOne({ discord: discordId });
    const doc = await PointsRequest.create({
        targetDiscord: discordId,
        targetTag: target?.discordTag || null,
        targetName: target?.registeredName || target?.discordTag || null,
        delta, reason: reason || "", source: source || "manual",
        requestedBy: actorId, requestedByTag: actorTag,
    });
    return { applied: false, queued: true, request: doc };
}

async function getThreshold(rank, settings) {
    const s = settings || await getSettings();
    const t = s.rankThresholds && typeof s.rankThresholds.get === "function" ? s.rankThresholds.get(rank) : undefined;
    return (t !== undefined && t !== null) ? t : CONFIG.DEFAULT_POINTS_PER_RANK;
}

async function rankProgress(p, settings) {
    const idx = rankIndex(p.rank);
    const isMax = idx >= CONFIG.MILITARY_RANKS.length - 1;
    const nextRank = isMax ? null : CONFIG.MILITARY_RANKS[idx + 1];
    const threshold = isMax ? 0 : await getThreshold(p.rank, settings);
    const remaining = isMax ? 0 : Math.max(0, threshold - p.points);
    return { currentRank: p.rank, nextRank, threshold, remaining };
}

// ينبّه قائد/نائب القطاع لو أي ملاحظة على أحد أفراد قطاعهم وصل عمرها 5 أيام بدون إجراء
const agingNoteCheckThrottle = new Map(); // sectorKey -> آخر وقت فحص
const AGING_CHECK_COOLDOWN_MS = 60 * 60 * 1000; // ساعة — نتجنب فحص كل ضغطة صفحة
async function checkAgingNotesForSector(sectorKey, sectorLabel, settings) {
    const sl = (settings.sectorLeadership || {})[sectorKey] || {};
    const notifyIds = [sl.commanderId, sl.deputyId].filter(Boolean);
    if (!notifyIds.length) return;
    const ids = await getSectorMemberIds(sectorKey);
    if (!ids || !ids.length) return;
    const now = new Date();
    const people = await Personnel.find({ discord: { $in: ids }, "notes.0": { $exists: true } });
    for (const p of people) {
        let changed = false;
        for (const n of p.notes) {
            if (!n.reviewNotified && n.reviewDeadline && n.reviewDeadline <= now) {
                n.reviewNotified = true;
                changed = true;
                for (const targetId of notifyIds) {
                    await Personnel.findOneAndUpdate({ discord: targetId }, { $push: { warnings: {
                        kind: "note-review",
                        reason: `📋 وصلت ملاحظة على ${p.registeredName || p.discordTag} إلى 5 أيام بدون إجراء.`,
                        noteReviewTargetDiscord: p.discord,
                        noteReviewTargetName: p.registeredName || p.discordTag,
                        noteReviewNoteId: n._id.toString(),
                        noteReviewText: n.text,
                        noteReviewSectorLabel: sectorLabel,
                        issuedBy: "system", issuedByTag: "النظام",
                    } } });
                }
            }
        }
        if (changed) await p.save();
    }
}

// ينهي أي إجازة "approved" نشطة على هذا الشخص — يصير إما لأن المدة خلصت، أو لأنه استخدم الموقع أثناء الإجازة (يعني رجع)
async function autoEndActiveLeave(discordId) {
    const leave = await LeaveRequest.findOne({ discord: discordId, status: "approved" });
    if (!leave) return;
    const now = new Date();
    const expired = leave.endDate && leave.endDate <= now;
    leave.status = "completed";
    leave.endedAt = now;
    leave.endedByTag = expired ? "تلقائي (انتهت المدة)" : "تلقائي (دخول للموقع أثناء الإجازة)";
    await leave.save();
    await logEvent({
        action: "إنهاء إجازة تلقائي", discordId: leave.discord, discordTag: leave.discordTag,
        actorId: "system", actorTag: "النظام", details: leave.endedByTag,
    });
}

// ── منطق قادة ونواب القطاعات ────────────────────────────────────────────
// يرجع مفتاح القطاع الذي يقوده/ينوبه هذا الشخص (من إعدادات قاعدة البيانات)، أو null
function getSectorRole(userId, settings) {
    return null; // نظام قيادة القطاعات اتشال بالكامل بطلب من الإدارة
}

// يرجع القطاع اللي هذا الشخص "مسؤول أفراد" فيه، أو null
function getPersonnelOfficerSector(userId, settings) {
    return null; // نظام قيادة القطاعات اتشال بالكامل بطلب من الإدارة
}

// يرجع القطاع اللي هذا الشخص "مسؤول تحضير" فيه، أو null
function getAttendanceOfficerSector(userId, settings) {
    return null; // نظام قيادة القطاعات اتشال بالكامل بطلب من الإدارة
}

// صلاحية مسؤول الأفراد تقتصر على رتبة "رئيس رقباء" وتحت
function isJuniorRank(rank) {
    return rankIndex(rank) <= rankIndex("رئيس رقباء");
}

// ── قيادة الشرطة العسكرية (نظام الشرطة العسكرية اتشال بالكامل بطلب من الإدارة) ──
function getMPRole(userId, settings) {
    return null;
}
function isMPPersonnelOfficer(userId, settings) {
    return false;
}
// قائد/نائب قطاع (يعيّنهم كبار المسؤولين بالآيدي من صفحة "قادة القطاعات") — صلاحيتهم على أزرار /تحكم-قياده بقطاعهم فقط
function getSectorLeaderInfo(userId, settings) {
    const sl = (settings && settings.sectorLeadership) || {};
    for (const key of Object.keys(CONFIG.SECTORS)) {
        const sec = sl[key];
        if (!sec) continue;
        if (sec.commanderId && sec.commanderId === userId) return { sector: key, sectorLabel: CONFIG.SECTORS[key], role: "commander" };
        if (sec.deputyId && sec.deputyId === userId) return { sector: key, sectorLabel: CONFIG.SECTORS[key], role: "deputy" };
    }
    return null;
}
// هل هذا الشخص من أعضاء القطاع؟ (حسب رول القطاع بديسكورد)
async function targetInSector(targetId, sectorKey, settings) {
    const roleId = sectorRoleId(sectorKey, settings);
    if (!roleId || !botReady) return false;
    try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
        const member = await guild.members.fetch(targetId);
        return member.roles.cache.has(roleId);
    } catch (e) { return false; }
}
// القيادة العليا — مجموعة يعيّنها كبار المسؤولين لمراجعة طلبات الترقية/التنزيل بكل القطاعات
function isHighCommand(userId, settings) {
    return !!(settings.highCommand || []).find(m => m.id === userId);
}
// يحسب وقت فتح الروم فعلياً: "الآن" = فوراً، "وقت محدد" = اليوم بذاك الوقت (أو بكرة لو الوقت فات اليوم)
function computeSummonUnlockAt(mode, hour, minute, ampm) {
    if (mode !== "scheduled") return new Date();
    let h = parseInt(hour, 10) % 12;
    if (ampm === "مساء") h += 12;
    const d = new Date();
    d.setSeconds(0, 0);
    d.setHours(h, parseInt(minute, 10) || 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d;
}
// هل هذا الشخص محظور عليه استخدام الموقع مؤقتاً بسبب استدعاء نشط؟ يبقى محظور حتى تنهي قيادة الشرطة العسكرية الاستدعاء (مو مجرد دخول الروم)
function isSummonBlocking(p) {
    return !!(p && p.summon && p.summon.status === "approved");
}

function sectorRoleId(sectorKey, settings) {
    // آيدي الرول اللي حدده كبار المسؤولين من الإعدادات له الأولوية، وإلا نرجع للقيمة الافتراضية
    const custom = settings && settings.sectorRoleIds && settings.sectorRoleIds[sectorKey];
    if (custom && String(custom).trim()) return String(custom).trim();
    if (sectorKey === "patrol") return CONFIG.PATROL_ROLE_ID;
    if (sectorKey === "roadSecurity") return CONFIG.ROAD_SECURITY_ROLE_ID;
    if (sectorKey === "antiDrugs") return CONFIG.ANTI_DRUGS_ROLE_ID;
    return null;
}

// يجيب آيديات كل أعضاء القطاع (حسب الرول بديسكورد) عن طريق البوت
// كاش بسيط لقائمة أعضاء السيرفر كاملة (30 ثانية) — عشان ما نعيد جلبها من ديسكورد كل ضغطة تبويب،
// لأن الجلب الكامل ثقيل ويفشل أحياناً (تايم أوت / ريت-ليمت) لو تكرر بسرعة
let guildMembersFetch = { time: 0, promise: null };
async function ensureGuildMembersFetched(guild) {
    const now = Date.now();
    if (guildMembersFetch.promise && (now - guildMembersFetch.time) < 30000) {
        return guildMembersFetch.promise;
    }
    guildMembersFetch.time = now;
    guildMembersFetch.promise = guild.members.fetch().catch(e => { guildMembersFetch.promise = null; throw e; });
    return guildMembersFetch.promise;
}
// يرجع مصفوفة آيديات لو نجح، أو null لو صار خطأ فعلي بالجلب (عشان ما نلخبط "فشل" مع "لا يوجد أعضاء")
async function getSectorMemberIds(sectorKey) {
    const roleId = sectorRoleId(sectorKey, await getSettings());
    if (!roleId) return [];
    if (!botReady) return null;
    try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
        const role = await guild.roles.fetch(roleId);
        if (!role) return [];
        await ensureGuildMembersFetched(guild);
        return role.members.map(m => m.id);
    } catch (e) {
        console.error("❌ فشل جلب أعضاء القطاع:", e.message);
        return null;
    }
}

// النقاط اللي المفروض يكون العسكري وصلها عشان يستحق هذي الرتبة بشكل طبيعي
// (نفس عدد نقاط عتبة الرتبة اللي قبلها مباشرة)
async function pointsForReachingRank(rankName, settings) {
    const idx = rankIndex(rankName);
    if (idx <= 0) return 0;
    const prevRank = CONFIG.MILITARY_RANKS[idx - 1];
    return await getThreshold(prevRank, settings);
}

// يفحص إذا العسكري وصل للنقاط المطلوبة لرتبته الحالية ويرقّيه تلقائياً
// (يدعم أكثر من رتبة دفعة وحدة لو جمع نقاط كثيرة، وينقل الباقي للرتبة الجديدة)
async function checkAutoPromotion(discordId) {
    const settings = await getSettings();
    const p = await Personnel.findOne({ discord: discordId });
    if (!p) return;
    let promoted = false;
    let guard = 0;
    while (guard++ < CONFIG.MILITARY_RANKS.length) {
        const idx = rankIndex(p.rank);
        if (idx >= CONFIG.MILITARY_RANKS.length - 1) break; // وصل لأعلى رتبة
        const threshold = await getThreshold(p.rank, settings);
        if (threshold <= 0 || p.points < threshold) break;
        const oldRank = p.rank;
        p.rank = CONFIG.MILITARY_RANKS[idx + 1];
        p.points -= threshold;
        promoted = true;
        await logEvent({ action: "ترقية تلقائية", discordId, discordTag: p.discordTag, actorId: "نظام تلقائي", actorTag: "🤖 نظام تلقائي", details: `${oldRank} ← ${p.rank} (وصل للنقاط المطلوبة)` });
    }
    if (promoted) await p.save();
}

// ══════════════════════════════════════════════════════════════════════════
// 3) بوت الديسكورد
// ══════════════════════════════════════════════════════════════════════════
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});

const pendingMessages = new Map(); // violationId -> { channelId, messageId }
let botReady = false;

async function isMilitary(discordId) {
    if (!botReady) return { ok: false, reason: "البوت لسا ما اتصل بديسكورد، حاول بعد ثوانٍ" };
    try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
        const member = await guild.members.fetch(discordId);
        const has = member.roles.cache.some(r => CONFIG.MILITARY_ROLE_IDS.includes(r.id));
        const isAntiDrugs = member.roles.cache.has(sectorRoleId("antiDrugs", await getSettings()));
        return { ok: has, member, isAntiDrugs };
    } catch (e) {
        console.error("❌ isMilitary خطأ:", e.message);
        return { ok: false, reason: e.message };
    }
}

// يفحص رولات ديسكورد الشخص مقابل خريطة settings.rankRoleIds (تعبّيها كبار المسؤولين من الإعدادات)
// ويرجع أعلى رتبة يملك روحها، أو null لو ما عنده أي رول من المحددة أو ما فيه إعداد أصلاً
async function detectRankFromRoles(discordId, settings) {
    const map = settings.rankRoleIds;
    if (!map || (typeof map.size === "number" && map.size === 0)) return null;
    if (!botReady) return null;
    try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
        const member = await guild.members.fetch(discordId);
        let bestIdx = -1, bestRank = null;
        for (const rank of CONFIG.MILITARY_RANKS) {
            const roleId = typeof map.get === "function" ? map.get(rank) : map[rank];
            if (!roleId) continue;
            if (member.roles.cache.has(roleId)) {
                const idx = rankIndex(rank);
                if (idx > bestIdx) { bestIdx = idx; bestRank = rank; }
            }
        }
        return bestRank;
    } catch (e) {
        return null;
    }
}

// هل هذا الشخص حامل رتبة الشرطة العسكرية بديسكورد؟
// يرسل رسالة خاصة (DM) للعسكري المستدعى فيها زر "دخول الاستدعاء" يفتح روم الفويس مباشرة
async function sendSummonDM(discordId, timeLabel) {
    if (!botReady) return;
    try {
        const user = await client.users.fetch(discordId);
        const embed = new EmbedBuilder()
            .setTitle("📣 لديك استدعاء")
            .setColor(0xf59e0b)
            .setDescription(`عليك استدعاء من الشرطة العسكرية.\n**الوقت:** ${timeLabel || "الآن"}`)
            .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel("🚪 دخول الاستدعاء").setStyle(ButtonStyle.Link).setURL(CONFIG.MP_SUMMON_VOICE_URL),
        );
        await user.send({ content: `<@${discordId}>`, embeds: [embed], components: [row] });
    } catch (e) {
        console.error("❌ فشل إرسال رسالة الاستدعاء الخاصة:", e.message);
    }
}

async function isMilitaryPoliceMember(discordId) {
    return false; // نظام الشرطة العسكرية اتشال بالكامل بطلب من الإدارة
}
// يرجع آيديات كل حاملي رتبة الشرطة العسكرية، أو null لو تعذر الجلب فعلياً
async function getMilitaryPoliceMemberIds() {
    return []; // نظام الشرطة العسكرية اتشال بالكامل بطلب من الإدارة
}

// يرجع مفتاح القطاع اللي هذا الشخص عضو فيه حسب رول ديسكورد (للاستخدام بنظام الإجازات والبصمة)
async function getMemberSectorKey(discordId) {
    return null; // نظام قيادة القطاعات اتشال بالكامل بطلب من الإدارة
}

function buildViolationEmbed(v) {
    if (v.kind === "report") {
        const fields = [
            { name: "اسم العسكري", value: v.reporterName || "-", inline: true },
            { name: "اليونت", value: v.reporterUnit || "-", inline: true },
            { name: "نوع التقرير", value: v.reportCategory || "-", inline: true },
            { name: "اسم المتهم", value: v.suspectName || "-", inline: true },
            { name: "موقع الضبط", value: v.arrestLocation || "-", inline: true },
            { name: "المركبة", value: v.vehicle || "-", inline: true },
            { name: "سبب الاستيقاف", value: v.stopReason || "-", inline: false },
        ];
        if (v.reportCategory === "مخدرات") {
            fields.push(
                { name: "نوع المخدر المضبوط", value: v.drugType || "-", inline: true },
                { name: "الكمية المضبوطة", value: v.drugQuantity || "-", inline: true },
                { name: "طريقة إخفاء المخدر", value: v.concealMethod || "-", inline: false },
            );
        } else {
            fields.push({ name: "المضبوطات", value: v.seizedItems || "-", inline: false });
        }
        fields.push({ name: "الإجراءات الأمنية المتخذة", value: (v.securityActions && v.securityActions.length) ? v.securityActions.map(a => `- ${a}`).join("\n") : "-", inline: false });
        return new EmbedBuilder()
            .setTitle(`🧪 تقرير مكافحة مخدرات جديد (${v.reportCategory || "-"}) — بانتظار المراجعة`)
            .setColor(0xf59e0b)
            .addFields(fields)
            .setFooter({ text: `ID: ${v._id}` })
            .setTimestamp(v.createdAt);
    }
    return new EmbedBuilder()
        .setTitle("🚨 مخالفة جديدة بانتظار المراجعة")
        .setColor(0xf59e0b)
        .addFields(
            { name: "اسم العسكري", value: v.reporterName || "-", inline: true },
            { name: "اليونت", value: v.reporterUnit || "-", inline: true },
            { name: "نوع المخالفة", value: v.violationType, inline: false },
            { name: "المركبة", value: v.vehicle, inline: true },
            { name: "لوحة السيارة", value: v.plateNumber, inline: true },
        )
        .setFooter({ text: `ID: ${v._id}` })
        .setTimestamp(v.createdAt);
}

function buildViolationButtons(id, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`approve_${id}`).setLabel("قبول").setStyle(ButtonStyle.Success).setDisabled(disabled),
        new ButtonBuilder().setCustomId(`reject_${id}`).setLabel("رفض").setStyle(ButtonStyle.Danger).setDisabled(disabled),
    );
}

// إشعار كل أعضاء القيادة العليا برسالة خاصة (DM) بديسكورد فور تقديم طلب ترقية/تنزيل جديد،
// مع زر رابط مباشر لفتح الموقع (Link Button ما يحتاج تفاعل من البوت، ديسكورد يفتح الرابط مباشرة)
async function notifyHighCommandOfPromotion(doc) {
    if (!botReady) return;
    const settings = await getSettings();
    const members = settings.highCommand || [];
    if (!members.length) return;
    const embed = new EmbedBuilder()
        .setTitle("🎖️ يوجد تقرير ترقية عسكرية")
        .setColor(0xf59e0b)
        .addFields(
            { name: "الفرد", value: doc.targetName || doc.targetTag, inline: true },
            { name: "القطاع", value: doc.sectorLabel, inline: true },
            { name: "الاتجاه", value: doc.direction === "up" ? "⬆️ ترقية" : "⬇️ تنزيل", inline: true },
            { name: "من رتبة", value: doc.fromRank, inline: true },
            { name: "إلى رتبة", value: doc.toRank, inline: true },
            { name: "مقدّم الطلب", value: doc.requestedByTag || "-", inline: false },
            { name: "السبب", value: doc.reason || "-", inline: false },
        )
        .setFooter({ text: `ID: ${doc._id}` })
        .setTimestamp(doc.createdAt || new Date());
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("🔵 اضغط هنا لدخول فلاش").setStyle(ButtonStyle.Link).setURL(CONFIG.SITE_URL),
    );
    for (const m of members) {
        try {
            const user = await client.users.fetch(m.id);
            await user.send({ embeds: [embed], components: [row] });
        } catch (e) {
            console.error("❌ فشل إرسال إشعار الترقية لعضو القيادة العليا:", m.id, e.message);
        }
    }
}

// إرسال المخالفة تلقائياً لقناة المخالفات فور تسجيلها من الموقع
// يرفع صورة المخالفة كمرفق برسالة القناة، ويحفظ مرجع الرسالة بدل ما يخزن الصورة نفسها بقاعدة البيانات.
// إذا تعذر الرفع لأي سبب (البوت متوقف، القناة محذوفة...) نحفظ الصورة احتياطياً بقاعدة البيانات عشان ما تضيع.
// إرسال رسالة خاصة (DM) لأي عسكري بنتيجة أي إجراء عليه — مهم جداً الآن إن الموقع صار خاص بالإدارة فقط،
// فهذي الرسالة صارت الطريقة الوحيدة اللي يعرف فيها العسكري إن طلبه اتقبل أو انرفض
async function dmMember(discordId, embed) {
    if (!botReady || !discordId) return;
    try {
        const user = await client.users.fetch(discordId);
        await user.send({ embeds: [embed] });
    } catch (e) {
        console.error("❌ فشل إرسال رسالة خاصة:", discordId, e.message);
    }
}

async function postViolationToChannel(v, rawPhoto) {
    const settings = await getSettings();
    if (!botReady || !settings.violationsChannelId) {
        if (rawPhoto) { v.photo = rawPhoto; await v.save().catch(() => {}); }
        return;
    }
    try {
        const channel = await client.channels.fetch(settings.violationsChannelId);
        const embed = buildViolationEmbed(v);
        const components = [buildViolationButtons(v._id.toString())];
        const files = [];
        if (rawPhoto && rawPhoto.startsWith("data:image")) {
            const base64Data = rawPhoto.split(",")[1];
            const buffer = Buffer.from(base64Data, "base64");
            const ext = rawPhoto.includes("image/png") ? "png" : "jpg";
            const fname = `violation_${v._id}.${ext}`;
            files.push(new AttachmentBuilder(buffer, { name: fname }));
            // ملاحظة: ما نربط الصورة بالإيمبد (بدون setImage) — تجي كمرفق منفصل تحت الرسالة
            // بعرض ديسكورد الطبيعي (thumbnail قابل للضغط والتكبير)، مو مدمجة جوا الإيمبد
        }
        const msg = await channel.send({ embeds: [embed], components, files });
        pendingMessages.set(v._id.toString(), { channelId: msg.channelId, messageId: msg.id });
        if (rawPhoto) {
            v.photoChannelId = msg.channelId;
            v.photoMessageId = msg.id;
            await v.save();
        }
    } catch (e) {
        console.error("❌ فشل إرسال المخالفة للقناة:", e.message);
        // احتياط: لا نخسر الصورة لو فشل الرفع لديسكورد
        if (rawPhoto) { v.photo = rawPhoto; await v.save().catch(() => {}); }
    }
}

// ── نظام صور الملاحظات (نفس فكرة صور المخالفات: ترفع كمرفق برسالة بقناة ديسكورد، مو بقاعدة البيانات) ──
function buildNoteEmbed(personnelName, personnelDiscord, text, addedByTag) {
    return new EmbedBuilder()
        .setTitle("📝 ملاحظة جديدة")
        .setColor(0xfacc15)
        .addFields(
            { name: "العسكري", value: personnelName || personnelDiscord, inline: true },
            { name: "بواسطة", value: addedByTag || "-", inline: true },
            { name: "النص", value: text || "-", inline: false },
        )
        .setTimestamp();
}
// يرفع صورة الملاحظة لقناة الملاحظات ويرجع مرجع الرسالة، أو null لو تعذر (والمتصل يحتفظ بالصورة كاحتياط بقاعدة البيانات)
async function postNoteToChannel(personnelDiscord, personnelName, text, addedByTag, rawImage) {
    const settings = await getSettings();
    if (!botReady || !settings.notesChannelId || !rawImage) return null;
    try {
        const channel = await client.channels.fetch(settings.notesChannelId);
        const embed = buildNoteEmbed(personnelName, personnelDiscord, text, addedByTag);
        const files = [];
        if (rawImage.startsWith("data:image")) {
            const base64Data = rawImage.split(",")[1];
            const buffer = Buffer.from(base64Data, "base64");
            const ext = rawImage.includes("image/png") ? "png" : "jpg";
            files.push(new AttachmentBuilder(buffer, { name: `note_${Date.now()}.${ext}` }));
        }
        const msg = await channel.send({ embeds: [embed], files });
        return { channelId: msg.channelId, messageId: msg.id };
    } catch (e) {
        console.error("❌ فشل إرسال الملاحظة للقناة:", e.message);
        return null;
    }
}
// يضيف ملاحظة لعسكري، يرفع صورتها لقناة الملاحظات إذا أمكن (وإلا يحتفظ بها بقاعدة البيانات كاحتياط)
async function pushNoteWithImage({ discord, text, image, actorId, actorTag }) {
    const p = await Personnel.findOne({ discord });
    if (!p) return null;
    p.notes.push({ text, image, addedBy: actorId, addedByTag: actorTag, reviewDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
    const note = p.notes[p.notes.length - 1];
    await p.save();
    const uploaded = await postNoteToChannel(p.discord, p.registeredName || p.discordTag || p.discord, text, actorTag, image);
    if (uploaded) {
        note.imageChannelId = uploaded.channelId;
        note.imageMessageId = uploaded.messageId;
        note.image = null; // ما نحتاج نخزن نسخة بقاعدة البيانات بعد ما ارتفعت لديسكورد بنجاح
        await p.save();
    }
    return p;
}


async function syncViolationMessage(v) {
    const ref = pendingMessages.get(v._id.toString());
    if (!ref) return;
    try {
        const channel = await client.channels.fetch(ref.channelId);
        const msg = await channel.messages.fetch(ref.messageId);
        const color = v.status === "approved" ? 0x22c55e : v.status === "rejected" ? 0xef4444 : 0xf59e0b;
        const isReport = v.kind === "report";
        const title = v.status === "approved" ? (isReport ? "✅ تقرير مكافحة مخدرات مقبول" : "✅ مخالفة مقبولة")
            : v.status === "rejected" ? (isReport ? "❌ تقرير مكافحة مخدرات مرفوض" : "❌ مخالفة مرفوضة")
            : (isReport ? `🧪 تقرير مكافحة مخدرات جديد (${v.reportCategory || "-"}) — بانتظار المراجعة` : "🚨 مخالفة جديدة بانتظار المراجعة");
        const oldEmbed = msg.embeds[0] ? EmbedBuilder.from(msg.embeds[0]) : buildViolationEmbed(v);
        const embed = oldEmbed.setColor(color).setTitle(title);
        await msg.edit({ embeds: [embed], components: [buildViolationButtons(v._id.toString(), v.status !== "pending")] });
    } catch (e) { /* تجاهل */ }
    if (v.status !== "pending") pendingMessages.delete(v._id.toString());
}

async function approveViolation(v, actorId, actorTag) {
    // لو على صاحب المخالفة استدعاء نشط لسا ما دخل له، مخالفاته تبقى مجمدة لحد ما ينتهي الاستدعاء
    const reporter = await Personnel.findOne({ discord: v.reporterDiscord });
    if (isSummonBlocking(reporter)) return { blocked: true };
    v.status = "approved"; v.reviewedBy = actorId; v.reviewedByTag = actorTag; v.reviewedAt = new Date();
    await v.save();
    const pts = v.kind === "report" ? CONFIG.REPORT_POINTS_APPROVE : CONFIG.POINTS_ON_APPROVE;
    const label = v.kind === "report" ? `تقرير مكافحة مخدرات (${v.reportCategory})` : v.violationType;
    const pr = await applyOrQueuePoints({
        discordId: v.reporterDiscord, delta: pts, actorId, actorTag,
        source: v.kind === "report" ? "report" : "violation",
        reason: `قبول ${label} — ${v.reporterName}`,
    });
    if (pr.applied) await checkAutoPromotion(v.reporterDiscord);
    await syncViolationMessage(v);
    await logEvent({ action: v.kind === "report" ? "قبول تقرير" : "قبول مخالفة", discordId: v.reporterDiscord, discordTag: v.reporterTag, actorId, actorTag, details: `${label} — ${v.reporterName}${pr.queued ? " (النقاط بانتظار موافقة الإدارة)" : ""}` });
    dmMember(v.reporterDiscord, new EmbedBuilder()
        .setTitle("✅ تم قبول مخالفتك")
        .setColor(0x22c55e)
        .addFields({ name: "النوع", value: label }, { name: pr.queued ? "النقاط" : "النقاط المكتسبة", value: pr.queued ? `+${pts} (بانتظار موافقة الإدارة)` : `+${pts}` })
        .setTimestamp()).catch(() => {});
    return { blocked: false };
}

async function rejectViolation(v, actorId, actorTag, reason) {
    const reporter = await Personnel.findOne({ discord: v.reporterDiscord });
    if (isSummonBlocking(reporter)) return { blocked: true };
    v.status = "rejected"; v.rejectReason = reason; v.reviewedBy = actorId; v.reviewedByTag = actorTag; v.reviewedAt = new Date();
    await v.save();
    const pts = v.kind === "report" ? CONFIG.REPORT_POINTS_REJECT : CONFIG.POINTS_ON_REJECT;
    const rlabel = v.kind === "report" ? `تقرير مكافحة مخدرات (${v.reportCategory})` : v.violationType;
    const pr = await applyOrQueuePoints({
        discordId: v.reporterDiscord, delta: -pts, actorId, actorTag,
        source: v.kind === "report" ? "report" : "violation",
        reason: `رفض ${rlabel} — ${v.reporterName} — السبب: ${reason}`,
    });
    await syncViolationMessage(v);
    await logEvent({ action: v.kind === "report" ? "رفض تقرير" : "رفض مخالفة", discordId: v.reporterDiscord, discordTag: v.reporterTag, actorId, actorTag, details: `${rlabel} — ${v.reporterName} — السبب: ${reason}${pr.queued ? " (خصم النقاط بانتظار موافقة الإدارة)" : ""}` });
    dmMember(v.reporterDiscord, new EmbedBuilder()
        .setTitle("❌ تم رفض مخالفتك")
        .setColor(0xef4444)
        .addFields({ name: "النوع", value: rlabel }, { name: "السبب", value: reason || "-" })
        .setTimestamp()).catch(() => {});
    return { blocked: false };
}

// ══════════════════════════════════════════════════════════════════════════
// أوامر بوت الأوامر (نفس بوت الموقع) — أي عضو يقدر يشغّل الأمر نفسه ويفتح اللوحة،
// لكن زر كل لوحة ما يشتغل إلا لو رتبة الشخص تحقق أقل رتبة محددة من settings.commandPermissions
// (عدا لوحة التسجيل، متاحة للجميع بدون شرط رتبة) — كلها بلهجة سعودية رسمية
// ══════════════════════════════════════════════════════════════════════════
const violationSessions = new Map(); // userId -> { types: [] , vehicle: null }
const cmdSessions = new Map();       // userId -> { targetId, direction }

function brandEmbed() { return new EmbedBuilder().setColor(0xd4af37).setFooter({ text: "مركز العمليات العسكري • بوت الأوامر الرسمي" }); }

async function handleViolationCommand(interaction) {
    await interaction.deferReply();
    const settings = await getSettings();
    const embed = brandEmbed().setTitle("📝 لوحة إصدار المخالفات العسكرية").setDescription(
        "هذي اللوحة الرسمية لتسجيل مخالفة مرورية بحق أي مركبة أثناء الخدمة.\n\n" +
        `**الرتبة المطلوبة لاستخدام الزر:** ${settings.commandPermissions.violation} فما فوق\n\n` +
        "اضغط الزر أدناه للبدء بتعبئة بيانات المخالفة.");
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("viol_start").setLabel("📝 إصدار مخالفة").setStyle(ButtonStyle.Primary));
    await interaction.editReply({ embeds: [embed], components: [row] });
}
async function handleViolationStart(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const settings = await getSettings();
    const p = await getOrCreatePersonnel(interaction.user.id, interaction.member);
    if (p.isBlocked) return interaction.editReply({ content: "🚫 حسابك موقوف حالياً، راجع الإدارة." });
    if (!rankAtLeast(p.rank, settings.commandPermissions.violation)) {
        return interaction.editReply({ content: `🚫 رتبتك الحالية (${p.rank}) أقل من الرتبة المطلوبة (${settings.commandPermissions.violation}).` });
    }
    const vehicles = await Vehicle.find().sort({ name: 1 }).limit(25);
    if (!vehicles.length) return interaction.editReply({ content: "❌ لا توجد مركبات مضافة بالنظام حالياً." });
    violationSessions.set(interaction.user.id, { types: [], vehicle: null });
    const typeMenu = new StringSelectMenuBuilder().setCustomId("viol_types_select").setPlaceholder("اختر نوع أو أكثر من أنواع المخالفة")
        .setMinValues(1).setMaxValues(Math.min(CONFIG.VIOLATION_TYPES.length, 10))
        .addOptions(CONFIG.VIOLATION_TYPES.map(t => ({ label: t, value: t })));
    await interaction.editReply({ content: "**الخطوة ١ من ٣ — نوع المخالفة**\nحدد نوع أو عدة أنواع للمخالفة:", components: [new ActionRowBuilder().addComponents(typeMenu)] });
}
async function handleViolationTypesSelect(interaction) {
    await interaction.deferUpdate();
    const session = violationSessions.get(interaction.user.id);
    if (!session) return interaction.editReply({ content: "⏱️ انتهت الجلسة، ابدأ من جديد.", components: [] });
    session.types = interaction.values;
    const vehicles = await Vehicle.find().sort({ name: 1 }).limit(25);
    const vehicleMenu = new StringSelectMenuBuilder().setCustomId("viol_vehicle_select").setPlaceholder("اختر المركبة")
        .addOptions(vehicles.map(v => ({ label: v.name, value: v.name })));
    await interaction.editReply({ content: `**الخطوة ٢ من ٣ — المركبة**\nالأنواع المحددة: ${session.types.join("، ")}`, components: [new ActionRowBuilder().addComponents(vehicleMenu)] });
}
async function handleViolationVehicleSelect(interaction) {
    await interaction.deferUpdate();
    const session = violationSessions.get(interaction.user.id);
    if (!session) return interaction.editReply({ content: "⏱️ انتهت الجلسة، ابدأ من جديد.", components: [] });
    session.vehicle = interaction.values[0];
    await interaction.editReply({ content: `**الخطوة ٣ من ٣ — صورة المخالفة (إجباري)**\nالأنواع: ${session.types.join("، ")}\nالمركبة: ${session.vehicle}\n\n📸 أرسل الآن صورة المخالفة بنفس هذه القناة خلال دقيقتين.`, components: [] });
    const channel = interaction.channel;
    const filter = m => m.author.id === interaction.user.id && m.attachments.size > 0;
    try {
        const collected = await channel.awaitMessages({ filter, max: 1, time: 120000, errors: ["time"] });
        const msg = collected.first();
        const attachment = msg.attachments.find(a => (a.contentType || "").startsWith("image/"));
        if (!attachment) { violationSessions.delete(interaction.user.id); return interaction.followUp({ content: "❌ ما لقيت صورة صالحة، أعد المحاولة.", ephemeral: true }); }
        const p = await getOrCreatePersonnel(interaction.user.id, interaction.member);
        const pendingCount = await Violation.countDocuments({ reporterDiscord: interaction.user.id, status: "pending" });
        if (pendingCount >= 5) {
            violationSessions.delete(interaction.user.id); msg.delete().catch(() => {});
            return interaction.followUp({ content: "🚫 عندك 5 مخالفات معلّقة، لازم الإدارة تراجع وحدة منها أول.", ephemeral: true });
        }
        const v = await Violation.create({
            reporterDiscord: interaction.user.id, reporterTag: interaction.user.username,
            reporterName: p.registeredName || interaction.user.username, reporterUnit: p.unit,
            violationType: session.types.join("، "), vehicle: session.vehicle, plateNumber: generatePlate(), status: "pending",
        });
        violationSessions.delete(interaction.user.id);
        const base64 = await attachmentToBase64(attachment.url).catch(() => null);
        msg.delete().catch(() => {});
        await postViolationToChannel(v, base64);
        await logEvent({ action: "طلب مخالفة (بوت الأوامر)", discordId: v.reporterDiscord, discordTag: v.reporterTag, actorId: interaction.user.id, actorTag: interaction.user.username, details: `${v.violationType} — ${v.vehicle}` });
        await interaction.followUp({ content: "✅ تم تسجيل مخالفتك بنجاح، بانتظار مراجعة الإدارة.", ephemeral: true });
    } catch (e) {
        violationSessions.delete(interaction.user.id);
        await interaction.followUp({ content: "⏱️ انتهى الوقت المحدد لإرسال الصورة، أعد المحاولة.", ephemeral: true });
    }
}

async function handleCommandCommand(interaction) {
    await interaction.deferReply();
    const settings = await getSettings();
    const embed = brandEmbed().setTitle("🎖️ لوحة تحكم القيادة").setDescription(
        "أوامر القيادة المتاحة لك حسب رتبتك — ترقية/تنزيل، تحذير، ملاحظة، نقاط، إشعار، ونقاط الاستلام (تختار الشخص اللي تعطيه).\n\n" +
        `**الرتبة المطلوبة لأغلب الأزرار:** ${settings.commandPermissions.command} فما فوق\n` +
        "**قادة ونواب القطاعات:** يستخدمون الأزرار على أفراد قطاعهم فقط، وزر «حضور القطاع» يعرض لهم مين داخل ومين خارج ووقت الدخول والخروج.");
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("cmd_start").setLabel("🎖️ ترقية/تنزيل").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("cmd_warn_start").setLabel("⚠️ تحذير").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("cmd_note_start").setLabel("📝 ملاحظة").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("cmd_points_start").setLabel("⭐ نقاط").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("cmd_notice_start").setLabel("📢 إشعار").setStyle(ButtonStyle.Secondary),
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("cmd_reception").setLabel(`🪖 نقاط الاستلام (+${CONFIG.RECEPTION_POINTS})`).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("cmd_att_view").setLabel("📋 حضور القطاع").setStyle(ButtonStyle.Secondary),
    );
    await interaction.editReply({ embeds: [embed], components: [row1, row2] });
}
// نقطة دخول مشتركة لكل أزرار القيادة اللي تحتاج اختيار فرد (ترقية/تنزيل، تحذير، ملاحظة، نقاط، إشعار)
async function startCommandFlow(interaction, action, placeholder, stepLabel) {
    await interaction.deferReply({ ephemeral: true });
    const settings = await getSettings();
    const p = await getOrCreatePersonnel(interaction.user.id, interaction.member);
    // الرتبة المطلوبة تعطي صلاحية كاملة، وقائد/نائب القطاع يعطيه صلاحية على أفراد قطاعه فقط
    let leaderSector = null;
    if (!rankAtLeast(p.rank, settings.commandPermissions.command)) {
        const leader = getSectorLeaderInfo(interaction.user.id, settings);
        if (!leader) {
            return interaction.editReply({ content: `🚫 رتبتك الحالية (${p.rank}) أقل من الرتبة المطلوبة (${settings.commandPermissions.command}).` });
        }
        leaderSector = leader.sector;
        stepLabel += `\n\n🎖️ صلاحيتك كـ${leader.role === "commander" ? "قائد" : "نائب"} ${leader.sectorLabel} على أفراد قطاعك فقط.`;
    }
    cmdSessions.set(interaction.user.id, { action, leaderSector });
    const menu = new UserSelectMenuBuilder().setCustomId("cmd_target_select").setPlaceholder(placeholder);
    await interaction.editReply({ content: stepLabel, components: [new ActionRowBuilder().addComponents(menu)] });
}
async function handleCommandStart(interaction) {
    return startCommandFlow(interaction, "promote", "اختر الفرد المطلوب ترقيته أو تنزيله", "**الخطوة ١ من ٣ — اختيار الفرد**");
}
async function handleCommandWarnStart(interaction) {
    return startCommandFlow(interaction, "warn", "اختر الفرد المطلوب تحذيره", "**اختر الفرد**");
}
async function handleCommandNoteStart(interaction) {
    return startCommandFlow(interaction, "note", "اختر الفرد المطلوب تسجيل ملاحظة عليه", "**اختر الفرد**");
}
async function handleCommandPointsStart(interaction) {
    return startCommandFlow(interaction, "points", "اختر الفرد المطلوب تعديل نقاطه", "**اختر الفرد**");
}
async function handleCommandNoticeStart(interaction) {
    return startCommandFlow(interaction, "notice", "اختر الفرد المطلوب إرسال إشعار له", "**اختر الفرد**");
}
// نقاط الاستلام — أول ما تضغط الزر يطلب منك تختار الشخص اللي تبي تعطيه النقاط، وبعدها تنطبق مباشرة (مقيّدة بحد أقصى يومي لكل شخص)
async function handleCommandReceptionButton(interaction) {
    return startCommandFlow(interaction, "reception", "اختر الشخص اللي تبي تعطيه نقاط الاستلام", `**🪖 نقاط الاستلام (+${CONFIG.RECEPTION_POINTS})**\nاختر الشخص اللي تبي تعطيه نقاط الاستلام:`);
}
async function finishReception(interaction, session, targetId) {
    cmdSessions.delete(interaction.user.id);
    const todayStart = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date()) + "T00:00:00.000+03:00");
    const countToday = await Log.countDocuments({ action: "نقاط الاستلام", discordId: targetId, createdAt: { $gte: todayStart } });
    if (countToday >= CONFIG.RECEPTION_MAX_PER_DAY) {
        return interaction.editReply({ content: `🚫 <@${targetId}> وصل الحد الأقصى لنقاط الاستلام اليوم (${CONFIG.RECEPTION_MAX_PER_DAY} مرات).`, components: [] });
    }
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    const targetMember = await guild.members.fetch(targetId).catch(() => null);
    const target = await getOrCreatePersonnel(targetId, targetMember);
    await applyOrQueuePoints({ discordId: targetId, delta: CONFIG.RECEPTION_POINTS, actorId: interaction.user.id, actorTag: interaction.user.username, source: "reception", reason: "نقاط الاستلام" });
    await checkAutoPromotion(targetId);
    await logEvent({ action: "نقاط الاستلام", discordId: targetId, discordTag: target.discordTag, actorId: interaction.user.id, actorTag: interaction.user.username, details: `+${CONFIG.RECEPTION_POINTS} نقطة (${countToday + 1}/${CONFIG.RECEPTION_MAX_PER_DAY} اليوم)` });
    await interaction.editReply({ content: `✅ تم إضافة ${CONFIG.RECEPTION_POINTS} نقاط استلام لـ<@${targetId}> (${countToday + 1}/${CONFIG.RECEPTION_MAX_PER_DAY} اليوم).`, components: [] });
}
async function handleCommandTargetSelect(interaction) {
    const session = cmdSessions.get(interaction.user.id);
    // الأزرار اللي تفتح نموذج (Modal) لازم ما نرد على التفاعل قبل فتحه، وإلا ديسكورد يرفض فتح النموذج ويطلع "فشل التفاعل"
    const modalActions = ["warn", "notice", "note", "points"];
    if (!session || !modalActions.includes(session.action)) await interaction.deferUpdate();
    const reply = (payload) => (interaction.deferred || interaction.replied) ? interaction.editReply(payload) : interaction.update(payload);
    if (!session) return reply({ content: "⏱️ انتهت الجلسة، ابدأ من جديد.", components: [] });
    const targetId = interaction.values[0];
    // نقاط الاستلام يمديك تعطيها لنفسك أو لغيرك (ضمن الحد اليومي)، أما بقية الأزرار فما تقدر تختار نفسك
    if (session.action !== "reception" && targetId === interaction.user.id) {
        cmdSessions.delete(interaction.user.id);
        return reply({ content: "🚫 ما تقدر تختار نفسك.", components: [] });
    }
    if (interaction.users?.get(targetId)?.bot) {
        cmdSessions.delete(interaction.user.id);
        return reply({ content: "🚫 ما تقدر تختار بوت.", components: [] });
    }
    // قائد/نائب القطاع (اللي صلاحيته جاية من منصبه مو من رتبته) يتحكم بأفراد قطاعه فقط
    if (session.leaderSector) {
        const inSector = await targetInSector(targetId, session.leaderSector, await getSettings());
        if (!inSector) {
            cmdSessions.delete(interaction.user.id);
            return reply({ content: `🚫 صلاحيتك على أفراد ${CONFIG.SECTORS[session.leaderSector]} فقط، والشخص المختار مو من قطاعك.`, components: [] });
        }
    }
    if (session.action === "reception") return finishReception(interaction, session, targetId);
    session.targetId = targetId;

    if (session.action === "warn" || session.action === "notice") {
        const modal = new ModalBuilder().setCustomId("cmd_warnnotice_modal").setTitle(session.action === "warn" ? "سبب التحذير" : "نص الإشعار");
        const input = new TextInputBuilder().setCustomId("reason").setLabel("اكتب النص").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(400);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
    }
    if (session.action === "note") {
        const modal = new ModalBuilder().setCustomId("cmd_note_modal").setTitle("نص الملاحظة");
        const input = new TextInputBuilder().setCustomId("text").setLabel("اكتب الملاحظة").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
    }
    if (session.action === "points") {
        const modal = new ModalBuilder().setCustomId("cmd_points_modal").setTitle("تعديل نقاط");
        const amountInput = new TextInputBuilder().setCustomId("amount").setLabel("عدد النقاط (استخدم - للخصم، مثال: -5)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10);
        const reasonInput = new TextInputBuilder().setCustomId("reason").setLabel("السبب").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(300);
        modal.addComponents(new ActionRowBuilder().addComponents(amountInput), new ActionRowBuilder().addComponents(reasonInput));
        return interaction.showModal(modal);
    }
    if (session.action === "promote") {
        const target = await getOrCreatePersonnel(targetId, null);
        session.targetRank = target.rank;
        const idx = rankIndex(target.rank);
        const row = new ActionRowBuilder();
        if (idx < CONFIG.MILITARY_RANKS.length - 1) row.addComponents(new ButtonBuilder().setCustomId("cmd_dir_up").setLabel(`⬆️ ترقية إلى ${CONFIG.MILITARY_RANKS[idx + 1]}`).setStyle(ButtonStyle.Success));
        if (idx > 0) row.addComponents(new ButtonBuilder().setCustomId("cmd_dir_down").setLabel(`⬇️ تنزيل إلى ${CONFIG.MILITARY_RANKS[idx - 1]}`).setStyle(ButtonStyle.Danger));
        return reply({ content: `**الخطوة ٢ من ٣ — الاتجاه**\nالفرد: <@${targetId}>\nرتبته الحالية: ${target.rank}`, components: row.components.length ? [row] : [] });
    }
    // إجراء غير معروف — ننهي الجلسة بدل ما نخلي التفاعل معلّق
    cmdSessions.delete(interaction.user.id);
    return reply({ content: "❌ إجراء غير معروف، ابدأ من جديد.", components: [] });
}

// ── عرض حضور القطاع لقائد/نائب القطاع (مين داخل ومين خارج ومتى سجّل دخول وخروج) ──
async function sendSectorAttendance(interaction, sectorKey) {
    const settings = await getSettings();
    const label = CONFIG.SECTORS[sectorKey];
    const roleId = sectorRoleId(sectorKey, settings);
    if (!roleId || !botReady) return interaction.editReply({ content: "❌ ما قدرت أجلب أعضاء القطاع الحين، حاول بعد شوي.", components: [] });
    let members;
    try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
        const role = await guild.roles.fetch(roleId);
        if (!role) return interaction.editReply({ content: `❌ رول ${label} غير موجود بالسيرفر — تأكد من آيدي الرول بإعدادات الكبار.`, components: [] });
        await ensureGuildMembersFetched(guild);
        members = role.members.filter(m => !m.user.bot).map(m => ({ id: m.id, name: m.displayName }));
    } catch (e) {
        return interaction.editReply({ content: "❌ تعذر جلب أعضاء القطاع من ديسكورد، حاول بعد شوي.", components: [] });
    }
    if (!members.length) return interaction.editReply({ content: `ما فيه أعضاء معهم رول ${label} حالياً.`, components: [] });
    const statuses = await AttendanceStatus.find({ discord: { $in: members.map(m => m.id) } });
    const byId = new Map(statuses.map(st => [st.discord, st]));
    const rows = members.map(m => ({ name: (byId.get(m.id)?.registeredName) || m.name, st: byId.get(m.id) || null }));
    const group = r => !r.st || (!r.st.lastCheckInAt && !r.st.lastCheckOutAt) ? 2 : (r.st.status === "in" ? 0 : 1);
    rows.sort((x, y) => group(x) - group(y) || x.name.localeCompare(y.name, "ar"));
    const ts = d => d ? `<t:${Math.floor(new Date(d).getTime() / 1000)}:f>` : "—";
    const counts = [0, 0, 0];
    const lines = rows.map(r => {
        const g = group(r); counts[g]++;
        if (g === 2) return `⚪ **${r.name}** — ما سجّل حضور قط`;
        return `${g === 0 ? "🟢" : "🔴"} **${r.name}** — ${g === 0 ? "داخل" : "خارج"}\n↳ دخول: ${ts(r.st.lastCheckInAt)} • خروج: ${ts(r.st.lastCheckOutAt)}`;
    });
    // نقسم القائمة على أكثر من إيمبد (حد الوصف 4096 حرف)
    const embeds = []; let cur = "";
    for (const line of lines) {
        if ((cur + "\n\n" + line).length > 3800) { embeds.push(cur); cur = line; }
        else cur = cur ? cur + "\n\n" + line : line;
    }
    if (cur) embeds.push(cur);
    const shown = embeds.slice(0, 10);
    const out = shown.map((desc, i) => {
        const e = brandEmbed().setDescription(desc);
        if (i === 0) e.setTitle(`📋 حضور ${label}`).setAuthor({ name: `🟢 ${counts[0]} داخل  •  🔴 ${counts[1]} خارج  •  ⚪ ${counts[2]} ما سجّلوا` });
        return e;
    });
    await interaction.editReply({ content: embeds.length > 10 ? "⚠️ القائمة طويلة، انعرض جزء منها فقط." : "", embeds: out, components: [] });
}
async function handleCommandAttendanceView(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const settings = await getSettings();
    const leader = getSectorLeaderInfo(interaction.user.id, settings);
    if (leader) return sendSectorAttendance(interaction, leader.sector);
    if (isSeniorAdmin(interaction.user.id)) {
        const menu = new StringSelectMenuBuilder().setCustomId("cmd_att_sector_select").setPlaceholder("اختر القطاع")
            .addOptions(Object.entries(CONFIG.SECTORS).map(([k, v]) => ({ label: v, value: k })));
        return interaction.editReply({ content: "**اختر القطاع اللي تبي تشوف حضوره:**", components: [new ActionRowBuilder().addComponents(menu)] });
    }
    return interaction.editReply({ content: "🚫 هذا الزر لقادة ونواب القطاعات فقط." });
}
async function handleCommandAttendanceSectorSelect(interaction) {
    await interaction.deferUpdate();
    if (!isSeniorAdmin(interaction.user.id)) return interaction.editReply({ content: "🚫 ما عندك صلاحية.", components: [] });
    const key = interaction.values[0];
    if (!CONFIG.SECTORS[key]) return interaction.editReply({ content: "❌ قطاع غير صحيح.", components: [] });
    return sendSectorAttendance(interaction, key);
}
async function handleCommandDirectionButton(interaction) {
    const session = cmdSessions.get(interaction.user.id);
    if (!session) { await interaction.deferUpdate(); return interaction.editReply({ content: "⏱️ انتهت الجلسة، ابدأ من جديد.", components: [] }); }
    session.direction = interaction.customId === "cmd_dir_up" ? "up" : "down";
    const modal = new ModalBuilder().setCustomId("cmd_reason_modal").setTitle(session.direction === "up" ? "سبب الترقية" : "سبب التنزيل");
    const input = new TextInputBuilder().setCustomId("reason").setLabel("اكتب السبب").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(400);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}
async function handleCommandReasonModal(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const session = cmdSessions.get(interaction.user.id);
    if (!session) return interaction.editReply({ content: "⏱️ انتهت الجلسة، ابدأ من جديد بالأمر." });
    const reason = interaction.fields.getTextInputValue("reason");
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    const targetMember = await guild.members.fetch(session.targetId).catch(() => null);
    const target = await getOrCreatePersonnel(session.targetId, targetMember);
    if (session.targetId === interaction.user.id) {
        cmdSessions.delete(interaction.user.id);
        return interaction.editReply({ content: "🚫 ما تقدر ترقي أو تنزل نفسك." });
    }
    const idx = rankIndex(target.rank);
    const toRank = session.direction === "up" ? CONFIG.MILITARY_RANKS[idx + 1] : CONFIG.MILITARY_RANKS[idx - 1];
    const sectorKey = await getMemberSectorKey(session.targetId);
    const settings = await getSettings();
    const doc = await PromotionRequest.create({
        sector: sectorKey, sectorLabel: sectorKey ? CONFIG.SECTORS[sectorKey] : "غير محدد",
        targetDiscord: session.targetId, targetTag: targetMember?.user?.username || session.targetId,
        targetName: target.registeredName || targetMember?.displayName || session.targetId,
        fromRank: target.rank, toRank, direction: session.direction, reason: reason.trim(),
        requestedBy: interaction.user.id, requestedByTag: interaction.user.username,
    });
    cmdSessions.delete(interaction.user.id);
    await logEvent({ action: session.direction === "up" ? "طلب ترقية (بوت الأوامر)" : "طلب تنزيل (بوت الأوامر)", discordId: session.targetId, discordTag: doc.targetTag, actorId: interaction.user.id, actorTag: interaction.user.username, details: `${doc.fromRank} ← ${doc.toRank} — السبب: ${reason.trim()}` });
    notifyHighCommandOfPromotion(doc).catch(() => {});
    await interaction.editReply({ content: `✅ تم إرسال طلبك بخصوص ${target.registeredName || "الفرد"}، بانتظار موافقة القيادة العليا.` });
}
async function handleCommandWarnNoticeModal(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const session = cmdSessions.get(interaction.user.id);
    if (!session) return interaction.editReply({ content: "⏱️ انتهت الجلسة، ابدأ من جديد بالأمر." });
    if (session.targetId === interaction.user.id) {
        cmdSessions.delete(interaction.user.id);
        return interaction.editReply({ content: "🚫 ما تقدر تسوي هذا الإجراء على نفسك." });
    }
    const reason = interaction.fields.getTextInputValue("reason").trim();
    const kind = session.action === "warn" ? "warning" : "notice";
    cmdSessions.delete(interaction.user.id);
    try {
        const { p: result, dismissed } = await issueWarning({ targetDiscord: session.targetId, kind, reason, actorId: interaction.user.id, actorTag: interaction.user.username });
        dmMember(session.targetId, new EmbedBuilder()
            .setTitle(kind === "warning" ? "⚠️ تلقيت تحذيراً" : "📢 إشعار جديد")
            .setColor(kind === "warning" ? 0xef4444 : 0x60a5fa)
            .setDescription(reason)
            .setTimestamp()).catch(() => {});
        await interaction.editReply({ content: dismissed ? "⚠️ تم تسجيل التحذير — وتجاوز الفرد الحد المسموح فتم فصله تلقائياً." : (kind === "warning" ? "✅ تم تسجيل التحذير." : "✅ تم إرسال الإشعار.") });
    } catch (e) {
        await interaction.editReply({ content: `❌ ${e.message}` });
    }
}
async function handleCommandNoteModal(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const session = cmdSessions.get(interaction.user.id);
    if (!session) return interaction.editReply({ content: "⏱️ انتهت الجلسة، ابدأ من جديد بالأمر." });
    if (session.targetId === interaction.user.id) {
        cmdSessions.delete(interaction.user.id);
        return interaction.editReply({ content: "🚫 ما تقدر تسجل ملاحظة على نفسك." });
    }
    const text = interaction.fields.getTextInputValue("text").trim();
    cmdSessions.delete(interaction.user.id);
    const p = await pushNoteWithImage({ discord: session.targetId, text, image: null, actorId: interaction.user.id, actorTag: interaction.user.username });
    if (!p) return interaction.editReply({ content: "❌ هذا الفرد غير مسجل بالنظام أصلاً." });
    await logEvent({ action: "ملاحظة (بوت الأوامر)", discordId: session.targetId, discordTag: p.discordTag, actorId: interaction.user.id, actorTag: interaction.user.username, details: text });
    await interaction.editReply({ content: "✅ تم تسجيل الملاحظة." });
}
async function handleCommandPointsModal(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const session = cmdSessions.get(interaction.user.id);
    if (!session) return interaction.editReply({ content: "⏱️ انتهت الجلسة، ابدأ من جديد بالأمر." });
    const amountRaw = interaction.fields.getTextInputValue("amount").trim();
    const reason = interaction.fields.getTextInputValue("reason").trim();
    const delta = parseInt(amountRaw, 10);
    cmdSessions.delete(interaction.user.id);
    if (isNaN(delta) || delta === 0) return interaction.editReply({ content: "❌ حط عدد نقاط صحيح (مو صفر)." });
    const pr = await applyOrQueuePoints({ discordId: session.targetId, delta, actorId: interaction.user.id, actorTag: interaction.user.username, source: "manual", reason: `(بوت الأوامر) ${reason}` });
    if (pr.blocked) return interaction.editReply({ content: `🚫 ${pr.error}` });
    if (pr.skipped) return interaction.editReply({ content: "❌ حط عدد نقاط صحيح (مو صفر)." });
    await logEvent({ action: pr.applied ? "تعديل نقاط (بوت الأوامر)" : "طلب تعديل نقاط (بوت الأوامر)", discordId: session.targetId, actorId: interaction.user.id, actorTag: interaction.user.username, details: `${delta >= 0 ? "+" : ""}${delta} — ${reason}` });
    if (pr.applied) {
        await checkAutoPromotion(session.targetId);
        return interaction.editReply({ content: `✅ تم تعديل النقاط (${delta >= 0 ? "+" : ""}${delta}).` });
    }
    await interaction.editReply({ content: "✅ تم إرسال طلب النقاط، بانتظار موافقة الإدارة." });
}

async function handleLeaveCommand(interaction) {
    await interaction.deferReply();
    const settings = await getSettings();
    const embed = brandEmbed().setTitle("🌴 لوحة طلب الإجازة العسكرية").setDescription(
        "لكل عسكري رصيد إجازات ثابت (10 أيام)، ينقص مع كل إجازة تُقبل ولا يتجدد إلا بتعديل الإدارة يدوياً.\n\n" +
        `**الرتبة المطلوبة لاستخدام الزر:** ${settings.commandPermissions.leave} فما فوق`);
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("leave_start").setLabel("🌴 طلب إجازة").setStyle(ButtonStyle.Primary));
    await interaction.editReply({ embeds: [embed], components: [row] });
}
async function handleLeaveStart(interaction) {
    const settings = await getSettings();
    const p = await getOrCreatePersonnel(interaction.user.id, interaction.member);
    if (!rankAtLeast(p.rank, settings.commandPermissions.leave)) {
        return interaction.reply({ content: `🚫 رتبتك الحالية (${p.rank}) أقل من الرتبة المطلوبة (${settings.commandPermissions.leave}).`, ephemeral: true });
    }
    const modal = new ModalBuilder().setCustomId("leave_modal").setTitle("طلب إجازة عسكرية");
    const daysInput = new TextInputBuilder().setCustomId("days").setLabel("مدة الإجازة بالأيام").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3);
    const reasonInput = new TextInputBuilder().setCustomId("reason").setLabel("سبب الإجازة").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(400);
    modal.addComponents(new ActionRowBuilder().addComponents(daysInput), new ActionRowBuilder().addComponents(reasonInput));
    await interaction.showModal(modal);
}
async function handleLeaveModal(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const days = parseInt(interaction.fields.getTextInputValue("days"), 10);
    const reason = interaction.fields.getTextInputValue("reason").trim();
    if (!days || days < 1) return interaction.editReply({ content: "❌ حدد عدد أيام صحيح." });
    const p = await getOrCreatePersonnel(interaction.user.id, interaction.member);
    const balance = p.leaveBalance ?? CONFIG.DEFAULT_LEAVE_BALANCE ?? 10;
    if (days > balance) return interaction.editReply({ content: `❌ رصيدك الحالي ${balance} يوم فقط، ما يكفي لهذا الطلب.` });
    const pending = await LeaveRequest.countDocuments({ discord: interaction.user.id, status: "pending" });
    if (pending >= 2) return interaction.editReply({ content: "❌ عندك طلب إجازة قيد المراجعة بالفعل." });
    const active = await LeaveRequest.findOne({ discord: interaction.user.id, status: "approved" });
    if (active) return interaction.editReply({ content: "❌ عندك إجازة نشطة حالياً." });
    const sectorKey = await getMemberSectorKey(interaction.user.id);
    const settings = await getSettings();
    const leave = await LeaveRequest.create({
        discord: interaction.user.id, discordTag: interaction.user.username,
        name: p.registeredName || interaction.user.username, unit: p.unit, rank: p.rank,
        sector: sectorKey, sectorLabel: sectorKey ? CONFIG.SECTORS[sectorKey] : null, reason, days,
    });
    await logEvent({ action: "طلب إجازة (بوت الأوامر)", discordId: p.discord, discordTag: p.discordTag, actorId: p.discord, actorTag: interaction.user.username, details: `${days} يوم — ${reason}` });
    if (sectorKey) {
        await notifySectorLeadership(settings, sectorKey, brandEmbed().setTitle("🌴 طلب إجازة جديد بقطاعك")
            .addFields({ name: "الفرد", value: leave.name, inline: true }, { name: "المدة", value: `${days} يوم`, inline: true }, { name: "السبب", value: reason }).setTimestamp());
    }
    await interaction.editReply({ content: "✅ تم إرسال طلب إجازتك، بانتظار مراجعة الإدارة." });
}

async function handlePersonnelCommand(interaction) {
    await interaction.deferReply();
    const settings = await getSettings();
    const embed = brandEmbed().setTitle("🪪 لوحة تحكم الأفراد").setDescription(
        "من هنا يقدر أي عسكري يشوف بطاقته العسكرية أو مخالفاته الخاصة.\n\n" +
        `**الرتبة المطلوبة لاستخدام الأزرار:** ${settings.commandPermissions.personnel} فما فوق`);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("pers_card").setLabel("🪪 عرض البطاقة").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("pers_violations").setLabel("📋 مخالفاتي").setStyle(ButtonStyle.Secondary));
    await interaction.editReply({ embeds: [embed], components: [row] });
}
async function handlePersonnelCard(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const settings = await getSettings();
    const p = await getOrCreatePersonnel(interaction.user.id, interaction.member);
    if (!rankAtLeast(p.rank, settings.commandPermissions.personnel)) {
        return interaction.editReply({ content: `🚫 رتبتك الحالية (${p.rank}) أقل من الرتبة المطلوبة (${settings.commandPermissions.personnel}).` });
    }
    const embed = brandEmbed().setTitle("🪪 بطاقة عسكرية").setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
            { name: "الاسم", value: p.registeredName || interaction.user.username, inline: true },
            { name: "الرتبة", value: p.rank, inline: true },
            { name: "اليونت", value: p.unit || "-", inline: true },
            { name: "النقاط", value: String(p.points), inline: true },
            { name: "عدد الملاحظات", value: String(p.notes.length), inline: true },
            { name: "رصيد الإجازات", value: `${p.leaveBalance ?? 10} يوم`, inline: true },
        ).setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}
async function handlePersonnelViolations(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const settings = await getSettings();
    const p = await getOrCreatePersonnel(interaction.user.id, interaction.member);
    if (!rankAtLeast(p.rank, settings.commandPermissions.personnel)) {
        return interaction.editReply({ content: `🚫 رتبتك الحالية (${p.rank}) أقل من الرتبة المطلوبة (${settings.commandPermissions.personnel}).` });
    }
    const list = await Violation.find({ reporterDiscord: interaction.user.id }).sort({ createdAt: -1 }).limit(15);
    if (!list.length) return interaction.editReply({ content: "لا توجد لديك أي مخالفات مسجّلة حتى الآن." });
    const lines = list.map(v => {
        const s = v.status === "pending" ? "⏳ قيد المراجعة" : v.status === "approved" ? "✅ مقبولة" : "❌ مرفوضة";
        return `**${v.violationType}** — ${v.vehicle} — ${s}`;
    });
    await interaction.editReply({ embeds: [brandEmbed().setTitle("📋 مخالفاتي").setDescription(lines.join("\n")).setTimestamp()] });
}

async function handleAttendanceCommand(interaction) {
    await interaction.deferReply();
    const embed = brandEmbed().setTitle("🕒 لوحة تسجيل الحضور والانصراف").setDescription("لتسجيل الدخول والخروج من الخدمة — متاحة لجميع الأفراد بدون استثناء.");
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("att_in").setLabel("🟢 تسجيل دخول").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("att_out").setLabel("🔴 تسجيل خروج").setStyle(ButtonStyle.Danger));
    await interaction.editReply({ embeds: [embed], components: [row] });
}
async function handleAttendanceButton(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const wantIn = interaction.customId === "att_in";
    const p = await getOrCreatePersonnel(interaction.user.id, interaction.member);
    if (p.isBlocked) return interaction.editReply({ content: "🚫 حسابك موقوف — راجع الإدارة." });
    let st = await AttendanceStatus.findOne({ discord: interaction.user.id });
    if (!st) st = await AttendanceStatus.create({ discord: interaction.user.id, discordTag: interaction.user.username });
    if (wantIn && st.status === "in") return interaction.editReply({ content: "أنت مسجّل دخول بالفعل." });
    if (!wantIn && st.status === "out") return interaction.editReply({ content: "أنت مسجّل خروج بالفعل." });
    const sectorKey = await getMemberSectorKey(interaction.user.id);
    const settings = await getSettings();
    const now = new Date();
    const newType = wantIn ? "in" : "out";
    st.status = newType; st.discordTag = interaction.user.username;
    st.registeredName = p.registeredName; st.unit = p.unit; st.rank = p.rank;
    st.sectorLabel = sectorKey ? CONFIG.SECTORS[sectorKey] : st.sectorLabel;
    if (newType === "in") {
        const isNewDay = !st.lastCheckInAt || st.lastCheckInAt.toDateString() !== now.toDateString();
        st.lastCheckInAt = now; st.todayCount = isNewDay ? 1 : st.todayCount + 1;
    } else { st.lastCheckOutAt = now; }
    st.updatedAt = now;
    await st.save();
    await AttendanceLog.create({ discord: interaction.user.id, discordTag: interaction.user.username, registeredName: st.registeredName, unit: st.unit, rank: st.rank, type: newType, at: now });
    const { date, time, day } = arabicDateTimeParts(now);
    await interaction.editReply({ content: newType === "in" ? `🟢 تم تسجيل دخولك بنجاح — ${time} — ${day} ${date}` : `🔴 تم تسجيل خروجك بنجاح — ${time} — ${day} ${date}` });
    if (sectorKey) {
        const embed = brandEmbed().setTitle(newType === "in" ? "🟢 تسجيل دخول" : "🔴 تسجيل خروج")
            .setDescription(`الفرد **${st.registeredName || interaction.user.username}** ${newType === "in" ? "سجّل دخول" : "سجّل خروج"}.`)
            .addFields({ name: "التاريخ", value: date, inline: true }, { name: "الوقت", value: time, inline: true }, { name: "اليوم", value: day, inline: true }).setTimestamp();
        await notifySectorLeadership(settings, sectorKey, embed);
    }
}

const commands = [
    new SlashCommandBuilder()
        .setName("حظر")
        .setDescription("حظر عسكري من الموقع (كبار المسؤولين فقط)")
        .addUserOption(o => o.setName("اللاعب").setDescription("العسكري المطلوب حظره").setRequired(true))
        .addStringOption(o => o.setName("السبب").setDescription("سبب الحظر").setRequired(true)),

    new SlashCommandBuilder()
        .setName("فك-حظر")
        .setDescription("فك حظر عسكري عن الموقع (كبار المسؤولين فقط)")
        .addUserOption(o => o.setName("اللاعب").setDescription("العسكري المطلوب فك حظره").setRequired(true)),

    new SlashCommandBuilder().setName("اصدار-مخالفة").setDescription("فتح لوحة إصدار مخالفة عسكرية"),
    new SlashCommandBuilder().setName("تحكم-قياده").setDescription("فتح لوحة تحكم القيادة — ترقية/تنزيل عسكري"),
    new SlashCommandBuilder().setName("اصدار-اجازه").setDescription("فتح لوحة طلب إجازة عسكرية"),
    new SlashCommandBuilder().setName("تحكم-الافراد").setDescription("فتح لوحة تحكم الأفراد — بطاقة تعريف ومخالفات"),
    new SlashCommandBuilder().setName("لوحة-التسجيل").setDescription("فتح لوحة تسجيل الدخول والخروج من الخدمة"),
].map(c => c.toJSON());

async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(CONFIG.BOT_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, CONFIG.GUILD_ID), { body: commands });
        console.log("✅ تم تسجيل أوامر السلاش");
    } catch (e) {
        console.log("❌ خطأ بتسجيل الأوامر:", e);
    }
}

client.on("interactionCreate", async interaction => {
    try {
        // ── أوامر السلاش ─────────────────────────────────────────────
        if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;

            if (commandName === "حظر") {
                if (!isSeniorAdmin(interaction.user.id)) {
                    return interaction.reply({ content: "🚫 هذا الأمر مخصص لكبار المسؤولين فقط.", ephemeral: true });
                }
                const target = interaction.options.getUser("اللاعب");
                const reason = interaction.options.getString("السبب");
                await Personnel.findOneAndUpdate(
                    { discord: target.id },
                    {
                        $set: { isBlocked: true },
                        $push: { notes: { text: `🚫 حظر من الموقع — السبب: ${reason}`, addedBy: interaction.user.id, addedByTag: interaction.user.username } },
                        $setOnInsert: { discordTag: target.username },
                    },
                    { upsert: true }
                );
                await logEvent({ action: "حظر عسكري (أمر)", discordId: target.id, discordTag: target.username, actorId: interaction.user.id, actorTag: interaction.user.username, details: `السبب: ${reason}` });
                return interaction.reply({ content: `🚫 تم حظر <@${target.id}> من الموقع.\n📝 السبب: ${reason}`, ephemeral: true });
            }

            if (commandName === "فك-حظر") {
                if (!isSeniorAdmin(interaction.user.id)) {
                    return interaction.reply({ content: "🚫 هذا الأمر مخصص لكبار المسؤولين فقط.", ephemeral: true });
                }
                const target = interaction.options.getUser("اللاعب");
                const p = await Personnel.findOneAndUpdate({ discord: target.id }, { isBlocked: false }, { new: true });
                if (!p) return interaction.reply({ content: "❌ هذا اللاعب غير مسجل بالنظام أصلاً.", ephemeral: true });
                await logEvent({ action: "فك حظر عسكري (أمر)", discordId: target.id, discordTag: target.username, actorId: interaction.user.id, actorTag: interaction.user.username });
                return interaction.reply({ content: `✅ تم فك حظر <@${target.id}> من الموقع.`, ephemeral: true });
            }

            const cmdMap = {
                "اصدار-مخالفة": handleViolationCommand,
                "تحكم-قياده": handleCommandCommand,
                "اصدار-اجازه": handleLeaveCommand,
                "تحكم-الافراد": handlePersonnelCommand,
                "لوحة-التسجيل": handleAttendanceCommand,
            };
            const cmdFn = cmdMap[commandName];
            if (cmdFn) { await cmdFn(interaction); } return;
            return;
        }

        // ── أزرار ─────────────────────────────────────────────────────
        if (interaction.isButton()) {
            const id = interaction.customId;

            if (id.startsWith("approve_") || id.startsWith("reject_")) {
                const [action, vid] = id.split("_");
                const allowed = await isAnyAdmin(interaction.user.id);
                const isDiscordAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
                if (!allowed && !isDiscordAdmin) {
                    return interaction.reply({ content: "🚫 ما تملك صلاحية.", ephemeral: true });
                }
                const v = await Violation.findById(vid);
                if (!v || v.status !== "pending") {
                    return interaction.reply({ content: "هذه المخالفة تمت مراجعتها مسبقاً.", ephemeral: true });
                }
                if (action === "approve") {
                    await approveViolation(v, interaction.user.id, interaction.user.username);
                    return interaction.deferUpdate();
                }
                if (action === "reject") {
                    const modal = new ModalBuilder().setCustomId(`rejectmodal_${vid}`).setTitle("سبب الرفض");
                    const input = new TextInputBuilder()
                        .setCustomId("reason").setLabel("اكتب سبب رفض المخالفة")
                        .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500);
                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    return interaction.showModal(modal);
                }
                return;
            }

            const btnMap = {
                viol_start: handleViolationStart,
                cmd_start: handleCommandStart,
                cmd_warn_start: handleCommandWarnStart,
                cmd_note_start: handleCommandNoteStart,
                cmd_points_start: handleCommandPointsStart,
                cmd_notice_start: handleCommandNoticeStart,
                cmd_reception: handleCommandReceptionButton,
                cmd_att_view: handleCommandAttendanceView,
                cmd_dir_up: handleCommandDirectionButton,
                cmd_dir_down: handleCommandDirectionButton,
                leave_start: handleLeaveStart,
                pers_card: handlePersonnelCard,
                pers_violations: handlePersonnelViolations,
                att_in: handleAttendanceButton,
                att_out: handleAttendanceButton,
            };
            const btnFn = btnMap[id];
            if (btnFn) { await btnFn(interaction); } return;
            return;
        }

        // ── قوائم اختيار ─────────────────────────────────────────────
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === "viol_types_select") { await handleViolationTypesSelect(interaction); return; }
            if (interaction.customId === "viol_vehicle_select") { await handleViolationVehicleSelect(interaction); return; }
            if (interaction.customId === "cmd_att_sector_select") { await handleCommandAttendanceSectorSelect(interaction); return; }
            return;
        }
        if (interaction.isUserSelectMenu()) {
            if (interaction.customId === "cmd_target_select") { await handleCommandTargetSelect(interaction); return; }
            return;
        }

        // ── نماذج (Modals) ───────────────────────────────────────────
        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith("rejectmodal_")) {
                const vid = interaction.customId.split("_")[1];
                const reason = interaction.fields.getTextInputValue("reason");
                const v = await Violation.findById(vid);
                if (!v || v.status !== "pending") {
                    return interaction.reply({ content: "هذه المخالفة تمت مراجعتها مسبقاً.", ephemeral: true });
                }
                await rejectViolation(v, interaction.user.id, interaction.user.username, reason);
                return interaction.reply({ content: "✅ تم رفض المخالفة وحفظ السبب.", ephemeral: true });
            }
            if (interaction.customId === "cmd_reason_modal") { await handleCommandReasonModal(interaction); return; }
            if (interaction.customId === "cmd_warnnotice_modal") { await handleCommandWarnNoticeModal(interaction); return; }
            if (interaction.customId === "cmd_note_modal") { await handleCommandNoteModal(interaction); return; }
            if (interaction.customId === "cmd_points_modal") { await handleCommandPointsModal(interaction); return; }
            if (interaction.customId === "leave_modal") { await handleLeaveModal(interaction); return; }
            return;
        }
    } catch (e) {
        console.error("❌ خطأ بالتفاعل:", e);
        try {
            const msg = { content: "⚠️ صار خطأ غير متوقع، حاول مرة ثانية.", ephemeral: true };
            if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(() => interaction.followUp(msg));
            else await interaction.reply(msg);
        } catch (e2) { /* تجاهل */ }
    }
});

const activeVehicleSessions = new Set();
client.on("messageCreate", async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith("-")) return;
    const [cmd] = message.content.slice(1).trim().split(/\s+/);
    if (cmd !== "مركبات") return;

    const senior = isSeniorAdmin(message.author.id);
    if (!senior) return;
    if (activeVehicleSessions.has(message.author.id)) {
        return message.reply("عندك جلسة إضافة مركبات شغالة حالياً، أكملها أول.");
    }
    activeVehicleSessions.add(message.author.id);
    const filter = m => m.author.id === message.author.id;
    try {
        await message.reply(`كم عدد المركبات اللي تبي تضيفها؟ (الأقصى ${CONFIG.MAX_VEHICLES_ADD})`);
        const countCollected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
        const countMsg = countCollected.first();
        const count = parseInt(countMsg.content.trim());
        if (isNaN(count) || count < 1 || count > CONFIG.MAX_VEHICLES_ADD) {
            activeVehicleSessions.delete(message.author.id);
            return message.reply(`❌ الرقم غير صحيح. لازم يكون بين 1 و ${CONFIG.MAX_VEHICLES_ADD}.`);
        }
        countMsg.delete().catch(() => {});
        const added = [];
        for (let i = 1; i <= count; i++) {
            const p = await message.channel.send(`🚗 اكتب اسم المركبة رقم ${i} من ${count} (يمديك ترفق صورة مع الرسالة):`);
            const collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
            const nameMsg = collected.first();
            const name = nameMsg.content.trim();
            const photo = nameMsg.attachments.first()?.url || null;
            nameMsg.delete().catch(() => {});
            p.delete().catch(() => {});
            if (!name) { i--; continue; }
            try {
                await Vehicle.create({ name, photo, addedBy: message.author.id });
                added.push(name);
            } catch (e) {
                await message.channel.send(`⚠️ المركبة "${name}" موجودة مسبقاً، تم تجاوزها.`);
            }
        }
        await message.channel.send(`✅ تم إضافة ${added.length} مركبة:\n${added.map(n => `• ${n}`).join("\n") || "لا شيء"}`);
    } catch (e) {
        await message.channel.send("⏱️ انتهى الوقت، تم إلغاء العملية.");
    } finally {
        activeVehicleSessions.delete(message.author.id);
    }
});

client.once("ready", async () => {
    console.log(`🤖 البوت شغال: ${client.user.tag}`);
    botReady = true;
    await registerCommands();
});

if (CONFIG.BOT_TOKEN) {
    client.login(CONFIG.BOT_TOKEN).catch(e => console.log("❌ فشل تسجيل دخول البوت:", e.message));
} else {
    console.log("⚠️ BOT_TOKEN غير موجود — البوت لن يعمل، تحقق من متغيرات البيئة");
}

// ══════════════════════════════════════════════════════════════════════════
// 4) موقع الويب (Express)
// ══════════════════════════════════════════════════════════════════════════
const app = express();

// 🛠️ يمسك أي خطأ غير متوقع داخل أي راوت (Mongo, إلخ) ويرجّع JSON دايماً
// بدل ما يخلي الطلب "يعلّق" بدون رد، وهذا اللي كان يسبب بقاء "جاري التحميل..."
// معلّقة للأبد بأي صفحة (مخالفاتي، لوحة الإدارة، مخالفات معلّقة...)
["get", "post", "put", "delete", "patch"].forEach(method => {
    const original = app[method].bind(app);
    app[method] = (path, ...handlers) => {
        const wrapped = handlers.map(h => {
            if (typeof h !== "function") return h;
            return (req, res, next) => {
                Promise.resolve(h(req, res, next)).catch(err => {
                    console.error(`❌ خطأ في ${method.toUpperCase()} ${path}:`, err);
                    if (!res.headersSent) res.status(500).json({ error: "صار خطأ بالسيرفر، حاول مرة ثانية", ok: false });
                });
            };
        });
        return original(path, ...wrapped);
    };
});

app.use(express.json({ limit: "8mb" }));
app.use(session({ secret: CONFIG.SESSION_SECRET, resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: CONFIG.DISCORD_CLIENT_ID,
    clientSecret: CONFIG.DISCORD_CLIENT_SECRET,
    callbackURL: CONFIG.DISCORD_CALLBACK_URL,
    scope: ["identify", "guilds.members.read"],
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

app.get("/auth/discord", passport.authenticate("discord"));
app.get("/auth/discord/callback", (req, res, next) => {
    passport.authenticate("discord", (err, user) => {
        if (err) {
            // مثال شائع: "Failed to obtain access token" — يصير غالباً لو الرابط انفتح مرتين
            // أو تصفّح متصفح الجوال جهّز (prefetch) الرابط قبل الضغط عليه فعلياً، فينستهلك الكود قبل لا يوصل السيرفر
            console.error("❌ فشل تسجيل الدخول عبر ديسكورد:", err.message);
            console.error("🔎 تفاصيل إضافية للتشخيص — callbackURL المستخدم:", CONFIG.DISCORD_CALLBACK_URL);
            console.error("🔎 host اللي وصل بيه الطلب:", req.headers.host, "| x-forwarded-host:", req.headers["x-forwarded-host"], "| x-forwarded-proto:", req.headers["x-forwarded-proto"]);
            if (err.oauthError) console.error("🔎 err.oauthError:", JSON.stringify(err.oauthError));
            if (err.data) console.error("🔎 err.data (رد ديسكورد الفعلي):", err.data);
            if (err.body) console.error("🔎 err.body:", err.body);
            const isRateLimited = err.oauthError?.statusCode === 429 || (err.data && String(err.data).includes("1015"));
            return res.redirect(isRateLimited ? "/?loginError=ratelimit" : "/?loginError=1");
        }
        if (!user) return res.redirect("/");
        req.logIn(user, (loginErr) => {
            if (loginErr) { console.error("❌ فشل تسجيل الدخول (session):", loginErr.message); return res.redirect("/?loginError=1"); }
            res.redirect("/");
        });
    })(req, res, next);
});
app.get("/auth/logout", (req, res) => { req.logout(() => res.redirect("/")); });

function ensureAuth(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    isOpsCenterUser(req.user.id).then(allowed => {
        if (!allowed) return res.status(403).json({ error: "🚫 هذا الموقع (مركز العمليات) خاص بالإدارة فقط. استخدم بوت الأوامر بالديسكورد." });
        next();
    }).catch(err => {
        console.error("❌ خطأ بالتحقق من صلاحية دخول مركز العمليات:", err.message);
        res.status(500).json({ error: "صار خطأ بالسيرفر، حاول مرة ثانية" });
    });
}
// مركز العمليات صار خاص بالإدارة فقط — هذي كل الفئات المسموح لها الدخول للموقع
async function isOpsCenterUser(userId) {
    if (isSeniorAdmin(userId)) return true;
    const settings = await getSettings();
    if ((settings.adminList || []).includes(userId)) return true;
    if (isHighCommand(userId, settings)) return true;
    if (getSectorRole(userId, settings)) return true;
    if (getPersonnelOfficerSector(userId, settings)) return true;
    if (getAttendanceOfficerSector(userId, settings)) return true;
    if (getMPRole(userId, settings)) return true;
    if (isMPPersonnelOfficer(userId, settings)) return true;
    return false;
}

async function ensureSeniorAdmin(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    if (!isSeniorAdmin(req.user.id)) return res.status(403).json({ error: "هذا القسم لكبار المسؤولين فقط" });
    next();
}

async function ensureAntiDrugsRole(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    if (isSeniorAdmin(req.user.id)) return next();
    const check = await isMilitary(req.user.id);
    if (!check.isAntiDrugs) return res.status(403).json({ error: "تسجيل التقارير مخصص لمديرية مكافحة المخدرات فقط" });
    next();
}

async function ensureAnyAdmin(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    if (!isSeniorAdmin(req.user.id) && !settings.adminList.includes(req.user.id)) {
        return res.status(403).json({ error: "ليست لديك صلاحية" });
    }
    req.settings = settings;
    next();
}

// يسمح لقائد/نائب قطاع بالدخول لمساراته، وأيضاً لكبار المسؤولين (يتحكمون بكل شي)
// لو كان كبير مسؤول لازم يحدد القطاع اللي يبيه عبر ?sector= بالكويري
async function ensureSectorLeader(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    // لو الشخص فعلياً قائد/نائب قطاع حقيقي (حتى لو كبير مسؤول بنفس الوقت) نستخدم قطاعه الحقيقي مباشرة
    const realInfo = getSectorRole(req.user.id, settings);
    if (realInfo) {
        req.sectorInfo = realInfo;
        req.settings = settings;
        return next();
    }
    if (isSeniorAdmin(req.user.id)) {
        const q = (req.query.sector || req.body?.sector || "").trim();
        if (!q || !CONFIG.SECTORS[q]) return res.status(400).json({ error: "حدد قطاع صحيح" });
        req.sectorInfo = { sector: q, sectorLabel: CONFIG.SECTORS[q], role: "senior" };
        req.settings = settings;
        return next();
    }
    return res.status(403).json({ error: "هذا القسم لقادة ونواب القطاعات فقط" });
}

// قائد/نائب أي قطاع (الدوريات، أمن الطرق، مكافحة المخدرات) أو كبار المسؤولين يقدرون يقبلون/يرفضون مخالفات وتقارير قطاعهم
function canReviewSector(sectorInfo) {
    return true;
}

// يسمح لـ"مسؤول الأفراد" بالدخول لمساراته الخاصة، وكبار المسؤولين عبر ?sector= بالكويري
async function ensurePersonnelOfficer(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    // لو الشخص فعلياً مسؤول أفراد حقيقي (حتى لو كبير مسؤول بنفس الوقت) نستخدم قطاعه الحقيقي مباشرة
    const realInfo = getPersonnelOfficerSector(req.user.id, settings);
    if (realInfo) {
        req.sectorInfo = realInfo;
        return next();
    }
    if (isSeniorAdmin(req.user.id)) {
        const q = (req.query.sector || req.body?.sector || "").trim();
        if (!q || !CONFIG.SECTORS[q]) return res.status(400).json({ error: "حدد قطاع صحيح" });
        req.sectorInfo = { sector: q, sectorLabel: CONFIG.SECTORS[q] };
        return next();
    }
    return res.status(403).json({ error: "هذا القسم لمسؤول الأفراد فقط" });
}

// يسمح لـ"مسؤول التحضير" بالدخول لمساراته الخاصة، وكبار المسؤولين عبر ?sector= بالكويري
async function ensureAttendanceOfficer(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    const realInfo = getAttendanceOfficerSector(req.user.id, settings);
    if (realInfo) { req.sectorInfo = realInfo; return next(); }
    if (isSeniorAdmin(req.user.id)) {
        const q = (req.query.sector || req.body?.sector || "").trim();
        if (!q || !CONFIG.SECTORS[q]) return res.status(400).json({ error: "حدد قطاع صحيح" });
        req.sectorInfo = { sector: q, sectorLabel: CONFIG.SECTORS[q] };
        return next();
    }
    return res.status(403).json({ error: "هذا القسم لمسؤول التحضير فقط" });
}

// يسمح بعرض حضور القطاع لأي من: مسؤول التحضير، قائد القطاع، نائب القطاع، أو كبار المسؤولين (عبر ?sector=)
// هذي الصلاحية "عرض فقط" — تُستخدم بمعزل عن ensureSectorLeader/ensureAttendanceOfficer لأنها تجمع أكثر من دور بنفس الوقت
async function ensureAttendanceViewer(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    const leaderInfo = getSectorRole(req.user.id, settings); // قائد أو نائب
    if (leaderInfo) { req.sectorInfo = leaderInfo; return next(); }
    const attInfo = getAttendanceOfficerSector(req.user.id, settings);
    if (attInfo) { req.sectorInfo = attInfo; return next(); }
    if (isSeniorAdmin(req.user.id)) {
        const q = (req.query.sector || req.body?.sector || "").trim();
        if (!q || !CONFIG.SECTORS[q]) return res.status(400).json({ error: "حدد قطاع صحيح" });
        req.sectorInfo = { sector: q, sectorLabel: CONFIG.SECTORS[q] };
        return next();
    }
    return res.status(403).json({ error: "هذا القسم لقادة ونواب القطاعات ومسؤول التحضير فقط" });
}

// يسمح لقائد/نائب الشرطة العسكرية (أو كبار المسؤولين) بدخول لوحة الشرطة العسكرية كاملة
async function ensureMPLeader(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    const role = getMPRole(req.user.id, settings);
    if (role) { req.mpRole = role; req.settings = settings; return next(); }
    if (isSeniorAdmin(req.user.id)) { req.mpRole = "senior"; req.settings = settings; return next(); }
    return res.status(403).json({ error: "هذا القسم لقيادة الشرطة العسكرية فقط" });
}
// يسمح لمسؤول أفراد الشرطة العسكرية (أو كبار المسؤولين)
async function ensureMPPersonnelOfficer(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    if (isMPPersonnelOfficer(req.user.id, settings) || isSeniorAdmin(req.user.id)) { req.settings = settings; return next(); }
    return res.status(403).json({ error: "هذا القسم لمسؤول أفراد الشرطة العسكرية فقط" });
}
// يسمح لأي حامل رتبة الشرطة العسكرية (عادي أو قيادة) بدخول ميزات الملاحظة/الاستدعاء/تسجيل التقرير
async function ensureMPMember(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    if (isSeniorAdmin(req.user.id) || getMPRole(req.user.id, settings) || isMPPersonnelOfficer(req.user.id, settings)) {
        req.settings = settings; return next();
    }
    const has = await isMilitaryPoliceMember(req.user.id);
    if (!has) return res.status(403).json({ error: "هذا القسم لمنسوبي الشرطة العسكرية فقط" });
    req.settings = settings;
    next();
}

// يسمح لأعضاء القيادة العليا (أو كبار المسؤولين) بمراجعة طلبات الترقية/التنزيل
async function ensureHighCommand(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const settings = await getSettings();
    if (isHighCommand(req.user.id, settings) || isSeniorAdmin(req.user.id) || (settings.adminList || []).includes(req.user.id)) { req.settings = settings; return next(); }
    return res.status(403).json({ error: "هذا القسم للقيادة العليا فقط" });
}

// يتأكد أن الفرد المطلوب من أعضاء قطاع مسؤول الأفراد، وبرتبة رئيس رقباء فما دون (نطاق صلاحيته)
async function ensureJuniorInMySector(req, res, discordId) {
    const ids = await getSectorMemberIds(req.sectorInfo.sector);
    if (ids === null) { res.status(503).json({ error: "تعذر التحقق من أعضاء القطاع حالياً، حاول مرة ثانية بعد شوي" }); return null; }
    if (!ids.includes(discordId)) { res.status(403).json({ error: "هذا الشخص ليس من أعضاء قطاعك" }); return null; }
    const p = await Personnel.findOne({ discord: discordId });
    if (!p) { res.status(404).json({ error: "غير موجود" }); return null; }
    if (!isJuniorRank(p.rank)) { res.status(403).json({ error: "صلاحيتك تشمل رتبة رئيس رقباء وتحت فقط" }); return null; }
    return p;
}

// إحصائيات سريعة تظهر فوراً بالصفحة الرئيسية لمركز العمليات — كل شي بانتظار مراجعة الإدارة
app.get("/api/ops-stats", ensureAuth, async (req, res) => {
    const [pendingViolations, pendingLeaves, pendingPromotions, checkedInNow] = await Promise.all([
        Violation.countDocuments({ status: "pending" }),
        LeaveRequest.countDocuments({ status: "pending" }),
        PromotionRequest.countDocuments({ status: "pending" }),
        AttendanceStatus.countDocuments({ status: "in" }),
    ]);
    res.json({ pendingViolations, pendingLeaves, pendingPromotions, checkedInNow });
});

app.get("/api/me", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    const senior = isSeniorAdmin(req.user.id);
    // موظف بالإدارة عبر "توظيف الإدارة" يصير مصرح له دخول الموقع تلقائياً، نفس كبار المسؤولين
    const hiredAdmin = !senior && (settings.adminList || []).includes(req.user.id);
    const bypassGates = senior || hiredAdmin;
    let isAntiDrugs = false;
    await autoEndActiveLeave(req.user.id).catch(e => console.error("❌ فشل فحص إنهاء الإجازة التلقائي:", e.message));

    // كبار المسؤولين وموظفو الإدارة يدخلون دائماً حتى لو كان التسجيل مقفل أو الموقع بالصيانة أو ماعندهم رتبة عسكرية
    if (!bypassGates) {
        if (settings.disableLogin) {
            return res.json({ blocked: true, reason: "🔒 تسجيل الدخول مغلق حالياً من قبل الإدارة العليا." });
        }
        if (settings.isMaintenance) {
            return res.json({ blocked: true, maintenance: true, reason: "🚨 الموقع مغلق حالياً للصيانة العامة بطلب من الإدارة العليا." });
        }
        const check = await isMilitary(req.user.id);
        if (!check.ok) {
            return res.json({ blocked: true, reason: "هذا الموقع مخصص لمنسوبي الجهات العسكرية فقط" });
        }
        isAntiDrugs = !!check.isAntiDrugs;
    } else {
        // نتحقق من الرول حتى لو كبير مسؤول/موظف إدارة، فقط عشان نعرف إذا يشوف واجهة تقارير مكافحة المخدرات
        const check = await isMilitary(req.user.id);
        isAntiDrugs = !!check.isAntiDrugs;
    }

    let p = await Personnel.findOne({ discord: req.user.id });
    if (!p) p = await Personnel.create({ discord: req.user.id, discordTag: req.user.username, leaveBalance: settings.leaveBalanceDefault ?? CONFIG.DEFAULT_LEAVE_BALANCE });
    p = await autoUnblockIfExpired(p); // فك الإيقاف تلقائيًا لو انتهت مدة عقوبة تحذير مؤقتة

    // مزامنة الرتبة تلقائياً من رول الديسكورد لو كبار المسؤولين عبّوا آيديات رتب بالإعدادات
    const detectedRank = await detectRankFromRoles(req.user.id, settings);
    if (detectedRank && detectedRank !== p.rank) {
        const oldRank = p.rank;
        p.rank = detectedRank;
        await p.save();
        await logEvent({ action: "مزامنة رتبة تلقائية من الرول", discordId: p.discord, discordTag: p.discordTag, actorId: "system", actorTag: "النظام", details: `${oldRank || "-"} ← ${detectedRank} (حسب رول الديسكورد)` });
    }

    if (!senior && p.isBlocked) {
        if (p.isDismissed) {
            return res.json({ blocked: true, reason: "🚫 تم فصلك نهائيًا من الخدمة العسكرية بسبب تجاوز عدد التحذيرات المسموح." });
        }
        if (p.blockUntil) {
            return res.json({ blocked: true, reason: `🚫 موقوف مؤقتًا حتى ${p.blockUntil.toLocaleString('ar')} — نتيجة عقوبة تحذير.` });
        }
        return res.json({ blocked: true, reason: "🚫 تم إيقاف حسابك من الموقع من قبل الإدارة." });
    }

    const isAdmin = senior || settings.adminList.includes(req.user.id);
    const progress = await rankProgress(p, settings);
    // نجيب صلاحية القيادة وصلاحية مسؤول الأفراد بشكل مستقل — حتى لو الشخص كبير مسؤول
    // عشان لو عنده أكثر من صلاحية بنفس الوقت (مثلاً: كبير مسؤول + مسؤول أفراد) تطلع له كل الأزرار
    const sectorInfo = getSectorRole(req.user.id, settings);
    if (sectorInfo) {
        const sec = (settings.sectorLeadership && settings.sectorLeadership[sectorInfo.sector]) || {};
        sectorInfo.personnelOfficerId = sec.personnelOfficerId || null;
        sectorInfo.personnelOfficerName = sec.personnelOfficerName || null;
        sectorInfo.attendanceOfficerId = sec.attendanceOfficerId || null;
        sectorInfo.attendanceOfficerName = sec.attendanceOfficerName || null;
        if (sectorInfo.role === "commander" || sectorInfo.role === "deputy") {
            const lastCheck = agingNoteCheckThrottle.get(sectorInfo.sector);
            if (!lastCheck || Date.now() - lastCheck > AGING_CHECK_COOLDOWN_MS) {
                agingNoteCheckThrottle.set(sectorInfo.sector, Date.now());
                checkAgingNotesForSector(sectorInfo.sector, sectorInfo.sectorLabel, settings).catch(e => console.error("❌ فشل فحص الملاحظات القديمة:", e.message));
            }
        }
    }
    const personnelOfficerInfo = getPersonnelOfficerSector(req.user.id, settings);
    const attendanceOfficerInfo = getAttendanceOfficerSector(req.user.id, settings);

    // ── الشرطة العسكرية ──
    const mpRole = getMPRole(req.user.id, settings); // "commander" | "deputy" | null
    const mpPersonnelOfficer = isMPPersonnelOfficer(req.user.id, settings);
    let isMilitaryPolice = !!(mpRole || mpPersonnelOfficer || senior);
    if (!isMilitaryPolice) isMilitaryPolice = await isMilitaryPoliceMember(req.user.id);
    const mpInfo = mpRole ? {
        role: mpRole,
        label: mpRole === "commander" ? settings.mpLeadership?.commanderName : settings.mpLeadership?.deputyName,
    } : null;
    const summon = (p.summon && p.summon.status !== "none") ? {
        status: p.summon.status, mode: p.summon.mode, timeLabel: p.summon.timeLabel,
        unlockAt: p.summon.unlockAt, enteredAt: p.summon.enteredAt,
    } : null;

    res.json({
        blocked: false,
        discordId: req.user.id,
        discordTag: req.user.username,
        avatar: req.user.avatar ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png` : null,
        registeredName: p.registeredName,
        unit: p.unit,
        rank: p.rank,
        points: p.points,
        leaveBalance: p.leaveBalance ?? CONFIG.DEFAULT_LEAVE_BALANCE,
        notes: p.notes,
        isBlocked: p.isBlocked,
        isAdmin,
        isSeniorAdmin: senior,
        isAntiDrugs,
        sectorInfo,
        personnelOfficerInfo,
        attendanceOfficerInfo,
        mpInfo,
        mpPersonnelOfficer,
        isMilitaryPolice,
        isHighCommand: isHighCommand(req.user.id, settings),
        summon,
        summonLocked: isSummonBlocking(p),
        maintenance: settings.isMaintenance,
        violationsDisabled: settings.disableViolations,
        nextRank: progress.nextRank,
        pointsThreshold: progress.threshold,
        pointsRemaining: progress.remaining,
    });
});

app.post("/api/profile/setup", ensureAuth, async (req, res) => {
    const { name, unit } = req.body;
    if (!name || !unit) return res.status(400).json({ error: "أكمل الاسم واليونت" });
    const p = await Personnel.findOneAndUpdate(
        { discord: req.user.id }, { registeredName: name, unit }, { new: true, upsert: true }
    );
    res.json({ ok: true, registeredName: p.registeredName, unit: p.unit });
});

// ══════════════════════════════════════════════════════════════════════════
// نظام البصمة/التحضير — صار تسجيل الحضور والانصراف كامل عن طريق أمر البوت /لوحة-التسجيل فقط
// (لا يوجد تسجيل حضور ذاتي بالموقع بعد الآن — الموقع صار للإدارة فقط)
// ══════════════════════════════════════════════════════════════════════════

app.get("/api/violations/meta", ensureAuth, async (req, res) => {
    const vehicles = await Vehicle.find().sort({ name: 1 });
    res.json({ types: CONFIG.VIOLATION_TYPES, vehicles: vehicles.map(v => ({ name: v.name, photo: v.photo })) });
});

const VIOLATION_COOLDOWN_MS = 5 * 1000;
const violationLocks = new Set(); // يمنع إرسال مخالفتين بنفس اللحظة من نفس الحساب

app.post("/api/violations/submit", ensureAuth, async (req, res) => {
    if (violationLocks.has(req.user.id)) {
        return res.status(429).json({ error: "في مخالفة قيد الإرسال حالياً على حسابك، انتظر لحظة." });
    }
    violationLocks.add(req.user.id);
    try {
        const settings = await getSettings();
        if (settings.disableViolations) return res.status(403).json({ error: "تسجيل المخالفات مغلق حالياً" });
        const p = await Personnel.findOne({ discord: req.user.id });
        if (!p || !p.registeredName || !p.unit) return res.status(400).json({ error: "أكمل بياناتك (الاسم واليونت) أولاً" });
        if (p.isBlocked) return res.status(403).json({ error: "أنت موقوف عن تسجيل مخالفات جديدة" });
        if (isSummonBlocking(p)) return res.status(403).json({ error: "🚨 عليك استدعاء نشط من الشرطة العسكرية، لازم تدخل الاستدعاء أولاً قبل أي إجراء بالموقع" });

        // يمنع تسجيل مخالفة جديدة إذا وصل عدد المخالفات/التقارير المعلّقة له للحد الأقصى
        const pendingCount = await Violation.countDocuments({ reporterDiscord: req.user.id, status: "pending" });
        if (pendingCount >= CONFIG.MAX_PENDING_ITEMS) {
            return res.status(429).json({ error: `عندك ${CONFIG.MAX_PENDING_ITEMS} مخالفات/تقارير معلّقة بانتظار المراجعة، لازم الإدارة تقبل أو ترفض وحدة منها قبل تسجيل مخالفة جديدة.` });
        }

        const last = await Violation.findOne({ reporterDiscord: req.user.id }).sort({ createdAt: -1 });
        if (last) {
            const elapsed = Date.now() - last.createdAt.getTime();
            if (elapsed < VIOLATION_COOLDOWN_MS) {
                const wait = Math.ceil((VIOLATION_COOLDOWN_MS - elapsed) / 1000);
                return res.status(429).json({ error: `لازم تنتظر ${wait} ثانية قبل تسجيل مخالفة جديدة`, cooldown: wait });
            }
        }

        const { violationType, vehicle, photo } = req.body;
        if (!violationType || !vehicle) return res.status(400).json({ error: "أكمل نوع المخالفة والمركبة" });
        if (!photo) return res.status(400).json({ error: "لازم ترفق صورة المخالفة" });
        if (photo && photo.length > CONFIG.MAX_PHOTO_MB * 1024 * 1024 * 1.4) {
            return res.status(400).json({ error: `الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB` });
        }
        const vehicleDoc = await Vehicle.findOne({ name: vehicle });

        const v = await Violation.create({
            reporterDiscord: req.user.id, reporterTag: req.user.username,
            reporterName: p.registeredName, reporterUnit: p.unit,
            violationType, vehicle, vehiclePhoto: vehicleDoc?.photo || null,
            plateNumber: generatePlate(), status: "pending",
        });
        await postViolationToChannel(v, photo);
        res.json({ ok: true, violation: v });
    } finally {
        violationLocks.delete(req.user.id);
    }
});

app.get("/api/violations/mine", ensureAuth, async (req, res, next) => {
    try {
        // نشيل الصورة الثقيلة (base64) *قبل* الفرز — لو فرزنا والصورة لسا موجودة يتجاوز حد الذاكرة المسموح لفرز MongoDB ويطيح بخطأ
        const list = await Violation.aggregate([
            { $match: { reporterDiscord: req.user.id } },
            { $addFields: { hasPhoto: { $or: [{ $ifNull: ["$photo", false] }, { $ifNull: ["$photoMessageId", false] }] } } },
            { $project: { photo: 0 } },
            { $sort: { createdAt: -1 } },
            { $limit: 500 }
        ]);
        res.json({ list });
    } catch (e) {
        console.error("❌ فشل تحميل مخالفاتي:", e);
        res.status(500).json({ error: "تعذر تحميل مخالفاتك، حاول مرة ثانية" });
    }
});

// جلب صورة مخالفة واحدة عند الطلب فقط (مو ضمن القائمة) — يسرّع تحميل القوائم
const photoUrlCache = new Map(); // violationId -> { url, fetchedAt } — نتجنب نرجع نسأل ديسكورد كل ضغطة
const PHOTO_CACHE_MS = 20 * 60 * 60 * 1000; // روابط مرفقات ديسكورد صالحة تقريباً 24 ساعة، نجدد قبل لا تنتهي
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
    ]);
}
app.get("/api/violations/:id/photo", ensureAuth, async (req, res) => {
    try {
        const v = await Violation.findById(req.params.id).select("photo photoChannelId photoMessageId reporterDiscord");
        if (!v) return res.status(404).json({ error: "المخالفة غير موجودة" });
        const settings = await getSettings();
        const allowed = v.reporterDiscord === req.user.id || isSeniorAdmin(req.user.id) || settings.adminList.includes(req.user.id)
            || !!getSectorRole(req.user.id, settings) || !!getPersonnelOfficerSector(req.user.id, settings);
        if (!allowed) return res.status(403).json({ error: "غير مصرح" });

        // الصورة محفوظة كمرفق برسالة ديسكورد — نجيب رابطها الطازج (روابط مرفقات ديسكورد تنتهي صلاحيتها بعد فترة)
        if (v.photoChannelId && v.photoMessageId) {
            const cacheKey = v._id.toString();
            const cached = photoUrlCache.get(cacheKey);
            if (cached && (Date.now() - cached.fetchedAt) < PHOTO_CACHE_MS) {
                return res.json({ photo: cached.url });
            }
            try {
                // مهلة 10 ثواني بدل ما ننتظر إعادة محاولات ديسكورد التلقائية اللي ممكن توصل دقيقتين
                const channel = client.channels.cache.get(v.photoChannelId) || await withTimeout(client.channels.fetch(v.photoChannelId), 10000);
                const msg = await withTimeout(channel.messages.fetch(v.photoMessageId), 10000);
                const att = msg.attachments.first();
                if (att) {
                    photoUrlCache.set(cacheKey, { url: att.url, fetchedAt: Date.now() });
                    return res.json({ photo: att.url });
                }
            } catch (e) {
                console.error("❌ فشل جلب صورة المخالفة من ديسكورد:", e.message);
                if (!v.photo) return res.status(503).json({ error: "تعذر جلب الصورة من ديسكورد حالياً، حاول مرة ثانية بعد شوي" });
                // نكمل تحت لو فيه صورة احتياطية بقاعدة البيانات
            }
        }
        res.json({ photo: v.photo || null });
    } catch (e) {
        console.error("❌ فشل تحميل صورة المخالفة:", e);
        res.status(500).json({ error: "تعذر تحميل الصورة" });
    }
});

// صورة ملاحظة معيّنة — محفوظة كمرفق برسالة بقناة الملاحظات (نفس فكرة صور المخالفات)
app.get("/api/notes/:discord/:noteId/photo", ensureAuth, async (req, res) => {
    try {
        const p = await Personnel.findOne({ discord: req.params.discord }, { notes: 1 });
        if (!p) return res.status(404).json({ error: "غير موجود" });
        const note = p.notes.id(req.params.noteId);
        if (!note) return res.status(404).json({ error: "الملاحظة غير موجودة" });
        const settings = await getSettings();
        const allowed = req.params.discord === req.user.id || isSeniorAdmin(req.user.id) || settings.adminList.includes(req.user.id)
            || !!getSectorRole(req.user.id, settings) || !!getPersonnelOfficerSector(req.user.id, settings)
            || !!getMPRole(req.user.id, settings) || isMPPersonnelOfficer(req.user.id, settings) || (await isMilitaryPoliceMember(req.user.id));
        if (!allowed) return res.status(403).json({ error: "غير مصرح" });

        if (note.imageChannelId && note.imageMessageId) {
            const cacheKey = "note:" + note._id.toString();
            const cached = photoUrlCache.get(cacheKey);
            if (cached && (Date.now() - cached.fetchedAt) < PHOTO_CACHE_MS) {
                return res.json({ photo: cached.url });
            }
            try {
                const channel = client.channels.cache.get(note.imageChannelId) || await withTimeout(client.channels.fetch(note.imageChannelId), 10000);
                const msg = await withTimeout(channel.messages.fetch(note.imageMessageId), 10000);
                const att = msg.attachments.first();
                if (att) {
                    photoUrlCache.set(cacheKey, { url: att.url, fetchedAt: Date.now() });
                    return res.json({ photo: att.url });
                }
            } catch (e) {
                console.error("❌ فشل جلب صورة الملاحظة من ديسكورد:", e.message);
                if (!note.image) return res.status(503).json({ error: "تعذر جلب الصورة من ديسكورد حالياً، حاول مرة ثانية بعد شوي" });
            }
        }
        res.json({ photo: note.image || null });
    } catch (e) {
        console.error("❌ فشل تحميل صورة الملاحظة:", e);
        res.status(500).json({ error: "تعذر تحميل الصورة" });
    }
});

// حذف ملاحظة نهائياً — لقادة/نواب القطاعات أو كبار المسؤولين (يُستخدم من إشعار مراجعة الملاحظات القديمة)
app.delete("/api/notes/:discord/:noteId", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    if (!getSectorRole(req.user.id, settings) && !isSeniorAdmin(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const p = await Personnel.findOneAndUpdate({ discord: req.params.discord }, { $pull: { notes: { _id: req.params.noteId } } }, { new: true });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "حذف ملاحظة", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: "حذف من مراجعة الملاحظات القديمة" });
    res.json({ ok: true });
});
// تمديد مهلة مراجعة الملاحظة 5 أيام إضافية
app.post("/api/notes/:discord/:noteId/extend-review", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    if (!getSectorRole(req.user.id, settings) && !isSeniorAdmin(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    const p = await Personnel.findOne({ discord: req.params.discord });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    const note = p.notes.id(req.params.noteId);
    if (!note) return res.status(404).json({ error: "الملاحظة غير موجودة" });
    note.reviewDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    note.reviewNotified = false;
    await p.save();
    await logEvent({ action: "تمديد مراجعة ملاحظة", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: "تمديد 5 أيام" });
    res.json({ ok: true });
});

// ── مسارات الإداري المعيَّن (قبول/رفض فقط) ──────────────────────────────
app.get("/api/admin/pending", ensureAnyAdmin, async (req, res) => {
    // نشيل الصورة قبل الفرز عشان ما يتجاوز الفرز حد الذاكرة
    const list = await Violation.aggregate([
        { $match: { status: "pending" } },
        { $addFields: { hasPhoto: { $or: [{ $ifNull: ["$photo", false] }, { $ifNull: ["$photoMessageId", false] }] } } },
        { $project: { photo: 0 } },
        { $sort: { createdAt: 1 } }
    ]);
    res.json({ list });
});

app.post("/api/admin/violations/:id/approve", ensureAnyAdmin, async (req, res) => {
    const v = await Violation.findById(req.params.id);
    if (!v || v.status !== "pending") return res.status(404).json({ error: "غير موجودة" });
    const r = await approveViolation(v, req.user.id, req.user.username);
    if (r.blocked) return res.status(403).json({ error: "على هذا العسكري استدعاء نشط، لا يمكن قبول مخالفاته حتى ينتهي الاستدعاء" });
    res.json({ ok: true });
});

app.post("/api/admin/violations/:id/reject", ensureAnyAdmin, async (req, res) => {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: "لازم تكتب سبب الرفض" });
    const v = await Violation.findById(req.params.id);
    if (!v || v.status !== "pending") return res.status(404).json({ error: "غير موجودة" });
    const r = await rejectViolation(v, req.user.id, req.user.username, reason.trim());
    if (r.blocked) return res.status(403).json({ error: "على هذا العسكري استدعاء نشط، لا يمكن رفض مخالفاته حتى ينتهي الاستدعاء" });
    res.json({ ok: true });
});

// ── طلبات النقاط المعلّقة (أي نقاط منحها/خصمها شخص غير إداري — قائد/نائب قطاع، مسؤول أفراد، قيادة شرطة عسكرية...) ──
// متاحة لأي إداري (كبير مسؤول أو من قائمة الإدارة)
app.get("/api/admin/points-requests/pending", ensureAnyAdmin, async (req, res) => {
    const list = await PointsRequest.find({ status: "pending" }).sort({ createdAt: 1 }).limit(200);
    res.json({ list });
});
app.get("/api/admin/points-requests/reviewed", ensureAnyAdmin, async (req, res) => {
    const list = await PointsRequest.find({ status: { $ne: "pending" } }).sort({ reviewedAt: -1 }).limit(200);
    res.json({ list });
});
app.post("/api/admin/points-requests/:id/approve", ensureAnyAdmin, async (req, res) => {
    const r = await PointsRequest.findById(req.params.id);
    if (!r || r.status !== "pending") return res.status(404).json({ error: "غير موجود أو تمت مراجعته" });
    r.status = "approved"; r.reviewedBy = req.user.id; r.reviewedByTag = req.user.username; r.reviewedAt = new Date();
    await r.save();
    const p = await Personnel.findOneAndUpdate({ discord: r.targetDiscord }, { $inc: { points: r.delta } }, { new: true });
    if (p && p.points < 0) { p.points = 0; await p.save(); }
    if (p) await checkAutoPromotion(r.targetDiscord);
    await logEvent({ action: "قبول طلب نقاط", discordId: r.targetDiscord, discordTag: r.targetTag, actorId: req.user.id, actorTag: req.user.username, details: `${r.delta >= 0 ? "+" : ""}${r.delta} — ${r.reason} (طالب الطلب: ${r.requestedByTag})` });
    if (p) dmMember(r.targetDiscord, new EmbedBuilder()
        .setTitle(r.delta >= 0 ? "✅ تمت الموافقة على نقاطك" : "⚠️ تم تأكيد خصم نقاط")
        .setColor(r.delta >= 0 ? 0x22c55e : 0xef4444)
        .addFields({ name: "التفاصيل", value: r.reason || "-" }, { name: "النقاط", value: `${r.delta >= 0 ? "+" : ""}${r.delta}` })
        .setTimestamp()).catch(() => {});
    res.json({ ok: true, personnel: p });
});
app.post("/api/admin/points-requests/:id/reject", ensureAnyAdmin, async (req, res) => {
    const { reason } = req.body;
    const r = await PointsRequest.findById(req.params.id);
    if (!r || r.status !== "pending") return res.status(404).json({ error: "غير موجود أو تمت مراجعته" });
    r.status = "rejected"; r.rejectReason = (reason || "").trim() || null; r.reviewedBy = req.user.id; r.reviewedByTag = req.user.username; r.reviewedAt = new Date();
    await r.save();
    await logEvent({ action: "رفض طلب نقاط", discordId: r.targetDiscord, discordTag: r.targetTag, actorId: req.user.id, actorTag: req.user.username, details: `${r.delta >= 0 ? "+" : ""}${r.delta} — ${r.reason} — رُفض من ${req.user.username}${reason ? " — السبب: " + reason.trim() : ""}` });
    res.json({ ok: true });
});

// ── صفحة بحث الأفراد بلوحة كبار المسؤولين/الإدارة — بديل تبويبات القطاعات/الحسابات/المركبات/الملاحظات ──
// بحث فقط (مو قائمة كاملة) + إجراءات فورية بدون موافقة لأنهم أصلاً إداريين: ترقية/تنزيل/نقاط/تحذير
app.get("/api/admin/personnel/search", ensureAnyAdmin, async (req, res) => {
    const q = (req.query.q || "").trim();
    if (q.length < 2) return res.json({ list: [] });
    const filter = { $or: [{ registeredName: new RegExp(q, "i") }, { unit: new RegExp(q, "i") }, { discordTag: new RegExp(q, "i") }, { discord: q }] };
    const list = await Personnel.find(filter, { "notes.image": 0 }).sort({ createdAt: -1 }).limit(15);
    res.json({ list });
});
app.post("/api/admin/personnel/:discord/rank-direct", ensureAnyAdmin, async (req, res) => {
    if (req.params.discord === req.user.id) return res.status(403).json({ error: "ما تقدر ترقي أو تنزل نفسك." });
    const { direction } = req.body;
    if (!["up", "down"].includes(direction)) return res.status(400).json({ error: "حدد الاتجاه" });
    const p = await Personnel.findOne({ discord: req.params.discord });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    const idx = rankIndex(p.rank);
    const newIdx = direction === "up" ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= CONFIG.MILITARY_RANKS.length) return res.status(400).json({ error: "لا توجد رتبة أعلى/أدنى" });
    const fromRank = p.rank;
    p.rank = CONFIG.MILITARY_RANKS[newIdx];
    p.points = 0;
    await p.save();
    await logEvent({ action: direction === "up" ? "ترقية مباشرة (بحث الأفراد)" : "تنزيل مباشر (بحث الأفراد)", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: `${fromRank} ← ${p.rank}` });
    dmMember(p.discord, new EmbedBuilder().setTitle(direction === "up" ? "⬆️ تمت ترقيتك" : "⬇️ تم تنزيل رتبتك").setColor(direction === "up" ? 0x22c55e : 0xef4444).addFields({ name: "الرتبة الجديدة", value: p.rank }).setTimestamp()).catch(() => {});
    res.json({ ok: true, personnel: p });
});
app.post("/api/admin/personnel/:discord/points-direct", ensureAnyAdmin, async (req, res) => {
    const { delta, reason } = req.body;
    const d = parseInt(delta, 10);
    if (isNaN(d) || d === 0) return res.status(400).json({ error: "حط عدد نقاط صحيح" });
    const pr = await applyOrQueuePoints({ discordId: req.params.discord, delta: d, actorId: req.user.id, actorTag: req.user.username, source: "manual", reason: (reason || "").trim() || "تعديل نقاط (بحث الأفراد)" });
    if (pr.blocked) return res.status(403).json({ error: pr.error });
    if (!pr.applied) return res.status(500).json({ error: "تعذر تنفيذ العملية" });
    await checkAutoPromotion(req.params.discord);
    await logEvent({ action: "تعديل نقاط مباشر (بحث الأفراد)", discordId: req.params.discord, actorId: req.user.id, actorTag: req.user.username, details: `${d >= 0 ? "+" : ""}${d} — ${(reason || "").trim()}` });
    res.json({ ok: true, personnel: pr.personnel });
});
app.post("/api/admin/personnel/:discord/warning-direct", ensureAnyAdmin, async (req, res) => {
    if (req.params.discord === req.user.id) return res.status(403).json({ error: "ما تقدر تسوي هذا الإجراء على نفسك." });
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: "اكتب السبب" });
    try {
        const { p, dismissed } = await issueWarning({ targetDiscord: req.params.discord, kind: "warning", reason: reason.trim(), actorId: req.user.id, actorTag: req.user.username });
        dmMember(req.params.discord, new EmbedBuilder().setTitle("⚠️ تلقيت تحذيراً").setColor(0xef4444).setDescription(reason.trim()).setTimestamp()).catch(() => {});
        res.json({ ok: true, personnel: p, dismissed });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// ── مسارات كبار المسؤولين فقط ────────────────────────────────────────────
app.get("/api/senior/personnel", ensureSeniorAdmin, async (req, res) => {
    const q = (req.query.q || "").trim();
    const filter = q ? { $or: [{ registeredName: new RegExp(q, "i") }, { unit: new RegExp(q, "i") }, { discordTag: new RegExp(q, "i") }] } : {};
    const list = await Personnel.find(filter, { "notes.image": 0 }).sort({ createdAt: -1 }).limit(100);
    res.json({ list });
});

app.post("/api/senior/personnel/:discord/note", ensureSeniorAdmin, async (req, res) => {
    const { text, image } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "اكتب الملاحظة" });
    if (!image) return res.status(400).json({ error: "لازم ترفق صورة مع الملاحظة" });
    if (image.length > CONFIG.MAX_PHOTO_MB * 1024 * 1024 * 1.4) return res.status(400).json({ error: `الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB` });
    const p = await pushNoteWithImage({ discord: req.params.discord, text: text.trim(), image, actorId: req.user.id, actorTag: req.user.username });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "إضافة ملاحظة", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: `على ${p.registeredName || p.discord}: ${text.trim()}` });
    res.json({ ok: true, notes: p.notes });
});

// ── تحذير / إشعار — مع نظام تصعيد للتحذيرات (أول / ثاني / ثالث فما فوق) ──
// تطبّق أثر العقوبة فعليًا على وثيقة العسكري (نقاط / رتبة / إيقاف مؤقت / فصل نهائي)
function applyPenaltyEffect(p, penalty) {
    switch (penalty.type) {
        case "points":
            p.points = Math.max(0, p.points - penalty.value);
            break;
        case "resetPoints":
            p.points = 0;
            break;
        case "demote": {
            const idx = Math.max(0, rankIndex(p.rank) - penalty.ranks);
            p.rank = CONFIG.MILITARY_RANKS[idx];
            p.points = 0;
            break;
        }
        case "demoteToFirst":
            p.rank = CONFIG.MILITARY_RANKS[0];
            p.points = 0;
            break;
        case "suspend":
            p.isBlocked = true;
            p.blockUntil = new Date(Date.now() + penalty.days * 24 * 60 * 60 * 1000);
            break;
        case "combo":
            if (penalty.ranks) {
                const idx = Math.max(0, rankIndex(p.rank) - penalty.ranks);
                p.rank = CONFIG.MILITARY_RANKS[idx];
                p.points = 0;
            }
            if (penalty.value) p.points = Math.max(0, p.points - penalty.value);
            if (penalty.days) {
                p.isBlocked = true;
                p.blockUntil = new Date(Date.now() + penalty.days * 24 * 60 * 60 * 1000);
            }
            break;
        case "dismiss":
            p.isBlocked = true;
            p.isDismissed = true;
            p.blockUntil = null;
            break;
    }
}

// لو مضت مدة الإيقاف المؤقت (عقوبة تحذير)، يفك الإيقاف تلقائيًا (ما ينطبق على الفصل النهائي)
async function autoUnblockIfExpired(p) {
    if (p && p.isBlocked && !p.isDismissed && p.blockUntil && p.blockUntil <= new Date()) {
        const until = p.blockUntil;
        p.isBlocked = false;
        p.blockUntil = null;
        await p.save();
        await logEvent({
            action: "إلغاء إيقاف", discordId: p.discord, discordTag: p.discordTag,
            actorId: "نظام تلقائي", actorTag: "🤖 نظام تلقائي",
            details: `انتهت مدة الإيقاف المؤقت (كانت حتى ${until.toLocaleString('ar')})`,
        });
    }
    return p;
}

async function issueWarning({ targetDiscord, kind, reason, actorId, actorTag, pointsToDeduct, penaltyType }) {
    if (!["warning", "notice"].includes(kind)) throw new Error("نوع غير معروف");
    if (!reason || !reason.trim()) throw new Error("لازم تكتب السبب");

    const p = await Personnel.findOne({ discord: targetDiscord });
    if (!p) throw new Error("غير موجود");

    const entry = { kind, reason: reason.trim(), issuedBy: actorId, issuedByTag: actorTag };
    let dismissed = false;
    let logDetails = `على ${p.registeredName || p.discord}: ${reason.trim()}`;

    if (kind === "warning") {
        const priorCount = p.warnings.filter(w => w.kind === "warning").length;
        const warningNumber = priorCount + 1;
        entry.warningNumber = warningNumber;

        if (warningNumber === 1) {
            // التحذير الأول — خصم 10 نقاط ثابت
            const pts = 10;
            p.points = Math.max(0, p.points - pts);
            entry.pointsDeducted = pts;
            entry.penaltyLabel = `خصم ${pts} نقاط`;
            logDetails += ` (تحذير أول — خصم ${pts} نقاط)`;
        } else if (warningNumber === 2) {
            // التحذير الثاني — تنزيل رتبة واحدة + خصم 25 نقطة ثابت
            const pts = 25;
            applyPenaltyEffect(p, { type: "demote", ranks: 1 });
            p.points = Math.max(0, p.points - pts);
            entry.pointsDeducted = pts;
            entry.penaltyType = "demote1";
            entry.penaltyLabel = `تنزيل رتبة واحدة + خصم ${pts} نقطة`;
            logDetails += ` (تحذير ثاني — تنزيل رتبة + خصم ${pts} نقطة)`;
        } else if (warningNumber >= 3) {
            // التحذير الثالث فما فوق — فصل نهائي
            applyPenaltyEffect(p, { type: "dismiss" });
            entry.penaltyType = "dismiss";
            entry.penaltyLabel = "فصل نهائي من الخدمة العسكرية";
            dismissed = true;
            logDetails += ` (تحذير ثالث — فصل نهائي)`;
        }
    }

    p.warnings.push(entry);
    await p.save();

    await logEvent({
        action: dismissed ? "فصل تلقائي (تجاوز التحذيرات)" : (kind === "warning" ? "إصدار تحذير" : "إصدار إشعار"),
        discordId: p.discord, discordTag: p.discordTag, actorId, actorTag,
        details: logDetails,
    });

    return { p, dismissed };
}

// يرجع عدد التحذيرات (نوع warning فقط) لهذا الشخص — تستخدمها الواجهة قبل فتح فورم التحذير
// عشان تعرف تعرض الفورم المناسب (أول / ثاني / ثالث / فصل تلقائي)
app.get("/api/senior/personnel/:discord/warning-info", ensureSeniorAdmin, async (req, res) => {
    const p = await Personnel.findOne({ discord: req.params.discord }, { warnings: 1 });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    const count = (p.warnings || []).filter(w => w.kind === "warning").length;
    res.json({ count });
});

// عقوبات التحذيرات (تُستخدم عند إصدار التحذير الثالث) — يستخدمها أي شخص عنده صلاحية إرسال تحذير
app.get("/api/warn-penalties", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    res.json({ list: settings.warningPenalties || [] });
});

// ── إدارة عقوبات التحذيرات (صفحة كبار المسؤولين — إضافة/تعديل/حذف) ──────
app.get("/api/senior/penalties", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    res.json({ list: settings.warningPenalties || [] });
});

const PENALTY_TYPES = ["points", "resetPoints", "demote", "demoteToFirst", "suspend", "combo", "dismiss"];

app.post("/api/senior/penalties", ensureSeniorAdmin, async (req, res) => {
    const { label, type, value, ranks, days } = req.body;
    if (!label || !label.trim()) return res.status(400).json({ error: "لازم تكتب اسم العقوبة" });
    if (!PENALTY_TYPES.includes(type)) return res.status(400).json({ error: "نوع عقوبة غير معروف" });
    const settings = await getSettings();
    const penalty = { id: "pen_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), label: label.trim(), type };
    if (value !== undefined && value !== "" && !isNaN(parseInt(value))) penalty.value = parseInt(value);
    if (ranks !== undefined && ranks !== "" && !isNaN(parseInt(ranks))) penalty.ranks = parseInt(ranks);
    if (days !== undefined && days !== "" && !isNaN(parseInt(days))) penalty.days = parseInt(days);
    settings.warningPenalties = settings.warningPenalties || [];
    settings.warningPenalties.push(penalty);
    settings.markModified("warningPenalties");
    await settings.save();
    await logEvent({ action: "إضافة عقوبة تحذير", actorId: req.user.id, actorTag: req.user.username, details: penalty.label });
    res.json({ ok: true, list: settings.warningPenalties });
});

app.put("/api/senior/penalties/:id", ensureSeniorAdmin, async (req, res) => {
    const { label, type, value, ranks, days } = req.body;
    const settings = await getSettings();
    const idx = (settings.warningPenalties || []).findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "غير موجودة" });
    if (label && label.trim()) settings.warningPenalties[idx].label = label.trim();
    if (PENALTY_TYPES.includes(type)) settings.warningPenalties[idx].type = type;
    settings.warningPenalties[idx].value = (value !== undefined && value !== "" && !isNaN(parseInt(value))) ? parseInt(value) : undefined;
    settings.warningPenalties[idx].ranks = (ranks !== undefined && ranks !== "" && !isNaN(parseInt(ranks))) ? parseInt(ranks) : undefined;
    settings.warningPenalties[idx].days = (days !== undefined && days !== "" && !isNaN(parseInt(days))) ? parseInt(days) : undefined;
    settings.markModified("warningPenalties");
    await settings.save();
    await logEvent({ action: "تعديل عقوبة تحذير", actorId: req.user.id, actorTag: req.user.username, details: settings.warningPenalties[idx].label });
    res.json({ ok: true, list: settings.warningPenalties });
});

app.delete("/api/senior/penalties/:id", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    const before = (settings.warningPenalties || []).length;
    settings.warningPenalties = (settings.warningPenalties || []).filter(p => p.id !== req.params.id);
    if (settings.warningPenalties.length === before) return res.status(404).json({ error: "غير موجودة" });
    settings.markModified("warningPenalties");
    await settings.save();
    await logEvent({ action: "حذف عقوبة تحذير", actorId: req.user.id, actorTag: req.user.username, details: req.params.id });
    res.json({ ok: true, list: settings.warningPenalties });
});

// أقرب "مراجعة ملاحظة قديمة" لهذا المستخدم لسّه ما اتعاهد عليها — تستخدمها الواجهة للبولينج تعرضها بوجهه
// (تحذير/إشعار الموقع اتشالت بالكامل بطلب من الإدارة — تصدر الآن فقط من بوت الأوامر بدون شاشة مقاطعة بالموقع)
app.get("/api/warnings/pending", async (req, res) => {
    if (!req.isAuthenticated()) return res.json({ warning: null });
    const p = await Personnel.findOne({ discord: req.user.id }, { warnings: 1 });
    if (!p || !p.warnings || !p.warnings.length) return res.json({ warning: null });
    const pending = p.warnings.filter(w => !w.acknowledged && w.kind === "note-review").sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!pending) return res.json({ warning: null });
    res.json({ warning: {
        id: pending._id, kind: pending.kind, reason: pending.reason, createdAt: pending.createdAt,
        warningNumber: pending.warningNumber || null,
        pointsDeducted: pending.pointsDeducted || 0,
        penaltyLabel: pending.penaltyLabel || null,
        noteReviewTargetDiscord: pending.noteReviewTargetDiscord || null,
        noteReviewTargetName: pending.noteReviewTargetName || null,
        noteReviewNoteId: pending.noteReviewNoteId || null,
        noteReviewText: pending.noteReviewText || null,
        noteReviewSectorLabel: pending.noteReviewSectorLabel || null,
    } });
});

// اتعاهد وأقر بعدم تكرار ذلك
app.post("/api/warnings/:id/ack", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    const p = await Personnel.findOne({ discord: req.user.id });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    const w = p.warnings.id(req.params.id);
    if (!w) return res.status(404).json({ error: "غير موجود" });
    if (!w.acknowledged) {
        w.acknowledged = true;
        w.acknowledgedAt = new Date();
        await p.save();
        await logEvent({
            action: "تعاهد على " + (w.kind === "warning" ? "تحذير" : "إشعار"),
            discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username,
            details: w.reason,
        });
    }
    res.json({ ok: true });
});

// يجيب كل الملاحظات المضافة على كل العساكر بصفحة وحدة (لكبار المسؤولين)
app.get("/api/senior/notes", ensureSeniorAdmin, async (req, res) => {
    const list = await Personnel.find({ "notes.0": { $exists: true } }, { discord: 1, discordTag: 1, registeredName: 1, notes: 1 });
    const flat = [];
    for (const p of list) {
        for (const n of p.notes) {
            flat.push({
                noteId: n._id, discord: p.discord, personnelName: p.registeredName || p.discordTag || p.discord,
                text: n.text, hasImage: !!(n.image || (n.imageChannelId && n.imageMessageId)), addedBy: n.addedBy, addedByTag: n.addedByTag, createdAt: n.createdAt,
            });
        }
    }
    flat.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ list: flat });
});

// ── حذف ملاحظات قطاع كامل (بالجملة أو باستثناء محدد) — كبار المسؤولين فقط ──
app.get("/api/senior/notes/by-sector/:sector", ensureSeniorAdmin, async (req, res) => {
    const sector = req.params.sector;
    if (!CONFIG.SECTORS[sector]) return res.status(400).json({ error: "قطاع غير معروف" });
    const ids = await getSectorMemberIds(sector);
    if (ids === null) return res.status(503).json({ error: "تعذر جلب أعضاء القطاع من ديسكورد حالياً، حاول مرة ثانية بعد شوي" });
    if (!ids.length) return res.json({ list: [] });
    const people = await Personnel.find({ discord: { $in: ids }, "notes.0": { $exists: true } }, { discord: 1, discordTag: 1, registeredName: 1, notes: 1 });
    const flat = [];
    for (const p of people) {
        for (const n of p.notes) {
            flat.push({
                noteId: n._id, discord: p.discord, personnelName: p.registeredName || p.discordTag || p.discord,
                text: n.text, addedByTag: n.addedByTag, createdAt: n.createdAt,
            });
        }
    }
    flat.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ list: flat, sectorLabel: CONFIG.SECTORS[sector] });
});
app.post("/api/senior/notes/by-sector/:sector/delete-all", ensureSeniorAdmin, async (req, res) => {
    const sector = req.params.sector;
    if (!CONFIG.SECTORS[sector]) return res.status(400).json({ error: "قطاع غير معروف" });
    const ids = await getSectorMemberIds(sector);
    if (ids === null) return res.status(503).json({ error: "تعذر جلب أعضاء القطاع من ديسكورد حالياً، حاول مرة ثانية بعد شوي" });
    if (!ids.length) return res.json({ ok: true, count: 0 });
    const result = await Personnel.updateMany({ discord: { $in: ids } }, { $set: { notes: [] } });
    await logEvent({ action: "حذف كل ملاحظات القطاع", actorId: req.user.id, actorTag: req.user.username, details: `${CONFIG.SECTORS[sector]} — ${result.modifiedCount} عسكري` });
    res.json({ ok: true, count: result.modifiedCount });
});
app.post("/api/senior/notes/by-sector/:sector/delete-except", ensureSeniorAdmin, async (req, res) => {
    const sector = req.params.sector;
    if (!CONFIG.SECTORS[sector]) return res.status(400).json({ error: "قطاع غير معروف" });
    const { keepNoteIds } = req.body; // الملاحظات المستثناة (تبقى)
    const keep = Array.isArray(keepNoteIds) ? keepNoteIds : [];
    const ids = await getSectorMemberIds(sector);
    if (ids === null) return res.status(503).json({ error: "تعذر جلب أعضاء القطاع من ديسكورد حالياً، حاول مرة ثانية بعد شوي" });
    if (!ids.length) return res.json({ ok: true, count: 0 });
    const people = await Personnel.find({ discord: { $in: ids }, "notes.0": { $exists: true } });
    let count = 0;
    for (const p of people) {
        const before = p.notes.length;
        p.notes = p.notes.filter(n => keep.includes(n._id.toString()));
        count += before - p.notes.length;
        if (before !== p.notes.length) await p.save();
    }
    await logEvent({ action: "حذف ملاحظات القطاع باستثناء", actorId: req.user.id, actorTag: req.user.username, details: `${CONFIG.SECTORS[sector]} — حذف ${count}، استثناء ${keep.length}` });
    res.json({ ok: true, count });
});

app.delete("/api/senior/personnel/:discord/note/:noteId", ensureSeniorAdmin, async (req, res) => {
    try {
        const p = await Personnel.findOneAndUpdate(
            { discord: req.params.discord },
            { $pull: { notes: { _id: req.params.noteId } } },
            { new: true }
        );
        if (!p) return res.status(404).json({ error: "غير موجود" });
        await logEvent({ action: "حذف ملاحظة", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: `من ${p.registeredName || p.discord}` });
        res.json({ ok: true });
    } catch (e) {
        console.error("❌ فشل حذف ملاحظة:", e.message, "| discord:", req.params.discord, "| noteId:", req.params.noteId);
        res.status(400).json({ error: "تعذر حذف هذي الملاحظة (معرّف غير صالح)، جرب تحذفها من صفحة حذف ملاحظات القطاعات بدلاً منها" });
    }
});

app.post("/api/senior/personnel/:discord/block", ensureSeniorAdmin, async (req, res) => {
    const { blocked } = req.body;
    const p = await Personnel.findOneAndUpdate({ discord: req.params.discord }, { isBlocked: !!blocked }, { new: true });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: blocked ? "إيقاف عسكري" : "إلغاء إيقاف", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: p.registeredName || p.discord });
    res.json({ ok: true, isBlocked: p.isBlocked });
});

// حذف نهائي لحساب عسكري — يحذف السجل بالكامل من قاعدة البيانات (يختفي من الصفحة نهائياً)
// العسكري يقدر يقدم/يسجل من جديد بعدها عادي لأنه يصير كأنه ما سجل قبل
app.delete("/api/senior/personnel/:discord", ensureSeniorAdmin, async (req, res) => {
    const p = await Personnel.findOneAndDelete({ discord: req.params.discord });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "حذف حساب نهائي", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: p.registeredName || p.discordTag || p.discord });
    res.json({ ok: true });
});

// تعديل شامل لملف عسكري: الاسم، اليونت، الرتبة، النقاط — من لوحة كبار المسؤولين مباشرة
app.post("/api/senior/personnel/:discord/update", ensureSeniorAdmin, async (req, res) => {
    const { name, unit, rank, points } = req.body;
    const update = {};
    if (typeof name === "string" && name.trim()) update.registeredName = name.trim();
    if (typeof unit === "string" && unit.trim()) update.unit = unit.trim();

    const settings = await getSettings();
    const existing = await Personnel.findOne({ discord: req.params.discord });
    const oldIdx = rankIndex(existing ? existing.rank : "جندي");

    if (typeof rank === "string" && rank.trim()) {
        const newRank = rank.trim();
        if (!CONFIG.MILITARY_RANKS.includes(newRank)) return res.status(400).json({ error: "رتبة غير موجودة" });
        update.rank = newRank;

        // إذا ما حط الأدمن نقاط يدوياً مع الرتبة، نعطيه تلقائياً النقاط المناسبة لرتبته الجديدة
        const explicitPoints = points !== undefined && points !== "" && !isNaN(parseInt(points));
        if (!explicitPoints) {
            const newIdx = rankIndex(newRank);
            if (newIdx > oldIdx) update.points = await pointsForReachingRank(newRank, settings);
            else if (newIdx < oldIdx) update.points = 0; // تنزيل الرتبة يصفّر النقاط عشان ما يترقى تلقائي بنفس النقاط القديمة
        }
    }
    if (points !== undefined && points !== "" && !isNaN(parseInt(points))) update.points = Math.max(0, parseInt(points));

    const p = await Personnel.findOneAndUpdate({ discord: req.params.discord }, update, { new: true });
    if (!p) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "تعديل ملف عسكري", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: JSON.stringify(update) });
    await checkAutoPromotion(req.params.discord);
    res.json({ ok: true, personnel: p });
});

// ── تعديل نقاط الأعضاء — متاح لكبار المسؤولين، قادة/نواب القطاعات، ومسؤول الأفراد (بنطاق صلاحيته) ──
// مسؤول الأفراد يقدر يعدّل نقاط رتبة "رئيس رقباء" وتحت فقط ضمن قطاعه، وقيادة القطاع تعدّل أي فرد بقطاعها
async function ensurePointsEditor(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "غير مسجّل دخول" });
    if (isSeniorAdmin(req.user.id)) return next();
    const settings = await getSettings();
    const leaderInfo = getSectorRole(req.user.id, settings);
    if (leaderInfo) {
        const ids = await getSectorMemberIds(leaderInfo.sector);
        if (ids === null) return res.status(503).json({ error: "تعذر التحقق من أعضاء القطاع حالياً" });
        if (!ids.includes(req.params.discord)) return res.status(403).json({ error: "هذا الشخص ليس من أعضاء قطاعك" });
        return next();
    }
    const poInfo = getPersonnelOfficerSector(req.user.id, settings);
    if (poInfo) {
        const p = await ensureJuniorInMySector({ sectorInfo: poInfo }, res, req.params.discord);
        if (!p) return; // ensureJuniorInMySector already sent the error response
        return next();
    }
    return res.status(403).json({ error: "ليست لديك صلاحية تعديل النقاط" });
}
app.post("/api/points/edit/:discord", ensurePointsEditor, async (req, res) => {
    const { points } = req.body;
    if (points === undefined || points === "" || isNaN(parseInt(points))) return res.status(400).json({ error: "حط عدد نقاط صحيح" });
    const before = await Personnel.findOne({ discord: req.params.discord });
    if (!before) return res.status(404).json({ error: "غير موجود" });
    const newValue = Math.max(0, parseInt(points));
    const delta = newValue - before.points;
    const pr = await applyOrQueuePoints({
        discordId: req.params.discord, delta, actorId: req.user.id, actorTag: req.user.username,
        source: "manual", reason: `تعديل نقاط يدوي — النقاط الجديدة المطلوبة: ${newValue}`,
    });
    if (pr.blocked) return res.status(403).json({ error: pr.error });
    if (pr.applied) {
        await logEvent({ action: "تعديل نقاط", discordId: before.discord, discordTag: before.discordTag, actorId: req.user.id, actorTag: req.user.username, details: `النقاط الجديدة: ${pr.personnel.points}` });
        await checkAutoPromotion(req.params.discord);
        return res.json({ ok: true, personnel: pr.personnel });
    }
    await logEvent({ action: "طلب تعديل نقاط", discordId: before.discord, discordTag: before.discordTag, actorId: req.user.id, actorTag: req.user.username, details: `${delta >= 0 ? "+" : ""}${delta} نقطة — بانتظار موافقة الإدارة` });
    res.json({ ok: true, queued: true, personnel: before, message: "تم إرسال طلب تعديل النقاط لموافقة الإدارة." });
});

// ══════════════════════════════════════════════════════════════════════════
// أرشيف المخالفات المقبولة/المرفوضة (كبار المسؤولين) + حذف نهائي
// ══════════════════════════════════════════════════════════════════════════
app.get("/api/senior/violations/reviewed", ensureSeniorAdmin, async (req, res) => {
    const list = await Violation.aggregate([
        { $match: { status: { $in: ["approved", "rejected"] } } },
        { $addFields: { hasPhoto: { $or: [{ $ifNull: ["$photo", false] }, { $ifNull: ["$photoMessageId", false] }] } } },
        { $project: { photo: 0 } },
        { $sort: { reviewedAt: -1 } },
        { $limit: 300 },
    ]).option({ maxTimeMS: 10000 });
    res.json({ list });
});

// حذف نهائي لمخالفة — تختفي من لوحة كبار المسؤولين، وصفحة "مخالفاتي" عند العضو، وصفحة قائد القطاع
app.delete("/api/senior/violations/:id/permanent", ensureSeniorAdmin, async (req, res) => {
    const v = await Violation.findByIdAndDelete(req.params.id);
    if (!v) return res.status(404).json({ error: "غير موجود" });
    await logEvent({ action: "حذف مخالفة نهائي", discordId: v.reporterDiscord, discordTag: v.reporterTag, actorId: req.user.id, actorTag: req.user.username, details: `${v.kind === "report" ? "تقرير" : "مخالفة"} (${v.status === "approved" ? "مقبولة" : "مرفوضة"})` });
    res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════════════
// نظام الإجازات
// ══════════════════════════════════════════════════════════════════════════
app.get("/api/leave/mine", ensureAuth, async (req, res) => {
    const p = await Personnel.findOne({ discord: req.user.id }, { leaveBalance: 1 });
    const list = await LeaveRequest.find({ discord: req.user.id }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ balance: p ? (p.leaveBalance ?? CONFIG.DEFAULT_LEAVE_BALANCE) : CONFIG.DEFAULT_LEAVE_BALANCE, list });
});

app.post("/api/leave/request", ensureAuth, async (req, res) => {
    const { reason, days } = req.body;
    const d = parseInt(days);
    if (!reason || !reason.trim()) return res.status(400).json({ error: "لازم تكتب السبب" });
    if (!d || d < 1) return res.status(400).json({ error: "حدد عدد أيام صحيح" });

    const p = await Personnel.findOne({ discord: req.user.id });
    if (!p || !p.registeredName) return res.status(400).json({ error: "أكمل بياناتك بالموقع أولاً" });
    if (isSummonBlocking(p)) return res.status(403).json({ error: "🚨 عليك استدعاء نشط من الشرطة العسكرية، لازم تدخل الاستدعاء أولاً قبل أي إجراء بالموقع" });
    const balance = p.leaveBalance ?? CONFIG.DEFAULT_LEAVE_BALANCE;
    if (d > balance) return res.status(400).json({ error: `رصيدك الحالي ${balance} يوم فقط، ما يكفي لهذا الطلب` });

    const pending = await LeaveRequest.countDocuments({ discord: req.user.id, status: "pending" });
    if (pending >= 2) return res.status(400).json({ error: "عندك طلب إجازة قيد المراجعة بالفعل" });

    const active = await LeaveRequest.findOne({ discord: req.user.id, status: "approved" });
    if (active) return res.status(400).json({ error: "عندك إجازة نشطة حالياً، ما تقدر تطلب إجازة جديدة إلا بعد ما تنتهي" });

    // بعد ما تنتهي إجازته (تلقائي أو يدوي)، ما يقدر يطلب إجازة جديدة إلا بعد 3 أيام من انتهائها
    const lastCompleted = await LeaveRequest.findOne({ discord: req.user.id, status: "completed" }).sort({ endedAt: -1 });
    if (lastCompleted && lastCompleted.endedAt) {
        const cooldownMs = 3 * 24 * 60 * 60 * 1000;
        const sinceEnd = Date.now() - new Date(lastCompleted.endedAt).getTime();
        if (sinceEnd < cooldownMs) {
            const daysLeft = Math.ceil((cooldownMs - sinceEnd) / (24 * 60 * 60 * 1000));
            return res.status(400).json({ error: `لازم تنتظر ${daysLeft} يوم إضافي بعد انتهاء آخر إجازة قبل تقديم طلب جديد` });
        }
    }

    const sectorKey = await getMemberSectorKey(req.user.id);
    const leave = await LeaveRequest.create({
        discord: req.user.id, discordTag: req.user.username,
        name: p.registeredName, unit: p.unit, rank: p.rank,
        sector: sectorKey, sectorLabel: sectorKey ? CONFIG.SECTORS[sectorKey] : null,
        reason: reason.trim(), days: d,
    });
    await logEvent({ action: "طلب إجازة", discordId: p.discord, discordTag: p.discordTag, actorId: p.discord, actorTag: p.discordTag, details: `${d} يوم — ${reason.trim()}` });
    res.json({ ok: true, leave });
});

// طلبات الإجازة المعلّقة اللي يراجعها هذا الشخص:
// - قائد/نائب القطاع: كل طلبات قطاعه
// - مسؤول الأفراد: طلبات رتبة رئيس رقباء وتحت بقطاعه فقط (والقائد/النائب يشوفونها بعد الموافقة كـ"علم" فقط)
app.get("/api/leave/pending", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    const leaderInfo = getSectorRole(req.user.id, settings);
    const poInfo = getPersonnelOfficerSector(req.user.id, settings);
    if (!leaderInfo && !poInfo && !isSeniorAdmin(req.user.id)) return res.status(403).json({ error: "ليست لديك صلاحية" });

    let query = { status: { $in: ["pending", "approved"] } };
    if (isSeniorAdmin(req.user.id) && !leaderInfo && !poInfo) {
        // كبار المسؤولين بدون دور قطاعي حقيقي يحتاجون تحديد قطاع
        const q = (req.query.sector || "").trim();
        if (!q || !CONFIG.SECTORS[q]) return res.status(400).json({ error: "حدد قطاع صحيح" });
        query.sector = q;
    } else if (leaderInfo) {
        query.sector = leaderInfo.sector;
    } else if (poInfo) {
        query.sector = poInfo.sector;
    }

    let list = await LeaveRequest.find(query).sort({ createdAt: -1 }).limit(100).lean();
    // مسؤول الأفراد يشوف بس طلبات رئيس رقباء وتحت
    if (poInfo && !leaderInfo) {
        list = list.filter(l => isJuniorRank(l.rank));
    }
    res.json({ list });
});

// كبار المسؤولين يشوفون كل طلبات الإجازات المعلّقة من كل القطاعات بصفحة وحدة
app.get("/api/senior/leave/pending", ensureAnyAdmin, async (req, res) => {
    const list = await LeaveRequest.find({ status: { $in: ["pending", "approved"] } }).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ list });
});

app.post("/api/leave/:id/approve", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave || leave.status !== "pending") return res.status(404).json({ error: "غير موجود" });

    const leaderInfo = getSectorRole(req.user.id, settings);
    const poInfo = getPersonnelOfficerSector(req.user.id, settings);
    let approverLabel = null;
    if (leaderInfo && leaderInfo.sector === leave.sector) {
        approverLabel = leaderInfo.role === "commander" ? "قائد القطاع" : "نائب القطاع";
    } else if (poInfo && poInfo.sector === leave.sector && isJuniorRank(leave.rank)) {
        approverLabel = "مسؤول الأفراد";
    } else if (isSeniorAdmin(req.user.id)) {
        approverLabel = "كبار المسؤولين";
    } else if ((settings.adminList || []).includes(req.user.id)) {
        approverLabel = "الإدارة";
    } else {
        return res.status(403).json({ error: "ليست لديك صلاحية الموافقة على هذا الطلب" });
    }

    const p = await Personnel.findOne({ discord: leave.discord });
    if (!p) return res.status(404).json({ error: "الفرد غير موجود" });
    const balance = p.leaveBalance ?? CONFIG.DEFAULT_LEAVE_BALANCE;
    if (leave.days > balance) return res.status(400).json({ error: "رصيد الفرد الحالي ما يكفي لهذا الطلب" });
    p.leaveBalance = balance - leave.days;
    await p.save();

    leave.status = "approved";
    leave.reviewedBy = req.user.id;
    leave.reviewedByTag = req.user.username + ` (${approverLabel})`;
    leave.reviewedAt = new Date();
    leave.startDate = new Date();
    leave.endDate = new Date(Date.now() + leave.days * 24 * 60 * 60 * 1000);
    await leave.save();

    await logEvent({ action: "قبول إجازة", discordId: p.discord, discordTag: p.discordTag, actorId: req.user.id, actorTag: req.user.username, details: `${leave.days} يوم (بواسطة ${approverLabel}) — الرصيد المتبقي: ${p.leaveBalance}` });
    dmMember(p.discord, new EmbedBuilder()
        .setTitle("✅ تم قبول طلب إجازتك")
        .setColor(0x22c55e)
        .addFields({ name: "المدة", value: `${leave.days} يوم` }, { name: "الرصيد المتبقي", value: `${p.leaveBalance} يوم` })
        .setTimestamp()).catch(() => {});
    res.json({ ok: true, leave });
});

// إنهاء إجازة نشطة يدوياً — نفس صلاحية قبول/رفض هذا الطلب
app.post("/api/leave/:id/end", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave || leave.status !== "approved") return res.status(404).json({ error: "غير موجودة أو مو نشطة" });

    const leaderInfo = getSectorRole(req.user.id, settings);
    const poInfo = getPersonnelOfficerSector(req.user.id, settings);
    let approverLabel = null;
    if (leaderInfo && leaderInfo.sector === leave.sector) approverLabel = leaderInfo.role === "commander" ? "قائد القطاع" : "نائب القطاع";
    else if (poInfo && poInfo.sector === leave.sector && isJuniorRank(leave.rank)) approverLabel = "مسؤول الأفراد";
    else if (isSeniorAdmin(req.user.id)) approverLabel = "كبار المسؤولين";
    else if ((settings.adminList || []).includes(req.user.id)) approverLabel = "الإدارة";
    else return res.status(403).json({ error: "ليست لديك صلاحية إنهاء هذه الإجازة" });

    leave.status = "completed";
    leave.endedAt = new Date();
    leave.endedByTag = req.user.username + ` (${approverLabel})`;
    await leave.save();
    await logEvent({ action: "إنهاء إجازة", discordId: leave.discord, discordTag: leave.discordTag, actorId: req.user.id, actorTag: req.user.username, details: `بواسطة ${approverLabel}` });
    dmMember(leave.discord, new EmbedBuilder()
        .setTitle("⏹️ تم إنهاء إجازتك")
        .setColor(0xf59e0b)
        .setDescription(`تم إنهاء إجازتك النشطة بواسطة ${approverLabel}.`)
        .setTimestamp()).catch(() => {});
    res.json({ ok: true });
});

app.post("/api/leave/:id/reject", ensureAuth, async (req, res) => {
    const settings = await getSettings();
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave || leave.status !== "pending") return res.status(404).json({ error: "غير موجود" });

    const leaderInfo = getSectorRole(req.user.id, settings);
    const poInfo = getPersonnelOfficerSector(req.user.id, settings);
    let approverLabel = null;
    if (leaderInfo && leaderInfo.sector === leave.sector) approverLabel = leaderInfo.role === "commander" ? "قائد القطاع" : "نائب القطاع";
    else if (poInfo && poInfo.sector === leave.sector && isJuniorRank(leave.rank)) approverLabel = "مسؤول الأفراد";
    else if (isSeniorAdmin(req.user.id)) approverLabel = "كبار المسؤولين";
    else if ((settings.adminList || []).includes(req.user.id)) approverLabel = "الإدارة";
    else return res.status(403).json({ error: "ليست لديك صلاحية" });

    leave.status = "rejected";
    leave.rejectReason = (req.body.reason || "").trim() || null;
    leave.reviewedBy = req.user.id;
    leave.reviewedByTag = req.user.username + ` (${approverLabel})`;
    leave.reviewedAt = new Date();
    await leave.save();

    await logEvent({ action: "رفض إجازة", discordId: leave.discord, discordTag: leave.discordTag, actorId: req.user.id, actorTag: req.user.username, details: leave.rejectReason || "-" });
    dmMember(leave.discord, new EmbedBuilder()
        .setTitle("❌ تم رفض طلب إجازتك")
        .setColor(0xef4444)
        .addFields({ name: "المدة المطلوبة", value: `${leave.days} يوم` }, { name: "السبب", value: leave.rejectReason || "-" })
        .setTimestamp()).catch(() => {});
    res.json({ ok: true, leave });
});

app.get("/api/senior/settings", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    res.json({ settings });
});

app.post("/api/senior/settings", ensureSeniorAdmin, async (req, res) => {
    const { isMaintenance, disableLogin, disableViolations, violationsChannelId, notesChannelId } = req.body;
    const s = await getSettings();
    if (typeof isMaintenance === "boolean") s.isMaintenance = isMaintenance;
    if (typeof disableLogin === "boolean") s.disableLogin = disableLogin;
    if (typeof disableViolations === "boolean") s.disableViolations = disableViolations;
    if (typeof violationsChannelId === "string") s.violationsChannelId = violationsChannelId.trim() || null;
    if (typeof notesChannelId === "string") s.notesChannelId = notesChannelId.trim() || null;
    await s.save();
    await logEvent({ action: "تعديل إعدادات الموقع", actorId: req.user.id, actorTag: req.user.username, details: JSON.stringify(req.body) });
    res.json({ ok: true });
});

// ── آيديات رولات القطاعات (دوريات / أمن الطرق / مكافحة المخدرات) — الكبار يحطون أي رول يبغونه ──
app.get("/api/senior/sector-role-ids", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    const roleIds = {};
    for (const key of Object.keys(CONFIG.SECTORS)) roleIds[key] = sectorRoleId(key, settings) || "";
    res.json({ sectors: CONFIG.SECTORS, roleIds });
});
app.post("/api/senior/sector-role-ids", ensureSeniorAdmin, async (req, res) => {
    const { roleIds } = req.body || {};
    if (!roleIds || typeof roleIds !== "object") return res.status(400).json({ error: "بيانات غير صالحة" });
    const s = await getSettings();
    for (const key of Object.keys(CONFIG.SECTORS)) {
        if (typeof roleIds[key] !== "string") continue;
        const val = roleIds[key].trim();
        if (val && !/^\d{15,25}$/.test(val)) return res.status(400).json({ error: `آيدي رول ${CONFIG.SECTORS[key]} غير صحيح (أرقام فقط)` });
        s.sectorRoleIds[key] = val || null;
    }
    s.markModified("sectorRoleIds");
    await s.save();
    await logEvent({ action: "تعديل آيديات رولات القطاعات", actorId: req.user.id, actorTag: req.user.username, details: JSON.stringify(roleIds) });
    res.json({ ok: true });
});

// ── قادة ونواب القطاعات — يعيّنهم كبار المسؤولين بالآيدي، وكل واحد يكون لقطاع واحد فقط ──
const SECTOR_LEADER_ROLES = { commander: "قائد", deputy: "نائب" };
app.get("/api/senior/sector-leaders", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    const leadership = {};
    for (const key of Object.keys(CONFIG.SECTORS)) {
        const sl = (settings.sectorLeadership && settings.sectorLeadership[key]) || {};
        leadership[key] = {
            commanderId: sl.commanderId || null, commanderName: sl.commanderName || null,
            deputyId: sl.deputyId || null, deputyName: sl.deputyName || null,
        };
    }
    res.json({ sectors: CONFIG.SECTORS, leadership });
});
app.post("/api/senior/sector-leaders/assign", ensureSeniorAdmin, async (req, res) => {
    const sector = String(req.body?.sector || "").trim();
    const role = String(req.body?.role || "").trim();
    const discordId = String(req.body?.discordId || "").replace(/[<@!>\s]/g, "");
    if (!CONFIG.SECTORS[sector]) return res.status(400).json({ error: "قطاع غير صحيح" });
    if (!SECTOR_LEADER_ROLES[role]) return res.status(400).json({ error: "المنصب غير صحيح" });
    if (!/^\d{17,20}$/.test(discordId)) return res.status(400).json({ error: "الآيدي غير صحيح — لازم أرقام فقط (آيدي حساب ديسكورد)" });
    const s = await getSettings();
    // الشخص ما يكون قائد/نائب إلا بقطاع واحد ومنصب واحد
    for (const key of Object.keys(CONFIG.SECTORS)) {
        const sl = (s.sectorLeadership && s.sectorLeadership[key]) || {};
        for (const r of Object.keys(SECTOR_LEADER_ROLES)) {
            if (sl[r + "Id"] === discordId && !(key === sector && r === role)) {
                return res.status(400).json({ error: `هذا الشخص معيّن أصلاً كـ${SECTOR_LEADER_ROLES[r]} ${CONFIG.SECTORS[key]} — أزله أول قبل ما تعيّنه بمنصب ثاني` });
            }
        }
    }
    // نجيب اسمه: من سجل الموقع، وإلا من السيرفر عن طريق البوت
    const per = await Personnel.findOne({ discord: discordId });
    let name = per?.registeredName || null;
    if (botReady) {
        try {
            const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
            const member = await guild.members.fetch(discordId);
            name = name || member.displayName || member.user.username;
        } catch (e) {
            if (!per) return res.status(404).json({ error: "ما لقيت هذا الآيدي بالسيرفر — تأكد منه" });
        }
    }
    name = name || per?.discordTag || discordId;
    s.sectorLeadership[sector][role + "Id"] = discordId;
    s.sectorLeadership[sector][role + "Name"] = name;
    s.markModified("sectorLeadership");
    await s.save();
    await logEvent({ action: "تعيين قيادة قطاع", discordId, discordTag: name, actorId: req.user.id, actorTag: req.user.username, details: `${SECTOR_LEADER_ROLES[role]} ${CONFIG.SECTORS[sector]}` });
    res.json({ ok: true, name });
});
app.post("/api/senior/sector-leaders/remove", ensureSeniorAdmin, async (req, res) => {
    const sector = String(req.body?.sector || "").trim();
    const role = String(req.body?.role || "").trim();
    if (!CONFIG.SECTORS[sector] || !SECTOR_LEADER_ROLES[role]) return res.status(400).json({ error: "بيانات غير صحيحة" });
    const s = await getSettings();
    const old = s.sectorLeadership[sector][role + "Id"];
    s.sectorLeadership[sector][role + "Id"] = null;
    s.sectorLeadership[sector][role + "Name"] = null;
    s.markModified("sectorLeadership");
    await s.save();
    await logEvent({ action: "إزالة قيادة قطاع", discordId: old || null, actorId: req.user.id, actorTag: req.user.username, details: `${SECTOR_LEADER_ROLES[role]} ${CONFIG.SECTORS[sector]}` });
    res.json({ ok: true });
});

// أقل رتبة تقدر تستخدم أزرار كل أمر ببوت الأوامر — يقرأها بوت الأوامر مباشرة من نفس قاعدة البيانات
// آيديات رولات الرتب العسكرية — أي شخص معه الرول يتسجل تلقائياً أن رتبته هذي (لوحة كبار المسؤولين)
app.get("/api/senior/rank-role-ids", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    const map = {};
    for (const rank of CONFIG.MILITARY_RANKS) map[rank] = (settings.rankRoleIds && settings.rankRoleIds.get(rank)) || "";
    res.json({ ranks: CONFIG.MILITARY_RANKS, rankRoleIds: map });
});
app.post("/api/senior/rank-role-ids", ensureSeniorAdmin, async (req, res) => {
    const { rankRoleIds } = req.body;
    if (!rankRoleIds || typeof rankRoleIds !== "object") return res.status(400).json({ error: "بيانات غير صالحة" });
    const s = await getSettings();
    for (const rank of CONFIG.MILITARY_RANKS) {
        const val = rankRoleIds[rank];
        if (typeof val === "string") {
            if (val.trim()) s.rankRoleIds.set(rank, val.trim());
            else s.rankRoleIds.delete(rank);
        }
    }
    s.markModified("rankRoleIds");
    await s.save();
    await logEvent({ action: "تعديل آيديات رتب العسكرية", actorId: req.user.id, actorTag: req.user.username, details: JSON.stringify(rankRoleIds) });
    res.json({ ok: true });
});

app.get("/api/senior/command-permissions", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    res.json({ ranks: CONFIG.MILITARY_RANKS, permissions: settings.commandPermissions });
});
app.post("/api/senior/command-permissions", ensureSeniorAdmin, async (req, res) => {
    const { violation, command, leave, personnel } = req.body;
    const s = await getSettings();
    for (const [key, val] of Object.entries({ violation, command, leave, personnel })) {
        if (typeof val === "string" && CONFIG.MILITARY_RANKS.includes(val)) s.commandPermissions[key] = val;
    }
    s.markModified("commandPermissions");
    await s.save();
    await logEvent({ action: "تعديل صلاحيات أوامر البوت", actorId: req.user.id, actorTag: req.user.username, details: JSON.stringify(s.commandPermissions) });
    res.json({ ok: true, permissions: s.commandPermissions });
});

app.get("/api/senior/admins", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    res.json({ list: settings.adminList });
});

app.post("/api/senior/hire-admin", ensureSeniorAdmin, async (req, res) => {
    const { discordId, name } = req.body;
    if (!discordId || !discordId.trim()) return res.status(400).json({ error: "حط آيدي الإداري" });
    const settings = await getSettings();
    if (!settings.adminList.includes(discordId.trim())) settings.adminList.push(discordId.trim());
    await settings.save();
    await logEvent({ action: "توظيف إداري", discordId: discordId.trim(), actorId: req.user.id, actorTag: req.user.username, details: name || "" });
    res.json({ ok: true });
});

app.post("/api/senior/fire-admin", ensureSeniorAdmin, async (req, res) => {
    const { discordId } = req.body;
    const settings = await getSettings();
    settings.adminList = settings.adminList.filter(id => id !== discordId);
    await settings.save();
    await logEvent({ action: "فصل إداري", discordId, actorId: req.user.id, actorTag: req.user.username });
    res.json({ ok: true });
});

app.get("/api/senior/vehicles", ensureSeniorAdmin, async (req, res) => {
    const list = await Vehicle.find().sort({ createdAt: -1 });
    res.json({ list });
});

app.post("/api/senior/vehicles", ensureSeniorAdmin, async (req, res) => {
    const { name, photo } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "حط اسم المركبة" });
    if (photo && photo.length > CONFIG.MAX_PHOTO_MB * 1024 * 1024 * 1.4) {
        return res.status(400).json({ error: `الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB` });
    }
    try {
        const v = await Vehicle.create({ name: name.trim(), photo: photo || null, addedBy: req.user.id });
        await logEvent({ action: "إضافة مركبة", actorId: req.user.id, actorTag: req.user.username, details: v.name });
        res.json({ ok: true, vehicle: v });
    } catch (e) { res.status(400).json({ error: "المركبة موجودة مسبقاً" }); }
});

app.delete("/api/senior/vehicles/:id", ensureSeniorAdmin, async (req, res) => {
    await Vehicle.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

app.get("/api/senior/thresholds", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    const obj = {};
    for (const r of CONFIG.MILITARY_RANKS) obj[r] = await getThreshold(r, settings);
    res.json({ ranks: CONFIG.MILITARY_RANKS, thresholds: obj });
});

app.post("/api/senior/thresholds", ensureSeniorAdmin, async (req, res) => {
    const { thresholds } = req.body;
    const settings = await getSettings();
    if (!settings.rankThresholds) settings.rankThresholds = new Map();
    Object.entries(thresholds || {}).forEach(([rank, val]) => {
        if (CONFIG.MILITARY_RANKS.includes(rank)) settings.rankThresholds.set(rank, Math.max(0, parseInt(val) || 0));
    });
    await settings.save();
    await logEvent({ action: "تعديل حدود النقاط", actorId: req.user.id, actorTag: req.user.username, details: "تحديث نقاط الترقية" });
    res.json({ ok: true });
});

app.get("/api/senior/log", ensureSeniorAdmin, async (req, res) => {
    const list = await Log.find().sort({ createdAt: -1 }).limit(200);
    res.json({ list });
});
// مسح كامل سجلات اللوق الشامل القديمة (كبار المسؤولين فقط) — لا يمكن التراجع عنه
app.post("/api/senior/log/wipe", ensureSeniorAdmin, async (req, res) => {
    const result = await Log.deleteMany({});
    // نسجل حدث المسح نفسه كأول سجل جديد بعد التصفير
    await logEvent({ action: "مسح اللوق الشامل بالكامل", actorId: req.user.id, actorTag: req.user.username, details: `تم حذف ${result.deletedCount} سجل قديم` });
    res.json({ ok: true, deleted: result.deletedCount });
});


// ══════════════════════════════════════════════════════════════════════════
// 4.4.1) القيادة العليا — تراجع كل طلبات الترقية/التنزيل من كل القطاعات
// ══════════════════════════════════════════════════════════════════════════
app.get("/api/high-command/promotion-requests", ensureHighCommand, async (req, res) => {
    const list = await PromotionRequest.find({ status: "pending" }).sort({ createdAt: -1 }).limit(200);
    res.json({ list });
});
// تنبيه فوري (شاشة كاملة زي نظام التحذيرات) لأي عضو بالقيادة العليا بأقدم طلب ترقية/تنزيل بانتظار المراجعة
// يُستدعى بالبولينج — أول من يقبل/يرفض يسوي الطلب يختفي تلقائياً عند الجميع لأن حالته ما عادت "pending"
app.get("/api/high-command/promotion-alert", ensureHighCommand, async (req, res) => {
    const r = await PromotionRequest.findOne({ status: "pending" }).sort({ createdAt: 1 });
    if (!r) return res.json({ alert: null });
    res.json({ alert: {
        id: r._id, sector: r.sector, sectorLabel: r.sectorLabel,
        targetDiscord: r.targetDiscord, targetName: r.targetName, targetTag: r.targetTag,
        fromRank: r.fromRank, toRank: r.toRank, direction: r.direction,
        reason: r.reason, requestedByTag: r.requestedByTag, createdAt: r.createdAt,
    } });
});
app.get("/api/high-command/promotion-requests/history", ensureHighCommand, async (req, res) => {
    const list = await PromotionRequest.find({ status: { $ne: "pending" } }).sort({ reviewedAt: -1 }).limit(200);
    res.json({ list });
});
app.post("/api/high-command/promotion-requests/:id/approve", ensureHighCommand, async (req, res) => {
    const r = await PromotionRequest.findById(req.params.id);
    if (!r || r.status !== "pending") return res.status(404).json({ error: "غير موجود" });
    const p = await Personnel.findOne({ discord: r.targetDiscord });
    if (!p) return res.status(404).json({ error: "الفرد غير موجود" });
    const settings = await getSettings();
    const oldRank = p.rank;
    p.rank = r.toRank;
    p.points = r.direction === "up" ? await pointsForReachingRank(r.toRank, settings) : 0;
    await p.save();
    r.status = "approved"; r.reviewedBy = req.user.id; r.reviewedByTag = req.user.username + " (القيادة العليا)"; r.reviewedAt = new Date();
    await r.save();

    const verb = r.direction === "up" ? "ترقيتك" : "تنزيلك";
    await Personnel.findOneAndUpdate({ discord: r.targetDiscord }, { $push: { warnings: {
        kind: "notice", reason: `🎖️ تمت ${verb} من ${oldRank} إلى ${r.toRank} — بموافقة القيادة العليا.`,
        issuedBy: req.user.id, issuedByTag: req.user.username,
    } } });
    dmMember(r.targetDiscord, new EmbedBuilder()
        .setTitle("🎖️ تمت الموافقة على ترقيتك/تنزيلك")
        .setColor(0x22c55e)
        .addFields({ name: "من رتبة", value: oldRank, inline: true }, { name: "إلى رتبة", value: r.toRank, inline: true })
        .setTimestamp()).catch(() => {});
    if (r.requestedBy) {
        await Personnel.findOneAndUpdate({ discord: r.requestedBy }, { $push: { warnings: {
            kind: "notice", reason: `✅ انقبل طلبك بـ${r.direction === "up" ? "ترقية" : "تنزيل"} ${r.targetName || r.targetTag} من ${oldRank} إلى ${r.toRank} من القيادة العليا.`,
            issuedBy: req.user.id, issuedByTag: req.user.username,
        } } });
        dmMember(r.requestedBy, new EmbedBuilder()
            .setTitle("✅ تم قبول طلبك بالقيادة العليا")
            .setColor(0x22c55e)
            .setDescription(`طلبك بـ${r.direction === "up" ? "ترقية" : "تنزيل"} ${r.targetName || r.targetTag} من ${oldRank} إلى ${r.toRank} تم قبوله.`)
            .setTimestamp()).catch(() => {});
    }
    // لو الطلب من مسؤول أفراد (مو قائد/نائب)، لازم قائد القطاع يعرف كمان
    const sl = (settings.sectorLeadership || {})[r.sector];
    if (sl && sl.commanderId && sl.commanderId !== r.requestedBy) {
        await Personnel.findOneAndUpdate({ discord: sl.commanderId }, { $push: { warnings: {
            kind: "notice", reason: `🎖️ تمت ${r.direction === "up" ? "ترقية" : "تنزيل"} ${r.targetName || r.targetTag} من ${oldRank} إلى ${r.toRank} بأمر القيادة العليا.`,
            issuedBy: req.user.id, issuedByTag: req.user.username,
        } } });
        dmMember(sl.commanderId, new EmbedBuilder()
            .setTitle("🎖️ علم — تمت ترقية/تنزيل بقطاعك")
            .setColor(0xf59e0b)
            .setDescription(`تمت ${r.direction === "up" ? "ترقية" : "تنزيل"} ${r.targetName || r.targetTag} من ${oldRank} إلى ${r.toRank} بأمر القيادة العليا.`)
            .setTimestamp()).catch(() => {});
    }
    await logEvent({
        action: r.direction === "up" ? "ترقية عسكري" : "تنزيل عسكري", discordId: p.discord, discordTag: p.discordTag,
        actorId: req.user.id, actorTag: req.user.username + " (القيادة العليا)",
        details: `${oldRank} ← ${r.toRank} — السبب: ${r.reason || "-"}`,
    });
    res.json({ ok: true, personnel: p });
});
app.post("/api/high-command/promotion-requests/:id/reject", ensureHighCommand, async (req, res) => {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: "اكتب سبب الرفض" });
    const r = await PromotionRequest.findById(req.params.id);
    if (!r || r.status !== "pending") return res.status(404).json({ error: "غير موجود" });
    r.status = "rejected"; r.rejectReason = reason.trim(); r.reviewedBy = req.user.id; r.reviewedByTag = req.user.username + " (القيادة العليا)"; r.reviewedAt = new Date();
    await r.save();
    const verb = r.direction === "up" ? "ترقيتك" : "تنزيلك";
    await Personnel.findOneAndUpdate({ discord: r.targetDiscord }, { $push: { warnings: {
        kind: "notice", reason: `تم رفض طلب ${verb} من القيادة العليا. السبب: ${reason.trim()}`,
        issuedBy: req.user.id, issuedByTag: req.user.username,
    } } });
    dmMember(r.targetDiscord, new EmbedBuilder()
        .setTitle("❌ تم رفض طلب الترقية/التنزيل")
        .setColor(0xef4444)
        .addFields({ name: "السبب", value: reason.trim() })
        .setTimestamp()).catch(() => {});
    if (r.requestedBy) {
        await Personnel.findOneAndUpdate({ discord: r.requestedBy }, { $push: { warnings: {
            kind: "notice", reason: `❌ انرفض طلبك بـ${r.direction === "up" ? "ترقية" : "تنزيل"} ${r.targetName || r.targetTag} من القيادة العليا. السبب: ${reason.trim()}`,
            issuedBy: req.user.id, issuedByTag: req.user.username,
        } } });
        dmMember(r.requestedBy, new EmbedBuilder()
            .setTitle("❌ تم رفض طلبك بالقيادة العليا")
            .setColor(0xef4444)
            .setDescription(`طلبك بـ${r.direction === "up" ? "ترقية" : "تنزيل"} ${r.targetName || r.targetTag}.`)
            .addFields({ name: "السبب", value: reason.trim() })
            .setTimestamp()).catch(() => {});
    }
    await logEvent({ action: "رفض طلب ترقية/تنزيل", discordId: r.targetDiscord, discordTag: r.targetTag, actorId: req.user.id, actorTag: req.user.username + " (القيادة العليا)", details: `${r.fromRank} ← ${r.toRank} — السبب: ${reason.trim()}` });
    res.json({ ok: true });
});

// إدارة أعضاء القيادة العليا — كبار المسؤولين فقط
app.get("/api/senior/high-command", ensureSeniorAdmin, async (req, res) => {
    const settings = await getSettings();
    res.json({ list: settings.highCommand || [] });
});
app.post("/api/senior/high-command/add", ensureSeniorAdmin, async (req, res) => {
    const { discordId } = req.body;
    if (!discordId || !discordId.trim()) return res.status(400).json({ error: "حدد الشخص" });
    const person = await Personnel.findOne({ discord: discordId.trim() });
    if (!person || !person.registeredName) return res.status(400).json({ error: "لازم يكون هذا الشخص مسجل بالموقع" });
    const settings = await getSettings();
    if (!settings.highCommand) settings.highCommand = [];
    if (settings.highCommand.some(m => m.id === person.discord)) return res.status(400).json({ error: "موجود بالقيادة العليا بالفعل" });
    settings.highCommand.push({ id: person.discord, name: person.registeredName || person.discordTag });
    settings.markModified("highCommand");
    await settings.save();
    await logEvent({ action: "إضافة عضو للقيادة العليا", discordId: person.discord, discordTag: person.discordTag, actorId: req.user.id, actorTag: req.user.username, details: person.registeredName });
    res.json({ ok: true, list: settings.highCommand });
});
app.post("/api/senior/high-command/remove", ensureSeniorAdmin, async (req, res) => {
    const { discordId } = req.body;
    const settings = await getSettings();
    const removed = (settings.highCommand || []).find(m => m.id === discordId);
    settings.highCommand = (settings.highCommand || []).filter(m => m.id !== discordId);
    settings.markModified("highCommand");
    await settings.save();
    await logEvent({ action: "إزالة عضو من القيادة العليا", actorId: req.user.id, actorTag: req.user.username, details: removed?.name || discordId });
    res.json({ ok: true, list: settings.highCommand });
});

// ══════════════════════════════════════════════════════════════════════════
// 4.7) APIs مخصصة لموقع البنك (ربط رواتب العساكر) — بدون تسجيل دخول ديسكورد
//      يستخدمها البنك فقط للحصول على قائمة الرتب ورتبة كل عسكري مسجل
// ══════════════════════════════════════════════════════════════════════════

// قائمة الرتب العسكرية الرسمية (يستخدمها البنك لبناء جدول تحديد الرواتب)
app.get("/api/bank/ranks", async (req, res) => {
    res.json({ success: true, ranks: CONFIG.MILITARY_RANKS });
});

// رتبة كل عسكري مسجل (يستخدمها البنك وقت توزيع الرواتب لمطابقة كل حساب برتبته)
app.get("/api/bank/personnel-ranks", async (req, res) => {
    try {
        const list = await Personnel.find({ isBlocked: false }, "discord discordTag rank registeredName");
        const personnel = list.map(p => ({
            discord: p.discord,
            discordTag: p.discordTag,
            rank: p.rank,
            registeredName: p.registeredName,
        }));
        res.json({ success: true, personnel });
    } catch (e) {
        res.json({ success: false, msg: e.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// 5) الواجهة (صفحة واحدة SPA)
// ══════════════════════════════════════════════════════════════════════════
app.get("/", (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${CONFIG.SITE_NAME}</title>
<style>
    :root {
        --bg1: #0a1628; --bg2: #0d1f3c; --panel: rgba(255,255,255,0.04); --border: rgba(59,130,246,0.25);
        --gold: #3b82f6; --gold-soft: #60a5fa; --green: #1d4ed8; --green2: #3b82f6;
        --red: #ef4444; --amber: #eab308; --text: #e2e8f0; --muted: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Tajawal', 'Tahoma', 'Segoe UI', sans-serif; }
    body { background: linear-gradient(135deg, #0a1628 0%, #0d1f3c 40%, #0a2744 70%, #0d3060 100%); color: var(--text); min-height: 100vh; }
    #warn-banner { position: sticky; top: 0; z-index: 1000; width: 100%; background: linear-gradient(90deg,#7f1d1d,#991b1b); color: #fecaca; text-align: center; padding: 10px 14px; font-weight: bold; font-size: 13px; box-shadow: 0 2px 10px rgba(0,0,0,0.4); }
    .fp-wrap { max-width: 420px; margin: 40px auto; text-align: center; padding: 0 16px; }
    .fp-circle { width: 160px; height: 160px; border-radius: 50%; border: 4px solid var(--border); background: var(--panel); display: flex; align-items: center; justify-content: center; margin: 20px auto; cursor: pointer; user-select: none; position: relative; overflow: hidden; transition: 0.15s; }
    .fp-circle .fp-fill { position: absolute; bottom: 0; left: 0; width: 100%; height: 0%; background: linear-gradient(180deg, var(--gold), var(--green)); transition: height linear; opacity: 0.55; }
    .fp-circle .fp-icon { font-size: 56px; position: relative; z-index: 2; color: var(--gold-soft); }
    .fp-circle .fp-icon svg { width: 68px; height: 68px; display: block; }
    .fp-circle.scanning { border-color: var(--gold); box-shadow: 0 0 25px rgba(59,130,246,0.5); }
    .fp-status { margin-top: 14px; font-size: 14px; min-height: 20px; }
    .fp-status.ok { color: #4ade80; }
    .fp-status.fail { color: #f87171; }
    nav { background: rgba(5,15,30,0.95); backdrop-filter: blur(15px); border-bottom: 1px solid rgba(59,130,246,0.3); padding: 0 1.2rem; display: flex; align-items: center; justify-content: space-between; height: 62px; position: sticky; top: 37px; z-index: 900; }
    .logo { font-size: 1.3rem; font-weight: 900; background: linear-gradient(90deg, #3b82f6, #60a5fa, #93c5fd); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 2px; }
    .nav-links { display: flex; gap: 0.3rem; list-style: none; flex-wrap: wrap; }
    .nav-links button { background: transparent; border: 1px solid transparent; color: #94a3b8; padding: 0.4rem 0.8rem; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 0.85rem; transition: all 0.2s; }
    .nav-links button:hover { background: rgba(59,130,246,0.2); border-color: #3b82f6; color: #60a5fa; }
    .hamburger-btn { display: none; background: rgba(59,130,246,0.15); border: 1px solid #3b82f6; color: #60a5fa; padding: 0.4rem 0.7rem; border-radius: 8px; cursor: pointer; font-size: 1.2rem; }
    .mobile-menu { display: none; position: fixed; top: 99px; left: 0; width: 230px; background: rgba(5,15,30,0.98); border: 1px solid rgba(59,130,246,0.35); border-radius: 0 0 14px 0; z-index: 950; padding: 8px 0; box-shadow: 4px 8px 30px rgba(0,0,0,0.7); }
    .mobile-menu.open { display: block; }
    .mobile-menu button { display: block; width: 100%; background: transparent; border: none; border-bottom: 1px solid rgba(59,130,246,0.08); color: #94a3b8; padding: 12px 20px; text-align: right; font-family: inherit; font-size: 0.9rem; cursor: pointer; }
    .mobile-menu button:hover { background: rgba(59,130,246,0.18); color: #60a5fa; }
    @media (max-width: 760px) { .nav-links { display: none !important; } .hamburger-btn { display: inline-block; } }
    .wrap { max-width: 940px; margin: 0 auto; padding: 20px 16px 60px; }
    .card { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 18px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
    h1, h2, h3 { color: var(--gold-soft); margin-bottom: 12px; }
    .btn { display: inline-block; background: linear-gradient(135deg, var(--green), var(--green2)); color: #fff; border: none; border-radius: 8px; padding: 0.6rem 1.3rem; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: 0.2s; }
    .btn:hover { opacity: 0.85; transform: translateY(-1px); }
    .btn.danger { background: #ef4444; }
    .btn.gray { background: rgba(255,255,255,0.08); border: 1px solid rgba(59,130,246,0.25); color: #94a3b8; }
    .btn.gold { background: linear-gradient(135deg, #1d4ed8, #60a5fa); color: #fff; }
    .btn.sm { padding: 0.4rem 0.9rem; font-size: 0.8rem; }
    input, select, textarea { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,0.06); color: #fff; margin-bottom: 10px; font-size: 14px; }
    label { display: block; margin-bottom: 6px; color: var(--gold-soft); font-size: 13px; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .badge.pending { background: rgba(234,179,8,0.15); color: #fbbf24; border: 1px solid #eab308; }
    .badge.approved { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid #22c55e; }
    .badge.rejected { background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid #ef4444; }
    .stat { text-align: center; padding: 14px; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid var(--border); }
    .stat .num { font-size: 24px; font-weight: 900; color: var(--gold-soft); }
    .stat .lbl { font-size: 12px; color: var(--muted); }
    .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
    .center { text-align: center; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px; border-bottom: 1px solid var(--border); text-align: right; vertical-align: middle; }
    .avatar { width: 70px; height: 70px; border-radius: 50%; border: 3px solid var(--gold); }
    .thumb { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border); cursor: pointer; }
    .tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .tab { background: rgba(255,255,255,0.04); border: 1px solid rgba(59,130,246,0.3); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; color: #94a3b8; }
    .tab.active { background: var(--green2); color: #fff; border-color: var(--green2); }
    .log-item { background: rgba(255,255,255,0.02); border: 1px solid rgba(59,130,246,0.2); border-radius: 8px; padding: 10px 15px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem; }
    .id-card { background: linear-gradient(135deg, #1e3a5f, #0f2848); border: 2px solid var(--gold); border-radius: 20px; padding: 22px; max-width: 400px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .rank-line { display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 15px; color: var(--gold-soft); margin: 10px 0; font-weight: bold; }
    .hidden { display: none !important; }
    #toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #0d1f3c; padding: 10px 20px; border-radius: 10px; border: 1px solid var(--gold); z-index: 999; display: none; }
    .fab { position: fixed; bottom: 25px; right: 25px; z-index: 998; background: linear-gradient(135deg, #1d4ed8, #3b82f6); color: #fff; border: 2px solid rgba(255,255,255,0.2); padding: 14px 24px; border-radius: 50px; font-weight: bold; font-family: inherit; font-size: 14px; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.4); transition: 0.3s; }
    .fab:hover { transform: scale(1.05); }
    .vgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px; margin-bottom: 10px; }
    .vcard { border: 2px solid var(--border); border-radius: 10px; padding: 6px; text-align: center; cursor: pointer; font-size: 11px; background: rgba(255,255,255,0.03); }
    .vcard.sel { border-color: var(--gold); background: rgba(59,130,246,0.12); }
    .vcard img { width: 100%; height: 54px; object-fit: cover; border-radius: 6px; margin-bottom: 4px; }


    /* ── فورم اختيار نوع/أنواع المخالفة (بدل القائمة المنسدلة) ─────────────── */
    #vtype-overlay { display: none; position: fixed; inset: 0; z-index: 2600; background: rgba(0,0,0,0.75); align-items: center; justify-content: center; padding: 20px; overflow-y: auto; }
    #vtype-overlay.open { display: flex; }
    .vtype-box { background: #0d1f3c; border: 1px solid var(--gold); border-radius: 14px; padding: 22px; max-width: 460px; width: 100%; max-height: 85vh; overflow-y: auto; margin: auto; }
    .vtype-box h3 { margin-bottom: 14px; color: var(--gold-soft); text-align: center; }
    .vtype-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .vtype-opt { border: 2px solid var(--border); border-radius: 10px; padding: 10px 14px; font-size: 13px; cursor: pointer; background: rgba(255,255,255,0.04); color: #fff; }
    .vtype-opt.sel { border-color: #22c55e; background: rgba(34,197,94,0.28); color: #4ade80; font-weight: bold; }
    .vtype-actions { display: flex; gap: 8px; margin-top: 18px; }
    .vtype-actions button { flex: 1; }
    .login-screen { text-align: center; padding: 4rem 2rem; }
    .login-screen h1 { font-size: 3rem; color: #3b82f6; text-shadow: 0 0 20px rgba(59,130,246,0.5); margin-bottom: 10px; }
    footer { text-align: center; padding: 1.5rem; margin-top: 2rem; border-top: 1px solid var(--border); background: rgba(255,255,255,0.02); color: var(--muted); font-size: 0.9rem; }
    /* صفحة عرض الصورة بملء الشاشة — نفس أسلوب ديسكورد */
    #photo-page { display: none; position: fixed; inset: 0; z-index: 5000; background: #000; flex-direction: column; }
    #photo-page.open { display: flex; }
    #photo-page .pp-bar { display: flex; align-items: center; padding: env(safe-area-inset-top,14px) 8px 10px; background: rgba(0,0,0,0.55); flex-shrink: 0; }
    #photo-page .pp-back { background: none; border: none; color: #fff; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 4px; cursor: pointer; padding: 10px 14px; -webkit-tap-highlight-color: transparent; }
    #photo-page .pp-body { flex: 1; display: flex; align-items: center; justify-content: center; overflow: auto; touch-action: pinch-zoom; }
    #photo-page .pp-body img { max-width: 100%; max-height: 100%; object-fit: contain; }
    #photo-page .pp-loading { color: #cbd5e1; font-size: 14px; text-align: center; padding: 20px; }

    /* ── تحذير / إشعار (شاشة كاملة) ────────────────────────────────── */
    #warn-overlay { display: none; position: fixed; inset: 0; z-index: 3000; align-items: center; justify-content: center; flex-direction: column; gap: 10px; padding: 20px; text-align: center; }
    #warn-overlay.open { display: flex; }
    #warn-overlay.k-warning { background: radial-gradient(circle at center, #7a1a1a, #3d0d0d); }
    #warn-overlay.k-notice { background: radial-gradient(circle at center, #7a4a12, #3d2506); }
    .warn-box { border: 2px dashed rgba(255,255,255,0.55); border-radius: 10px; padding: 26px 40px; max-width: 480px; }
    .warn-title { font-size: 30px; font-weight: bold; color: #fff; display: flex; align-items: center; justify-content: center; gap: 10px; }
    .warn-title .tri { color: #f87171; }
    #warn-overlay.k-notice .warn-title .tri { color: #fbbf24; }
    .warn-line { border: none; border-top: 1px solid rgba(255,255,255,0.5); margin: 12px 0; }
    .warn-extra { color: #fde047; font-size: 16px; font-weight: bold; margin-top: 4px; }
    .warn-reason { color: #fff; font-size: 19px; margin-top: 8px; line-height: 1.6; }
    .warn-ack-btn { margin-top: 26px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.5); color: #fff; padding: 12px 22px; border-radius: 10px; font-family: inherit; font-size: 14px; cursor: pointer; }
    .warn-ack-btn:hover { background: rgba(255,255,255,0.2); }

    /* ── تنبيه القيادة العليا بطلب ترقية/تنزيل جديد (شاشة كاملة زي نظام التحذيرات) ─── */
    #promo-alert-overlay { display: none; position: fixed; inset: 0; z-index: 2500; background: radial-gradient(circle at center, #14532d, #052e16); color: #fff; text-align: center; flex-direction: column; align-items: center; justify-content: center; padding: 20px; overflow-y: auto; }
    #promo-alert-overlay.open { display: flex; }
    .promo-box { border: 2px dashed rgba(255,255,255,0.55); border-radius: 10px; padding: 26px 40px; max-width: 480px; }
    .promo-title { font-size: 28px; font-weight: bold; color: #fff; display: flex; align-items: center; justify-content: center; gap: 10px; }
    .promo-extra { color: #86efac; font-size: 16px; font-weight: bold; margin-top: 10px; line-height: 1.7; white-space: pre-line; }
    .promo-reason { color: #fff; font-size: 17px; margin-top: 10px; line-height: 1.6; }
    .promo-actions { display: flex; gap: 12px; margin-top: 26px; }
    .promo-actions button { padding: 12px 22px; border-radius: 10px; font-family: inherit; font-size: 14px; cursor: pointer; border: 1px solid rgba(255,255,255,0.5); color: #fff; }
    .promo-approve-btn { background: rgba(34,197,94,0.35); }
    .promo-approve-btn:hover { background: rgba(34,197,94,0.55); }
    .promo-reject-btn { background: rgba(248,113,113,0.25); }
    .promo-reject-btn:hover { background: rgba(248,113,113,0.45); }

    /* ── فورم إرسال تحذير/إشعار (بديل عن prompt/confirm) ─────────────── */
    #wf-overlay { display: none; position: fixed; inset: 0; z-index: 2500; background: rgba(0,0,0,0.75); align-items: center; justify-content: center; padding: 20px; overflow-y: auto; }
    #wf-overlay.open { display: flex; }
    .wf-box { background: #0d1f3c; border: 1px solid var(--gold); border-radius: 14px; padding: 22px; max-width: 380px; width: 100%; text-align: center; max-height: 85vh; overflow-y: auto; margin: auto; }
    .wf-box h3 { margin-bottom: 14px; color: var(--gold-soft); }
    .wf-choice-row { display: flex; gap: 10px; margin-top: 6px; }
    .wf-choice-row button { flex: 1; padding: 14px 8px; border-radius: 10px; font-family: inherit; font-size: 14px; cursor: pointer; border: 1px solid var(--border); background: rgba(255,255,255,0.04); color: #fff; }
    .wf-choice-row button.wf-warning:hover { border-color: #f87171; background: rgba(248,113,113,0.12); }
    .wf-choice-row button.wf-notice:hover { border-color: #fbbf24; background: rgba(251,191,36,0.12); }
    .wf-box textarea { width: 100%; min-height: 90px; margin-top: 10px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 8px; color: #fff; padding: 10px; font-family: inherit; font-size: 14px; resize: vertical; }
    .wf-actions { display: flex; gap: 8px; margin-top: 14px; }
    .wf-actions button { flex: 1; }
</style>
<div id="wf-overlay">
    <div class="wf-box" id="wf-box"></div>
</div>
<div id="warn-overlay">
    <div class="warn-box">
        <div class="warn-title"><span class="tri">⚠️</span><span id="warn-title-text">تحذير</span><span class="tri">⚠️</span></div>
        <hr class="warn-line">
        <div class="warn-extra" id="warn-extra-text"></div>
        <div class="warn-reason" id="warn-reason-text"></div>
    </div>
    <button class="warn-ack-btn" id="warn-ack-btn" onclick="ackCurrentWarning()">🤝 اتعاهد وأقر بعدم تكرار ذلك</button>
    <div class="row" id="warn-notereview-actions" style="display:none;gap:10px;margin-top:10px;">
        <button class="btn danger sm" onclick="noteReviewDelete()">🗑️ حذف الملاحظة</button>
        <button class="btn sm" onclick="noteReviewExtend()">⏳ تمديد 5 أيام</button>
    </div>
</div>
<div id="promo-alert-overlay">
    <div class="promo-box">
        <div class="promo-title"><span>🎖️</span><span>ترقية عسكرية</span><span>🎖️</span></div>
        <hr class="warn-line">
        <div class="promo-extra" id="promo-alert-extra"></div>
        <div class="promo-reason" id="promo-alert-reason"></div>
    </div>
    <div class="promo-actions">
        <button class="promo-approve-btn" onclick="promoAlertApprove()">✅ قبول</button>
        <button class="promo-reject-btn" onclick="promoAlertReject()">❌ رفض</button>
    </div>
</div>
<div id="vtype-overlay">
    <div class="vtype-box">
        <h3>اختر نوع/أنواع المخالفة</h3>
        <div class="vtype-grid" id="vtype-grid"></div>
        <div class="vtype-actions">
            <button class="btn gray" onclick="closeVTypeOverlay()">إلغاء</button>
            <button class="btn" onclick="confirmVTypeSelection()">✅ تم</button>
        </div>
    </div>
</div>
</head>
<body>
<div id="warn-banner">⚠️ تنبيه: هذا الموقع مخصص للمحاكاة واللعب فقط، ولا يمت للواقع بصلة.</div>
<nav>
    <div class="logo">🚨 ${CONFIG.SITE_NAME}</div>
    <ul class="nav-links" id="nav-links"></ul>
    <button class="hamburger-btn" onclick="toggleMobileMenu()">☰</button>
</nav>
<div class="mobile-menu" id="mobile-menu"></div>
<div class="wrap" id="app"><div class="card center">جارِ التحميل...</div></div>
<div id="toast"></div>
<div id="photo-page">
    <div class="pp-bar"><button class="pp-back" onclick="closePhotoPage()">‹ رجوع</button></div>
    <div class="pp-body" onclick="if(event.target===this) closePhotoPage()">
        <div id="photo-page-loading" class="pp-loading">جارِ تحميل الصورة...</div>
        <img id="photo-page-img" src="" style="display:none;">
    </div>
</div>
<footer><p>جميع الحقوق محفوظة © 2026 | <span style="color:#d4af37;font-weight:bold;">${CONFIG.SITE_NAME}</span></p></footer>

<script>
const MILITARY_RANKS = ${JSON.stringify(CONFIG.MILITARY_RANKS)};
let ME = null;
let lastKnownRank = null;
let META = { types: [], vehicles: [] };
let selectedVehicle = null;
let photoBase64 = null;
let reportMeta = { vehicles: [] };
let reportSelectedVehicle = null;
let reportVehiclePhoto = null;
let currentAdminTab = null;
let pollTimer = null;
let blockedPollTimer = null;

// يمسك آخر زر ضُغط فعليًا (يشتغل حتى على سفاري آيفون اللي ما يعطي focus للأزرار تلقائيًا عند اللمس)
let __lastClickedBtn = null;
document.addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (b) __lastClickedBtn = b;
}, true);

// كل الأزرار اللي تستدعي api() توقف فورًا (تعتيم + تعطيل) لحظة الضغط وترجع بعد الرد —
// يمنع إحساس "تعليق" الزر ويمنع إرسال نفس الطلب مرتين لو ضغط المستخدم أكثر من مرة.
// ملاحظة: ما نرفض الطلب لو الزر "busy" — لأن تعطيل الزر (disabled) نفسه كافي يمنع الضغط المكرر،
// ورفض الطلب بناءً على متغيّر عالمي واحد كان يسبب تعليق كل طلبات الموقع لو طلب واحد بس علّق أو فشل بصمت.
async function api(url, opts) {
    const btn = (__lastClickedBtn && __lastClickedBtn.isConnected) ? __lastClickedBtn : null;
    if (btn) {
        btn.dataset.prevOpacity = btn.style.opacity || '';
        btn.disabled = true;
        btn.style.opacity = '0.55';
        btn.style.cursor = 'wait';
    }
    try {
        const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'خطأ');
        return data;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = btn.dataset.prevOpacity || '';
            btn.style.cursor = '';
        }
    }
}
function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 2800);
}
// صفحة عرض الصورة بملء الشاشة (نفس أسلوب ديسكورد) — تفتح كصفحة ثانية فوق الموقع بدل نافذة منبثقة صغيرة
function openPhotoPage() {
    const loading = document.getElementById('photo-page-loading');
    const img = document.getElementById('photo-page-img');
    loading.textContent = 'جارِ تحميل الصورة...';
    loading.style.display = 'block';
    img.style.display = 'none';
    img.src = '';
    document.getElementById('photo-page').classList.add('open');
    history.pushState({ photoPage: true }, '');
}
function setPhotoPageImage(src) {
    document.getElementById('photo-page-loading').style.display = 'none';
    const img = document.getElementById('photo-page-img');
    img.src = src;
    img.style.display = 'block';
}
function setPhotoPageError(msg) {
    document.getElementById('photo-page-loading').textContent = msg + ' — اضغط رجوع وحاول مرة ثانية';
}
function closePhotoPage(skipHistory) {
    document.getElementById('photo-page').classList.remove('open');
    document.getElementById('photo-page-img').src = '';
    if (!skipHistory && history.state && history.state.photoPage) history.back();
}
window.addEventListener('popstate', () => {
    const pp = document.getElementById('photo-page');
    if (pp.classList.contains('open')) closePhotoPage(true);
});
// يجيب صورة المخالفة عند الضغط فقط (بدل تحميلها كلها مع القائمة) — يسرّع تحميل الصفحة
async function viewViolationPhoto(id) {
    openPhotoPage();
    try {
        const { photo } = await api('/api/violations/' + id + '/photo');
        if (!photo) return setPhotoPageError('لا توجد صورة');
        setPhotoPageImage(photo);
    } catch (e) { setPhotoPageError(e.message); }
}
// يجيب صورة الملاحظة عند الضغط فقط (نفس أسلوب صورة المخالفة)
async function viewNotePhoto(discord, noteId) {
    openPhotoPage();
    try {
        const { photo } = await api('/api/notes/' + discord + '/' + noteId + '/photo');
        if (!photo) return setPhotoPageError('لا توجد صورة');
        setPhotoPageImage(photo);
    } catch (e) { setPhotoPageError(e.message); }
}

// ── فورم إرسال تحذير/إشعار (فورم مخصص للموقع، مو نوافذ نظام الجهاز الافتراضية) ──
function openWarnForm(discord, apiBase) {
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>وش تبي ترسل لهذا الشخص؟</h3>
        <div class="wf-choice-row">
            <button class="wf-warning" onclick="warnFormReason('\${discord}','\${apiBase}','warning')">⚠️ تحذير</button>
            <button class="wf-notice" onclick="warnFormReason('\${discord}','\${apiBase}','notice')">🔔 إشعار</button>
        </div>
        <div class="wf-actions"><button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button></div>\`;
    document.getElementById('wf-overlay').classList.add('open');
}
async function warnFormReason(discord, apiBase, kind) {
    const box = document.getElementById('wf-box');
    if (kind === 'notice') {
        box.innerHTML = \`
            <h3>🔔 ضع سبب الإشعار</h3>
            <textarea id="wf-reason" placeholder="اكتب السبب هنا..."></textarea>
            <div class="wf-actions">
                <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
                <button class="btn sm" onclick="submitWarnForm('\${discord}','\${apiBase}','notice')">إرسال</button>
            </div>\`;
        return;
    }

    // تحذير: نحدد أول شي رقم التحذير (أول/ثاني/ثالث/فصل تلقائي) عشان نعرض الفورم المناسب
    box.innerHTML = '<h3>⚠️ جارِ التحقق من عدد التحذيرات...</h3>';
    let wn = 1;
    try {
        const info = await api(apiBase + discord + '/warning-info');
        wn = (info.count || 0) + 1;
    } catch (e) { toast(e.message); }

    if (wn === 1) {
        box.innerHTML = \`
            <h3>⚠️ التحذير الأول — سيُخصم 10 نقاط تلقائيًا</h3>
            <textarea id="wf-reason" placeholder="اكتب السبب هنا..."></textarea>
            <div class="wf-actions">
                <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
                <button class="btn sm" onclick="submitWarnForm('\${discord}','\${apiBase}','warning')">إرسال</button>
            </div>\`;
    } else if (wn === 2) {
        box.innerHTML = \`
            <h3>⚠️ التحذير الثاني — تنزيل رتبة واحدة + خصم 25 نقطة تلقائيًا</h3>
            <textarea id="wf-reason" placeholder="اكتب السبب هنا..."></textarea>
            <div class="wf-actions">
                <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
                <button class="btn sm" onclick="submitWarnForm('\${discord}','\${apiBase}','warning')">إرسال</button>
            </div>\`;
    } else {
        box.innerHTML = \`
            <h3>🚫 التحذير الثالث — سيتم فصل العضو نهائيًا</h3>
            <p style="font-size:13px;color:#fca5a5;margin-top:6px;line-height:1.6;">هذا التحذير الثالث لهذا العضو. إرساله يعني فصله نهائيًا من الخدمة العسكرية فور الإرسال.</p>
            <textarea id="wf-reason" placeholder="اكتب سبب هذا التحذير (سبب الفصل)..." style="margin-top:8px;"></textarea>
            <div class="wf-actions">
                <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
                <button class="btn sm" style="background:#7f1d1d;color:#fff;" onclick="submitWarnForm('\${discord}','\${apiBase}','warning')">تأكيد الفصل</button>
            </div>\`;
    }
}
function closeWarnForm() {
    document.getElementById('wf-overlay').classList.remove('open');
    document.getElementById('wf-box').innerHTML = '';
}
async function submitWarnForm(discord, apiBase, kind) {
    const reason = document.getElementById('wf-reason').value;
    if (!reason || !reason.trim()) return toast('لازم تكتب السبب');
    const body = { kind, reason };
    try {
        const result = await api(apiBase + discord + '/warn', { method: 'POST', body: JSON.stringify(body) });
        toast(kind === 'warning' ? (result.dismissed ? '🚫 تم فصل العضو تلقائيًا' : '✅ تم إرسال التحذير') : '✅ تم إرسال الإشعار');
        closeWarnForm();
    } catch (e) { toast(e.message); }
}

// ── فورم ملاحظة موحّد (سبب + صورة إجبارية) — يستخدمه كبار المسؤولين/قادة القطاعات/مسؤولي الأفراد/الشرطة العسكرية ──
let noteFormCtx = null;
let noteImageData = null;
function openNoteForm(discord, apiBase, reloadCall) {
    noteFormCtx = { discord, apiBase, reloadCall };
    noteImageData = null;
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>📝 إضافة ملاحظة</h3>
        <textarea id="nf-text" placeholder="اكتب سبب الملاحظة..."></textarea>
        <label style="margin-top:8px;display:block;font-size:13px;color:var(--muted);">صورة الملاحظة (إجبارية)</label>
        <input type="file" id="nf-image" accept="image/*" onchange="previewNoteImage()">
        <img id="nf-preview" style="display:none;max-width:100%;border-radius:8px;margin-top:8px;">
        <div class="wf-actions">
            <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
            <button class="btn sm" onclick="submitNoteForm()">إرسال</button>
        </div>\`;
    document.getElementById('wf-overlay').classList.add('open');
}
function previewNoteImage() {
    const input = document.getElementById('nf-image');
    const file = input.files[0];
    if (!file) { noteImageData = null; return; }
    if (file.size > ${CONFIG.MAX_PHOTO_MB} * 1024 * 1024) { toast('الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB'); input.value = ''; noteImageData = null; return; }
    const reader = new FileReader();
    reader.onload = () => {
        noteImageData = reader.result;
        const img = document.getElementById('nf-preview');
        if (img) { img.src = noteImageData; img.style.display = 'block'; }
    };
    reader.readAsDataURL(file);
}
async function submitNoteForm() {
    const text = document.getElementById('nf-text').value;
    if (!text || !text.trim()) return toast('اكتب الملاحظة');
    if (!noteImageData) return toast('لازم ترفق صورة مع الملاحظة');
    try {
        await api(noteFormCtx.apiBase + noteFormCtx.discord + '/note', { method: 'POST', body: JSON.stringify({ text, image: noteImageData }) });
        toast('✅ تمت إضافة الملاحظة');
        closeWarnForm();
        noteImageData = null;
        if (noteFormCtx.reloadCall) { try { Function(noteFormCtx.reloadCall)(); } catch (e) {} }
    } catch (e) { toast(e.message); }
}

// ── فورم ملاحظة القطاعات — يسأل "هل لديك دليل؟" أولاً، والصورة تظهر بس لو "نعم" ──
function openSectorNoteForm(discord, apiBase, reloadCall) {
    noteFormCtx = { discord, apiBase, reloadCall };
    noteImageData = null;
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>📝 إضافة ملاحظة</h3>
        <p style="color:var(--muted);font-size:13px;margin-top:6px;">هل لديك دليل (صورة) على هذي الملاحظة؟</p>
        <div class="wf-choice-row">
            <button class="wf-warning" onclick="sectorNoteHasEvidence(true)">نعم</button>
            <button class="wf-notice" onclick="sectorNoteHasEvidence(false)">لا</button>
        </div>
        <div class="wf-actions"><button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button></div>\`;
    document.getElementById('wf-overlay').classList.add('open');
}
function sectorNoteHasEvidence(hasEvidence) {
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>📝 إضافة ملاحظة</h3>
        <textarea id="nf-text" placeholder="اكتب سبب الملاحظة..."></textarea>
        \${hasEvidence ? \`
        <label style="margin-top:8px;display:block;font-size:13px;color:var(--muted);">صورة الملاحظة (إجبارية)</label>
        <input type="file" id="nf-image" accept="image/*" onchange="previewNoteImage()">
        <img id="nf-preview" style="display:none;max-width:100%;border-radius:8px;margin-top:8px;">\` : ''}
        <div class="wf-actions">
            <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
            <button class="btn sm" onclick="submitSectorNoteForm(\${hasEvidence})">إرسال</button>
        </div>\`;
}
async function submitSectorNoteForm(hasEvidence) {
    const text = document.getElementById('nf-text').value;
    if (!text || !text.trim()) return toast('اكتب الملاحظة');
    if (hasEvidence && !noteImageData) return toast('لازم ترفق صورة مع الملاحظة');
    try {
        await api(noteFormCtx.apiBase + noteFormCtx.discord + '/note', { method: 'POST', body: JSON.stringify({ text, image: hasEvidence ? noteImageData : null }) });
        toast('✅ تمت إضافة الملاحظة');
        closeWarnForm();
        noteImageData = null;
        if (noteFormCtx.reloadCall) { try { Function(noteFormCtx.reloadCall)(); } catch (e) {} }
    } catch (e) { toast(e.message); }
}

// ── فورم الاستدعاء (الآن / وقت محدد + صباح أو مساء) ──
let summonFormCtx = null;
function openSummonForm(discord, apiPath, reloadCall) {
    summonFormCtx = { discord, apiPath, reloadCall };
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>📣 استدعاء عسكري</h3>
        <div class="wf-choice-row">
            <button class="wf-warning" onclick="summonPickMode('now')">⏱️ الآن</button>
            <button class="wf-notice" onclick="summonPickMode('scheduled')">🕒 وقت محدد</button>
        </div>
        <div class="wf-actions"><button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button></div>\`;
    document.getElementById('wf-overlay').classList.add('open');
}
function summonPickMode(mode) {
    const box = document.getElementById('wf-box');
    if (mode === 'now') {
        box.innerHTML = \`
            <h3>⏱️ استدعاء فوري</h3>
            <p style="font-size:13px;color:var(--muted);margin-top:6px;">بيوصل للعضو إشعار "لديك استدعاء" فوراً.</p>
            <div class="wf-actions">
                <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
                <button class="btn sm" onclick="submitSummonForm('now')">إرسال</button>
            </div>\`;
        return;
    }
    box.innerHTML = \`
        <h3>🕒 حدد وقت الاستدعاء</h3>
        <div class="row" style="gap:8px;">
            <input type="number" id="sf-hour" placeholder="الساعة (1-12)" min="1" max="12" style="width:33%;">
            <input type="number" id="sf-minute" placeholder="الدقيقة" min="0" max="59" style="width:33%;">
            <select id="sf-ampm" style="width:33%;"><option value="صباح">صباح</option><option value="مساء">مساء</option></select>
        </div>
        <div class="wf-actions">
            <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
            <button class="btn sm" onclick="submitSummonForm('scheduled')">إرسال</button>
        </div>\`;
}
async function submitSummonForm(mode) {
    const body = { mode };
    if (mode === 'scheduled') {
        body.hour = document.getElementById('sf-hour').value;
        body.minute = document.getElementById('sf-minute').value;
        body.ampm = document.getElementById('sf-ampm').value;
        if (!body.hour || !body.minute) return toast('حدد الوقت كاملاً');
    }
    try {
        const r = await api(summonFormCtx.apiPath + summonFormCtx.discord + '/summon', { method: 'POST', body: JSON.stringify(body) });
        toast(r.pending ? '✅ تم إرسال طلب الاستدعاء لقيادة الشرطة العسكرية' : '✅ تم إرسال الاستدعاء');
        closeWarnForm();
        if (summonFormCtx.reloadCall) { try { Function(summonFormCtx.reloadCall)(); } catch (e) {} }
    } catch (e) { toast(e.message); }
}

// ── إشعار للجميع (لكل الأعضاء المسجلين بالموقع) ─────────────────────────
function openWarnAllForm() {
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>📢 ضع نص الإشعار (سيصل لكل الأعضاء المسجلين)</h3>
        <textarea id="wf-reason-all" placeholder="اكتب نص الإشعار هنا..."></textarea>
        <div class="wf-actions">
            <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
            <button class="btn sm" onclick="submitWarnAllForm()">إرسال للجميع</button>
        </div>\`;
    document.getElementById('wf-overlay').classList.add('open');
}
async function submitWarnAllForm() {
    const reason = document.getElementById('wf-reason-all').value;
    if (!reason || !reason.trim()) return toast('لازم تكتب النص');
    if (!confirm('متأكد تبي ترسل هذا الإشعار لكل الأعضاء المسجلين بالموقع؟')) return;
    try {
        const { count } = await api('/api/senior/personnel/warn-all', { method: 'POST', body: JSON.stringify({ reason }) });
        toast('✅ تم الإرسال لـ ' + count + ' عضو');
        closeWarnForm();
    } catch (e) { toast(e.message); }
}

// ── عرض التحذير/الإشعار بوجه المستقبِل (شاشة كاملة، تُفتح تلقائياً بالبولينج) ──
let currentWarningId = null;
async function checkPendingWarning() {
    if (document.getElementById('warn-overlay').classList.contains('open')) return; // فيه وحدة معروضة أصلاً
    try {
        const { warning } = await api('/api/warnings/pending');
        if (warning) showWarningOverlay(warning);
    } catch (e) {}
}
function showWarningOverlay(w) {
    currentWarningId = w.id;
    currentNoteReview = w.kind === 'note-review' ? {
        discord: w.noteReviewTargetDiscord, noteId: w.noteReviewNoteId,
    } : null;
    const overlay = document.getElementById('warn-overlay');
    overlay.classList.remove('k-warning', 'k-notice');
    overlay.classList.add(w.kind === 'warning' ? 'k-warning' : 'k-notice');
    const numLabel = { 1: 'تحذير أول', 2: 'تحذير ثاني', 3: 'تحذير ثالث' };
    document.getElementById('warn-title-text').textContent = w.kind === 'warning' ? (numLabel[w.warningNumber] || 'تحذير') : w.kind === 'note-review' ? '📋 مراجعة ملاحظة' : 'إشعار';
    let extra = '';
    if (w.kind === 'warning' && (w.warningNumber === 1 || w.warningNumber === 2) && w.pointsDeducted) extra = w.penaltyLabel || ('تم خصم ' + w.pointsDeducted + ' نقطة من رصيدك');
    if (w.kind === 'warning' && w.warningNumber >= 3 && w.penaltyLabel) extra = 'العقوبة المطبقة: ' + w.penaltyLabel;
    if (w.kind === 'note-review') extra = (w.noteReviewSectorLabel || '') + (w.noteReviewTargetName ? ' — ' + w.noteReviewTargetName : '');
    document.getElementById('warn-extra-text').textContent = extra;
    document.getElementById('warn-reason-text').textContent = w.kind === 'note-review' ? (w.noteReviewText || w.reason) : w.reason;
    document.getElementById('warn-ack-btn').style.display = w.kind === 'note-review' ? 'none' : '';
    document.getElementById('warn-ack-btn').textContent = w.kind === 'warning' ? '🤝 اتعاهد وأقر بعدم تكرار ذلك' : '✅ تم الاطلاع';
    document.getElementById('warn-notereview-actions').style.display = w.kind === 'note-review' ? 'flex' : 'none';
    overlay.classList.add('open');
}
let currentNoteReview = null;
async function noteReviewDelete() {
    if (!currentNoteReview || !currentWarningId) return;
    if (!confirm('متأكد تبي تحذف هذي الملاحظة نهائياً؟')) return;
    try {
        await api('/api/notes/' + currentNoteReview.discord + '/' + currentNoteReview.noteId, { method: 'DELETE' });
        await api('/api/warnings/' + currentWarningId + '/ack', { method: 'POST' });
        toast('🗑️ تم حذف الملاحظة');
        document.getElementById('warn-overlay').classList.remove('open');
        currentWarningId = null; currentNoteReview = null;
        checkPendingWarning();
    } catch (e) { toast(e.message); }
}
async function noteReviewExtend() {
    if (!currentNoteReview || !currentWarningId) return;
    try {
        await api('/api/notes/' + currentNoteReview.discord + '/' + currentNoteReview.noteId + '/extend-review', { method: 'POST' });
        await api('/api/warnings/' + currentWarningId + '/ack', { method: 'POST' });
        toast('⏳ تم تمديد المراجعة 5 أيام');
        document.getElementById('warn-overlay').classList.remove('open');
        currentWarningId = null; currentNoteReview = null;
        checkPendingWarning();
    } catch (e) { toast(e.message); }
}
async function ackCurrentWarning() {
    if (!currentWarningId) return;
    const btn = document.getElementById('warn-ack-btn');
    btn.disabled = true;
    try {
        await api('/api/warnings/' + currentWarningId + '/ack', { method: 'POST' });
        document.getElementById('warn-overlay').classList.remove('open');
        currentWarningId = null;
        checkPendingWarning(); // لو فيه تحذير ثاني بالطابور
    } catch (e) { toast(e.message); }
    btn.disabled = false;
}
// ── تنبيه القيادة العليا بطلب ترقية/تنزيل جديد (شاشة كاملة، تُفتح تلقائياً بالبولينج) ──
let currentPromoAlertId = null;
async function checkPromotionAlert() {
    if (!ME || !ME.isHighCommand) return;
    if (document.getElementById('promo-alert-overlay').classList.contains('open')) return;
    try {
        const { alert } = await api('/api/high-command/promotion-alert');
        if (alert) showPromotionAlert(alert);
    } catch (e) {}
}
function showPromotionAlert(a) {
    currentPromoAlertId = a.id;
    const dirLabel = a.direction === 'up' ? '⬆️ طلب ترقية' : '⬇️ طلب تنزيل';
    document.getElementById('promo-alert-extra').textContent =
        dirLabel + ': ' + (a.targetName || a.targetTag) + '\\n' + a.fromRank + ' ← ' + a.toRank +
        '\\nالقطاع: ' + a.sectorLabel + '\\nمقدّم الطلب: ' + (a.requestedByTag || '-');
    document.getElementById('promo-alert-reason').textContent = 'السبب: ' + (a.reason || '-');
    document.getElementById('promo-alert-overlay').classList.add('open');
}
function closePromotionAlert() {
    document.getElementById('promo-alert-overlay').classList.remove('open');
    currentPromoAlertId = null;
    if (typeof hcTab !== 'undefined' && hcTab === 'pending' && document.getElementById('hc-content')) loadHCPending();
    checkPromotionAlert();
}
async function promoAlertApprove() {
    if (!currentPromoAlertId) return;
    if (!confirm('متأكد تبي تقبل هذا الطلب؟')) return;
    try {
        await api('/api/high-command/promotion-requests/' + currentPromoAlertId + '/approve', { method: 'POST' });
        toast('✅ تمت الموافقة');
        closePromotionAlert();
    } catch (e) { toast(e.message); }
}
async function promoAlertReject() {
    if (!currentPromoAlertId) return;
    const reason = prompt('اكتب سبب الرفض:');
    if (reason === null) return;
    if (!reason.trim()) return toast('لازم تكتب سبب الرفض');
    try {
        await api('/api/high-command/promotion-requests/' + currentPromoAlertId + '/reject', { method: 'POST', body: JSON.stringify({ reason }) });
        toast('❌ تم الرفض');
        closePromotionAlert();
    } catch (e) { toast(e.message); }
}
async function refreshMe() {
    try { ME = await api('/api/me'); } catch (e) { /* تجاهل */ }
}
async function init() {
    try { ME = await api('/api/me'); } catch (e) { renderLogin(); return; }
    if (ME.blocked) { renderBlocked(ME.reason); return; }
    lastKnownRank = ME.rank;
    buildNav();
    if (checkSummonGate()) return;
    renderDashboard();
    checkPendingWarning();
    checkPromotionAlert();
    startPolling();
}
function buildNav() {
    const links = document.getElementById('nav-links');
    const mobile = document.getElementById('mobile-menu');
    if (!ME || ME.blocked) { links.innerHTML = ''; mobile.innerHTML = ''; return; }
    const items = [
        { label: '🏠 الرئيسية', fn: 'renderDashboard()' },
    ];
    if (ME.isAdmin) items.push({ label: '🛠️ لوحة الإدارة', fn: 'renderAdmin()' });
    items.push({ label: '🚪 خروج', fn: "location.href='/auth/logout'" });
    links.innerHTML = items.map(i => \`<button onclick="\${i.fn}">\${i.label}</button>\`).join('');
    mobile.innerHTML = items.map(i => \`<button onclick="\${i.fn}; closeMobileMenu();">\${i.label}</button>\`).join('');
}
function renderFabs() {
    const fabs = [];
    if (ME.isAdmin) fabs.push({ label: '🛠️ لوحة الإدارة', fn: 'renderAdmin()' });
    return fabs.map((f, i) => \`<button class="fab" style="bottom:\${25 + i * 65}px;" onclick="\${f.fn}">\${f.label}</button>\`).join('');
}
function toggleMobileMenu() { document.getElementById('mobile-menu').classList.toggle('open'); }
function closeMobileMenu() { document.getElementById('mobile-menu').classList.remove('open'); }
function renderMinePage() {
    document.getElementById('app').innerHTML = \`<div class="card"><h2>📋 مخالفاتي</h2><div id="mine-list">جارِ التحميل...</div></div>\`;
    loadMine();
}
async function renderLeavePage() {
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>🌴 الإجازات</h2><button class="btn gray sm" onclick="renderDashboard()">رجوع</button></div>
        <div class="card" id="leave-balance-box">جارِ التحميل...</div>
        <div class="card">
            <h3>طلب إجازة جديدة</h3>
            <label>عدد الأيام</label>
            <input type="number" id="leave-days" min="1" placeholder="مثال: 2">
            <label>السبب</label>
            <textarea id="leave-reason" placeholder="اكتب سبب الإجازة..."></textarea>
            <button class="btn" onclick="submitLeaveRequest()">إرسال الطلب</button>
        </div>
        <div class="card">
            <h3>طلباتي السابقة</h3>
            <div id="leave-mine-list">جارِ التحميل...</div>
        </div>\`;
    loadMyLeave();
}
async function loadMyLeave() {
    try {
        const { balance, list } = await api('/api/leave/mine');
        document.getElementById('leave-balance-box').innerHTML = \`رصيدك الحالي: <b style="color:var(--gold-soft);font-size:18px;">\${balance}</b> يوم\`;
        const box = document.getElementById('leave-mine-list');
        box.innerHTML = list.length === 0 ? '<p style="color:var(--muted);">لا توجد طلبات سابقة</p>' :
            list.map(l => \`
                <div class="card" style="padding:10px 14px;margin-top:8px;">
                    <div class="row">
                        <div>
                            <b>\${l.days} يوم</b>
                            <div style="color:var(--muted);font-size:13px;">\${l.reason}</div>
                        </div>
                        <span class="badge \${l.status}">\${l.status === 'pending' ? 'قيد المراجعة' : l.status === 'approved' ? 'مقبولة' : 'مرفوضة'}</span>
                    </div>
                    \${l.status === 'rejected' && l.rejectReason ? \`<div style="font-size:11px;color:var(--muted);margin-top:3px;">سبب الرفض: \${l.rejectReason}</div>\` : ''}
                </div>\`).join('');
    } catch (e) { toast(e.message); }
}
async function submitLeaveRequest() {
    const days = document.getElementById('leave-days').value;
    const reason = document.getElementById('leave-reason').value;
    if (!days || parseInt(days) < 1) return toast('حدد عدد أيام صحيح');
    if (!reason || !reason.trim()) return toast('اكتب السبب');
    try {
        await api('/api/leave/request', { method: 'POST', body: JSON.stringify({ days: parseInt(days), reason }) });
        toast('✅ تم إرسال طلب الإجازة');
        renderLeavePage();
    } catch (e) { toast(e.message); }
}
function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(pollTick, 5000);
}
async function pollTick() {
    if (!ME || ME.blocked) return;
    try {
        const fresh = await api('/api/me');
        if (fresh.blocked) {
            // صار حظر/إيقاف/صيانة/إغلاق تسجيل وهو شغّال بالموقع — نوقفه فوراً ونعرض السبب
            clearInterval(pollTimer);
            ME = fresh;
            renderBlocked(fresh.reason);
            startBlockedRecheck();
            return;
        }
        if (lastKnownRank && fresh.rank !== lastKnownRank) {
            toast('🎉 مبروك! تمت ترقيتك إلى ' + fresh.rank);
        }
        lastKnownRank = fresh.rank;
        ME = fresh;
        buildNav();
        if (document.getElementById('ops-stats-grid')) loadOpsStats();
        if (document.getElementById('mine-list')) loadMine(true);
        if (document.getElementById('notes-box')) renderNotes();
        if (document.getElementById('pending-box')) loadPending();
        if (currentAdminTab === 'log') loadLog(true);
        checkPendingWarning();
        checkPromotionAlert();
    } catch (e) {}
}
// لو صار عليه حظر/صيانة وهو شغّال، نفضل نتابعه بهدوء، وأول ما يرجع الوضع طبيعي نحدّث الصفحة تلقائياً
function startBlockedRecheck() {
    if (blockedPollTimer) clearInterval(blockedPollTimer);
    blockedPollTimer = setInterval(async () => {
        try {
            const fresh = await api('/api/me');
            if (!fresh.blocked) { clearInterval(blockedPollTimer); location.reload(); }
        } catch (e) {}
    }, 6000);
}
function renderLogin() {
    document.getElementById('nav-links').innerHTML = '';
    document.getElementById('mobile-menu').innerHTML = '';
    const loginError = new URLSearchParams(window.location.search).get('loginError');
    if (loginError && window.history.replaceState) window.history.replaceState({}, '', window.location.pathname);
    const errorBox = loginError === 'ratelimit'
        ? \`<div class="card" style="border-color:#f59e0b;max-width:360px;margin:0 auto 20px;">
            <p style="color:#f59e0b;font-weight:bold;">⏳ ديسكورد مشغول حالياً</p>
            <p style="color:var(--muted);font-size:13px;margin-top:6px;">في ضغط مؤقت على سيرفر ديسكورد، انتظر شوي (دقيقة أو دقيقتين) وجرب تسجيل الدخول مرة ثانية.</p>
        </div>\`
        : loginError === '1'
        ? \`<div class="card" style="border-color:#f59e0b;max-width:360px;margin:0 auto 20px;">
            <p style="color:#f59e0b;font-weight:bold;">⚠️ صار خطأ بتسجيل الدخول</p>
            <p style="color:var(--muted);font-size:13px;margin-top:6px;">جرب مرة ثانية، وتأكد إنك ما تفتح رابط قديم أو مكرر — اضغط الزر تحت من جديد.</p>
        </div>\`
        : '';
    document.getElementById('app').innerHTML = \`
        <div class="login-screen">
            <h1>${CONFIG.SITE_NAME}</h1>
            <p style="color:var(--muted);margin-bottom:28px;">نظام إدارة عسكري لمنسوبي الجهات العسكرية</p>
            \${errorBox}
            <a href="/auth/discord" style="display:inline-flex;align-items:center;justify-content:center;gap:10px;background:#5865F2;color:#fff;font-weight:bold;font-size:16px;padding:16px 34px;border-radius:10px;text-decoration:none;box-shadow:0 6px 18px rgba(88,101,242,0.4);">
                <span>🔒</span><span>تسجيل الدخول عبر ديسكورد</span>
            </a>
        </div>\`;
}
function renderBlocked(reason) {
    document.getElementById('nav-links').innerHTML = '';
    document.getElementById('mobile-menu').innerHTML = '';
    document.getElementById('app').innerHTML = \`
        <div class="card center" style="margin-top:60px;">
            <h2 style="color:#fca5a5;">🚫 غير مصرح</h2>
            <p style="color:var(--muted);margin-top:10px;">\${reason}</p>
            <a class="btn gray" href="/auth/logout" style="margin-top:16px;">تسجيل خروج</a>
        </div>\`;
}
function renderSetup() {
    document.getElementById('app').innerHTML = \`
        <div class="card" style="margin-top:40px;">
            <h2>أكمل بياناتك العسكرية</h2>
            <label>الاسم المسجل في السيرفر</label>
            <input id="setup-name" placeholder="مثال: عبدالله الحربي">
            <label>اليونت العسكري</label>
            <input id="setup-unit" placeholder="مثال: الدورية الأولى">
            <button class="btn" onclick="doSetup()">حفظ ومتابعة</button>
        </div>\`;
}
async function doSetup() {
    const name = document.getElementById('setup-name').value.trim();
    const unit = document.getElementById('setup-unit').value.trim();
    if (!name || !unit) return toast('أكمل الحقول');
    try { await api('/api/profile/setup', { method: 'POST', body: JSON.stringify({ name, unit }) }); init(); }
    catch (e) { toast(e.message); }
}
function renderDashboard() {
    document.getElementById('app').innerHTML = \`
        <div class="card row">
            <div class="row" style="gap:14px;">
                \${ME.avatar ? \`<img class="avatar" src="\${ME.avatar}">\` : ''}
                <div><h2 style="margin-bottom:2px;">\${ME.registeredName || ME.discordTag}</h2><div style="color:var(--muted);font-size:13px;">\${ME.unit || '-'} • \${ME.rank}</div></div>
            </div>
            <div class="row" style="gap:8px;">
                \${ME.isAdmin ? '<button class="btn gray sm" onclick="renderAdmin()">لوحة الإدارة</button>' : ''}
                <button class="btn gray sm" onclick="renderCard()">بطاقتي</button>
                <a class="btn gray sm" href="/auth/logout">خروج</a>
            </div>
        </div>
        \${ME.maintenance ? '<div class="card" style="border-color:var(--amber);color:#fbbf24;">⚠️ الموقع في وضع الصيانة حالياً</div>' : ''}
        <div class="card">
            <h3 style="margin-bottom:10px;">📊 إحصائيات مركز العمليات — بانتظار المراجعة</h3>
            <div class="grid3" id="ops-stats-grid">جارِ التحميل...</div>
        </div>
        \${renderFabs()}
    \`;
    loadOpsStats();
}
async function loadOpsStats() {
    const box = document.getElementById('ops-stats-grid');
    if (!box) return;
    try {
        const s = await api('/api/ops-stats');
        box.innerHTML = \`
            <div class="stat"><div class="num" style="color:#fbbf24;">\${s.pendingViolations}</div><div class="lbl">مخالفات معلّقة</div></div>
            <div class="stat"><div class="num" style="color:#fbbf24;">\${s.pendingLeaves}</div><div class="lbl">إجازات معلّقة</div></div>
            <div class="stat"><div class="num" style="color:#fbbf24;">\${s.pendingPromotions}</div><div class="lbl">ترقيات/تنزيلات معلّقة</div></div>
            <div class="stat"><div class="num" style="color:#4ade80;">\${s.checkedInNow}</div><div class="lbl">حاضرون الآن</div></div>\`;
    } catch (e) {
        box.innerHTML = \`<div style="color:#f87171;">تعذر تحميل الإحصائيات (\${e.message})</div>\`;
    }
}
function renderNotes() {
    const box = document.getElementById('notes-box');
    if (!box) return;
    if (!ME.notes || ME.notes.length === 0) { box.innerHTML = ''; return; }
    box.innerHTML = '<div style="font-size:13px;color:var(--gold-soft);margin-bottom:6px;">ملاحظات عليك:</div>' +
        ME.notes.map(n => \`<div style="background:rgba(5,15,10,0.6);padding:8px;border-radius:8px;margin-bottom:6px;font-size:13px;">\${n.text}\${(n.image || (n.imageChannelId && n.imageMessageId)) ? \`<button class="btn sm gray" style="margin-top:6px;" onclick="viewNotePhoto('\${ME.discordId}','\${n._id}')">📷 عرض الصورة</button>\` : ''}</div>\`).join('');
}
async function loadMine(silent) {
    const box = document.getElementById('mine-list');
    try {
        const { list } = await api('/api/violations/mine');
        const cEl = document.getElementById('mine-count');
        if (cEl) cEl.textContent = list.length;
        if (!box) return;
        if (list.length === 0) { box.innerHTML = '<p style="color:var(--muted);">لا توجد مخالفات مسجلة بعد</p>'; return; }
        box.innerHTML = \`<table><tr><th></th><th>النوع</th><th>المركبة</th><th>اللوحة</th><th>الحالة</th></tr>\` +
            list.map(v => \`<tr>
                <td>\${v.hasPhoto ? \`<button class="btn sm gray" onclick="viewViolationPhoto('\${v._id}')">📷 عرض</button>\` : '—'}</td>
                <td>\${v.kind === 'report' ? ('🧪 تقرير مكافحة مخدرات — ' + v.reportCategory) : v.violationType}</td><td>\${v.vehicle}</td><td>\${v.plateNumber}</td>
                <td><span class="badge \${v.status}">\${v.status === 'pending' ? 'قيد المراجعة' : v.status === 'approved' ? 'مقبولة' : 'مرفوضة'}</span>\${v.status === 'rejected' && v.rejectReason ? \`<div style="font-size:11px;color:var(--muted);margin-top:3px;">\${v.rejectReason}</div>\` : ''}</td>
            </tr>\`).join('') + '</table>';
    } catch (e) {
        if (box) box.innerHTML = \`<p style="color:#f87171;">تعذر تحميل مخالفاتي، حاول تحدّث الصفحة. (\${e.message})</p>\`;
    }
}
let vtypeSelected = [];
async function renderNewViolation() {
    const meta = await api('/api/violations/meta');
    META = meta; selectedVehicle = null; photoBase64 = null; vtypeSelected = [];
    document.getElementById('app').innerHTML = \`
        <div class="card">
            <h2>تسجيل مخالفة جديدة</h2>
            <label>نوع المخالفة</label>
            <div class="row" style="gap:10px;align-items:center;margin-bottom:12px;">
                <button class="btn sm" type="button" onclick="openVTypeOverlay()">➕ اختيار نوع المخالفة</button>
                <span id="vtype-summary" style="color:var(--muted);font-size:13px;">لم يتم اختيار أي نوع بعد</span>
            </div>
            <label>المركبة</label>
            \${meta.vehicles.length ? \`<div class="vgrid" id="v-grid">\${meta.vehicles.map((v,i) => \`
                <div class="vcard" id="vcard-\${i}" onclick="pickVehicle(\${i})">
                    \${v.photo ? \`<img src="\${v.photo}">\` : ''}
                    <div>\${v.name}</div>
                </div>\`).join('')}</div>\` : '<p style="color:var(--muted);margin-bottom:10px;">لا توجد مركبات مضافة</p>'}
            <label>صورة المخالفة (إجباري)</label>
            <input type="file" id="v-photo" accept="image/*" onchange="previewPhoto()" required>
            <img id="v-photo-preview" style="display:none;max-width:220px;border-radius:8px;margin-bottom:10px;">
            <div class="row" style="gap:8px;margin-top:10px;">
                <button class="btn" id="v-submit-btn" onclick="submitViolation()">إرسال</button>
                <button class="btn gray" onclick="renderDashboard()">رجوع</button>
            </div>
        </div>\`;
    if (meta.vehicles.length) pickVehicle(0);
}
// ── فورم اختيار نوع/أنواع المخالفة (بطاقات تتلوّن أخضر عند التحديد، تدعم اختيار أكثر من نوع) ──
function openVTypeOverlay() {
    const grid = document.getElementById('vtype-grid');
    grid.innerHTML = META.types.map(function (t, i) {
        const cls = vtypeSelected.indexOf(t) > -1 ? 'vtype-opt sel' : 'vtype-opt';
        return '<div class="' + cls + '" id="vtype-opt-' + i + '" onclick="toggleVType(' + i + ')">' + t + '</div>';
    }).join('');
    document.getElementById('vtype-overlay').classList.add('open');
}
function toggleVType(i) {
    const t = META.types[i];
    const idx = vtypeSelected.indexOf(t);
    const el = document.getElementById('vtype-opt-' + i);
    if (idx > -1) { vtypeSelected.splice(idx, 1); el.classList.remove('sel'); }
    else { vtypeSelected.push(t); el.classList.add('sel'); }
}
function closeVTypeOverlay() {
    document.getElementById('vtype-overlay').classList.remove('open');
}
function confirmVTypeSelection() {
    if (!vtypeSelected.length) { toast('اختر نوع مخالفة واحد على الأقل'); return; }
    document.getElementById('vtype-summary').textContent = vtypeSelected.join('، ');
    document.getElementById('vtype-summary').style.color = '#4ade80';
    closeVTypeOverlay();
}
function pickVehicle(i) {
    selectedVehicle = META.vehicles[i].name;
    document.querySelectorAll('.vcard').forEach(el => el.classList.remove('sel'));
    document.getElementById('vcard-' + i).classList.add('sel');
}
function previewPhoto() {
    const f = document.getElementById('v-photo').files[0];
    if (!f) return;
    if (f.size > ${CONFIG.MAX_PHOTO_MB} * 1024 * 1024) { toast('الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        photoBase64 = e.target.result;
        const img = document.getElementById('v-photo-preview');
        img.src = photoBase64; img.style.display = 'block';
    };
    reader.readAsDataURL(f);
}
let violationSubmitting = false;
async function submitViolation() {
    if (violationSubmitting) return; // يمنع الدبل-كليك من إرسال الطلب مرتين
    if (!vtypeSelected.length) return toast('اختر نوع مخالفة واحد على الأقل');
    const violationType = vtypeSelected.join('، ');
    if (!selectedVehicle) return toast('اختر المركبة');
    if (!photoBase64) return toast('لازم ترفق صورة المخالفة');
    const btn = document.getElementById('v-submit-btn');
    violationSubmitting = true;
    if (btn) { btn.disabled = true; btn.textContent = 'جارِ الإرسال...'; }
    try {
        await api('/api/violations/submit', { method: 'POST', body: JSON.stringify({ violationType, vehicle: selectedVehicle, photo: photoBase64 }) });
        toast('تم الإرسال، بانتظار قبول الإدارة'); renderDashboard();
    } catch (e) {
        toast(e.message);
        if (btn) { btn.disabled = false; btn.textContent = 'إرسال'; }
    } finally {
        violationSubmitting = false;
    }
}
function renderNewReport() {
    document.getElementById('app').innerHTML = \`
        <div class="card">
            <h2>تسجيل تقرير جديد</h2>
            <p style="color:var(--muted);margin-bottom:14px;">اختر نوع التقرير:</p>
            <div class="row" style="gap:8px;">
                <button class="btn" onclick="renderReportForm('جنائي')">⚖️ جنائي</button>
                <button class="btn" onclick="renderReportForm('مخدرات')">💊 مخدرات</button>
            </div>
            <div style="margin-top:14px;">
                <button class="btn gray" onclick="renderDashboard()">رجوع</button>
            </div>
        </div>\`;
}
let reportItemCount = 0;
async function renderReportForm(category) {
    const meta = await api('/api/violations/meta');
    reportMeta = meta; reportSelectedVehicle = null; reportVehiclePhoto = null;
    reportItemCount = 0;
    const isDrugs = category === 'مخدرات';
    document.getElementById('app').innerHTML = \`
        <div class="card">
            <h2>تسجيل تقرير \${isDrugs ? 'مكافحة مخدرات' : 'جنائي'}</h2>
            <label>اسم المتهم</label>
            <input id="rp-suspect-name" placeholder="اسم المتهم">
            <label>موقع الضبط</label>
            <input id="rp-location" placeholder="موقع الضبط">
            <label>المركبة</label>
            \${meta.vehicles.length ? \`<div class="vgrid" id="rp-v-grid">\${meta.vehicles.map((v,i) => \`
                <div class="vcard" id="rp-vcard-\${i}" onclick="pickReportVehicle(\${i})">
                    \${v.photo ? \`<img src="\${v.photo}">\` : ''}
                    <div>\${v.name}</div>
                </div>\`).join('')}</div>\` : '<p style="color:var(--muted);margin-bottom:10px;">لا توجد مركبات مضافة</p>'}
            <h3 style="margin-top:16px;">تفاصيل العملية الميدانية</h3>
            <label>سبب الاستيقاف</label>
            <input id="rp-stop-reason" placeholder="سبب الاستيقاف">
            <div class="row" style="margin-top:16px;"><h3>المخالفات على هذا المتهم (بحد أقصى 5)</h3><button type="button" class="btn sm gray" onclick="addReportItem('\${category}')">+ إضافة مخالفة</button></div>
            <div id="rp-items-box"></div>
            <label style="margin-top:12px;">الإجراءات الأمنية المتخذة</label>
            <div id="rp-actions-box">
                <div class="row rp-action-row" style="gap:6px;flex-wrap:nowrap;">
                    <input class="rp-action" placeholder="- إجراء أمني" style="flex:1;">
                    <button type="button" class="btn danger sm" style="flex:0 0 auto;" onclick="removeSecurityAction(this)">حذف</button>
                </div>
            </div>
            <button class="btn gray sm" style="margin:8px 0;" onclick="addSecurityAction()">+ إضافة إجراء</button>
            <label>صورة المركبة (إجباري)</label>
            <input type="file" id="rp-photo" accept="image/*" onchange="previewReportPhoto()" required>
            <img id="rp-photo-preview" style="display:none;max-width:220px;border-radius:8px;margin-bottom:10px;">
            <div class="row" style="gap:8px;margin-top:10px;">
                <button class="btn" onclick="submitReport('\${category}')">إرسال التقرير</button>
                <button class="btn gray" onclick="renderNewReport()">رجوع</button>
            </div>
        </div>\`;
    if (meta.vehicles.length) pickReportVehicle(0);
    addReportItem(category); // مخالفة أولى إجبارية
}
function addReportItem(category) {
    const box = document.getElementById('rp-items-box');
    if (box.querySelectorAll('.rp-item-block').length >= 5) return toast('الحد الأقصى 5 مخالفات بنفس التقرير');
    reportItemCount++;
    const i = reportItemCount;
    const isDrugs = category === 'مخدرات';
    const div = document.createElement('div');
    div.className = 'card rp-item-block';
    div.id = 'rp-item-' + i;
    div.style.cssText = 'margin-top:8px;padding:12px;';
    div.innerHTML = \`
        <div class="row"><b>مخالفة #<span class="rp-item-num">\${box.children.length + 1}</span></b><button type="button" class="btn danger sm" onclick="removeReportItem(\${i})">حذف</button></div>
        \${isDrugs ? \`
        <label>نوع المخدر المضبوط</label>
        <input class="rp-item-drug-type" placeholder="مثال: حشيش، شبو، حبوب مخدرة">
        <label>الكمية المضبوطة</label>
        <input class="rp-item-drug-qty" placeholder="مثال: 3 كيلو / 50 حبة">
        <label>طريقة إخفاء المخدر</label>
        <input class="rp-item-conceal" placeholder="مثال: مخبأ داخل صندوق السيارة">
        \` : \`
        <label>المضبوطات</label>
        <textarea class="rp-item-seized" placeholder="المضبوطات" rows="2"></textarea>
        \`}\`;
    box.appendChild(div);
    renumberReportItems();
}
function removeReportItem(i) {
    const box = document.getElementById('rp-items-box');
    if (box.querySelectorAll('.rp-item-block').length <= 1) return toast('لازم تبقى مخالفة واحدة على الأقل');
    document.getElementById('rp-item-' + i).remove();
    renumberReportItems();
}
function renumberReportItems() {
    document.querySelectorAll('#rp-items-box .rp-item-block').forEach((el, idx) => {
        el.querySelector('.rp-item-num').textContent = idx + 1;
    });
}
function pickReportVehicle(i) {
    reportSelectedVehicle = reportMeta.vehicles[i].name;
    document.querySelectorAll('#rp-v-grid .vcard').forEach(el => el.classList.remove('sel'));
    document.getElementById('rp-vcard-' + i).classList.add('sel');
}
function addSecurityAction() {
    const box = document.getElementById('rp-actions-box');
    const row = document.createElement('div');
    row.className = 'row rp-action-row';
    row.style.cssText = 'gap:6px;flex-wrap:nowrap;margin-top:6px;';
    row.innerHTML = '<input class="rp-action" placeholder="- إجراء أمني" style="flex:1;"><button type="button" class="btn danger sm" style="flex:0 0 auto;" onclick="removeSecurityAction(this)">حذف</button>';
    box.appendChild(row);
}
function removeSecurityAction(btn) {
    const box = document.getElementById('rp-actions-box');
    if (box.querySelectorAll('.rp-action-row').length <= 1) {
        // لازم يبقى إجراء واحد على الأقل بالفورم
        btn.closest('.rp-action-row').querySelector('.rp-action').value = '';
        return;
    }
    btn.closest('.rp-action-row').remove();
}
function previewReportPhoto() {
    const f = document.getElementById('rp-photo').files[0];
    if (!f) return;
    if (f.size > ${CONFIG.MAX_PHOTO_MB} * 1024 * 1024) { toast('الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        reportVehiclePhoto = e.target.result;
        const img = document.getElementById('rp-photo-preview');
        img.src = reportVehiclePhoto; img.style.display = 'block';
    };
    reader.readAsDataURL(f);
}
async function submitReport(category) {
    const isDrugs = category === 'مخدرات';
    const suspectName = document.getElementById('rp-suspect-name').value.trim();
    const arrestLocation = document.getElementById('rp-location').value.trim();
    const stopReason = document.getElementById('rp-stop-reason').value.trim();
    const securityActions = Array.from(document.querySelectorAll('.rp-action')).map(el => el.value.trim()).filter(Boolean);
    if (!suspectName || !arrestLocation) return toast('أكمل اسم المتهم وموقع الضبط');
    if (!reportSelectedVehicle) return toast('اختر المركبة');
    if (!stopReason) return toast('أكمل تفاصيل العملية الميدانية');
    if (!reportVehiclePhoto) return toast('لازم ترفق صورة المركبة');

    const blocks = Array.from(document.querySelectorAll('#rp-items-box .rp-item-block'));
    if (!blocks.length) return toast('أضف مخالفة واحدة على الأقل');
    const items = [];
    for (const b of blocks) {
        if (isDrugs) {
            const drugType = b.querySelector('.rp-item-drug-type').value.trim();
            const drugQuantity = b.querySelector('.rp-item-drug-qty').value.trim();
            const concealMethod = b.querySelector('.rp-item-conceal').value.trim();
            if (!drugType || !drugQuantity || !concealMethod) return toast('أكمل كل حقول كل مخالفة (نوع المخدر، الكمية، طريقة الإخفاء)');
            items.push({ drugType, drugQuantity, concealMethod });
        } else {
            const seizedItems = b.querySelector('.rp-item-seized').value.trim();
            if (!seizedItems) return toast('اكتب المضبوطات لكل مخالفة');
            items.push({ seizedItems });
        }
    }
    try {
        const r = await api('/api/reports/submit', { method: 'POST', body: JSON.stringify({
            category, suspectName, arrestLocation, vehicle: reportSelectedVehicle,
            stopReason, securityActions, photo: reportVehiclePhoto, items,
        }) });
        toast(\`✅ تم إرسال \${r.count} مخالفة على \${suspectName}، بانتظار المراجعة\`);
        renderDashboard();
    } catch (e) { toast(e.message); }
}
function renderCard() {
    document.getElementById('app').innerHTML = \`
        <div style="margin-top:30px;">
            <div class="id-card">
                \${ME.avatar ? \`<img class="avatar" src="\${ME.avatar}" style="display:block;margin:0 auto 12px;">\` : ''}
                <div class="center" style="font-size:18px;font-weight:bold;color:var(--gold-soft);">\${ME.registeredName}</div>
                <div class="center" style="font-size:13px;color:var(--muted);margin-bottom:14px;">${CONFIG.SITE_NAME} • بطاقة تعريف عسكرية</div>
                <table>
                    <tr><td>اليونت</td><td>\${ME.unit}</td></tr>
                    <tr><td>الرتبة</td><td>\${ME.rank}</td></tr>
                    <tr><td>النقاط</td><td>\${ME.points}</td></tr>
                    <tr><td>الحالة</td><td>\${ME.isBlocked ? 'موقوف' : 'فعّال'}</td></tr>
                </table>
            </div>
            <div class="center" style="margin-top:16px;"><button class="btn gray sm" onclick="renderDashboard()">رجوع</button></div>
        </div>\`;
}
function renderAdmin() {
    const tabsHtml = ME.isSeniorAdmin ? \`
        <div class="tabs">
            <div class="tab active" onclick="adminTab('pending', this)">المخالفات المعلّقة</div>
            <div class="tab" onclick="adminTab('reviewed', this)">✅ المخالفات المقبولة</div>
            <div class="tab" onclick="adminTab('search', this)">🔍 بحث الأفراد</div>
            <div class="tab" onclick="adminTab('points-requests', this)">⏳ نقاط معلّقة</div>
            <div class="tab" onclick="adminTab('hire', this)">توظيف الإدارة</div>
            <div class="tab" onclick="adminTab('thresholds', this)">ترقيات النقاط</div>
            <div class="tab" onclick="adminTab('leave', this)">🌴 طلبات الإجازات</div>
            <div class="tab" onclick="adminTab('promotions', this)">🎖️ طلبات الترقية/التنزيل</div>
            <div class="tab" onclick="adminTab('sector-leaders', this)">🎖️ قادة القطاعات</div>
            <div class="tab" onclick="adminTab('log', this)">اللوق الشامل</div>
            <div class="tab" onclick="adminTab('settings', this)">الإعدادات</div>
        </div>\` : \`
        <div class="tabs">
            <div class="tab active" onclick="adminTab('pending', this)">المخالفات المعلّقة</div>
            <div class="tab" onclick="adminTab('search', this)">🔍 بحث الأفراد</div>
            <div class="tab" onclick="adminTab('points-requests', this)">⏳ نقاط معلّقة</div>
            <div class="tab" onclick="adminTab('leave', this)">🌴 طلبات الإجازات</div>
            <div class="tab" onclick="adminTab('promotions', this)">🎖️ طلبات الترقية/التنزيل</div>
            <div class="tab" onclick="adminTab('thresholds', this)">ترقيات النقاط</div>
        </div>\`;
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>\${ME.isSeniorAdmin ? 'لوحة تحكم كبار المسؤولين' : 'لوحة الإدارة'}</h2><button class="btn gray sm" onclick="renderDashboard()">رجوع للوحتي</button></div>
        \${tabsHtml}
        <div id="admin-content"></div>\`;
    adminTab('pending');
}
function adminTab(name, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    currentAdminTab = name;
    if (name === 'pending') loadPending();
    if (name === 'reviewed') loadReviewedViolations();
    if (name === 'search') loadPersonnelSearchPage();
    if (name === 'points-requests') loadPointsRequestsPage();
    if (name === 'hire') loadHire();
    if (name === 'thresholds') loadThresholds();
    if (name === 'leave') loadSeniorLeavePage();
    if (name === 'promotions') loadAdminPromotionsPage();
    if (name === 'log') loadLog();
    if (name === 'sector-leaders') loadSectorLeaders();
    if (name === 'settings') loadSettings();
}
// تبويب طلبات الترقية/التنزيل بلوحة الإدارة — يعرضها لأي إداري (وليس فقط القيادة العليا)، ويسمح له بالبت فيها
async function loadAdminPromotionsPage() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let list;
    try { ({ list } = await api('/api/high-command/promotion-requests')); }
    catch (e) { box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل (\${e.message})</div>\`; return; }
    if (currentAdminTab !== 'promotions') return;
    if (!list.length) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد طلبات ترقية/تنزيل معلّقة حالياً</div>'; return; }
    box.innerHTML = list.map(r => \`
        <div class="card">
            <div><b>\${r.direction === 'up' ? '⬆️ ترقية' : '⬇️ تنزيل'}: \${r.targetName || r.targetTag}</b></div>
            <div style="color:var(--gold-soft);margin:4px 0;">\${r.fromRank} ← \${r.toRank}</div>
            <div style="font-size:12px;color:var(--muted);">القطاع: \${r.sectorLabel} — قدّمه: \${r.requestedByTag}</div>
            \${r.reason ? \`<div style="font-size:12px;color:var(--muted);margin-top:2px;">السبب: \${r.reason}</div>\` : ''}
            <div class="row" style="gap:8px;margin-top:10px;">
                <button class="btn sm" onclick="hcDecide('\${r._id}','approve')">✅ قبول</button>
                <button class="btn danger sm" onclick="hcDecide('\${r._id}','reject')">❌ رفض</button>
            </div>
        </div>\`).join('');
}
async function loadReviewedViolations() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let list;
    try { ({ list } = await api('/api/senior/violations/reviewed')); }
    catch (e) { box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل (\${e.message})</div>\`; return; }
    if (currentAdminTab !== 'reviewed') return;
    if (list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد مخالفات مقبولة أو مرفوضة بعد</div>'; return; }
    box.innerHTML = list.map(v => \`
        <div class="card">
            <div class="row" style="align-items:flex-start;">
                <div class="row" style="gap:10px;align-items:flex-start;">
                    \${v.hasPhoto ? \`<button class="btn sm gray" onclick="viewViolationPhoto('\${v._id}')">📷 عرض الصورة</button>\` : ''}
                    <div>
                        <b>\${v.reporterName}</b> <span style="color:var(--muted);font-size:12px;">(\${v.reporterUnit})</span>
                        <div style="color:var(--gold-soft);margin-top:4px;">\${v.kind === 'report' ? ('🧪 تقرير مكافحة — ' + v.reportCategory) : v.violationType}</div>
                        <div><span class="badge \${v.status}">\${v.status === 'approved' ? 'مقبولة' : 'مرفوضة'}</span></div>
                        \${v.status === 'rejected' && v.rejectReason ? \`<div style="font-size:11px;color:var(--muted);margin-top:3px;">\${v.rejectReason}</div>\` : ''}
                    </div>
                </div>
                <button class="btn danger sm" onclick="deleteViolationPermanent('\${v._id}')">🗑️ حذف نهائي</button>
            </div>
        </div>\`).join('');
}
async function deleteViolationPermanent(id) {
    if (!confirm('حذف نهائي — بيختفي من عندك وعند العضو وعند قائده. متأكد؟')) return;
    try { await api('/api/senior/violations/' + id + '/permanent', { method: 'DELETE' }); toast('تم الحذف'); loadReviewedViolations(); }
    catch (e) { toast(e.message); }
}
async function loadSeniorLeavePage() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let list;
    try { ({ list } = await api('/api/senior/leave/pending')); }
    catch (e) { box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل (\${e.message})</div>\`; return; }
    if (currentAdminTab !== 'leave') return;
    box.innerHTML = renderLeaveRequestsList(list, true);
}
function renderLeaveRequestsList(list, reload) {
    if (!list.length) return '<div class="card center" style="color:var(--muted);">لا توجد طلبات إجازة</div>';
    return list.map(l => {
        const isActive = l.status === 'approved';
        let actions = \`
            <button class="btn sm" onclick="approveLeave('\${l._id}', \${reload})">قبول</button>
            <button class="btn danger sm" onclick="rejectLeave('\${l._id}', \${reload})">رفض</button>\`;
        let extra = '';
        if (isActive) {
            const daysLeft = l.endDate ? Math.max(0, Math.ceil((new Date(l.endDate) - Date.now()) / 86400000)) : '-';
            extra = \`<div style="color:#4ade80;margin-top:4px;">⏳ نشطة — متبقي \${daysLeft} يوم</div>\`;
            actions = \`<button class="btn danger sm" onclick="endLeave('\${l._id}', \${reload})">🏁 إنهاء الإجازة</button>\`;
        }
        return \`
        <div class="card">
            <div class="row" style="align-items:flex-start;">
                <div>
                    <b>\${l.name}</b> <span style="color:var(--muted);font-size:12px;">(\${l.unit || '-'} • \${l.rank || '-'} • \${l.sectorLabel || '-'})</span>
                    <div style="color:var(--gold-soft);margin-top:4px;">📅 \${l.days} يوم</div>
                    <div style="color:var(--muted);font-size:13px;">\${l.reason}</div>
                    \${extra}
                </div>
                <div class="row" style="gap:8px;">\${actions}</div>
            </div>
        </div>\`;
    }).join('');
}
async function approveLeave(id, senior) {
    try { await api('/api/leave/' + id + '/approve', { method: 'POST' }); toast('✅ تمت الموافقة'); senior ? loadSeniorLeavePage() : loadSectorLeavePending(); }
    catch (e) { toast(e.message); }
}
async function rejectLeave(id, senior) {
    const reason = prompt('سبب الرفض (اختياري):') || '';
    try { await api('/api/leave/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) }); toast('تم الرفض'); senior ? loadSeniorLeavePage() : loadSectorLeavePending(); }
    catch (e) { toast(e.message); }
}
async function endLeave(id, senior) {
    if (!confirm('متأكد تبي تنهي هذي الإجازة الآن؟')) return;
    try { await api('/api/leave/' + id + '/end', { method: 'POST' }); toast('✅ تم إنهاء الإجازة'); senior ? loadSeniorLeavePage() : loadSectorLeavePending(); }
    catch (e) { toast(e.message); }
}

async function loadPending() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    if (!box.dataset.loaded) box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let list;
    try {
        ({ list } = await api('/api/admin/pending'));
    } catch (e) {
        if (currentAdminTab !== 'pending') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر تحميل المخالفات المعلّقة، حاول تحدّث الصفحة. (\${e.message})</div>\`;
        return;
    }
    if (currentAdminTab !== 'pending') return; // المستخدم غيّر التبويب أثناء التحميل
    box.id = 'admin-content'; box.dataset.loaded = '1';
    box.innerHTML = '<div id="pending-box"></div>';
    const pbox = document.getElementById('pending-box');
    if (list.length === 0) { pbox.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد مخالفات معلّقة</div>'; return; }
    pbox.innerHTML = list.map(v => v.kind === 'report' ? \`
        <div class="card">
            <div class="row" style="align-items:flex-start;">
                <div class="row" style="gap:10px;align-items:flex-start;">
                    \${v.hasPhoto ? \`<button class="btn sm gray" onclick="viewViolationPhoto('\${v._id}')">📷 عرض الصورة</button>\` : ''}
                    <div>
                        <b>\${v.reporterName}</b> <span style="color:var(--muted);font-size:12px;">(\${v.reporterUnit})</span>
                        <div style="color:var(--gold-soft);margin-top:4px;">🧪 تقرير مكافحة المخدرات — \${v.reportCategory}</div>
                        <div style="color:var(--muted);font-size:13px;">المتهم: \${v.suspectName} • موقع الضبط: \${v.arrestLocation}</div>
                        <div style="color:var(--muted);font-size:13px;">المركبة: \${v.vehicle} • سبب الاستيقاف: \${v.stopReason}</div>
                        \${v.reportCategory === 'مخدرات' ? \`
                        <div style="color:var(--muted);font-size:13px;">نوع المخدر: \${v.drugType || '-'} • الكمية: \${v.drugQuantity || '-'}</div>
                        <div style="color:var(--muted);font-size:13px;">طريقة الإخفاء: \${v.concealMethod || '-'}</div>
                        \` : \`<div style="color:var(--muted);font-size:13px;">المضبوطات: \${v.seizedItems}</div>\`}
                        \${v.securityActions && v.securityActions.length ? \`<div style="color:var(--muted);font-size:13px;">الإجراءات: \${v.securityActions.join('، ')}</div>\` : ''}
                    </div>
                </div>
                <div class="row" style="gap:8px;">
                    <button class="btn sm" onclick="approveV('\${v._id}')">قبول (+2)</button>
                    <button class="btn danger sm" onclick="rejectV('\${v._id}')">رفض (-1)</button>
                </div>
            </div>
        </div>\` : \`
        <div class="card">
            <div class="row">
                <div class="row" style="gap:10px;">
                    \${v.hasPhoto ? \`<button class="btn sm gray" onclick="viewViolationPhoto('\${v._id}')">📷 عرض الصورة</button>\` : ''}
                    <div>
                        <b>\${v.reporterName}</b> <span style="color:var(--muted);font-size:12px;">(\${v.reporterUnit})</span>
                        <div style="color:var(--gold-soft);margin-top:4px;">\${v.violationType}</div>
                        <div style="color:var(--muted);font-size:13px;">المركبة: \${v.vehicle} • اللوحة: \${v.plateNumber}</div>
                    </div>
                </div>
                <div class="row" style="gap:8px;">
                    <button class="btn sm" onclick="approveV('\${v._id}')">قبول</button>
                    <button class="btn danger sm" onclick="rejectV('\${v._id}')">رفض</button>
                </div>
            </div>
        </div>\`).join('');
}
const actionLocks = {};
function isActionLocked(id) {
    const until = actionLocks[id];
    if (until && Date.now() < until) return true;
    return false;
}
function lockAction(id) {
    actionLocks[id] = Date.now() + 5000;
    setTimeout(() => { delete actionLocks[id]; }, 5000);
}
async function approveV(id) {
    if (isActionLocked(id)) return toast('انتظر 5 ثواني قبل الضغط مرة أخرى');
    lockAction(id);
    try { await api('/api/admin/violations/' + id + '/approve', { method: 'POST' }); toast('تم القبول'); loadPending(); }
    catch (e) { toast(e.message); }
}
function rejectV(id) {
    if (isActionLocked(id)) return toast('انتظر 5 ثواني قبل الضغط مرة أخرى');
    const reason = prompt('اكتب سبب الرفض:');
    if (reason === null) return;
    if (!reason.trim()) return toast('لازم تكتب سبب');
    lockAction(id);
    api('/api/admin/violations/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) })
        .then(() => { toast('تم الرفض'); loadPending(); }).catch(e => toast(e.message));
}

// ── قادة القطاعات (كبار المسؤولين) ───────────────────────────────────────
let sectorsCache = { sectors: {}, leadership: {} };
async function loadSectors() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/senior/sectors'); }
    catch (e) {
        if (currentAdminTab !== 'sectors') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    if (currentAdminTab !== 'sectors') return;
    sectorsCache = data;
    renderSectorsBox();
}
function renderSectorsBox() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    const keys = Object.keys(sectorsCache.sectors);
    const mp = sectorsCache.mpLeadership || {};
    box.innerHTML = keys.map(key => {
        const label = sectorsCache.sectors[key];
        const sec = (sectorsCache.leadership && sectorsCache.leadership[key]) || {};
        return \`
        <div class="card">
            <h3>🪖 \${label}</h3>
            <div class="row" style="margin-top:8px;">
                <span>القائد: <b style="color:\${sec.commanderName ? '#4ade80' : 'var(--muted)'};">\${sec.commanderName || 'غير معيّن'}</b></span>
                <div class="row" style="gap:6px;">
                    <button class="btn sm" onclick="openSectorPicker('\${key}','commander')">قائد \${label}</button>
                    \${sec.commanderName ? \`<button class="btn danger sm" onclick="removeSectorRole('\${key}','commander')">إزالة</button>\` : ''}
                </div>
            </div>
            <div class="row" style="margin-top:8px;">
                <span>النائب: <b style="color:\${sec.deputyName ? '#4ade80' : 'var(--muted)'};">\${sec.deputyName || 'غير معيّن'}</b></span>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openSectorPicker('\${key}','deputy')">نائب \${label}</button>
                    \${sec.deputyName ? \`<button class="btn danger sm" onclick="removeSectorRole('\${key}','deputy')">إزالة</button>\` : ''}
                </div>
            </div>
            <div class="row" style="margin-top:8px;">
                <span>مسؤول الأفراد: <b style="color:\${sec.personnelOfficerName ? '#4ade80' : 'var(--muted)'};">\${sec.personnelOfficerName || 'غير معيّن'}</b></span>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openSectorPicker('\${key}','personnelOfficer')">مسؤول أفراد \${label}</button>
                    \${sec.personnelOfficerName ? \`<button class="btn danger sm" onclick="removeSectorRole('\${key}','personnelOfficer')">إزالة</button>\` : ''}
                </div>
            </div>
            <div style="color:var(--muted);font-size:12px;margin-top:2px;">مسؤول الأفراد يتحكم بالأعضاء من رتبة رئيس رقباء وتحت فقط (ملاحظات، تحذيرات، ومخالفاتهم) — وطلبات الترقية/التنزيل اللي يسويها تروح لك أو للنائب بصفحة "ترقيات الأفراد" داخل لوحة قيادة القطاع للموافقة عليها.</div>
            <div class="row" style="margin-top:8px;">
                <span>مسؤول التحضير: <b style="color:\${sec.attendanceOfficerName ? '#4ade80' : 'var(--muted)'};">\${sec.attendanceOfficerName || 'غير معيّن'}</b></span>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openSectorPicker('\${key}','attendanceOfficer')">مسؤول تحضير \${label}</button>
                    \${sec.attendanceOfficerName ? \`<button class="btn danger sm" onclick="removeSectorRole('\${key}','attendanceOfficer')">إزالة</button>\` : ''}
                </div>
            </div>
            <div style="color:var(--muted);font-size:12px;margin-top:2px;">مسؤول التحضير يشوف حضور أعضاء القطاع (المسجلين بالبصمة وغير المسجلين) وآخر سجل حضور/انصراف لكل واحد منهم.</div>
            <div id="picker-\${key}-commander"></div>
            <div id="picker-\${key}-deputy"></div>
            <div id="picker-\${key}-personnelOfficer"></div>
            <div id="picker-\${key}-attendanceOfficer"></div>
        </div>\`;
    }).join('') + \`
        <div class="card">
            <h3>🚔 الشرطة العسكرية</h3>
            <div class="row" style="margin-top:8px;">
                <span>القائد: <b style="color:\${mp.commanderName ? '#4ade80' : 'var(--muted)'};">\${mp.commanderName || 'غير معيّن'}</b></span>
                <div class="row" style="gap:6px;">
                    <button class="btn sm" onclick="openMPPicker('commander')">قائد الشرطة العسكرية</button>
                    \${mp.commanderName ? '<button class="btn danger sm" onclick="removeMPRole(\\'commander\\')">إزالة</button>' : ''}
                </div>
            </div>
            <div class="row" style="margin-top:8px;">
                <span>النائب: <b style="color:\${mp.deputyName ? '#4ade80' : 'var(--muted)'};">\${mp.deputyName || 'غير معيّن'}</b></span>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openMPPicker('deputy')">نائب الشرطة العسكرية</button>
                    \${mp.deputyName ? '<button class="btn danger sm" onclick="removeMPRole(\\'deputy\\')">إزالة</button>' : ''}
                </div>
            </div>
            <div style="color:var(--muted);font-size:12px;margin-top:2px;">مسؤول أفراد الشرطة العسكرية يعيّنه القائد أو النائب من داخل لوحة الشرطة العسكرية نفسها.</div>
            <div id="picker-mp-commander"></div>
            <div id="picker-mp-deputy"></div>
        </div>
        <div class="card">
            <h3>⭐ القيادة العليا</h3>
            <div style="color:var(--muted);font-size:12px;margin-bottom:8px;">تراجع كل طلبات الترقية والتنزيل من كل القطاعات — تقدر تضيف أكثر من شخص.</div>
            <input placeholder="🔍 ابحث عن اسم الشخص المسجل بالموقع..." oninput="searchHCCandidate(this.value)">
            <div id="hc-cand-results"></div>
            <div id="hc-members-list" style="margin-top:10px;">جارِ التحميل...</div>
        </div>\`;
    loadHighCommandList();
}
async function loadHighCommandList() {
    const box = document.getElementById('hc-members-list');
    if (!box) return;
    try {
        const { list } = await api('/api/senior/high-command');
        if (!list.length) { box.innerHTML = '<p style="color:var(--muted);font-size:13px;">لا يوجد أعضاء بالقيادة العليا بعد</p>'; return; }
        box.innerHTML = list.map(m => \`
            <div class="card" style="padding:8px 12px;margin-top:6px;">
                <div class="row">
                    <span>\${m.name}</span>
                    <button class="btn danger sm" onclick="removeHCMember('\${m.id}')">إزالة</button>
                </div>
            </div>\`).join('');
    } catch (e) { box.innerHTML = '<p style="color:#f87171;font-size:13px;">' + e.message + '</p>'; }
}
let hcSearchTimer = null;
function searchHCCandidate(q) {
    clearTimeout(hcSearchTimer);
    hcSearchTimer = setTimeout(async () => {
        const box = document.getElementById('hc-cand-results');
        if (!box) return;
        if (!q || !q.trim()) { box.innerHTML = ''; return; }
        box.innerHTML = 'جارِ البحث...';
        try {
            const { list } = await api('/api/senior/personnel?q=' + encodeURIComponent(q));
            if (list.length === 0) { box.innerHTML = '<p style="color:var(--muted);font-size:13px;">لا نتائج</p>'; return; }
            box.innerHTML = list.filter(p => p.registeredName).map(p => \`
                <div class="card" style="padding:8px 12px;margin-top:6px;">
                    <div class="row">
                        <span>\${p.registeredName} <span style="color:var(--muted);font-size:12px;">(\${p.unit || '-'} • \${p.rank})</span></span>
                        <button class="btn sm" onclick="addHCMember('\${p.discord}')">إضافة</button>
                    </div>
                </div>\`).join('');
        } catch (e) { box.innerHTML = '<p style="color:#f87171;font-size:13px;">' + e.message + '</p>'; }
    }, 350);
}
async function addHCMember(discordId) {
    try { await api('/api/senior/high-command/add', { method: 'POST', body: JSON.stringify({ discordId }) }); toast('تمت الإضافة'); document.getElementById('hc-cand-results').innerHTML = ''; loadHighCommandList(); }
    catch (e) { toast(e.message); }
}
async function removeHCMember(discordId) {
    if (!confirm('متأكد تبي تزيله من القيادة العليا؟')) return;
    try { await api('/api/senior/high-command/remove', { method: 'POST', body: JSON.stringify({ discordId }) }); toast('تم'); loadHighCommandList(); }
    catch (e) { toast(e.message); }
}
function openMPPicker(role) {
    ['commander', 'deputy'].forEach(r => {
        const el = document.getElementById('picker-mp-' + r);
        if (el && r !== role) el.innerHTML = '';
    });
    const el = document.getElementById('picker-mp-' + role);
    if (!el) return;
    if (el.innerHTML.trim()) { el.innerHTML = ''; return; }
    el.innerHTML = \`
        <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">
            <input placeholder="🔍 ابحث عن اسم الشخص المسجل بالموقع..." oninput="searchMPCandidate('\${role}', this.value)">
            <div id="cand-mp-\${role}"></div>
        </div>\`;
}
let mpSearchTimer = null;
function searchMPCandidate(role, q) {
    clearTimeout(mpSearchTimer);
    mpSearchTimer = setTimeout(async () => {
        const box = document.getElementById('cand-mp-' + role);
        if (!box) return;
        if (!q || !q.trim()) { box.innerHTML = ''; return; }
        box.innerHTML = 'جارِ البحث...';
        try {
            const { list } = await api('/api/senior/personnel?q=' + encodeURIComponent(q));
            if (list.length === 0) { box.innerHTML = '<p style="color:var(--muted);font-size:13px;">لا نتائج</p>'; return; }
            box.innerHTML = list.filter(p => p.registeredName).map(p => \`
                <div class="card" style="padding:8px 12px;margin-top:6px;">
                    <div class="row">
                        <span>\${p.registeredName} <span style="color:var(--muted);font-size:12px;">(\${p.unit || '-'} • \${p.rank})</span></span>
                        <button class="btn sm" onclick="assignMPRole('\${role}','\${p.discord}')">تعيين</button>
                    </div>
                </div>\`).join('');
        } catch (e) { box.innerHTML = '<p style="color:#f87171;font-size:13px;">' + e.message + '</p>'; }
    }, 350);
}
async function assignMPRole(role, discordId) {
    try { await api('/api/senior/mp/assign', { method: 'POST', body: JSON.stringify({ role, discordId }) }); toast('تم التعيين'); loadSectors(); }
    catch (e) { toast(e.message); }
}
async function removeMPRole(role) {
    if (!confirm('متأكد تبي تزيله من هذا المنصب؟')) return;
    try { await api('/api/senior/mp/remove', { method: 'POST', body: JSON.stringify({ role }) }); toast('تم'); loadSectors(); }
    catch (e) { toast(e.message); }
}
function openSectorPicker(sectorKey, role) {
    ['commander', 'deputy', 'personnelOfficer', 'attendanceOfficer'].forEach(r => {
        Object.keys(sectorsCache.sectors).forEach(k => {
            const el = document.getElementById('picker-' + k + '-' + r);
            if (el && (k !== sectorKey || r !== role)) el.innerHTML = '';
        });
    });
    const el = document.getElementById('picker-' + sectorKey + '-' + role);
    if (!el) return;
    if (el.innerHTML.trim()) { el.innerHTML = ''; return; }
    el.innerHTML = \`
        <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">
            <input placeholder="🔍 ابحث عن اسم الشخص المسجل بالموقع..." oninput="searchSectorCandidate('\${sectorKey}','\${role}', this.value)">
            <div id="cand-\${sectorKey}-\${role}"></div>
        </div>\`;
}
let sectorSearchTimer = null;
function searchSectorCandidate(sectorKey, role, q) {
    clearTimeout(sectorSearchTimer);
    sectorSearchTimer = setTimeout(async () => {
        const box = document.getElementById('cand-' + sectorKey + '-' + role);
        if (!box) return;
        if (!q || !q.trim()) { box.innerHTML = ''; return; }
        box.innerHTML = 'جارِ البحث...';
        try {
            const { list } = await api('/api/senior/personnel?q=' + encodeURIComponent(q));
            if (list.length === 0) { box.innerHTML = '<p style="color:var(--muted);font-size:13px;">لا نتائج</p>'; return; }
            box.innerHTML = list.filter(p => p.registeredName).map(p => \`
                <div class="card" style="padding:8px 12px;margin-top:6px;">
                    <div class="row">
                        <span>\${p.registeredName} <span style="color:var(--muted);font-size:12px;">(\${p.unit || '-'} • \${p.rank})</span></span>
                        <button class="btn sm" onclick="assignSectorRole('\${sectorKey}','\${role}','\${p.discord}')">تعيين</button>
                    </div>
                </div>\`).join('');
        } catch (e) { box.innerHTML = '<p style="color:#f87171;font-size:13px;">' + e.message + '</p>'; }
    }, 350);
}
async function assignSectorRole(sectorKey, role, discordId) {
    try {
        await api('/api/senior/sectors/' + sectorKey + '/assign', { method: 'POST', body: JSON.stringify({ role, discordId }) });
        toast('تم التعيين');
        loadSectors();
    } catch (e) { toast(e.message); }
}
async function removeSectorRole(sectorKey, role) {
    if (!confirm('متأكد تبي تزيله من هذا المنصب؟')) return;
    try {
        await api('/api/senior/sectors/' + sectorKey + '/remove', { method: 'POST', body: JSON.stringify({ role }) });
        toast('تم');
        loadSectors();
    } catch (e) { toast(e.message); }
}

// ── لوحة قيادة القطاع (لقادة/نواب القطاعات) ──────────────────────────────
let sectorPanelTab = 'members';
let sectorMembersCache = [];
// ══════════════════════════════════════════════════════════════════════════
// القيادة العليا — مراجعة طلبات الترقية/التنزيل من كل القطاعات
// ══════════════════════════════════════════════════════════════════════════
let hcTab = 'pending';
function renderHighCommandPanel() {
    if (!ME.isHighCommand) return renderDashboard();
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>⭐ القيادة العليا</h2><button class="btn gray sm" onclick="renderDashboard()">رجوع للوحتي</button></div>
        <div class="tabs">
            <div class="tab active" onclick="hcTabSwitch('pending', this)">⏳ الطلبات المعلّقة</div>
            <div class="tab" onclick="hcTabSwitch('history', this)">📜 السجل</div>
        </div>
        <div id="hc-content"></div>\`;
    hcTabSwitch('pending');
}
function hcTabSwitch(name, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    hcTab = name;
    if (name === 'pending') loadHCPending();
    if (name === 'history') loadHCHistory();
}
function hcCard(r, withActions) {
    return \`
        <div class="card">
            <b>\${r.targetName || r.targetTag}</b>
            <div style="color:var(--gold-soft);margin-top:4px;">\${r.direction === 'up' ? '⬆️ ترقية' : '⬇️ تنزيل'}: \${r.fromRank} ← \${r.toRank}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">القطاع: \${r.sectorLabel} • مقدّم الطلب: \${r.requestedByTag || r.requestedBy}</div>
            \${r.reason ? \`<div style="font-size:13px;margin-top:6px;">السبب: \${r.reason}</div>\` : ''}
            \${!withActions ? \`<div style="margin-top:6px;"><span class="badge \${r.status}">\${r.status === 'approved' ? 'مقبول' : 'مرفوض'}</span>\${r.rejectReason ? ' — ' + r.rejectReason : ''}</div>\` : ''}
            \${withActions ? \`
            <div class="row" style="gap:8px;margin-top:10px;">
                <button class="btn sm" onclick="hcDecide('\${r._id}','approve')">قبول</button>
                <button class="btn danger sm" onclick="hcDecide('\${r._id}','reject')">رفض</button>
            </div>\` : ''}
        </div>\`;
}
async function loadHCPending() {
    const box = document.getElementById('hc-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/high-command/promotion-requests'); }
    catch (e) { if (hcTab !== 'pending') return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (hcTab !== 'pending') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد طلبات معلّقة</div>'; return; }
    box.innerHTML = data.list.map(r => hcCard(r, true)).join('');
}
function hcDecide(id, action) {
    if (action === 'reject') {
        const reason = prompt('اكتب سبب الرفض:');
        if (reason === null) return;
        if (!reason.trim()) return toast('لازم تكتب سبب');
        api('/api/high-command/promotion-requests/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) })
            .then(() => { toast('تم الرفض'); loadHCPending(); }).catch(e => toast(e.message));
        return;
    }
    api('/api/high-command/promotion-requests/' + id + '/approve', { method: 'POST' })
        .then(() => { toast('✅ تمت الموافقة'); loadHCPending(); }).catch(e => toast(e.message));
}
async function loadHCHistory() {
    const box = document.getElementById('hc-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/high-command/promotion-requests/history'); }
    catch (e) { if (hcTab !== 'history') return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (hcTab !== 'history') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا يوجد سجل بعد</div>'; return; }
    box.innerHTML = data.list.map(r => hcCard(r, false)).join('');
}

function renderSectorPanel() {
    if (!ME.sectorInfo) return renderDashboard();
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>🎖️ قيادة \${ME.sectorInfo.sectorLabel} (\${ME.sectorInfo.role === 'commander' ? 'قائد' : 'نائب'})</h2>
            <div class="row" style="gap:8px;">
                <button class="btn gray sm" onclick="renderDashboard()">رجوع للوحتي</button>
            </div>
        </div>
        <div class="card">
            <div class="row">
                <span>مسؤول الأفراد: <b style="color:\${ME.sectorInfo.personnelOfficerName ? '#4ade80' : 'var(--muted)'};">\${ME.sectorInfo.personnelOfficerName || 'غير معيّن'}</b></span>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openPersonnelOfficerPicker()">تعيين / تغيير</button>
                    \${ME.sectorInfo.personnelOfficerName ? \`<button class="btn danger sm" onclick="removePersonnelOfficer()">إزالة</button>\` : ''}
                </div>
            </div>
            <div style="color:var(--muted);font-size:12px;margin-top:6px;">مسؤول الأفراد يتحكم بالأعضاء من رتبة رئيس رقباء وتحت فقط (ملاحظات وتحذيرات ومخالفاتهم). طلبات الترقية والتنزيل اللي يسويها ما تصير مباشرة — تجيك أو للنائب بتبويب "ترقيات الأفراد" تحت للموافقة عليها.</div>
            <div id="po-picker"></div>
        </div>
        <div class="card">
            <div class="row">
                <span>مسؤول التحضير: <b style="color:\${ME.sectorInfo.attendanceOfficerName ? '#4ade80' : 'var(--muted)'};">\${ME.sectorInfo.attendanceOfficerName || 'غير معيّن'}</b></span>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openAttendanceOfficerPicker()">تعيين / تغيير</button>
                    \${ME.sectorInfo.attendanceOfficerName ? \`<button class="btn danger sm" onclick="removeAttendanceOfficer()">إزالة</button>\` : ''}
                </div>
            </div>
            <div style="color:var(--muted);font-size:12px;margin-top:6px;">مسؤول التحضير يشوف حضور أعضاء القطاع (المسجلين بالبصمة وغير المسجلين) وآخر سجل حضور/انصراف لكل واحد منهم.</div>
            <div id="ao-picker"></div>
        </div>
        <div class="tabs">
            <div class="tab active" onclick="sectorTab('members', this)">أعضاء القطاع</div>
            <div class="tab" onclick="sectorTab('violations', this)">مخالفات القطاع</div>
            <div class="tab" onclick="sectorTab('file', this)">عرض ملف عسكري</div>
            <div class="tab" onclick="sectorTab('promotions', this)">ترقيات الأفراد</div>
            <div class="tab" onclick="sectorTab('attendance', this)">🖐️ حضور القطاع</div>
            <div class="tab" onclick="sectorTab('leave', this)">🌴 طلبات الإجازات</div>
        </div>
        <div id="sector-content"></div>\`;
    sectorTab('members');
}
// ── إشعار لكل أعضاء القطاع (حسب رول ديسكورد) — لقائد ونائب القطاع فقط ─────────
function openSectorNoticeForm() {
    if (!ME.sectorInfo) return;
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>📢 ضع نص الإشعار (سيصل لكل أعضاء \${ME.sectorInfo.sectorLabel} المسجلين بالموقع)</h3>
        <textarea id="wf-reason-sector" placeholder="اكتب نص الإشعار هنا..."></textarea>
        <div class="wf-actions">
            <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
            <button class="btn sm" onclick="submitSectorNoticeForm()">إرسال لأفراد القطاع</button>
        </div>\`;
    document.getElementById('wf-overlay').classList.add('open');
}
async function submitSectorNoticeForm() {
    const reason = document.getElementById('wf-reason-sector').value;
    if (!reason || !reason.trim()) return toast('لازم تكتب النص');
    if (!confirm('متأكد تبي ترسل هذا الإشعار لكل أعضاء ' + ME.sectorInfo.sectorLabel + '؟')) return;
    try {
        const { count } = await api('/api/sector/notice-all', { method: 'POST', body: JSON.stringify({ reason }) });
        toast('✅ تم الإرسال لـ ' + count + ' عضو');
        closeWarnForm();
    } catch (e) { toast(e.message); }
}
async function openAttendanceOfficerPicker() {
    const el = document.getElementById('ao-picker');
    if (!el) return;
    if (el.innerHTML.trim()) { el.innerHTML = ''; return; }
    el.innerHTML = '<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">جارِ التحميل...</div>';
    try {
        const { list } = await api('/api/sector/members');
        if (list.length === 0) { el.innerHTML = '<p style="color:var(--muted);font-size:13px;margin-top:8px;">لا يوجد أعضاء بالقطاع حالياً</p>'; return; }
        el.innerHTML = \`<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">\` +
            list.filter(p => p.registeredName).map(p => \`
                <div class="card" style="padding:8px 12px;margin-top:6px;">
                    <div class="row">
                        <span>\${p.registeredName} <span style="color:var(--muted);font-size:12px;">(\${p.unit || '-'} • \${p.rank})</span></span>
                        <button class="btn sm" onclick="assignAttendanceOfficer('\${p.discord}')">تعيين</button>
                    </div>
                </div>\`).join('') + \`</div>\`;
    } catch (e) { el.innerHTML = '<p style="color:#f87171;font-size:13px;margin-top:8px;">' + e.message + '</p>'; }
}
async function assignAttendanceOfficer(discordId) {
    try {
        await api('/api/sector/attendance-officer/assign', { method: 'POST', body: JSON.stringify({ discordId }) });
        toast('تم التعيين');
        await refreshMe();
        renderSectorPanel();
    } catch (e) { toast(e.message); }
}
async function removeAttendanceOfficer() {
    if (!confirm('متأكد تبي تزيله من مسؤول التحضير؟')) return;
    try {
        await api('/api/sector/attendance-officer/remove', { method: 'POST' });
        toast('تم');
        await refreshMe();
        renderSectorPanel();
    } catch (e) { toast(e.message); }
}
async function openPersonnelOfficerPicker() {
    const el = document.getElementById('po-picker');
    if (!el) return;
    if (el.innerHTML.trim()) { el.innerHTML = ''; return; }
    el.innerHTML = '<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">جارِ التحميل...</div>';
    try {
        const { list } = await api('/api/sector/members');
        if (list.length === 0) { el.innerHTML = '<p style="color:var(--muted);font-size:13px;margin-top:8px;">لا يوجد أعضاء بالقطاع حالياً</p>'; return; }
        el.innerHTML = \`<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">\` +
            list.filter(p => p.registeredName).map(p => \`
                <div class="card" style="padding:8px 12px;margin-top:6px;">
                    <div class="row">
                        <span>\${p.registeredName} <span style="color:var(--muted);font-size:12px;">(\${p.unit || '-'} • \${p.rank})</span></span>
                        <button class="btn sm" onclick="assignPersonnelOfficer('\${p.discord}')">تعيين</button>
                    </div>
                </div>\`).join('') + \`</div>\`;
    } catch (e) { el.innerHTML = '<p style="color:#f87171;font-size:13px;margin-top:8px;">' + e.message + '</p>'; }
}
async function assignPersonnelOfficer(discordId) {
    try {
        await api('/api/sector/personnel-officer/assign', { method: 'POST', body: JSON.stringify({ discordId }) });
        toast('تم التعيين');
        await refreshMe();
        renderSectorPanel();
    } catch (e) { toast(e.message); }
}
async function removePersonnelOfficer() {
    if (!confirm('متأكد تبي تزيله من مسؤول الأفراد؟')) return;
    try {
        await api('/api/sector/personnel-officer/remove', { method: 'POST' });
        toast('تم');
        await refreshMe();
        renderSectorPanel();
    } catch (e) { toast(e.message); }
}
function sectorTab(name, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    sectorPanelTab = name;
    if (name === 'members') loadSectorMembers();
    if (name === 'violations') loadSectorViolations();
    if (name === 'file') renderSectorFileSearch();
    if (name === 'promotions') loadPromotionRequests();
    if (name === 'attendance') loadSectorAttendance();
    if (name === 'leave') loadSectorLeavePending();
}
async function loadSectorAttendance() {
    const box = document.getElementById('sector-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/sector/attendance'); }
    catch (e) {
        if (sectorPanelTab !== 'attendance') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    if (sectorPanelTab !== 'attendance') return;
    if (!data.list.length) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا يوجد أعضاء بالقطاع</div>'; return; }
    box.innerHTML = data.list.map(m => \`
        <div class="card row">
            <div>
                <b>\${m.name || 'غير مسجل بالموقع'}</b>
                <div class="sub" style="font-size:12px;color:var(--muted);">\${m.unit || '-'} • \${m.rank || '-'}</div>
                \${!m.registeredForAttendance ? '<div style="font-size:12px;color:#fca5a5;margin-top:2px;">لم يبصم من قبل</div>' :
                    \`<div style="font-size:11px;color:var(--muted);margin-top:2px;">آخر حضور: \${m.lastCheckInAt ? new Date(m.lastCheckInAt).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' }) : '-'} • آخر انصراف: \${m.lastCheckOutAt ? new Date(m.lastCheckOutAt).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' }) : '-'}</div>\`}
            </div>
            <span class="badge \${m.status === 'in' ? 'approved' : 'pending'}">\${m.status === 'in' ? '✅ حاضر' : '⭕ منصرف'}</span>
        </div>\`).join('');
}
// ── لوحة مستقلة لـ"مسؤول التحضير" (لمن ما يكون بنفس الوقت قائد/نائب قطاع) — نفس بيانات تبويب "حضور القطاع" ──
function renderAttendanceOfficerPanel() {
    if (!ME.attendanceOfficerInfo) return renderDashboard();
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>🖐️ لوحة التحضير — \${ME.attendanceOfficerInfo.sectorLabel}</h2><button class="btn gray sm" onclick="renderDashboard()">رجوع للوحتي</button></div>
        <div style="color:var(--muted);font-size:12px;margin-bottom:6px;">حضور أعضاء القطاع (المسجلين بالبصمة وغير المسجلين) وآخر سجل حضور/انصراف لكل واحد منهم.</div>
        <div id="ao-panel-content"><div class="card">جارِ التحميل...</div></div>\`;
    loadAttendanceOfficerPanel();
}
async function loadAttendanceOfficerPanel() {
    const box = document.getElementById('ao-panel-content');
    if (!box) return;
    let data;
    try { data = await api('/api/sector/attendance'); }
    catch (e) { box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (!data.list.length) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا يوجد أعضاء بالقطاع</div>'; return; }
    box.innerHTML = data.list.map(m => \`
        <div class="card row">
            <div>
                <b>\${m.name || 'غير مسجل بالموقع'}</b>
                <div class="sub" style="font-size:12px;color:var(--muted);">\${m.unit || '-'} • \${m.rank || '-'}</div>
                \${!m.registeredForAttendance ? '<div style="font-size:12px;color:#fca5a5;margin-top:2px;">لم يبصم من قبل</div>' :
                    \`<div style="font-size:11px;color:var(--muted);margin-top:2px;">آخر حضور: \${m.lastCheckInAt ? new Date(m.lastCheckInAt).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' }) : '-'} • آخر انصراف: \${m.lastCheckOutAt ? new Date(m.lastCheckOutAt).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' }) : '-'}</div>\`}
            </div>
            <span class="badge \${m.status === 'in' ? 'approved' : 'pending'}">\${m.status === 'in' ? '✅ حاضر' : '⭕ منصرف'}</span>
        </div>\`).join('');
}
async function loadSectorLeavePending() {
    const box = document.getElementById('sector-content') || document.getElementById('po-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let list;
    try { ({ list } = await api('/api/leave/pending')); }
    catch (e) {
        if (sectorPanelTab !== 'leave' && poTab !== 'leave') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    box.innerHTML = renderLeaveRequestsList(list, false);
}
async function loadPromotionRequests() {
    const box = document.getElementById('sector-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/sector/promotion-requests'); }
    catch (e) {
        if (sectorPanelTab !== 'promotions') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    if (sectorPanelTab !== 'promotions') return;
    const list = data.list || [];
    const note = \`<div class="card" style="color:var(--muted);font-size:13px;">📩 طلبات الترقية والتنزيل (منك أو من مسؤول الأفراد) تراجعها القيادة العليا — هذي بس متابعة لحالتها.</div>\`;
    if (list.length === 0) { box.innerHTML = note + '<div class="card center" style="color:var(--muted);">لا توجد طلبات حالياً</div>'; return; }
    box.innerHTML = note + list.map(r => \`
        <div class="card">
            <b>\${r.targetName || r.targetTag}</b>
            <div style="color:var(--gold-soft);margin-top:4px;">\${r.direction === 'up' ? '⬆️ طلب ترقية' : '⬇️ طلب تنزيل'}: \${r.fromRank} ← \${r.toRank}</div>
            \${r.reason ? \`<div style="color:var(--muted);font-size:12px;margin-top:2px;">السبب: \${r.reason}</div>\` : ''}
            <div style="color:var(--muted);font-size:12px;margin-top:2px;">مقدّم الطلب: \${r.requestedByTag || r.requestedBy}</div>
            <div style="margin-top:4px;"><span class="badge \${r.status}">\${r.status === 'pending' ? 'قيد المراجعة (القيادة العليا)' : r.status === 'approved' ? 'تمت الموافقة' : 'مرفوض'}</span>\${r.status === 'rejected' && r.rejectReason ? \` — \${r.rejectReason}\` : ''}</div>
        </div>\`).join('');
}
async function loadSectorMembers() {
    const box = document.getElementById('sector-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/sector/members'); }
    catch (e) {
        if (sectorPanelTab !== 'members') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    if (sectorPanelTab !== 'members') return;
    sectorMembersCache = data.list;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا يوجد أعضاء مسجّلين بهذا القطاع حالياً</div>'; return; }
    box.innerHTML = data.list.map(p => \`
        <div class="card">
            <div class="row">
                <div>
                    <b>\${p.registeredName || p.discordTag}</b> <span style="color:var(--muted);font-size:12px;">\${p.unit || ''} • \${p.rank}</span>
                    <div style="font-size:13px;color:#94a3b8;">النقاط: \${p.points} \${p.isBlocked ? '• 🚫 موقوف' : ''}</div>
                </div>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="sectorPromote('\${p.discord}','up')">⬆️ ترقية</button>
                    <button class="btn sm gray" onclick="sectorPromote('\${p.discord}','down')">⬇️ تنزيل</button>
                    <button class="btn sm gray" onclick="sectorAssignUnit('\${p.discord}')">🪖 يونت</button>
                    <button class="btn sm gray" onclick="editMemberPoints('\${p.discord}', \${p.points})">✏️ النقاط</button>
                    <button class="btn sm gray" onclick="sectorAddNote('\${p.discord}')">📝 ملاحظة</button>
                </div>
            </div>
        </div>\`).join('');
}
async function sectorPromote(discord, direction) {
    const reason = prompt(direction === 'up' ? 'اكتب سبب الترقية:' : 'اكتب سبب التنزيل:');
    if (reason === null) return;
    if (!reason.trim()) return toast('لازم تكتب السبب');
    try {
        await api('/api/sector/personnel/' + discord + '/rank', { method: 'POST', body: JSON.stringify({ direction, reason }) });
        toast('📩 تم إرسال الطلب للقيادة العليا للمراجعة');
        loadSectorMembers();
    } catch (e) { toast(e.message); }
}
function sectorAssignUnit(discord) {
    const unit = prompt('اسم اليونت الجديد:');
    if (unit === null) return;
    if (!unit.trim()) return toast('حط اسم اليونت');
    api('/api/sector/personnel/' + discord + '/unit', { method: 'POST', body: JSON.stringify({ unit }) })
        .then(() => { toast('تم التعيين'); loadSectorMembers(); }).catch(e => toast(e.message));
}
function sectorAddNote(discord) {
    openSectorNoteForm(discord, '/api/sector/personnel/', 'loadSectorMembers()');
}
async function loadSectorViolations() {
    const box = document.getElementById('sector-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/sector/violations'); }
    catch (e) {
        if (sectorPanelTab !== 'violations') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    if (sectorPanelTab !== 'violations') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد مخالفات أو تقارير بعد</div>'; return; }
    box.innerHTML = data.list.map(v => \`
        <div class="card">
            <div class="row" style="align-items:flex-start;">
                <div class="row" style="gap:10px;align-items:flex-start;">
                    \${v.hasPhoto ? \`<button class="btn sm gray" onclick="viewViolationPhoto('\${v._id}')">📷 عرض الصورة</button>\` : ''}
                    <div>
                        <b>\${v.reporterName || v.reporterTag}</b> <span style="color:var(--muted);font-size:12px;">(\${v.reporterUnit || '-'})</span>
                        <div style="color:var(--gold-soft);margin-top:4px;">\${v.kind === 'report' ? ('🧪 تقرير مكافحة مخدرات — ' + v.reportCategory) : v.violationType}</div>
                        <div style="margin-top:4px;"><span class="badge \${v.status}">\${v.status === 'pending' ? 'قيد المراجعة' : v.status === 'approved' ? 'مقبولة' : 'مرفوضة'}</span></div>
                    </div>
                </div>
                \${data.canReview && v.status === 'pending' ? \`
                <div class="row" style="gap:8px;">
                    <button class="btn sm" onclick="sectorApprove('\${v._id}')">قبول</button>
                    <button class="btn danger sm" onclick="sectorReject('\${v._id}')">رفض</button>
                </div>\` : ''}
            </div>
        </div>\`).join('');
}
function sectorApprove(id) {
    api('/api/sector/violations/' + id + '/approve', { method: 'POST' })
        .then(() => { toast('تم القبول'); loadSectorViolations(); }).catch(e => toast(e.message));
}
function sectorReject(id) {
    const reason = prompt('اكتب سبب الرفض:');
    if (reason === null) return;
    if (!reason.trim()) return toast('لازم تكتب سبب');
    api('/api/sector/violations/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) })
        .then(() => { toast('تم الرفض'); loadSectorViolations(); }).catch(e => toast(e.message));
}
function renderSectorFileSearch() {
    const box = document.getElementById('sector-content');
    if (!box) return;
    box.innerHTML = \`
        <div class="card">
            <input id="sector-file-search" placeholder="🔍 ابحث عن اسم عضو من قطاعك..." oninput="filterSectorFileSearch()">
            <div id="sector-file-results"></div>
        </div>
        <div id="sector-file-view"></div>\`;
    if (sectorMembersCache.length === 0) {
        api('/api/sector/members').then(d => { sectorMembersCache = d.list; }).catch(() => {});
    }
}
function filterSectorFileSearch() {
    const q = document.getElementById('sector-file-search').value.trim().toLowerCase();
    const box = document.getElementById('sector-file-results');
    if (!q) { box.innerHTML = ''; return; }
    const matches = sectorMembersCache.filter(p => (p.registeredName || '').toLowerCase().includes(q) || (p.discordTag || '').toLowerCase().includes(q));
    box.innerHTML = matches.map(p => \`
        <div class="card" style="padding:8px 12px;margin-top:6px;">
            <div class="row">
                <span>\${p.registeredName || p.discordTag} <span style="color:var(--muted);font-size:12px;">(\${p.unit || '-'})</span></span>
                <button class="btn sm" onclick="viewSectorFile('\${p.discord}')">عرض الملف</button>
            </div>
        </div>\`).join('') || '<p style="color:var(--muted);font-size:13px;">لا نتائج</p>';
}
async function viewSectorFile(discord) {
    const box = document.getElementById('sector-file-view');
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    try {
        const { personnel: p } = await api('/api/sector/personnel/' + discord);
        box.innerHTML = \`
            <div class="id-card" style="margin-top:16px;">
                <div class="center" style="font-size:18px;font-weight:bold;color:var(--gold-soft);">\${p.registeredName || p.discordTag}</div>
                <div class="center" style="font-size:12px;color:var(--muted);margin-bottom:10px;">ملف عسكري</div>
                <table>
                    <tr><td>اليونت</td><td>\${p.unit || '-'}</td></tr>
                    <tr><td>الرتبة</td><td>\${p.rank}</td></tr>
                </table>
                \${p.notes && p.notes.length ? '<div style="margin-top:10px;font-size:13px;color:var(--gold-soft);">الملاحظات:</div>' +
                    p.notes.map(n => \`<div style="background:rgba(5,15,10,0.6);padding:8px;border-radius:8px;margin-top:6px;font-size:13px;">\${n.text}\${(n.image || (n.imageChannelId && n.imageMessageId)) ? \`<button class="btn sm gray" style="margin-top:6px;" onclick="viewNotePhoto('\${p.discord}','\${n._id}')">📷 عرض الصورة</button>\` : ''}</div>\`).join('') : ''}
            </div>\`;
    } catch (e) { box.innerHTML = \`<div class="card" style="color:#f87171;">\${e.message}</div>\`; }
}

// ── لوحة "مسؤول الأفراد" — صلاحيته على رتبة رئيس رقباء وتحت فقط بقطاعه ────
let poTab = 'members';
function renderPersonnelOfficerPanel() {
    if (!ME.personnelOfficerInfo) return renderDashboard();
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>👥 مسؤول أفراد \${ME.personnelOfficerInfo.sectorLabel}</h2><button class="btn gray sm" onclick="renderDashboard()">رجوع للوحتي</button></div>
        <div class="card" style="color:var(--muted);font-size:13px;">صلاحيتك تشمل أفراد قطاعك من رتبة <b style="color:var(--gold-soft);">رئيس رقباء وتحت</b> فقط. طلبات الترقية/التنزيل ما تصير فورية — تروح كطلب لقائد أو نائب القطاع للموافقة.</div>
        <div class="tabs">
            <div class="tab active" onclick="poTabSwitch('members', this)">الأفراد</div>
            <div class="tab" onclick="poTabSwitch('violations', this)">مخالفات الأفراد</div>
            <div class="tab" onclick="poTabSwitch('leave', this)">🌴 طلبات الإجازات</div>
        </div>
        <div id="po-content"></div>\`;
    poTabSwitch('members');
}
function poTabSwitch(name, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    poTab = name;
    if (name === 'members') loadPoMembers();
    if (name === 'violations') loadPoViolations();
    if (name === 'leave') loadSectorLeavePending();
}
async function loadPoMembers() {
    const box = document.getElementById('po-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/personnel-officer/members'); }
    catch (e) {
        if (poTab !== 'members') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    if (poTab !== 'members') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا يوجد أفراد برتبة رئيس رقباء وتحت بقطاعك حالياً</div>'; return; }
    box.innerHTML = data.list.map(p => \`
        <div class="card">
            <div class="row">
                <div>
                    <b>\${p.registeredName || p.discordTag}</b> <span style="color:var(--muted);font-size:12px;">\${p.unit || ''} • \${p.rank}</span>
                    <div style="font-size:13px;color:#94a3b8;">النقاط: \${p.points} \${p.isBlocked ? '• 🚫 موقوف' : ''}</div>
                </div>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="poPromotionRequest('\${p.discord}','up')">⬆️ طلب ترقية</button>
                    <button class="btn sm gray" onclick="poPromotionRequest('\${p.discord}','down')">⬇️ طلب تنزيل</button>
                    <button class="btn sm gray" onclick="editMemberPoints('\${p.discord}', \${p.points})">✏️ النقاط</button>
                    <button class="btn sm gray" onclick="poAddNote('\${p.discord}')">📝 ملاحظة</button>
                </div>
            </div>
        </div>\`).join('');
}
// تعديل نقاط عضو — متاح لقيادة القطاع ومسؤول الأفراد (بنطاق صلاحيته) بنفس أسلوب كبار المسؤولين
async function editMemberPoints(discord, currentPoints) {
    const val = prompt('عدد النقاط الجديد:', currentPoints);
    if (val === null) return;
    if (val === '' || isNaN(parseInt(val))) return toast('حط رقم صحيح');
    try {
        await api('/api/points/edit/' + discord, { method: 'POST', body: JSON.stringify({ points: parseInt(val) }) });
        toast('تم تحديث النقاط');
        if (sectorPanelTab === 'members') loadSectorMembers();
        if (poTab === 'members') loadPoMembers();
    } catch (e) { toast(e.message); }
}
function poPromotionRequest(discord, direction) {
    const reason = prompt(direction === 'up' ? 'اكتب سبب الترقية:' : 'اكتب سبب التنزيل:');
    if (reason === null) return;
    if (!reason.trim()) return toast('لازم تكتب السبب');
    api('/api/personnel-officer/personnel/' + discord + '/promotion-request', { method: 'POST', body: JSON.stringify({ direction, reason }) })
        .then(() => toast('📩 تم إرسال الطلب للقيادة العليا للمراجعة')).catch(e => toast(e.message));
}
function poAddNote(discord) {
    openNoteForm(discord, '/api/personnel-officer/personnel/', 'loadPoMembers()');
}
async function loadPoViolations() {
    const box = document.getElementById('po-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/personnel-officer/violations'); }
    catch (e) {
        if (poTab !== 'violations') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    if (poTab !== 'violations') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد مخالفات أو تقارير بعد</div>'; return; }
    box.innerHTML = data.list.map(v => \`
        <div class="card">
            <div class="row" style="align-items:flex-start;">
                <div class="row" style="gap:10px;align-items:flex-start;">
                    \${v.hasPhoto ? \`<button class="btn sm gray" onclick="viewViolationPhoto('\${v._id}')">📷 عرض الصورة</button>\` : ''}
                    <div>
                        <b>\${v.reporterName || v.reporterTag}</b> <span style="color:var(--muted);font-size:12px;">(\${v.reporterUnit || '-'})</span>
                        <div style="color:var(--gold-soft);margin-top:4px;">\${v.kind === 'report' ? ('🧪 تقرير مكافحة مخدرات — ' + v.reportCategory) : v.violationType}</div>
                        <div style="margin-top:4px;"><span class="badge \${v.status}">\${v.status === 'pending' ? 'قيد المراجعة' : v.status === 'approved' ? 'مقبولة' : 'مرفوضة'}</span></div>
                    </div>
                </div>
                \${v.status === 'pending' ? \`
                <div class="row" style="gap:8px;">
                    <button class="btn sm" onclick="poApprove('\${v._id}')">قبول</button>
                    <button class="btn danger sm" onclick="poReject('\${v._id}')">رفض</button>
                </div>\` : ''}
            </div>
        </div>\`).join('');
}
function poApprove(id) {
    api('/api/personnel-officer/violations/' + id + '/approve', { method: 'POST' })
        .then(() => { toast('تم القبول'); loadPoViolations(); }).catch(e => toast(e.message));
}
function poReject(id) {
    const reason = prompt('اكتب سبب الرفض:');
    if (reason === null) return;
    if (!reason.trim()) return toast('لازم تكتب سبب');
    api('/api/personnel-officer/violations/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) })
        .then(() => { toast('تم الرفض'); loadPoViolations(); }).catch(e => toast(e.message));
}

// ══════════════════════════════════════════════════════════════════════════
// لوحة الشرطة العسكرية — قائد/نائب (3 صفحات: العساكر، التقارير، لوق القطاعات)
// ══════════════════════════════════════════════════════════════════════════
let mpTab = 'members';
function renderMPPanel() {
    if (!ME.mpInfo) return renderDashboard();
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>🚔 لوحة الشرطة العسكرية \${ME.mpInfo ? (' (' + (ME.mpInfo.role === 'commander' ? 'قائد' : 'نائب') + ')') : ''}</h2>
            <div class="row" style="gap:8px;">
                <button class="btn sm" onclick="openMPReportForm('renderMPPanel()')">+ تسجيل تقرير جديد</button>
                <button class="btn gray sm" onclick="renderDashboard()">رجوع للوحتي</button>
            </div>
        </div>
        <div class="tabs">
            <div class="tab active" onclick="mpTabSwitch('members', this)">👤 العساكر</div>
            <div class="tab" onclick="mpTabSwitch('force', this)">🚔 أفراد الشرطة العسكرية</div>
            <div class="tab" onclick="mpTabSwitch('file', this)">📇 عرض ملف عسكري</div>
            <div class="tab" onclick="mpTabSwitch('requests', this)">📣 طلبات الاستدعاء</div>
            <div class="tab" onclick="mpTabSwitch('reports', this)">📄 التقارير</div>
            <div class="tab" onclick="mpTabSwitch('log', this)">📜 لوق القطاعات</div>
            <div class="tab" onclick="mpTabSwitch('promo', this)">🎖️ سجل الترقيات</div>
            <div class="tab" onclick="mpTabSwitch('po', this)">👮 مسؤول الأفراد</div>
        </div>
        <div id="mp-content"></div>\`;
    mpTabSwitch('members');
}
function openMPNoticeForm() {
    if (!ME.mpInfo) return;
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>📢 ضع نص الإشعار (سيصل لكل أفراد الشرطة العسكرية المسجلين بالموقع)</h3>
        <textarea id="wf-reason-mp" placeholder="اكتب نص الإشعار هنا..."></textarea>
        <div class="wf-actions">
            <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
            <button class="btn sm" onclick="submitMPNoticeForm()">إرسال لأفراد الشرطة العسكرية</button>
        </div>\`;
    document.getElementById('wf-overlay').classList.add('open');
}
async function submitMPNoticeForm() {
    const reason = document.getElementById('wf-reason-mp').value;
    if (!reason || !reason.trim()) return toast('لازم تكتب النص');
    if (!confirm('متأكد تبي ترسل هذا الإشعار لكل أفراد الشرطة العسكرية؟')) return;
    try {
        const { count } = await api('/api/mp/notice-all', { method: 'POST', body: JSON.stringify({ reason }) });
        toast('✅ تم الإرسال لـ ' + count + ' عضو');
        closeWarnForm();
    } catch (e) { toast(e.message); }
}
async function loadMPForceMembers() {
    const box = document.getElementById('mp-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/mp/force-members'); }
    catch (e) { if (mpTab !== 'force') return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (mpTab !== 'force') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا يوجد أفراد شرطة عسكرية مسجلين بعد</div>'; return; }
    box.innerHTML = data.list.map(p => \`
        <div class="card">
            <div class="row">
                <div><b>\${p.registeredName || p.discordTag}</b> <span style="color:var(--muted);font-size:12px;">\${p.unit || ''} • \${p.rank}</span></div>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openNoteForm('\${p.discord}','/api/mp/personnel/','loadMPForceMembers()')">📝 ملاحظة</button>
                </div>
            </div>
        </div>\`).join('');
}
function mpTabSwitch(name, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    mpTab = name;
    if (name === 'members') loadMPMembers();
    if (name === 'force') loadMPForceMembers();
    if (name === 'file') renderMPFileSearch();
    if (name === 'requests') loadMPSummonRequests();
    if (name === 'reports') loadMPReports();
    if (name === 'log') loadMPSectorLog();
    if (name === 'promo') loadMPPromotionLog();
    if (name === 'po') loadMPPOBox();
}
let mpLeaderListCache = [];
async function loadMPMembers() {
    const box = document.getElementById('mp-content');
    if (!box) return;
    box.innerHTML = \`<div class="card"><input id="mp-leader-search" placeholder="بحث بالاسم / اليونت / الرتبة" onkeyup="if(event.key==='Enter') filterMPLeaderMembers();"><button class="btn sm" onclick="filterMPLeaderMembers()">بحث</button></div><div id="mp-leader-results"><div class="card">جارِ التحميل...</div></div>\`;
    let data;
    try { data = await api('/api/mp/members'); }
    catch (e) {
        if (mpTab !== 'members') return;
        document.getElementById('mp-leader-results').innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    if (mpTab !== 'members') return;
    mpLeaderListCache = data.list;
    renderMPLeaderMembersList(mpLeaderListCache);
}
function filterMPLeaderMembers() {
    const input = document.getElementById('mp-leader-search');
    const q = input ? input.value.trim() : '';
    if (!q) return renderMPLeaderMembersList(mpLeaderListCache);
    const filtered = mpLeaderListCache.filter(p =>
        (p.registeredName || p.discordTag || '').includes(q) ||
        (p.unit || '').includes(q) ||
        (p.rank || '').includes(q)
    );
    renderMPLeaderMembersList(filtered);
}
function renderMPLeaderMembersList(list) {
    const box = document.getElementById('mp-leader-results');
    if (!box) return;
    if (list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا يوجد نتائج</div>'; return; }
    box.innerHTML = list.map(p => \`
        <div class="card">
            <div class="row">
                <div>
                    <b>\${p.registeredName || p.discordTag}</b> <span style="color:var(--muted);font-size:12px;">\${p.unit || ''} • \${p.rank}</span>
                    \${p.summon && p.summon.status === 'approved' ? \`<div style="color:#f59e0b;font-size:12px;margin-top:3px;">📣 عليه استدعاء نشط — \${p.summon.timeLabel || ''}\${p.summon.enteredAt ? ' (دخل الاستدعاء)' : ''}</div>\` : ''}
                    \${p.summon && p.summon.status === 'pending' ? '<div style="color:#fbbf24;font-size:12px;margin-top:3px;">⏳ طلب استدعاء بانتظار قبولك</div>' : ''}
                </div>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openNoteForm('\${p.discord}','/api/mp/personnel/','loadMPMembers()')">📝 ملاحظة</button>
                    \${(!p.summon || p.summon.status === 'none') ? \`<button class="btn sm" onclick="openSummonForm('\${p.discord}','/api/mp/personnel/','loadMPMembers()')">📣 استدعاء</button>\` : ''}
                    \${p.summon && p.summon.status === 'approved' ? \`<button class="btn sm danger" onclick="mpStopSummon('\${p.discord}')">✅ إنهاء الاستدعاء</button>\` : ''}
                </div>
            </div>
        </div>\`).join('');
}
function mpStopSummon(discord) {
    api('/api/mp/personnel/' + discord + '/summon/stop', { method: 'POST' })
        .then(() => { toast('✅ تم إنهاء الاستدعاء'); loadMPMembers(); }).catch(e => toast(e.message));
}
function renderMPFileSearch() {
    const box = document.getElementById('mp-content');
    if (!box) return;
    box.innerHTML = \`
        <div class="card">
            <input id="mp-file-search" placeholder="🔍 ابحث عن اسم العسكري..." oninput="filterMPFileSearch()">
            <div id="mp-file-results"></div>
        </div>
        <div id="mp-file-view"></div>\`;
    if (mpLeaderListCache.length === 0) {
        api('/api/mp/members').then(d => { mpLeaderListCache = d.list; }).catch(() => {});
    }
}
function filterMPFileSearch() {
    const q = document.getElementById('mp-file-search').value.trim().toLowerCase();
    const box = document.getElementById('mp-file-results');
    if (!q) { box.innerHTML = ''; return; }
    const matches = mpLeaderListCache.filter(p => (p.registeredName || '').toLowerCase().includes(q) || (p.discordTag || '').toLowerCase().includes(q));
    box.innerHTML = matches.map(p => \`
        <div class="card" style="padding:8px 12px;margin-top:6px;">
            <div class="row">
                <span>\${p.registeredName || p.discordTag} <span style="color:var(--muted);font-size:12px;">(\${p.unit || '-'})</span></span>
                <button class="btn sm" onclick="viewMPFile('\${p.discord}')">عرض الملف</button>
            </div>
        </div>\`).join('') || '<p style="color:var(--muted);font-size:13px;">لا نتائج</p>';
}
async function viewMPFile(discord) {
    const box = document.getElementById('mp-file-view');
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    try {
        const { personnel: p, progress } = await api('/api/mp/personnel/' + discord);
        box.innerHTML = \`
            <div class="id-card" style="margin-top:16px;">
                <div class="center" style="font-size:18px;font-weight:bold;color:var(--gold-soft);">\${p.registeredName || p.discordTag}</div>
                <div class="center" style="font-size:12px;color:var(--muted);margin-bottom:10px;">ملف عسكري كامل</div>
                <table>
                    <tr><td>اليونت</td><td>\${p.unit || '-'}</td></tr>
                    <tr><td>الرتبة</td><td>\${p.rank}</td></tr>
                    <tr><td>النقاط</td><td>\${p.points}</td></tr>
                    <tr><td>متبقي للترقية</td><td>\${progress.nextRank ? (progress.remaining + ' نقطة (' + progress.nextRank + ')') : 'وصل لأعلى رتبة'}</td></tr>
                    <tr><td>الحالة</td><td>\${p.isBlocked ? 'موقوف' : 'فعّال'}</td></tr>
                    \${p.summon && p.summon.status !== 'none' ? \`<tr><td>الاستدعاء</td><td>\${p.summon.status === 'approved' ? '📣 نشط — ' + (p.summon.timeLabel || '') : '⏳ طلب معلّق'}</td></tr>\` : ''}
                </table>
                \${p.notes && p.notes.length ? '<div style="margin-top:10px;font-size:13px;color:var(--gold-soft);">الملاحظات:</div>' +
                    p.notes.map(n => \`<div style="background:rgba(5,15,10,0.6);padding:8px;border-radius:8px;margin-top:6px;font-size:13px;">\${n.text}\${(n.image || (n.imageChannelId && n.imageMessageId)) ? \`<button class="btn sm gray" style="margin-top:6px;" onclick="viewNotePhoto('\${p.discord}','\${n._id}')">📷 عرض الصورة</button>\` : ''}</div>\`).join('') : ''}
            </div>\`;
    } catch (e) { box.innerHTML = \`<div class="card" style="color:#f87171;">\${e.message}</div>\`; }
}
async function loadMPSummonRequests() {
    const box = document.getElementById('mp-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/mp/summon-requests'); }
    catch (e) { if (mpTab !== 'requests') return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (mpTab !== 'requests') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد طلبات استدعاء معلّقة</div>'; return; }
    box.innerHTML = data.list.map(p => \`
        <div class="card">
            <div class="row">
                <div>
                    <b>\${p.registeredName || p.discordTag}</b> <span style="color:var(--muted);font-size:12px;">\${p.rank}</span>
                    <div style="color:var(--gold-soft);margin-top:4px;">🕒 \${p.summon.timeLabel}</div>
                </div>
                <div class="row" style="gap:8px;">
                    <button class="btn sm" onclick="mpSummonReqDecide('\${p.discord}','approve')">قبول</button>
                    <button class="btn danger sm" onclick="mpSummonReqDecide('\${p.discord}','reject')">رفض</button>
                </div>
            </div>
        </div>\`).join('');
}
function mpSummonReqDecide(discord, action) {
    api('/api/mp/summon-requests/' + discord + '/' + action, { method: 'POST' })
        .then(() => { toast(action === 'approve' ? '✅ تم قبول الاستدعاء' : 'تم رفض الطلب'); loadMPSummonRequests(); })
        .catch(e => toast(e.message));
}
function renderMPReportCard(r, decideFn, isLeaderView) {
    const statusBadge = r.status === 'approved' ? '<span style="color:#4ade80;font-size:12px;">✅ مقبول</span>'
        : r.status === 'rejected' ? '<span style="color:#f87171;font-size:12px;">❌ مرفوض</span>'
        : '<span style="color:#fbbf24;font-size:12px;">⏳ معلّق</span>';
    let actions = '';
    if (r.status === 'pending') {
        actions = \`
            <button class="btn sm" onclick="\${decideFn}('\${r._id}','approve')">قبول التقرير</button>
            <button class="btn danger sm" onclick="\${decideFn}('\${r._id}','reject')">رفض</button>\`;
    } else if (isLeaderView && r.status === 'approved') {
        actions = \`<button class="btn danger sm" onclick="mpDeleteReport('\${r._id}')">🗑️ حذف نهائي</button>\`;
    } else if (isLeaderView && r.status === 'rejected') {
        actions = \`
            <button class="btn sm" onclick="\${decideFn}('\${r._id}','approve')">قبول مباشر</button>
            <button class="btn danger sm" onclick="mpDeleteReport('\${r._id}')">🗑️ حذف نهائي</button>\`;
        if (r.rejectReason) actions = \`<div style="color:var(--muted);font-size:12px;margin-bottom:8px;">سبب الرفض: \${r.rejectReason}</div>\` + actions;
    }
    return \`
        <div class="card">
            <div class="row"><b>\${r.reporterName}</b> \${statusBadge}</div>
            <span style="color:var(--muted);font-size:12px;">(\${r.reporterRank})</span>
            <div style="margin-top:6px;color:var(--gold-soft);">1) وش سوى بالاستلام:</div>
            <div style="font-size:13px;margin-top:2px;">\${r.dutyReport}</div>
            <div style="margin-top:8px;color:var(--gold-soft);">2) عدد الجولات/الدوريات: <span style="color:#fff;">\${r.patrolsCount || 0}</span></div>
            <div style="margin-top:4px;color:var(--gold-soft);">3) عدد الاستدعاءات المنفّذة: <span style="color:#fff;">\${r.summonsCount || 0}</span></div>
            \${r.incidents ? \`<div style="margin-top:8px;color:var(--gold-soft);">4) مخالفات/حالات مشبوهة:</div><div style="font-size:13px;margin-top:2px;">\${r.incidents}</div>\` : ''}
            \${r.notesIssued && r.notesIssued.length ? \`<div style="margin-top:8px;color:var(--gold-soft);">5) الملاحظات/التحذيرات المسجّلة (\${r.notesIssued.length}):</div>\` + r.notesIssued.map(n => \`<div style="font-size:12px;color:var(--muted);margin-top:3px;">• \${n.name || n.tag} (\${n.kind === 'warning' ? 'تحذير' : 'ملاحظة'}) — \${n.reason}</div>\`).join('') : ''}
            \${r.generalNotes ? \`<div style="margin-top:8px;color:var(--gold-soft);">6) ملاحظات عامة:</div><div style="font-size:13px;margin-top:2px;">\${r.generalNotes}</div>\` : ''}
            <div class="row" style="gap:8px;margin-top:10px;">\${actions}</div>
        </div>\`;
}
async function loadMPReports() {
    const box = document.getElementById('mp-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/mp/reports/all'); }
    catch (e) { if (mpTab !== 'reports') return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (mpTab !== 'reports') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد تقارير بعد</div>'; return; }
    box.innerHTML = data.list.map(r => renderMPReportCard(r, 'mpReportDecide', true)).join('');
}
function mpDeleteReport(id) {
    if (!confirm('متأكد تبي تحذف هذا التقرير نهائياً؟ ما يرجع بعدها.')) return;
    api('/api/mp/reports/' + id, { method: 'DELETE' })
        .then(() => { toast('🗑️ تم الحذف نهائياً'); loadMPReports(); }).catch(e => toast(e.message));
}
function mpReportDecide(id, action) {
    if (action === 'reject') {
        const reason = prompt('اكتب سبب الرفض:');
        if (reason === null) return;
        if (!reason.trim()) return toast('لازم تكتب سبب');
        api('/api/mp/reports/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) })
            .then(() => { toast('تم الرفض'); loadMPReports(); }).catch(e => toast(e.message));
        return;
    }
    api('/api/mp/reports/' + id + '/approve', { method: 'POST' })
        .then(() => { toast('✅ تم قبول التقرير'); loadMPReports(); }).catch(e => toast(e.message));
}
async function loadMPSectorLog() {
    const box = document.getElementById('mp-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/mp/sector-log'); }
    catch (e) { if (mpTab !== 'log') return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (mpTab !== 'log') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد أحداث بعد</div>'; return; }
    box.innerHTML = data.list.map(l => \`
        <div class="card" style="padding:10px 14px;">
            <div style="font-size:13px;"><b>\${l.action}</b> — \${l.actorTag || '-'}</div>
            \${l.discordTag ? \`<div style="font-size:12px;color:var(--muted);margin-top:2px;">على: \${l.discordTag}</div>\` : ''}
            \${l.details ? \`<div style="font-size:12px;color:var(--muted);margin-top:2px;">\${l.details}</div>\` : ''}
            <div style="font-size:11px;color:var(--muted);margin-top:4px;">\${new Date(l.createdAt).toLocaleString('ar')}</div>
        </div>\`).join('');
}
// سجل كامل ودائم لكل طلبات الترقية/التنزيل — لعلم قيادة الشرطة العسكرية: مين قدّم ومتى، ومين وافق/رفض ومتى
async function loadMPPromotionLog() {
    const box = document.getElementById('mp-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/mp/promotion-log'); }
    catch (e) { if (mpTab !== 'promo') return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (mpTab !== 'promo') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد طلبات ترقية/تنزيل بعد</div>'; return; }
    box.innerHTML = data.list.map(r => {
        const statusLabel = r.status === 'pending' ? '⏳ قيد المراجعة' : r.status === 'approved' ? '✅ مقبولة' : '❌ مرفوضة';
        const statusColor = r.status === 'pending' ? '#fbbf24' : r.status === 'approved' ? '#4ade80' : '#f87171';
        return \`
        <div class="card" style="padding:10px 14px;">
            <div style="font-size:13px;"><b>\${r.direction === 'up' ? '⬆️ ترقية' : '⬇️ تنزيل'}: \${r.targetName || r.targetTag}</b> — \${r.fromRank} ← \${r.toRank}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">القطاع: \${r.sectorLabel} — قدّمه: \${r.requestedByTag || '-'}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">وقت التقديم: \${new Date(r.createdAt).toLocaleString('ar')}</div>
            \${r.reason ? \`<div style="font-size:12px;color:var(--muted);margin-top:2px;">السبب: \${r.reason}</div>\` : ''}
            <div style="font-size:12px;margin-top:4px;color:\${statusColor};font-weight:bold;">\${statusLabel}</div>
            \${r.status !== 'pending' ? \`<div style="font-size:12px;color:var(--muted);margin-top:2px;">راجعه: \${r.reviewedByTag || '-'} — \${r.reviewedAt ? new Date(r.reviewedAt).toLocaleString('ar') : '-'}</div>\` : ''}
            \${r.status === 'rejected' && r.rejectReason ? \`<div style="font-size:12px;color:var(--muted);margin-top:2px;">سبب الرفض: \${r.rejectReason}</div>\` : ''}
        </div>\`;
    }).join('');
}
// صندوق تعيين/إزالة مسؤول أفراد الشرطة العسكرية داخل لوحة القيادة نفسها
async function loadMPPOBox() {
    const box = document.getElementById('mp-content');
    if (!box) return;
    box.innerHTML = \`<div class="card"><h3>👮 مسؤول أفراد الشرطة العسكرية</h3><div id="mp-po-current">جارِ التحميل...</div><input id="mp-po-search" placeholder="🔍 ابحث عن اسم الشخص المسجل بالموقع..." oninput="searchMPPOCandidate(this.value)"><div id="mp-po-cands"></div></div>\`;
    try {
        const { mpLeadership } = await api('/api/senior/mp/leadership').catch(() => ({ mpLeadership: null }));
        const cur = mpLeadership || {};
        document.getElementById('mp-po-current').innerHTML = \`الحالي: <b style="color:\${cur.personnelOfficerName ? '#4ade80' : 'var(--muted)'};">\${cur.personnelOfficerName || 'غير معيّن'}</b> \${cur.personnelOfficerName ? '<button class="btn danger sm" onclick="mpRemovePO()">إزالة</button>' : ''}\`;
    } catch (e) { document.getElementById('mp-po-current').innerHTML = '—'; }
}
let mpPoSearchTimer = null;
function searchMPPOCandidate(q) {
    clearTimeout(mpPoSearchTimer);
    mpPoSearchTimer = setTimeout(async () => {
        const box = document.getElementById('mp-po-cands');
        if (!box) return;
        if (!q || !q.trim()) { box.innerHTML = ''; return; }
        box.innerHTML = 'جارِ البحث...';
        try {
            const { list } = await api('/api/mp/members');
            const filtered = list.filter(p => p.registeredName && p.registeredName.includes(q));
            if (filtered.length === 0) { box.innerHTML = '<p style="color:var(--muted);font-size:13px;">لا نتائج</p>'; return; }
            box.innerHTML = filtered.slice(0, 15).map(p => \`
                <div class="card" style="padding:8px 12px;margin-top:6px;">
                    <div class="row">
                        <span>\${p.registeredName} <span style="color:var(--muted);font-size:12px;">(\${p.unit || '-'} • \${p.rank})</span></span>
                        <button class="btn sm" onclick="mpAssignPO('\${p.discord}')">تعيين</button>
                    </div>
                </div>\`).join('');
        } catch (e) { box.innerHTML = '<p style="color:#f87171;font-size:13px;">' + e.message + '</p>'; }
    }, 350);
}
function mpAssignPO(discordId) {
    api('/api/mp/personnel-officer/assign', { method: 'POST', body: JSON.stringify({ discordId }) })
        .then(() => { toast('تم التعيين'); loadMPPOBox(); }).catch(e => toast(e.message));
}
function mpRemovePO() {
    if (!confirm('متأكد تبي تزيله من منصب مسؤول الأفراد؟')) return;
    api('/api/mp/personnel-officer/remove', { method: 'POST' })
        .then(() => { toast('تم'); loadMPPOBox(); }).catch(e => toast(e.message));
}

// ══════════════════════════════════════════════════════════════════════════
// لوحة مسؤول أفراد الشرطة العسكرية — نطاقه: أعضاء الشرطة العسكرية (ما عدا القائد والنائب)
// ══════════════════════════════════════════════════════════════════════════
let mpPoTab = 'members';
function renderMPPOPanel() {
    if (!ME.mpPersonnelOfficer && !ME.isSeniorAdmin) return renderDashboard();
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>👮 مسؤول أفراد الشرطة العسكرية</h2><button class="btn gray sm" onclick="renderDashboard()">رجوع للوحتي</button></div>
        <div class="card" style="color:var(--muted);font-size:13px;">صلاحيتك تشمل أعضاء الشرطة العسكرية ما عدا القائد والنائب.</div>
        <div class="tabs">
            <div class="tab active" onclick="mpPoTabSwitch('members', this)">الأعضاء</div>
            <div class="tab" onclick="mpPoTabSwitch('reports', this)">التقارير</div>
        </div>
        <div id="mp-po-content"></div>\`;
    mpPoTabSwitch('members');
}
function mpPoTabSwitch(name, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    mpPoTab = name;
    if (name === 'members') loadMPPOMembers();
    if (name === 'reports') loadMPPOReports();
}
async function loadMPPOMembers() {
    const box = document.getElementById('mp-po-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/mp/po/members'); }
    catch (e) { if (mpPoTab !== 'members') return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (mpPoTab !== 'members') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا يوجد أعضاء حالياً</div>'; return; }
    box.innerHTML = data.list.map(p => \`
        <div class="card">
            <div class="row">
                <div><b>\${p.registeredName || p.discordTag}</b> <span style="color:var(--muted);font-size:12px;">\${p.unit || ''} • \${p.rank}</span></div>
                <button class="btn sm gray" onclick="openNoteForm('\${p.discord}','/api/mp/po/personnel/','loadMPPOMembers()')">📝 ملاحظة</button>
            </div>
        </div>\`).join('');
}
async function loadMPPOReports() {
    const box = document.getElementById('mp-po-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/mp/po/reports/pending'); }
    catch (e) { if (mpPoTab !== 'reports') return; box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    if (mpPoTab !== 'reports') return;
    if (data.list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد تقارير معلّقة</div>'; return; }
    box.innerHTML = data.list.map(r => renderMPReportCard(r, 'mpPoReportDecide')).join('');
}
function mpPoReportDecide(id, action) {
    if (action === 'reject') {
        const reason = prompt('اكتب سبب الرفض:');
        if (reason === null) return;
        if (!reason.trim()) return toast('لازم تكتب سبب');
        api('/api/mp/po/reports/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) })
            .then(() => { toast('تم الرفض'); loadMPPOReports(); }).catch(e => toast(e.message));
        return;
    }
    api('/api/mp/po/reports/' + id + '/approve', { method: 'POST' })
        .then(() => { toast('✅ تم قبول التقرير'); loadMPPOReports(); }).catch(e => toast(e.message));
}

// ══════════════════════════════════════════════════════════════════════════
// بوابة عضو الشرطة العسكرية العادي — العساكر (ملاحظة + طلب استدعاء) + تسجيل تقرير
// ══════════════════════════════════════════════════════════════════════════
let mpMemberTab = 'members';
let mpMemberListCache = [];
function renderMPMemberPanel() {
    if (!ME.isMilitaryPolice) return renderDashboard();
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>🚔 الشرطة العسكرية</h2>
            <div class="row" style="gap:8px;">
                <button class="btn sm" onclick="openMPReportForm('renderMPMemberPanel()')">+ تسجيل تقرير جديد</button>
                <button class="btn gray sm" onclick="renderDashboard()">رجوع للوحتي</button>
            </div>
        </div>
        <div class="card"><input id="mp-member-search" placeholder="بحث بالاسم / اليونت / الرتبة" onkeyup="if(event.key==='Enter') filterMPMemberList();"><button class="btn sm" onclick="filterMPMemberList()">بحث</button></div>
        <div id="mp-member-content"><div class="card">جارِ التحميل...</div></div>\`;
    loadMPMemberMembers();
}
async function loadMPMemberMembers() {
    const box = document.getElementById('mp-member-content');
    if (!box) return;
    let data;
    try { data = await api('/api/mp/members'); }
    catch (e) { box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`; return; }
    mpMemberListCache = data.list;
    renderMPMemberList(mpMemberListCache);
}
function filterMPMemberList() {
    const input = document.getElementById('mp-member-search');
    const q = input ? input.value.trim() : '';
    if (!q) return renderMPMemberList(mpMemberListCache);
    const filtered = mpMemberListCache.filter(p =>
        (p.registeredName || p.discordTag || '').includes(q) ||
        (p.unit || '').includes(q) ||
        (p.rank || '').includes(q)
    );
    renderMPMemberList(filtered);
}
function renderMPMemberList(list) {
    const box = document.getElementById('mp-member-content');
    if (!box) return;
    if (list.length === 0) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا يوجد نتائج</div>'; return; }
    box.innerHTML = list.map(p => \`
        <div class="card">
            <div class="row">
                <div>
                    <b>\${p.registeredName || p.discordTag}</b> <span style="color:var(--muted);font-size:12px;">\${p.unit || ''} • \${p.rank}</span>
                    \${p.summon && p.summon.status === 'approved' ? '<div style="color:#f59e0b;font-size:12px;margin-top:3px;">📣 عليه استدعاء نشط</div>' : ''}
                    \${p.summon && p.summon.status === 'pending' ? '<div style="color:#fbbf24;font-size:12px;margin-top:3px;">⏳ في طلب استدعاء بانتظار القيادة</div>' : ''}
                </div>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="openNoteForm('\${p.discord}','/api/mp/personnel/','loadMPMemberMembers()')">📝 ملاحظة</button>
                    \${(!p.summon || p.summon.status === 'none') ? \`<button class="btn sm" onclick="openSummonForm('\${p.discord}','/api/mp/personnel/','loadMPMemberMembers()')">📣 طلب استدعاء</button>\` : ''}
                </div>
            </div>
        </div>\`).join('');
}
// ── فورم تسجيل تقرير الشرطة العسكرية ──
let mpReportNotes = [];
let mpReportReturnFn = 'renderMPMemberPanel()';
function openMPReportForm(returnFn) {
    mpReportNotes = [];
    mpReportReturnFn = returnFn || 'renderMPMemberPanel()';
    document.getElementById('app').innerHTML = \`
        <div class="card row"><h2>📝 تسجيل تقرير شرطة عسكرية</h2><button class="btn gray sm" onclick="\${mpReportReturnFn}">رجوع</button></div>
        <div class="card">
            <label>1) وش سويت بالاستلام؟</label>
            <textarea id="mpr-duty" placeholder="اكتب وش سويت خلال الاستلام..."></textarea>
        </div>
        <div class="card">
            <label>2) كم عدد الجولات/الدوريات اللي سويتها خلال الشفت؟</label>
            <input type="number" id="mpr-patrols" min="0" placeholder="0">
        </div>
        <div class="card">
            <label>3) كم عدد الاستدعاءات اللي نفّذتها خلال الشفت؟</label>
            <input type="number" id="mpr-summons" min="0" placeholder="0">
        </div>
        <div class="card">
            <label>4) هل واجهتك أي مخالفات أمنية أو حالات مشبوهة؟ اذكرها</label>
            <textarea id="mpr-incidents" placeholder="اكتب التفاصيل، أو اترك فاضي إذا ما فيه"></textarea>
        </div>
        <div class="card">
            <div class="row"><h3>5) العساكر اللي عطيتهم ملاحظة/تحذير خلال الشفت</h3><button class="btn sm gray" onclick="addMPReportNoteRow()">+ إضافة</button></div>
            <div id="mpr-notes-list"></div>
        </div>
        <div class="card">
            <label>6) ملاحظات أو توصيات عامة</label>
            <textarea id="mpr-general" placeholder="أي شي تشوفه مهم تذكره..."></textarea>
        </div>
        <div class="card"><button class="btn" onclick="submitMPReport()">إرسال التقرير</button></div>\`;
}
function addMPReportNoteRow() {
    const i = mpReportNotes.length;
    mpReportNotes.push({ discord: '', tag: '', name: '', kind: 'note', reason: '' });
    renderMPReportNotesList();
}
function renderMPReportNotesList() {
    const box = document.getElementById('mpr-notes-list');
    if (!box) return;
    box.innerHTML = mpReportNotes.map((n, i) => \`
        <div class="card" style="margin-top:8px;padding:10px 14px;">
            <div class="row" style="gap:6px;">
                <input placeholder="اسم/آيدي العسكري" value="\${n.name}" oninput="mpReportNotes[\${i}].name=this.value" style="flex:2;">
                <select onchange="mpReportNotes[\${i}].kind=this.value" style="flex:1;">
                    <option value="note" \${n.kind === 'note' ? 'selected' : ''}>ملاحظة</option>
                    <option value="warning" \${n.kind === 'warning' ? 'selected' : ''}>تحذير</option>
                </select>
                <button class="btn danger sm" onclick="removeMPReportNoteRow(\${i})">حذف</button>
            </div>
            <textarea placeholder="السبب" oninput="mpReportNotes[\${i}].reason=this.value" style="margin-top:6px;">\${n.reason}</textarea>
        </div>\`).join('');
}
function removeMPReportNoteRow(i) {
    mpReportNotes.splice(i, 1);
    renderMPReportNotesList();
}
async function submitMPReport() {
    const dutyReport = document.getElementById('mpr-duty').value;
    if (!dutyReport || !dutyReport.trim()) return toast('اكتب وش سويت بالاستلام');
    const body = {
        dutyReport,
        patrolsCount: document.getElementById('mpr-patrols').value,
        summonsCount: document.getElementById('mpr-summons').value,
        incidents: document.getElementById('mpr-incidents').value,
        notesIssued: mpReportNotes,
        generalNotes: document.getElementById('mpr-general').value,
    };
    try {
        const r = await api('/api/mp/reports/submit', { method: 'POST', body: JSON.stringify(body) });
        toast(r.report && r.report.status === 'approved' ? '✅ تم قبول تقريرك' : '✅ تم إرسال التقرير للمراجعة');
        Function(mpReportReturnFn)();
    } catch (e) { toast(e.message); }
}

// ══════════════════════════════════════════════════════════════════════════
// بوابة "لديك استدعاء" — تظهر فور تسجيل الدخول لو عليه استدعاء نشط
// ══════════════════════════════════════════════════════════════════════════
function checkSummonGate() {
    if (!ME || !ME.summon || ME.summon.status !== 'approved') return false;
    const box = document.getElementById('app');
    const locked = ME.summon.unlockAt && new Date(ME.summon.unlockAt).getTime() > Date.now();
    if (ME.summon.enteredAt) {
        // دخل الروم فعلاً، لكن يبقى ممنوع من استخدام الموقع لين قيادة الشرطة العسكرية تنهي الاستدعاء
        box.innerHTML = \`
            <div class="card center" style="margin-top:60px;border-color:#f59e0b;">
                <h2 style="color:#f59e0b;">⏳ بانتظار إنهاء الاستدعاء</h2>
                <p style="color:var(--muted);margin-top:8px;">دخلت الاستدعاء — ما تقدر تستخدم الموقع لين تنهي قيادة الشرطة العسكرية الاستدعاء.</p>
                <div class="row" style="gap:8px;margin-top:16px;justify-content:center;">
                    <button class="btn gray sm" onclick="window.open('${CONFIG.MP_SUMMON_VOICE_URL}','_blank')">🚪 فتح الروم مرة ثانية</button>
                    <button class="btn sm" onclick="init()">🔄 تحديث</button>
                </div>
            </div>\`;
    } else {
        box.innerHTML = \`
            <div class="card center" style="margin-top:60px;border-color:#f59e0b;">
                <h2 style="color:#f59e0b;">📣 لديك استدعاء</h2>
                <p style="color:var(--muted);margin-top:8px;">استدعاء من الشرطة العسكرية — \${ME.summon.timeLabel || 'الآن'}</p>
                \${locked
                    ? \`<button class="btn gray" style="margin-top:16px;" onclick="toast('الروم بيفتح الساعة \${ME.summon.timeLabel}')">🔒 دخول الاستدعاء</button>\`
                    : \`<button class="btn" style="margin-top:16px;" onclick="enterSummon()">🚪 دخول الاستدعاء</button>\`}
            </div>\`;
    }
    document.getElementById('nav-links').innerHTML = '';
    document.getElementById('mobile-menu').innerHTML = '';
    return true;
}
async function enterSummon() {
    try {
        const r = await api('/api/summon/enter', { method: 'POST' });
        window.open(r.url, '_blank');
        toast('✅ تفضل ادخل الروم');
        ME.summon.enteredAt = new Date().toISOString();
        checkSummonGate();
    } catch (e) {
        toast(e.message);
    }
}

async function loadPersonnel() {
    const box = document.getElementById('admin-content');
    box.innerHTML = \`<div class="card row"><h3 style="margin:0;">الحسابات</h3><button class="btn sm" style="background:#78350f;color:#fff;" onclick="openWarnAllForm()">📢 إشعار للجميع</button></div><div class="card"><input id="p-search" placeholder="بحث بالاسم / اليونت / التاق" onkeyup="if(event.key==='Enter') searchPersonnel()"><button class="btn sm" onclick="searchPersonnel()">بحث</button></div><div id="p-list"></div>\`;
    searchPersonnel();
}
let personnelCache = [];
async function searchPersonnel() {
    const q = document.getElementById('p-search') ? document.getElementById('p-search').value : '';
    const { list } = await api('/api/senior/personnel?q=' + encodeURIComponent(q));
    if (currentAdminTab !== 'personnel') return; // المستخدم غيّر التبويب أثناء التحميل
    personnelCache = list;
    const pListEl = document.getElementById('p-list');
    if (!pListEl) return;
    pListEl.innerHTML = list.map((p, i) => \`
        <div class="card" id="pcard-\${i}">
            <div class="row">
                <div>
                    <b>\${p.registeredName || p.discordTag}</b> <span style="color:var(--muted);font-size:12px;">\${p.unit || ''} • \${p.rank}</span>
                    <div style="font-size:13px;color:#94a3b8;">النقاط: \${p.points} \${p.isBlocked ? '• 🚫 موقوف' : ''}</div>
                </div>
                <div class="row" style="gap:6px;">
                    <button class="btn sm gray" onclick="toggleEdit(\${i})">تعديل</button>
                    <button class="btn sm gray" onclick="addNote('\${p.discord}')">ملاحظة</button>
                    <button class="btn sm" style="background:#7f1d1d;color:#fff;" onclick="openWarnForm('\${p.discord}','/api/senior/personnel/')">⚠️ تحذير</button>
                    <button class="btn sm \${p.isBlocked ? '' : 'danger'}" onclick="toggleBlock('\${p.discord}', \${!p.isBlocked})">\${p.isBlocked ? 'إلغاء الإيقاف' : 'إيقاف (بند)'}</button>
                    <button class="btn sm danger" onclick="deletePersonnel('\${p.discord}', '\${(p.registeredName || p.discordTag || '').replace(/'/g, "\\\\'")}')">🗑️ حذف نهائي</button>
                </div>
            </div>
            <div id="pedit-\${i}" class="hidden" style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;">
                <label>الاسم</label><input id="pe-name-\${i}" value="\${p.registeredName || ''}">
                <label>اليونت</label><input id="pe-unit-\${i}" value="\${p.unit || ''}">
                <label>الرتبة العسكرية</label>
                <select id="pe-rank-\${i}">\${MILITARY_RANKS.map(r => \`<option \${r === p.rank ? 'selected' : ''}>\${r}</option>\`).join('')}</select>
                <label>النقاط</label><input type="number" id="pe-points-\${i}" data-original="\${p.points}" value="\${p.points}">
                <button class="btn sm" onclick="saveEdit('\${p.discord}', \${i})">حفظ التعديلات</button>
            </div>
        </div>\`).join('') || '<div class="card center" style="color:var(--muted);">لا نتائج</div>';
}
function toggleEdit(i) {
    document.getElementById('pedit-' + i).classList.toggle('hidden');
}
async function saveEdit(discordId, i) {
    const pointsInput = document.getElementById('pe-points-' + i);
    const pointsChanged = pointsInput.value !== pointsInput.dataset.original;
    const body = {
        name: document.getElementById('pe-name-' + i).value,
        unit: document.getElementById('pe-unit-' + i).value,
        rank: document.getElementById('pe-rank-' + i).value,
        // نرسل النقاط بس إذا الأدمن عدّلها فعلاً بنفسه، عشان النظام يقدر يحسبها تلقائياً وقت تغيير الرتبة بدون ما تظل "معلّقة" على القيمة القديمة
        points: pointsChanged ? pointsInput.value : '',
    };
    try {
        await api('/api/senior/personnel/' + discordId + '/update', { method: 'POST', body: JSON.stringify(body) });
        toast('✅ تم حفظ التعديلات');
        searchPersonnel();
    } catch (e) { toast(e.message); }
}
async function deletePersonnel(discordId, displayName) {
    if (!confirm('متأكد تبي تحذف حساب "' + (displayName || discordId) + '" نهائياً؟ ما يمكن التراجع عن هذا الإجراء.')) return;
    try {
        await api('/api/senior/personnel/' + discordId, { method: 'DELETE' });
        toast('🗑️ تم حذف الحساب نهائياً');
        searchPersonnel();
    } catch (e) { toast(e.message); }
}
function addNote(discordId) {
    openNoteForm(discordId, '/api/senior/personnel/', 'searchPersonnel()');
}
function toggleBlock(discordId, blocked) {
    api('/api/senior/personnel/' + discordId + '/block', { method: 'POST', body: JSON.stringify({ blocked }) })
        .then(() => { toast('تم التحديث'); searchPersonnel(); }).catch(e => toast(e.message));
}
let newVehiclePhoto = null;
async function loadVehicles() {
    const box = document.getElementById('admin-content');
    box.innerHTML = \`
        <div class="card">
            <h3>إضافة مركبة</h3>
            <label>اسم المركبة</label>
            <input id="veh-name" placeholder="مثال: فورد F150">
            <label>صورة المركبة</label>
            <input type="file" id="veh-photo" accept="image/*" onchange="previewVehiclePhoto()">
            <img id="veh-photo-preview" style="display:none;max-width:160px;border-radius:8px;margin-bottom:10px;">
            <button class="btn sm" onclick="addVehicle()">إضافة</button>
        </div>
        <div id="veh-list" class="vgrid"></div>\`;
    loadVehicleList();
}
function previewVehiclePhoto() {
    const f = document.getElementById('veh-photo').files[0];
    if (!f) return;
    if (f.size > ${CONFIG.MAX_PHOTO_MB} * 1024 * 1024) { toast('الصورة أكبر من ${CONFIG.MAX_PHOTO_MB}MB'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        newVehiclePhoto = e.target.result;
        const img = document.getElementById('veh-photo-preview');
        img.src = newVehiclePhoto; img.style.display = 'block';
    };
    reader.readAsDataURL(f);
}
async function addVehicle() {
    const name = document.getElementById('veh-name').value.trim();
    if (!name) return toast('حط اسم المركبة');
    try {
        await api('/api/senior/vehicles', { method: 'POST', body: JSON.stringify({ name, photo: newVehiclePhoto }) });
        toast('تمت الإضافة'); newVehiclePhoto = null; loadVehicles();
    } catch (e) { toast(e.message); }
}
async function loadVehicleList() {
    const { list } = await api('/api/senior/vehicles');
    if (currentAdminTab !== 'vehicles') return;
    const box = document.getElementById('veh-list');
    if (!box) return;
    box.innerHTML = list.map(v => \`
        <div class="vcard">
            \${v.photo ? \`<img src="\${v.photo}">\` : ''}
            <div>\${v.name}</div>
            <button class="btn danger sm" style="margin-top:4px;padding:3px 8px;font-size:10px;" onclick="delVehicle('\${v._id}')">حذف</button>
        </div>\`).join('') || '<p style="color:var(--muted);">لا توجد مركبات</p>';
}
function delVehicle(id) {
    api('/api/senior/vehicles/' + id, { method: 'DELETE' }).then(() => { toast('تم الحذف'); loadVehicleList(); });
}
async function loadHire() {
    const box = document.getElementById('admin-content');
    box.innerHTML = \`
        <div class="card">
            <h3>توظيف إداري</h3>
            <p style="color:var(--muted);font-size:12px;margin-bottom:10px;">الإداري المعيّن يقدر فقط يقبل أو يرفض المخالفات المعلّقة.</p>
            <label>آيدي الإداري (Discord ID)</label>
            <input id="hire-id" placeholder="مثال: 123456789012345678">
            <label>اسمه</label>
            <input id="hire-name" placeholder="اسم الإداري">
            <button class="btn sm" onclick="hireAdmin()">تم</button>
        </div>
        <div id="admins-list"></div>\`;
    loadAdminsList();
}
async function hireAdmin() {
    const discordId = document.getElementById('hire-id').value.trim();
    const name = document.getElementById('hire-name').value.trim();
    if (!discordId) return toast('حط آيدي الإداري');
    try { await api('/api/senior/hire-admin', { method: 'POST', body: JSON.stringify({ discordId, name }) }); toast('تم التعيين'); loadHire(); }
    catch (e) { toast(e.message); }
}
async function loadAdminsList() {
    const { list } = await api('/api/senior/admins');
    if (currentAdminTab !== 'hire') return;
    const box = document.getElementById('admins-list');
    if (!box) return;
    box.innerHTML = list.map(id => \`
        <div class="card row"><span>\${id}</span><button class="btn danger sm" onclick="fireAdmin('\${id}')">فصل</button></div>\`).join('') || '<div class="card center" style="color:var(--muted);">لا يوجد إداريون معيّنون</div>';
}
function fireAdmin(id) {
    api('/api/senior/fire-admin', { method: 'POST', body: JSON.stringify({ discordId: id }) }).then(() => { toast('تم الفصل'); loadHire(); });
}
// صفحة بحث الأفراد — بحث فقط (مو قائمة كاملة)، مع إجراءات فورية: ترقية/تنزيل/نقاط/تحذير
let personnelSearchTimer = null;
async function loadPersonnelSearchPage() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = \`
        <div class="card">
            <h3>🔍 بحث الأفراد</h3>
            <p style="color:var(--muted);font-size:12px;margin-bottom:10px;">اكتب اسم أو يونت أو تاق ديسكورد (حرفين فأكثر) — ما تطلع القائمة كاملة، لازم تبحث عن الشخص.</p>
            <input id="psearch-q" placeholder="ابحث..." oninput="onPersonnelSearchInput()">
        </div>
        <div id="psearch-results"></div>\`;
}
function onPersonnelSearchInput() {
    clearTimeout(personnelSearchTimer);
    personnelSearchTimer = setTimeout(runPersonnelSearch, 350);
}
async function runPersonnelSearch() {
    const q = document.getElementById('psearch-q')?.value.trim() || '';
    const box = document.getElementById('psearch-results');
    if (!box) return;
    if (q.length < 2) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="card center" style="color:var(--muted);">جارِ البحث...</div>';
    let list;
    try { ({ list } = await api('/api/admin/personnel/search?q=' + encodeURIComponent(q))); }
    catch (e) { box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر البحث (\${e.message})</div>\`; return; }
    if (document.getElementById('psearch-q')?.value.trim() !== q) return; // تجاوزه بحث أحدث
    if (!list.length) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا نتائج</div>'; return; }
    box.innerHTML = list.map(p => \`
        <div class="card" id="prow-\${p.discord}">
            <div><b>\${p.registeredName || p.discordTag || p.discord}</b> <span style="color:var(--muted);font-size:12px;">(\${p.discordTag || '-'})</span></div>
            <div style="font-size:12px;color:var(--gold-soft);margin:4px 0;">الرتبة: \${p.rank} — اليونت: \${p.unit || '-'} — النقاط: \${p.points}</div>
            <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px;">
                <button class="btn sm" onclick="psAction('\${p.discord}','up')">⬆️ ترقية</button>
                <button class="btn sm gray" onclick="psAction('\${p.discord}','down')">⬇️ تنزيل</button>
                <button class="btn sm" onclick="psPoints('\${p.discord}')">⭐ نقاط</button>
                <button class="btn sm danger" onclick="psWarn('\${p.discord}')">⚠️ تحذير</button>
            </div>
        </div>\`).join('');
}
async function psAction(discord, direction) {
    if (!confirm(direction === 'up' ? 'تأكيد الترقية؟' : 'تأكيد التنزيل؟')) return;
    try {
        const { personnel } = await api('/api/admin/personnel/' + discord + '/rank-direct', { method: 'POST', body: JSON.stringify({ direction }) });
        toast('تم');
        runPersonnelSearch();
    } catch (e) { toast(e.message); }
}
function psPoints(discord) {
    const delta = prompt('عدد النقاط (استخدم - للخصم):');
    if (delta === null || delta.trim() === '') return;
    const reason = prompt('السبب:') || '';
    api('/api/admin/personnel/' + discord + '/points-direct', { method: 'POST', body: JSON.stringify({ delta: parseInt(delta, 10), reason }) })
        .then(() => { toast('تم'); runPersonnelSearch(); }).catch(e => toast(e.message));
}
function psWarn(discord) {
    const reason = prompt('سبب التحذير:');
    if (!reason || !reason.trim()) return;
    api('/api/admin/personnel/' + discord + '/warning-direct', { method: 'POST', body: JSON.stringify({ reason }) })
        .then(() => { toast('تم تسجيل التحذير'); runPersonnelSearch(); }).catch(e => toast(e.message));
}
// طابور النقاط المعلّقة — أي نقاط منحها/خصمها شخص غير إداري تنتظر هنا موافقة أي إداري
async function loadPointsRequestsPage() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let list;
    try { ({ list } = await api('/api/admin/points-requests/pending')); }
    catch (e) { box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل (\${e.message})</div>\`; return; }
    if (currentAdminTab !== 'points-requests') return;
    if (!list.length) { box.innerHTML = '<div class="card center" style="color:var(--muted);">لا توجد طلبات نقاط معلّقة حالياً</div>'; return; }
    box.innerHTML = list.map(r => \`
        <div class="card" id="pr-\${r._id}">
            <div><b>\${r.targetName || r.targetTag || r.targetDiscord}</b> — \${r.delta >= 0 ? '+' : ''}\${r.delta} نقطة</div>
            <div style="font-size:12px;color:var(--muted);margin:4px 0;">\${r.reason || '-'}</div>
            <div style="font-size:11px;color:var(--muted);">طلبها: \${r.requestedByTag || r.requestedBy}</div>
            <div class="row" style="gap:8px;margin-top:10px;">
                <button class="btn sm" onclick="approvePointsRequest('\${r._id}')">✅ موافقة</button>
                <button class="btn sm danger" onclick="rejectPointsRequest('\${r._id}')">❌ رفض</button>
            </div>
        </div>\`).join('');
}
async function approvePointsRequest(id) {
    try { await api('/api/admin/points-requests/' + id + '/approve', { method: 'POST' }); toast('تمت الموافقة'); loadPointsRequestsPage(); }
    catch (e) { toast(e.message); }
}
async function rejectPointsRequest(id) {
    const reason = prompt('سبب الرفض (اختياري):') || '';
    try { await api('/api/admin/points-requests/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) }); toast('تم الرفض'); loadPointsRequestsPage(); }
    catch (e) { toast(e.message); }
}
async function loadThresholds() {
    const { ranks, thresholds } = await api('/api/senior/thresholds');
    if (currentAdminTab !== 'thresholds') return;
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = \`<div class="card">
        <h3>نقاط الترقية بين الرتب</h3>
        <p style="color:var(--muted);font-size:12px;margin-bottom:10px;">حدد كم نقطة يحتاجها العسكري بكل رتبة عشان يترقى للي بعدها.</p>
        \${ranks.map((r, i) => i === ranks.length - 1 ? '' : \`
            <div class="row" style="margin-bottom:8px;">
                <span style="font-size:13px;">\${r} ——> \${ranks[i+1]}</span>
                <input type="number" style="width:100px;margin-bottom:0;" id="th-\${i}" value="\${thresholds[r]}">
            </div>\`).join('')}
        <button class="btn sm" onclick="saveThresholds()" style="margin-top:8px;">حفظ</button>
    </div>\`;
    box.dataset.ranks = JSON.stringify(ranks);
}
async function saveThresholds() {
    const ranks = JSON.parse(document.getElementById('admin-content').dataset.ranks);
    const thresholds = {};
    ranks.forEach((r, i) => { const el = document.getElementById('th-' + i); if (el) thresholds[r] = parseInt(el.value) || 0; });
    try { await api('/api/senior/thresholds', { method: 'POST', body: JSON.stringify({ thresholds }) }); toast('تم الحفظ'); }
    catch (e) { toast(e.message); }
}
const LOG_META = {
    "ترقية تلقائية":        { icon: "🎖️", label: "ترقية تلقائية",        color: "#4ade80", border: "#22c55e" },
    "قبول تقرير":           { icon: "✅", label: "قبول تقرير",           color: "#4ade80", border: "#22c55e" },
    "رفض تقرير":            { icon: "❌", label: "رفض تقرير",            color: "#fca5a5", border: "#ef4444" },
    "قبول مخالفة":          { icon: "✅", label: "قبول مخالفة",          color: "#4ade80", border: "#22c55e" },
    "رفض مخالفة":           { icon: "❌", label: "رفض مخالفة",           color: "#fca5a5", border: "#ef4444" },
    "حظر عسكري (أمر)":      { icon: "🚫", label: "حظر عسكري",           color: "#fca5a5", border: "#ef4444" },
    "فك حظر عسكري (أمر)":   { icon: "🔓", label: "فك حظر عسكري",        color: "#60a5fa", border: "#3b82f6" },
    "ترقية عسكري":          { icon: "⬆️", label: "ترقية عسكري",         color: "#4ade80", border: "#22c55e" },
    "تنزيل عسكري":          { icon: "⬇️", label: "تنزيل عسكري",         color: "#fca5a5", border: "#ef4444" },
    "تعيين يونت":           { icon: "🪖", label: "تعيين يونت",          color: "#60a5fa", border: "#3b82f6" },
    "تعديل نقاط":           { icon: "✏️", label: "تعديل نقاط",          color: "#fde047", border: "#eab308" },
    "إضافة ملاحظة":         { icon: "📝", label: "إضافة ملاحظة",        color: "#93c5fd", border: "#3b82f6" },
    "إيقاف عسكري":          { icon: "🚫", label: "إيقاف عسكري",         color: "#fca5a5", border: "#ef4444" },
    "إلغاء إيقاف":          { icon: "✅", label: "إلغاء إيقاف",          color: "#4ade80", border: "#22c55e" },
    "حذف حساب نهائي":       { icon: "🗑️", label: "حذف حساب نهائي",      color: "#fca5a5", border: "#7f1d1d" },
    "تعديل ملف عسكري":      { icon: "✏️", label: "تعديل ملف عسكري",     color: "#93c5fd", border: "#3b82f6" },
    "تعديل إعدادات الموقع": { icon: "⚙️", label: "تعديل إعدادات الموقع", color: "#60a5fa", border: "#3b82f6" },
    "توظيف إداري":          { icon: "⭐", label: "توظيف إداري",          color: "#60a5fa", border: "#3b82f6" },
    "فصل إداري":            { icon: "🚫", label: "فصل إداري",           color: "#fca5a5", border: "#ef4444" },
    "إضافة مركبة":          { icon: "🚗", label: "إضافة مركبة",         color: "#93c5fd", border: "#3b82f6" },
    "تعديل حدود النقاط":    { icon: "🎯", label: "تعديل حدود النقاط",   color: "#60a5fa", border: "#3b82f6" },
    "حذف ملاحظة":           { icon: "🗑️", label: "حذف ملاحظة",          color: "#fca5a5", border: "#7f1d1d" },
    "حذف مخالفة نهائي":     { icon: "🗑️", label: "حذف مخالفة نهائي",    color: "#fca5a5", border: "#7f1d1d" },
    "تعيين قيادة قطاع":     { icon: "🎖️", label: "تعيين قيادة قطاع",    color: "#60a5fa", border: "#3b82f6" },
    "إزالة قيادة قطاع":     { icon: "🚫", label: "إزالة قيادة قطاع",    color: "#fca5a5", border: "#ef4444" },
    "فصل تلقائي (تجاوز التحذيرات)": { icon: "🚫", label: "فصل تلقائي (تجاوز التحذيرات)", color: "#fca5a5", border: "#7f1d1d" },
    "إصدار تحذير":          { icon: "⚠️", label: "إصدار تحذير",         color: "#f87171", border: "#7f1d1d" },
    "إصدار إشعار":          { icon: "🔔", label: "إصدار إشعار",         color: "#fbbf24", border: "#78350f" },
    "تعاهد على تحذير":      { icon: "🤝", label: "تعاهد على تحذير",     color: "#4ade80", border: "#166534" },
    "تعاهد على إشعار":      { icon: "🤝", label: "تعاهد على إشعار",     color: "#4ade80", border: "#166534" },
};
let lastLogId = null;
let allLogsData = [];
async function loadLog(silent) {
    const { list } = await api('/api/senior/log');
    if (currentAdminTab !== 'log') return;
    const box = document.getElementById('admin-content');
    if (!box) return;
    if (silent && list[0] && list[0]._id === lastLogId) return;
    if (list[0]) lastLogId = list[0]._id;
    allLogsData = list;
    if (!document.getElementById('log-search')) {
        box.innerHTML = \`<div class="card"><div class="row" style="gap:8px;align-items:center;">
            <input id="log-search" placeholder="🔍 ابحث بالاسم، اليوزر، الآيدي، أو نوع الحدث..." oninput="filterLog()" style="flex:1;">
            <button class="btn danger sm" onclick="wipeLog()">🗑️ مسح اللوق القديم بالكامل</button>
        </div><div id="log-list" style="margin-top:12px;"></div></div>\`;
    }
    const q = (document.getElementById('log-search') || {}).value || '';
    renderLog(q.trim() ? filterLogsData(q) : list);
}
async function wipeLog() {
    if (!confirm('⚠️ متأكد تبي تمسح كل سجلات اللوق الشامل القديمة نهائياً؟ ما ترجع بعد الحذف.')) return;
    if (!confirm('تأكيد أخير — هذا الإجراء نهائي ولا يمكن التراجع عنه.')) return;
    try {
        const { deleted } = await api('/api/senior/log/wipe', { method: 'POST' });
        toast(\`تم حذف \${deleted} سجل\`);
        lastLogId = null;
        loadLog();
    } catch (e) { toast(e.message); }
}
function filterLogsData(q) {
    q = q.trim().toLowerCase();
    return allLogsData.filter(log => {
        const meta = LOG_META[log.action] || { label: log.action };
        return [log.discordId, log.discordTag, log.actorId, log.actorTag, log.details, log.action, meta.label]
            .some(v => (v || '').toString().toLowerCase().includes(q));
    });
}
function filterLog() {
    const q = document.getElementById('log-search').value;
    renderLog(q.trim() ? filterLogsData(q) : allLogsData);
}
function renderLog(list) {
    const container = document.getElementById('log-list');
    if (!container) return;
    if (list.length === 0) { container.innerHTML = '<p style="text-align:center;color:var(--muted);padding:20px;">لا توجد نتائج.</p>'; return; }
    container.innerHTML = list.map(log => {
        const meta = LOG_META[log.action] || { icon: 'ℹ️', label: log.action, color: '#94a3b8', border: '#64748b' };
        return \`
        <div class="log-item" style="border-color:\${meta.border};flex-wrap:wrap;">
            <div><span style="color:\${meta.color};font-weight:bold;">\${meta.icon} \${meta.label}</span></div>
            <div style="text-align:left;color:#94a3b8;font-size:0.85rem;">
                \${log.discordTag || log.discordId ? \`<div>الشخص: <b style="color:#60a5fa;">\${log.discordTag || ''}</b> \${log.discordId ? '(' + log.discordId + ')' : ''}</div>\` : ''}
                \${log.actorTag || log.actorId ? \`<div>بواسطة: <b style="color:#e2e8f0;">\${log.actorTag || ''}</b> \${log.actorId ? '(' + log.actorId + ')' : ''}</div>\` : ''}
                \${log.details ? \`<div style="color:#93c5fd;">\${log.details}</div>\` : ''}
                <div style="font-size:0.78rem;color:#64748b;">\${new Date(log.createdAt).toLocaleString('ar')}</div>
            </div>
        </div>\`;
    }).join('');
}
async function loadNotesPage() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let list;
    try {
        ({ list } = await api('/api/senior/notes'));
    } catch (e) {
        if (currentAdminTab !== 'notes') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر تحميل الملاحظات، حاول تحدّث الصفحة. (\${e.message})</div>\`;
        return;
    }
    if (currentAdminTab !== 'notes') return;
    const sectorButtons = \`
        <div class="card">
            <div style="font-size:13px;color:var(--muted);margin-bottom:8px;">حذف ملاحظات قطاع كامل:</div>
            <div class="row" style="gap:8px;flex-wrap:wrap;">
                <button class="btn sm danger" onclick="openSectorNotesDelete('patrol')">🗑️ ملاحظات الدوريات</button>
                <button class="btn sm danger" onclick="openSectorNotesDelete('roadSecurity')">🗑️ ملاحظات أمن الطرق</button>
                <button class="btn sm danger" onclick="openSectorNotesDelete('antiDrugs')">🗑️ ملاحظات المكافحة</button>
            </div>
        </div>\`;
    if (list.length === 0) { box.innerHTML = sectorButtons + '<div class="card center" style="color:var(--muted);">لا توجد ملاحظات مسجلة</div>'; return; }
    box.innerHTML = sectorButtons + list.map(n => \`
        <div class="card">
            <div class="row" style="align-items:flex-start;">
                <div>
                    <b>\${n.personnelName}</b>
                    <div style="margin-top:4px;">\${n.text}</div>
                    \${n.hasImage ? \`<button class="btn sm gray" style="margin-top:6px;" onclick="viewNotePhoto('\${n.discord}','\${n.noteId}')">📷 عرض الصورة</button>\` : ''}
                    <div style="color:var(--muted);font-size:12px;margin-top:4px;">أضافها: \${n.addedByTag || n.addedBy || '-'} • \${new Date(n.createdAt).toLocaleString('ar')}</div>
                </div>
                <button class="btn danger sm" onclick="deleteNote('\${n.discord}', '\${n.noteId}')">🗑️ حذف</button>
            </div>
        </div>\`).join('');
}
function openSectorNotesDelete(sector) {
    const box = document.getElementById('wf-box');
    box.innerHTML = \`
        <h3>🗑️ حذف ملاحظات القطاع</h3>
        <p style="color:var(--muted);font-size:13px;margin-top:6px;">تبي تحذف الجميع، أو تستثني بعضها؟</p>
        <div class="wf-choice-row">
            <button class="wf-warning" onclick="sectorNotesDeleteAll('\${sector}')">حذف الجميع</button>
            <button class="wf-notice" onclick="sectorNotesDeleteExcept('\${sector}')">باستثناء</button>
        </div>
        <div class="wf-actions"><button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button></div>\`;
    document.getElementById('wf-overlay').classList.add('open');
}
async function sectorNotesDeleteAll(sector) {
    if (!confirm('متأكد؟ بتحذف كل ملاحظات هذا القطاع نهائياً بدون استثناء.')) return;
    try {
        const { count } = await api('/api/senior/notes/by-sector/' + sector + '/delete-all', { method: 'POST' });
        toast('🗑️ تم حذف ملاحظات ' + count + ' عسكري');
        closeWarnForm();
        loadNotesPage();
    } catch (e) { toast(e.message); }
}
let sectorNotesDeleteCtx = null;
async function sectorNotesDeleteExcept(sector) {
    const box = document.getElementById('wf-box');
    box.innerHTML = '<h3>جارِ التحميل...</h3>';
    try {
        const { list, sectorLabel } = await api('/api/senior/notes/by-sector/' + sector);
        sectorNotesDeleteCtx = { sector, keepIds: new Set() };
        if (list.length === 0) {
            box.innerHTML = \`<h3>لا توجد ملاحظات بقطاع \${sectorLabel}</h3><div class="wf-actions"><button class="btn gray sm" onclick="closeWarnForm()">إغلاق</button></div>\`;
            return;
        }
        box.innerHTML = \`
            <h3>استثناء ملاحظات (\${sectorLabel})</h3>
            <p style="color:var(--muted);font-size:13px;margin:6px 0;">علّم الملاحظات اللي تبي تستثنيها (تبقى)، والباقي بينحذف.</p>
            <div style="max-height:50vh;overflow-y:auto;text-align:right;">
                \${list.map(n => \`
                <label style="display:block;background:rgba(255,255,255,0.05);padding:8px;border-radius:8px;margin-bottom:6px;font-size:13px;">
                    <input type="checkbox" onchange="toggleKeepNote('\${n.noteId}', this.checked)" style="width:auto;margin-left:6px;">
                    <b>\${n.personnelName}</b>: \${n.text}
                    <div style="color:var(--muted);font-size:11px;">بواسطة: \${n.addedByTag || '-'}</div>
                </label>\`).join('')}
            </div>
            <div class="wf-actions">
                <button class="btn gray sm" onclick="closeWarnForm()">إلغاء</button>
                <button class="btn danger sm" onclick="submitSectorNotesDeleteExcept()">تنفيذ الحذف</button>
            </div>\`;
    } catch (e) { toast(e.message); closeWarnForm(); }
}
function toggleKeepNote(noteId, checked) {
    if (!sectorNotesDeleteCtx) return;
    if (checked) sectorNotesDeleteCtx.keepIds.add(noteId);
    else sectorNotesDeleteCtx.keepIds.delete(noteId);
}
async function submitSectorNotesDeleteExcept() {
    if (!sectorNotesDeleteCtx) return;
    if (!confirm('متأكد؟ كل الملاحظات اللي ما علّمتها بتنحذف نهائياً.')) return;
    try {
        const { count } = await api('/api/senior/notes/by-sector/' + sectorNotesDeleteCtx.sector + '/delete-except', {
            method: 'POST', body: JSON.stringify({ keepNoteIds: Array.from(sectorNotesDeleteCtx.keepIds) }),
        });
        toast('🗑️ تم حذف ' + count + ' ملاحظة');
        sectorNotesDeleteCtx = null;
        closeWarnForm();
        loadNotesPage();
    } catch (e) { toast(e.message); }
}
async function deleteNote(discord, noteId) {
    if (!confirm('متأكد تبي تحذف هذي الملاحظة؟')) return;
    try { await api('/api/senior/personnel/' + discord + '/note/' + noteId, { method: 'DELETE' }); toast('تم الحذف'); loadNotesPage(); }
    catch (e) { toast(e.message); }
}
// صفحة إدارة عقوبات التحذيرات بلوحة كبار المسؤولين — إضافة / تعديل / حذف
let editingPenaltyId = null;
async function loadPenaltiesPage() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let list;
    try { ({ list } = await api('/api/senior/penalties')); }
    catch (e) {
        if (currentAdminTab !== 'penalties') return;
        box.innerHTML = \`<div class="card" style="color:#f87171;">تعذر التحميل. (\${e.message})</div>\`;
        return;
    }
    if (currentAdminTab !== 'penalties') return;
    editingPenaltyId = null;
    renderPenaltiesPage(list);
}
const PENALTY_TYPE_LABELS = { points: 'خصم نقاط', resetPoints: 'تصفير النقاط', demote: 'تنزيل رتبة', demoteToFirst: 'تنزيل لأول رتبة', suspend: 'إيقاف مؤقت', combo: 'عقوبة مركّبة', dismiss: 'فصل نهائي' };
function renderPenaltiesPage(list) {
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = \`
        <div class="card">
            <h3 style="color:var(--gold-soft);margin-bottom:8px;">⚖️ عقوبات التحذيرات</h3>
            <p style="font-size:13px;color:#94a3b8;line-height:1.8;">
                تصل هذي العقوبات للعضو تلقائيًا عند وصوله للتحذير الثالث — تختار وحدة منها وقت إرسال التحذير. تقدر تضيف / تعدّل / تحذف عقوبات حسب ما يناسبكم.<br>
                <b style="color:#fca5a5;">ملاحظة:</b> أي تحذير رابع بعد عقوبة التحذير الثالث يفصل العضو تلقائيًا بغض النظر عن هذي القائمة.
            </p>
        </div>
        <div class="card" id="penalty-form-card">
            <h3 id="penalty-form-title" style="margin-bottom:10px;">➕ إضافة عقوبة جديدة</h3>
            <input id="pn-label" placeholder="اسم العقوبة (مثال: إيقاف 4 أيام)">
            <select id="pn-type" onchange="togglePenaltyFields()">
                <option value="points">خصم نقاط</option>
                <option value="resetPoints">تصفير النقاط بالكامل</option>
                <option value="demote">تنزيل رتبة</option>
                <option value="demoteToFirst">تنزيل لأول رتبة (جندي)</option>
                <option value="suspend">إيقاف مؤقت (أيام)</option>
                <option value="combo">عقوبة مركّبة (نقاط + رتبة + إيقاف)</option>
                <option value="dismiss">فصل نهائي</option>
            </select>
            <input id="pn-value" type="number" min="1" placeholder="عدد النقاط المخصومة">
            <input id="pn-ranks" type="number" min="1" placeholder="عدد الرتب المُنزّلة">
            <input id="pn-days" type="number" min="1" placeholder="عدد أيام الإيقاف">
            <div class="wf-actions" style="margin-top:6px;">
                <button class="btn gray sm" id="pn-cancel-btn" style="display:none;" onclick="resetPenaltyForm()">إلغاء التعديل</button>
                <button class="btn sm" onclick="savePenalty()">💾 حفظ</button>
            </div>
        </div>
        \${list.length === 0 ? '<div class="card center" style="color:var(--muted);">لا توجد عقوبات مضافة حالياً — ضيف عقوبة من الفورم فوق</div>' : list.map((p, i) => \`
        <div class="card row" style="align-items:center;">
            <div>
                <b>\${i + 1}. \${p.label}</b>
                <div style="font-size:12px;color:#94a3b8;margin-top:2px;">
                    \${PENALTY_TYPE_LABELS[p.type] || p.type}
                    \${p.value ? ' • ' + p.value + ' نقطة' : ''}
                    \${p.ranks ? ' • ' + p.ranks + ' رتبة' : ''}
                    \${p.days ? ' • ' + p.days + ' يوم' : ''}
                </div>
            </div>
            <div class="row" style="gap:6px;">
                <button class="btn sm gray" onclick='editPenalty(\${JSON.stringify(p)})'>✏️ تعديل</button>
                <button class="btn sm danger" onclick="deletePenalty('\${p.id}')">🗑️ حذف</button>
            </div>
        </div>\`).join('')}
    \`;
    togglePenaltyFields();
}
function togglePenaltyFields() {
    const type = document.getElementById('pn-type').value;
    document.getElementById('pn-value').style.display = (type === 'points' || type === 'combo') ? 'block' : 'none';
    document.getElementById('pn-ranks').style.display = (type === 'demote' || type === 'combo') ? 'block' : 'none';
    document.getElementById('pn-days').style.display = (type === 'suspend' || type === 'combo') ? 'block' : 'none';
}
function editPenalty(p) {
    editingPenaltyId = p.id;
    document.getElementById('penalty-form-title').textContent = '✏️ تعديل العقوبة';
    document.getElementById('pn-label').value = p.label || '';
    document.getElementById('pn-type').value = p.type || 'points';
    document.getElementById('pn-value').value = p.value || '';
    document.getElementById('pn-ranks').value = p.ranks || '';
    document.getElementById('pn-days').value = p.days || '';
    document.getElementById('pn-cancel-btn').style.display = 'inline-block';
    togglePenaltyFields();
    document.getElementById('penalty-form-card').scrollIntoView({ behavior: 'smooth' });
}
function resetPenaltyForm() {
    editingPenaltyId = null;
    document.getElementById('penalty-form-title').textContent = '➕ إضافة عقوبة جديدة';
    document.getElementById('pn-label').value = '';
    document.getElementById('pn-type').value = 'points';
    document.getElementById('pn-value').value = '';
    document.getElementById('pn-ranks').value = '';
    document.getElementById('pn-days').value = '';
    document.getElementById('pn-cancel-btn').style.display = 'none';
    togglePenaltyFields();
}
async function savePenalty() {
    const label = document.getElementById('pn-label').value;
    const type = document.getElementById('pn-type').value;
    const value = document.getElementById('pn-value').value;
    const ranks = document.getElementById('pn-ranks').value;
    const days = document.getElementById('pn-days').value;
    if (!label || !label.trim()) return toast('لازم تكتب اسم العقوبة');
    try {
        let list;
        if (editingPenaltyId) {
            ({ list } = await api('/api/senior/penalties/' + editingPenaltyId, { method: 'PUT', body: JSON.stringify({ label, type, value, ranks, days }) }));
            toast('تم تعديل العقوبة');
        } else {
            ({ list } = await api('/api/senior/penalties', { method: 'POST', body: JSON.stringify({ label, type, value, ranks, days }) }));
            toast('تمت إضافة العقوبة');
        }
        editingPenaltyId = null;
        renderPenaltiesPage(list);
    } catch (e) { toast(e.message); }
}
async function deletePenalty(id) {
    if (!confirm('متأكد تبي تحذف هذي العقوبة؟')) return;
    try {
        const { list } = await api('/api/senior/penalties/' + id, { method: 'DELETE' });
        toast('تم الحذف');
        renderPenaltiesPage(list);
    } catch (e) { toast(e.message); }
}
// ── قادة القطاعات: تعيين قائد/نائب لكل قطاع بالآيدي ──
function escH(v) {
    return String(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}
async function loadSectorLeaders() {
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = '<div class="card">جارِ التحميل...</div>';
    let data;
    try { data = await api('/api/senior/sector-leaders'); }
    catch (e) {
        if (currentAdminTab !== 'sector-leaders') return;
        box.innerHTML = '<div class="card" style="color:#f87171;">تعذر التحميل. (' + escH(e.message) + ')</div>';
        return;
    }
    if (currentAdminTab !== 'sector-leaders') return;
    box.innerHTML = '<div class="card" style="color:var(--muted);font-size:13px;">حط آيدي حساب ديسكورد للشخص — يصير قائد أو نائب لهذا القطاع فقط، ويقدر يستخدم أزرار /تحكم-قياده على أفراد قطاعه. الشخص ما يتعيّن بأكثر من قطاع أو منصب.</div>'
        + Object.keys(data.sectors).map(function (key) {
            var sec = data.leadership[key] || {};
            return '<div class="card"><h3>🪖 ' + escH(data.sectors[key]) + '</h3>'
                + sectorLeaderRow(key, 'commander', 'القائد', sec.commanderName, sec.commanderId)
                + sectorLeaderRow(key, 'deputy', 'النائب', sec.deputyName, sec.deputyId)
                + '</div>';
        }).join('');
}
function sectorLeaderRow(key, role, label, name, id) {
    var attrs = 'data-sector="' + key + '" data-role="' + role + '"';
    var html = '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px;">';
    html += '<div class="row"><span>' + label + ': <b style="color:' + (name ? '#4ade80' : 'var(--muted)') + ';">' + escH(name || 'غير معيّن') + '</b>'
        + (id ? ' <span style="color:var(--muted);font-size:12px;">(' + escH(id) + ')</span>' : '') + '</span>';
    if (id) html += '<button class="btn danger sm" ' + attrs + ' onclick="removeSectorLeader(this)">إزالة</button>';
    html += '</div>';
    html += '<div class="row" style="gap:6px;margin-top:8px;flex-wrap:nowrap;">'
        + '<input id="sl-' + key + '-' + role + '" placeholder="آيدي ديسكورد ' + label + '" inputmode="numeric" style="margin-bottom:0;flex:1;">'
        + '<button class="btn sm" ' + attrs + ' onclick="assignSectorLeader(this)">' + (id ? 'تغيير' : 'تعيين') + '</button></div></div>';
    return html;
}
async function assignSectorLeader(btn) {
    var key = btn.dataset.sector, role = btn.dataset.role;
    var input = document.getElementById('sl-' + key + '-' + role);
    var discordId = ((input && input.value) || '').trim();
    if (!discordId) return toast('اكتب آيدي الشخص أول');
    try {
        await api('/api/senior/sector-leaders/assign', { method: 'POST', body: JSON.stringify({ sector: key, role: role, discordId: discordId }) });
        toast('تم التعيين');
        loadSectorLeaders();
    } catch (e) { toast(e.message); }
}
async function removeSectorLeader(btn) {
    if (!confirm('متأكد تبي تزيله من هذا المنصب؟')) return;
    try {
        await api('/api/senior/sector-leaders/remove', { method: 'POST', body: JSON.stringify({ sector: btn.dataset.sector, role: btn.dataset.role }) });
        toast('تمت الإزالة');
        loadSectorLeaders();
    } catch (e) { toast(e.message); }
}
// ── آيديات رولات القطاعات (بالإعدادات) ──
async function loadSectorRoleIds() {
    var data;
    try { data = await api('/api/senior/sector-role-ids'); } catch (e) { return; }
    if (currentAdminTab !== 'settings') return;
    var box = document.getElementById('sector-role-card');
    if (!box) return;
    box.innerHTML = '<h3 style="margin-bottom:10px;">🪖 آيديات رولات القطاعات</h3>'
        + '<p style="color:var(--muted);font-size:12px;margin-bottom:10px;">حط آيدي رول ديسكورد لكل قطاع (أي رول تبيه) — منه يُعرف أعضاء كل قطاع، وعليه تنبني صلاحية قادة ونواب القطاعات. لو تركته فاضي يرجع للرول الافتراضي.</p>'
        + Object.keys(data.sectors).map(function (k) {
            return '<label style="margin-top:8px;">رول ' + escH(data.sectors[k]) + '</label>'
                + '<input id="sr-' + k + '" placeholder="آيدي الرول" inputmode="numeric" value="' + escH(data.roleIds[k] || '') + '">';
        }).join('')
        + '<button class="btn" style="margin-top:14px;" onclick="saveSectorRoleIds()">حفظ آيديات القطاعات</button>';
}
async function saveSectorRoleIds() {
    var roleIds = {};
    document.querySelectorAll('[id^="sr-"]').forEach(function (el) { roleIds[el.id.slice(3)] = el.value.trim(); });
    try { await api('/api/senior/sector-role-ids', { method: 'POST', body: JSON.stringify({ roleIds: roleIds }) }); toast('تم الحفظ'); }
    catch (e) { toast(e.message); }
}
async function loadSettings() {
    const { settings } = await api('/api/senior/settings');
    if (currentAdminTab !== 'settings') return;
    const box = document.getElementById('admin-content');
    if (!box) return;
    box.innerHTML = \`
        <div class="card">
            <div class="row"><span>وضع الصيانة</span><input type="checkbox" id="s-maint" \${settings.isMaintenance ? 'checked' : ''}></div>
            <div class="row" style="margin-top:10px;"><span>إغلاق تسجيل الدخول</span><input type="checkbox" id="s-login" \${settings.disableLogin ? 'checked' : ''}></div>
            <div class="row" style="margin-top:10px;"><span>إغلاق تسجيل المخالفات</span><input type="checkbox" id="s-viol" \${settings.disableViolations ? 'checked' : ''}></div>
            <label style="margin-top:10px;">آيدي قناة إرسال المخالفات والتقارير بديسكورد (اختياري)</label>
            <input id="s-channel" placeholder="آيدي القناة" value="\${settings.violationsChannelId || ''}">
            <label style="margin-top:10px;">آيدي قناة إرسال صور الملاحظات بديسكورد (اختياري)</label>
            <input id="s-notes-channel" placeholder="آيدي القناة" value="\${settings.notesChannelId || ''}">
            <button class="btn" style="margin-top:14px;" onclick="saveSettings()">حفظ الإعدادات</button>
        </div>
        <div class="card" id="cmd-perm-card">جارِ تحميل صلاحيات أوامر البوت...</div>
        <div class="card" id="sector-role-card">جارِ تحميل آيديات رولات القطاعات...</div>
        <div class="card" id="rank-role-card">جارِ تحميل آيديات رتب العسكرية...</div>\`;
    loadCommandPermissions();
    loadSectorRoleIds();
    loadRankRoleIds();
}
// آيديات رولات الرتب العسكرية — أي شخص معه الرول يتسجل تلقائياً أن رتبته هذي
async function loadRankRoleIds() {
    let data;
    try { data = await api('/api/senior/rank-role-ids'); } catch (e) { return; }
    if (currentAdminTab !== 'settings') return;
    const box = document.getElementById('rank-role-card');
    if (!box) return;
    box.innerHTML = \`
        <h3 style="margin-bottom:10px;">🎖️ آيديات رولات الرتب العسكرية</h3>
        <p style="color:var(--muted);font-size:12px;margin-bottom:10px;">حط آيدي رول الديسكورد حق كل رتبة — أي عضو معه الرول يتسجل تلقائياً أن رتبته هذي أول ما يدخل الموقع (اختياري، اتركه فاضي لو ما تبي هذي الرتبة).</p>
        \${data.ranks.map(r => \`
            <label style="margin-top:8px;">\${r}</label>
            <input id="rr-\${r}" placeholder="آيدي الرول" value="\${data.rankRoleIds[r] || ''}">\`).join('')}
        <button class="btn" style="margin-top:14px;" onclick="saveRankRoleIds()">حفظ آيديات الرتب</button>\`;
}
async function saveRankRoleIds() {
    const body = { rankRoleIds: {} };
    document.querySelectorAll('[id^="rr-"]').forEach(el => {
        body.rankRoleIds[el.id.slice(3)] = el.value.trim();
    });
    try { await api('/api/senior/rank-role-ids', { method: 'POST', body: JSON.stringify(body) }); toast('تم الحفظ'); }
    catch (e) { toast(e.message); }
}
// أقل رتبة تقدر تستخدم أزرار كل أمر ببوت الأوامر (مركز العمليات) — بوت الأوامر يقرأها مباشرة من نفس القاعدة
async function loadCommandPermissions() {
    let data;
    try { data = await api('/api/senior/command-permissions'); } catch (e) { return; }
    if (currentAdminTab !== 'settings') return;
    const box = document.getElementById('cmd-perm-card');
    if (!box) return;
    const rankOptions = (current) => data.ranks.map(r => \`<option value="\${r}" \${r === current ? 'selected' : ''}>\${r}</option>\`).join('');
    box.innerHTML = \`
        <h3 style="margin-bottom:10px;">🤖 صلاحيات أوامر البوت (أقل رتبة تقدر تستخدم كل زر)</h3>
        <label>زر /اصدار-مخالفة</label>
        <select id="cp-violation">\${rankOptions(data.permissions.violation)}</select>
        <label style="margin-top:10px;">زر /تحكم-قيادة</label>
        <select id="cp-command">\${rankOptions(data.permissions.command)}</select>
        <label style="margin-top:10px;">زر /اصدار-اجازة</label>
        <select id="cp-leave">\${rankOptions(data.permissions.leave)}</select>
        <label style="margin-top:10px;">زر /تحكم-الافراد</label>
        <select id="cp-personnel">\${rankOptions(data.permissions.personnel)}</select>
        <p style="color:var(--muted);font-size:12px;margin-top:8px;">ملاحظة: أمر /لوحة-التسجيل (تسجيل دخول/خروج) متاح للجميع بدون شرط رتبة.</p>
        <button class="btn" style="margin-top:14px;" onclick="saveCommandPermissions()">حفظ صلاحيات الأوامر</button>\`;
}
async function saveCommandPermissions() {
    const body = {
        violation: document.getElementById('cp-violation').value,
        command: document.getElementById('cp-command').value,
        leave: document.getElementById('cp-leave').value,
        personnel: document.getElementById('cp-personnel').value,
    };
    try { await api('/api/senior/command-permissions', { method: 'POST', body: JSON.stringify(body) }); toast('تم حفظ صلاحيات الأوامر'); }
    catch (e) { toast(e.message); }
}
async function saveSettings() {
    const body = {
        isMaintenance: document.getElementById('s-maint').checked,
        disableLogin: document.getElementById('s-login').checked,
        disableViolations: document.getElementById('s-viol').checked,
        violationsChannelId: document.getElementById('s-channel').value.trim(),
        notesChannelId: document.getElementById('s-notes-channel').value.trim(),
    };
    try { await api('/api/senior/settings', { method: 'POST', body: JSON.stringify(body) }); toast('تم الحفظ'); }
    catch (e) { toast(e.message); }
}
init();
</script>
</body>
</html>`);
});

// معالج أخطاء عام: أي خطأ غير متوقع بأي راوت (بدل ما يرجع صفحة HTML فاضية تسبب "خطأ" عامة بالواجهة)
// نطبعه بالسجل ونرجع JSON واضح للمتصفح عشان يقدر يعرض الرسالة الحقيقية
app.use((err, req, res, next) => {
    console.error("❌ خطأ غير متوقع بالسيرفر:", err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: err.message || "صار خطأ غير متوقع، حاول مرة ثانية" });
});

process.on("unhandledRejection", (err) => {
    console.error("❌ Unhandled Rejection:", err);
});

// حماية أخيرة: لو صار خطأ متزامن غير متوقع بأي مكان (مثلاً بأحداث البوت)، نسجّله فقط
// بدل ما نخلي نود.js يوقف السيرفر كامل ويسبب صفحة بيضاء لكل الزوار لين يعيد Render تشغيله
process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught Exception:", err);
});

app.listen(CONFIG.PORT, "0.0.0.0", () => {
    console.log(`🚀 ${CONFIG.SITE_NAME} server running on port ${CONFIG.PORT}`);
});
