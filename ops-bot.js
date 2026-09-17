// ══════════════════════════════════════════════════════════════════════════
// بوت الأوامر العسكري — بوت مستقل (توكن خاص فيه) يخدم نفس قاعدة بيانات "مركز العمليات"
// الأوامر: /اصدار-مخالفة، /تحكم-قيادة، /اصدار-اجازة، /تحكم-الافراد، /لوحة-التسجيل
// كل أمر: ما يشغّله غير كبار المسؤولين (يفتح اللوحة بالروم)، لكن الأزرار يستخدمها الأفراد
// حسب أقل رتبة يحددها الكبار من "مركز العمليات" (إلا لوحة التسجيل، متاحة للجميع بدون شرط رتبة)
// ══════════════════════════════════════════════════════════════════════════

const mongoose = require("mongoose");
const {
    Client, GatewayIntentBits, Partials, REST, Routes,
    SlashCommandBuilder, PermissionFlagsBits,
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    StringSelectMenuBuilder, UserSelectMenuBuilder,
} = require("discord.js");

// ══════════════════════════════════════════════════════════════════════════
// 1) الإعدادات
// ══════════════════════════════════════════════════════════════════════════
const CONFIG = {
    BOT_TOKEN: process.env.OPS_BOT_TOKEN || "",       // توكن بوت الأوامر (منفصل عن توكن مركز العمليات)
    GUILD_ID: process.env.GUILD_ID || "",
    MONGO_URI: process.env.MONGO_URI || "",           // نفس رابط قاعدة بيانات مركز العمليات بالضبط

    PATROL_ROLE_ID: process.env.PATROL_ROLE_ID || "1500064443537686588",
    ROAD_SECURITY_ROLE_ID: process.env.ROAD_SECURITY_ROLE_ID || "1533192878510178304",
    ANTI_DRUGS_ROLE_ID: "1500064767082233926",

    SECTORS: { patrol: "الدوريات", roadSecurity: "أمن الطرق", antiDrugs: "مكافحة المخدرات" },

    MILITARY_RANKS: [
        "جندي", "جندي اول", "عريف", "وكيل رقيب", "رقيب", "رقيب اول", "رئيس رقباء",
        "ملازم", "ملازم اول", "نقيب", "رائد",
        "مقدم", "عقيد", "عميد",
        "لواء", "فريق", "فريق اول",
    ],

    SENIOR_ADMIN_IDS: [
        "1003511814140743825",
    ],

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
    POINTS_ON_REJECT: 1,
    DEFAULT_LEAVE_BALANCE: 10,
    FP_FAIL_RATE: 0.2,

    // لون العلامة الرسمية بكل الإيمبدات (نفس هوية مركز العمليات — ذهبي)
    BRAND_COLOR: 0xd4af37,
};

function generatePlate() {
    const letters = "أبجدهوزحطيكلمنسعفصقرشتثخذضظغ";
    const pick = () => letters[Math.floor(Math.random() * letters.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${pick()} ${pick()} ${pick()} - ${num}`;
}

// ══════════════════════════════════════════════════════════════════════════
// 2) قاعدة البيانات — نفس السكيمات بالضبط اللي بمركز العمليات (نفس الكولكشنز، نفس الحقول)
// ══════════════════════════════════════════════════════════════════════════
mongoose.connect(CONFIG.MONGO_URI)
    .then(() => console.log("✅ بوت الأوامر متصل بقاعدة البيانات"))
    .catch(err => console.log("❌ خطأ اتصال قاعدة البيانات:", err));

const PersonnelSchema = new mongoose.Schema({
    discord: { type: String, required: true, unique: true },
    discordTag: String,
    registeredName: { type: String, default: null },
    unit: { type: String, default: null },
    rank: { type: String, default: "جندي" },
    points: { type: Number, default: 0 },
    notes: [{
        text: String, image: { type: String, default: null },
        imageChannelId: { type: String, default: null }, imageMessageId: { type: String, default: null },
        reviewDeadline: { type: Date, default: null }, reviewNotified: { type: Boolean, default: false },
        addedBy: String, addedByTag: String, createdAt: { type: Date, default: Date.now },
    }],
    summon: {
        status: { type: String, enum: ["none", "pending", "approved"], default: "none" },
        mode: { type: String, default: null }, timeLabel: { type: String, default: null },
        unlockAt: { type: Date, default: null },
        requestedBy: { type: String, default: null }, requestedByTag: { type: String, default: null },
        setBy: { type: String, default: null }, setByTag: { type: String, default: null }, setAt: { type: Date, default: null },
        enteredAt: { type: Date, default: null },
    },
    warnings: [{
        kind: { type: String, enum: ["warning", "notice", "note-review"], default: "warning" },
        reason: String, issuedBy: String, issuedByTag: String,
        acknowledged: { type: Boolean, default: false }, acknowledgedAt: Date,
        warningNumber: { type: Number, default: null }, pointsDeducted: { type: Number, default: 0 },
        penaltyType: { type: String, default: null }, penaltyLabel: { type: String, default: null },
        noteReviewTargetDiscord: { type: String, default: null }, noteReviewTargetName: { type: String, default: null },
        noteReviewNoteId: { type: String, default: null }, noteReviewText: { type: String, default: null },
        noteReviewSectorLabel: { type: String, default: null },
        createdAt: { type: Date, default: Date.now },
    }],
    isBlocked: { type: Boolean, default: false },
    blockUntil: { type: Date, default: null },
    isDismissed: { type: Boolean, default: false },
    leaveBalance: { type: Number, default: 10 },
    createdAt: { type: Date, default: Date.now },
});
const Personnel = mongoose.model("Personnel", PersonnelSchema);

const ViolationSchema = new mongoose.Schema({
    reporterDiscord: String, reporterTag: String, reporterName: String, reporterUnit: String,
    violationType: String, vehicle: String, vehiclePhoto: { type: String, default: null },
    plateNumber: String, photo: { type: String, default: null },
    photoChannelId: { type: String, default: null }, photoMessageId: { type: String, default: null },
    status: { type: String, default: "pending" }, rejectReason: { type: String, default: null },
    reviewedBy: String, reviewedByTag: String, reviewedAt: Date,
    createdAt: { type: Date, default: Date.now },
    kind: { type: String, enum: ["violation", "report"], default: "violation" },
    reportCategory: { type: String, default: null }, suspectName: { type: String, default: null },
    arrestLocation: { type: String, default: null }, stopReason: { type: String, default: null },
    seizedItems: { type: String, default: null }, securityActions: { type: [String], default: [] },
    drugType: { type: String, default: null }, drugQuantity: { type: String, default: null }, concealMethod: { type: String, default: null },
});
const Violation = mongoose.model("Violation", ViolationSchema);

const PromotionRequestSchema = new mongoose.Schema({
    sector: String, sectorLabel: String, targetDiscord: String, targetTag: String, targetName: String,
    fromRank: String, toRank: String, direction: { type: String, enum: ["up", "down"] },
    reason: { type: String, default: null }, requestedBy: String, requestedByTag: String,
    status: { type: String, default: "pending" }, rejectReason: { type: String, default: null },
    reviewedBy: String, reviewedByTag: String, reviewedAt: Date, createdAt: { type: Date, default: Date.now },
});
const PromotionRequest = mongoose.model("PromotionRequest", PromotionRequestSchema);

const LeaveRequestSchema = new mongoose.Schema({
    discord: String, discordTag: String, name: String, unit: String, rank: String,
    sector: String, sectorLabel: String, reason: String, days: { type: Number, required: true },
    status: { type: String, default: "pending" }, rejectReason: { type: String, default: null },
    reviewedBy: String, reviewedByTag: String, reviewedAt: Date,
    startDate: { type: Date, default: null }, endDate: { type: Date, default: null },
    endedAt: { type: Date, default: null }, endedByTag: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
});
const LeaveRequest = mongoose.model("LeaveRequest", LeaveRequestSchema);

const VehicleSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, photo: { type: String, default: null },
    addedBy: String, createdAt: { type: Date, default: Date.now },
});
const Vehicle = mongoose.model("Vehicle", VehicleSchema);

const AttendanceStatusSchema = new mongoose.Schema({
    discord: { type: String, required: true, unique: true }, discordTag: String,
    registeredName: String, unit: String, rank: String, sectorLabel: String,
    status: { type: String, enum: ["in", "out"], default: "out" },
    lastCheckInAt: { type: Date, default: null }, lastCheckOutAt: { type: Date, default: null },
    lastHeartbeatAt: { type: Date, default: null }, todayCount: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
});
const AttendanceStatus = mongoose.model("AttendanceStatus", AttendanceStatusSchema);

const AttendanceLogSchema = new mongoose.Schema({
    discord: String, discordTag: String, registeredName: String, unit: String, rank: String,
    type: { type: String, enum: ["in", "out"] }, at: { type: Date, default: Date.now },
});
const AttendanceLog = mongoose.model("AttendanceLog", AttendanceLogSchema);

const LogSchema = new mongoose.Schema({
    discordId: { type: String, default: null }, discordTag: { type: String, default: null },
    actorId: { type: String, default: null }, actorTag: { type: String, default: null },
    action: String, site: { type: String, default: "بوت الأوامر" }, accountNumber: { type: String, default: null },
    details: { type: String, default: "" }, createdAt: { type: Date, default: Date.now },
});
const Log = mongoose.model("Log", LogSchema);

const SettingsSchema = new mongoose.Schema({
    adminList: { type: [String], default: [] },
    sectorLeadership: {
        patrol: { commanderId: String, deputyId: String, personnelOfficerId: String, attendanceOfficerId: String },
        roadSecurity: { commanderId: String, deputyId: String, personnelOfficerId: String, attendanceOfficerId: String },
        antiDrugs: { commanderId: String, deputyId: String, personnelOfficerId: String, attendanceOfficerId: String },
    },
    highCommand: { type: [{ id: String, name: String }], default: [] },
    violationsChannelId: String,
    lockAttendance: { type: Boolean, default: false },
    leaveBalanceDefault: { type: Number, default: 10 },
    commandPermissions: {
        violation: { type: String, default: "جندي" },
        command: { type: String, default: "رقيب" },
        leave: { type: String, default: "جندي" },
        personnel: { type: String, default: "جندي" },
    },
}, { minimize: false, strict: false });
const Settings = mongoose.model("Settings", SettingsSchema);

async function getSettings() {
    let s = await Settings.findOne();
    if (!s) s = await Settings.create({});
    return s;
}
async function logEvent({ action, discordId = null, discordTag = null, actorId = null, actorTag = null, details = "" }) {
    try { await Log.create({ action, discordId, discordTag, actorId, actorTag, site: "بوت الأوامر", details }); } catch (e) { /* تجاهل */ }
}

// ══════════════════════════════════════════════════════════════════════════
// 3) دوال مساعدة (رتب، صلاحيات، قطاعات)
// ══════════════════════════════════════════════════════════════════════════
function rankIndex(rank) { return CONFIG.MILITARY_RANKS.indexOf(rank); }
function rankAtLeast(rank, minRank) {
    const a = rankIndex(rank), b = rankIndex(minRank);
    if (a === -1 || b === -1) return false;
    return a >= b;
}
function isSeniorAdmin(userId) { return CONFIG.SENIOR_ADMIN_IDS.includes(userId); }
async function isAnyAdmin(userId, settings) {
    if (isSeniorAdmin(userId)) return true;
    const s = settings || await getSettings();
    return (s.adminList || []).includes(userId);
}
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
async function getMemberSectorKey(guild, discordId) {
    try {
        const member = await guild.members.fetch(discordId);
        if (member.roles.cache.has(CONFIG.ANTI_DRUGS_ROLE_ID)) return "antiDrugs";
        if (member.roles.cache.has(CONFIG.PATROL_ROLE_ID)) return "patrol";
        if (member.roles.cache.has(CONFIG.ROAD_SECURITY_ROLE_ID)) return "roadSecurity";
        return null;
    } catch (e) { return null; }
}
function arabicDateTimeParts(date) {
    const d = new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
    const t = new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hour12: true }).format(date);
    const day = new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", weekday: "long" }).format(date);
    return { date: d, time: t, day };
}
async function dmUser(discordId, embed) {
    try { const u = await client.users.fetch(discordId); await u.send({ embeds: [embed] }); }
    catch (e) { console.error("❌ فشل إرسال رسالة خاصة:", discordId, e.message); }
}
// يرسل رسالة لقائد ونائب القطاع (لو موجودين) — تستخدمها لوحة التسجيل والإجازات
async function notifySectorLeadership(settings, sectorKey, embed) {
    if (!sectorKey) return;
    const sl = (settings.sectorLeadership || {})[sectorKey];
    if (!sl) return;
    for (const id of [sl.commanderId, sl.deputyId].filter(Boolean)) {
        dmUser(id, embed).catch(() => {});
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 4) العميل والأوامر
// ══════════════════════════════════════════════════════════════════════════
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
});
let botReady = false;

const commands = [
    new SlashCommandBuilder().setName("اصدار-مخالفة").setDescription("فتح لوحة إصدار مخالفة عسكرية (كبار المسؤولين فقط يشغّلونه)"),
    new SlashCommandBuilder().setName("تحكم-قياده").setDescription("فتح لوحة تحكم القيادة — ترقية/تنزيل عسكري (كبار المسؤولين فقط يشغّلونه)"),
    new SlashCommandBuilder().setName("اصدار-اجازه").setDescription("فتح لوحة طلب إجازة عسكرية (كبار المسؤولين فقط يشغّلونه)"),
    new SlashCommandBuilder().setName("تحكم-الافراد").setDescription("فتح لوحة تحكم الأفراد — بطاقة تعريف ومخالفات (كبار المسؤولين فقط يشغّلونه)"),
    new SlashCommandBuilder().setName("لوحة-التسجيل").setDescription("فتح لوحة تسجيل الدخول والخروج (كبار المسؤولين فقط يشغّلونه)"),
].map(c => c.toJSON());

async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(CONFIG.BOT_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, CONFIG.GUILD_ID), { body: commands });
        console.log("✅ تم تسجيل أوامر بوت الأوامر");
    } catch (e) {
        console.log("❌ خطأ بتسجيل أوامر بوت الأوامر:", e);
    }
}

// ── إيمبدات اللوحات (فخمة ورسمية) ────────────────────────────────────────
function brandFooter(embed) {
    return embed.setFooter({ text: "مركز العمليات العسكري • بوت الأوامر الرسمي" }).setColor(CONFIG.BRAND_COLOR);
}

client.once("ready", async () => {
    console.log(`🤖 بوت الأوامر شغّال: ${client.user.tag}`);
    botReady = true;
    await registerCommands();
});

// ══════════════════════════════════════════════════════════════════════════
// 5) جلسات مؤقتة بالذاكرة (لحفظ اختيارات المستخدم بين خطوات الأزرار/القوائم)
// ══════════════════════════════════════════════════════════════════════════
const violationSessions = new Map(); // userId -> { types: [], vehicle: null }
const cmdSessions = new Map();       // userId -> { targetId, direction }

// ══════════════════════════════════════════════════════════════════════════
// 6) أمر /اصدار-مخالفة
// ══════════════════════════════════════════════════════════════════════════
async function handleViolationCommand(interaction) {
    const settings = await getSettings();
    if (!(await isAnyAdmin(interaction.user.id, settings))) {
        return interaction.reply({ content: "🚫 هذا الأمر مخصص لكبار المسؤولين فقط.", ephemeral: true });
    }
    const embed = brandFooter(new EmbedBuilder()
        .setTitle("📝 لوحة إصدار المخالفات العسكرية")
        .setDescription(
            "هذي اللوحة الرسمية لتسجيل مخالفة مرورية بحق أي مركبة أثناء الخدمة.\n\n" +
            `**الرتبة المطلوبة لاستخدام الزر:** ${settings.commandPermissions.violation} فما فوق\n\n` +
            "اضغط الزر أدناه للبدء بتعبئة بيانات المخالفة."
        ));
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("viol_start").setLabel("📝 إصدار مخالفة").setStyle(ButtonStyle.Primary),
    );
    await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleViolationStart(interaction) {
    const settings = await getSettings();
    const p = await getOrCreatePersonnel(interaction.user.id, interaction.member);
    if (p.isBlocked) return interaction.reply({ content: "🚫 حسابك موقوف حالياً، راجع الإدارة.", ephemeral: true });
    if (!rankAtLeast(p.rank, settings.commandPermissions.violation)) {
        return interaction.reply({ content: `🚫 رتبتك الحالية (${p.rank}) أقل من الرتبة المطلوبة (${settings.commandPermissions.violation}) لاستخدام هذا الزر.`, ephemeral: true });
    }
    const vehicles = await Vehicle.find().sort({ name: 1 }).limit(25);
    if (!vehicles.length) return interaction.reply({ content: "❌ لا توجد مركبات مضافة بالنظام حالياً.", ephemeral: true });

    violationSessions.set(interaction.user.id, { types: [], vehicle: null });

    const typeMenu = new StringSelectMenuBuilder()
        .setCustomId("viol_types_select")
        .setPlaceholder("اختر نوع أو أكثر من أنواع المخالفة")
        .setMinValues(1).setMaxValues(Math.min(CONFIG.VIOLATION_TYPES.length, 10))
        .addOptions(CONFIG.VIOLATION_TYPES.map(t => ({ label: t, value: t })));

    await interaction.reply({
        content: "**الخطوة ١ من ٣ — نوع المخالفة**\nحدد نوع أو عدة أنواع للمخالفة من القائمة أدناه:",
        components: [new ActionRowBuilder().addComponents(typeMenu)],
        ephemeral: true,
    });
}

async function handleViolationTypesSelect(interaction) {
    const session = violationSessions.get(interaction.user.id);
    if (!session) return interaction.update({ content: "⏱️ انتهت الجلسة، ابدأ من جديد بالضغط على زر إصدار مخالفة.", components: [] });
    session.types = interaction.values;

    const vehicles = await Vehicle.find().sort({ name: 1 }).limit(25);
    const vehicleMenu = new StringSelectMenuBuilder()
        .setCustomId("viol_vehicle_select")
        .setPlaceholder("اختر المركبة")
        .addOptions(vehicles.map(v => ({ label: v.name, value: v.name })));

    await interaction.update({
        content: `**الخطوة ٢ من ٣ — المركبة**\nالأنواع المحددة: ${session.types.join("، ")}\n\nحدد المركبة:`,
        components: [new ActionRowBuilder().addComponents(vehicleMenu)],
    });
}

async function handleViolationVehicleSelect(interaction) {
    const session = violationSessions.get(interaction.user.id);
    if (!session) return interaction.update({ content: "⏱️ انتهت الجلسة، ابدأ من جديد.", components: [] });
    session.vehicle = interaction.values[0];

    await interaction.update({
        content: `**الخطوة ٣ من ٣ — صورة المخالفة (إجباري)**\nالأنواع: ${session.types.join("، ")}\nالمركبة: ${session.vehicle}\n\n📸 أرسل الآن صورة المخالفة **بنفس هذه القناة** خلال دقيقتين.`,
        components: [],
    });

    const channel = interaction.channel;
    const filter = m => m.author.id === interaction.user.id && m.attachments.size > 0;
    try {
        const collected = await channel.awaitMessages({ filter, max: 1, time: 120000, errors: ["time"] });
        const msg = collected.first();
        const attachment = msg.attachments.find(a => (a.contentType || "").startsWith("image/"));
        if (!attachment) {
            violationSessions.delete(interaction.user.id);
            return interaction.followUp({ content: "❌ ما لقيت صورة صالحة بالمرفق، أعد المحاولة من جديد.", ephemeral: true });
        }
        const settings = await getSettings();
        const p = await getOrCreatePersonnel(interaction.user.id, interaction.member);
        const pendingCount = await Violation.countDocuments({ reporterDiscord: interaction.user.id, status: "pending" });
        if (pendingCount >= 5) {
            violationSessions.delete(interaction.user.id);
            msg.delete().catch(() => {});
            return interaction.followUp({ content: "🚫 عندك 5 مخالفات معلّقة بانتظار المراجعة، لازم الإدارة تراجع وحدة منها قبل تسجيل مخالفة جديدة.", ephemeral: true });
        }

        const v = await Violation.create({
            reporterDiscord: interaction.user.id, reporterTag: interaction.user.username,
            reporterName: p.registeredName || interaction.user.username, reporterUnit: p.unit,
            violationType: session.types.join("، "), vehicle: session.vehicle,
            plateNumber: generatePlate(), status: "pending",
        });
        violationSessions.delete(interaction.user.id);
        msg.delete().catch(() => {});

        // نرسلها لقناة المخالفات (نفس قناة مركز العمليات) بزرَي قبول/رفض — يشتغلون من نفس بوت الأوامر
        if (settings.violationsChannelId) {
            try {
                const vchannel = await client.channels.fetch(settings.violationsChannelId);
                const embed = brandFooter(new EmbedBuilder()
                    .setTitle("📝 مخالفة عسكرية جديدة — بانتظار المراجعة")
                    .addFields(
                        { name: "مقدّم المخالفة", value: `${v.reporterName} (<@${v.reporterDiscord}>)`, inline: true },
                        { name: "اليونت", value: v.reporterUnit || "-", inline: true },
                        { name: "المركبة", value: v.vehicle, inline: true },
                        { name: "اللوحة", value: v.plateNumber, inline: true },
                        { name: "نوع المخالفة", value: v.violationType, inline: false },
                    ).setTimestamp());
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`viol_approve_${v._id}`).setLabel("✅ قبول").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`viol_reject_${v._id}`).setLabel("❌ رفض").setStyle(ButtonStyle.Danger),
                );
                const sent = await vchannel.send({ embeds: [embed], components: [row], files: [{ attachment: attachment.url, name: "violation.jpg" }] });
                v.photoChannelId = sent.channelId; v.photoMessageId = sent.id;
                await v.save();
            } catch (e) { console.error("❌ فشل إرسال المخالفة لقناة مركز العمليات:", e.message); }
        }

        await logEvent({ action: "طلب مخالفة (بوت الأوامر)", discordId: v.reporterDiscord, discordTag: v.reporterTag, actorId: interaction.user.id, actorTag: interaction.user.username, details: `${v.violationType} — ${v.vehicle}` });
        await interaction.followUp({ content: "✅ تم تسجيل مخالفتك بنجاح، بانتظار مراجعة الإدارة من مركز العمليات.", ephemeral: true });
    } catch (e) {
        violationSessions.delete(interaction.user.id);
        await interaction.followUp({ content: "⏱️ انتهى الوقت المحدد لإرسال الصورة، أعد المحاولة من جديد.", ephemeral: true });
    }
}

async function handleViolationDecisionButton(interaction) {
    const [, action, vid] = interaction.customId.match(/^viol_(approve|reject)_(.+)$/);
    const settings = await getSettings();
    const allowed = await isAnyAdmin(interaction.user.id, settings) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    if (!allowed) return interaction.reply({ content: "🚫 ما تملك صلاحية اتخاذ قرار بهذه المخالفة.", ephemeral: true });

    const v = await Violation.findById(vid);
    if (!v || v.status !== "pending") return interaction.reply({ content: "هذه المخالفة تمت مراجعتها مسبقاً.", ephemeral: true });

    if (action === "approve") {
        v.status = "approved"; v.reviewedBy = interaction.user.id; v.reviewedByTag = interaction.user.username; v.reviewedAt = new Date();
        await v.save();
        await Personnel.findOneAndUpdate({ discord: v.reporterDiscord }, { $inc: { points: CONFIG.POINTS_ON_APPROVE } });
        await logEvent({ action: "قبول مخالفة (بوت الأوامر)", discordId: v.reporterDiscord, discordTag: v.reporterTag, actorId: interaction.user.id, actorTag: interaction.user.username, details: v.violationType });
        dmUser(v.reporterDiscord, brandFooter(new EmbedBuilder().setTitle("✅ تم قبول مخالفتك").addFields({ name: "النوع", value: v.violationType }, { name: "النقاط", value: `+${CONFIG.POINTS_ON_APPROVE}` }).setTimestamp())).catch(() => {});
        await interaction.update({ components: [] });
        return interaction.followUp({ content: "✅ تم قبول المخالفة.", ephemeral: true });
    }
    // رفض — نفتح مودال لكتابة السبب
    const modal = new ModalBuilder().setCustomId(`viol_rejectmodal_${vid}`).setTitle("سبب رفض المخالفة");
    const input = new TextInputBuilder().setCustomId("reason").setLabel("اكتب سبب الرفض").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(400);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
}

async function handleViolationRejectModal(interaction) {
    const vid = interaction.customId.split("_").pop();
    const reason = interaction.fields.getTextInputValue("reason");
    const v = await Violation.findById(vid);
    if (!v || v.status !== "pending") return interaction.reply({ content: "هذه المخالفة تمت مراجعتها مسبقاً.", ephemeral: true });
    v.status = "rejected"; v.rejectReason = reason; v.reviewedBy = interaction.user.id; v.reviewedByTag = interaction.user.username; v.reviewedAt = new Date();
    await v.save();
    await Personnel.findOneAndUpdate({ discord: v.reporterDiscord }, { $inc: { points: -CONFIG.POINTS_ON_REJECT } });
    await Personnel.updateOne({ discord: v.reporterDiscord, points: { $lt: 0 } }, { $set: { points: 0 } });
    await logEvent({ action: "رفض مخالفة (بوت الأوامر)", discordId: v.reporterDiscord, discordTag: v.reporterTag, actorId: interaction.user.id, actorTag: interaction.user.username, details: `${v.violationType} — ${reason}` });
    dmUser(v.reporterDiscord, brandFooter(new EmbedBuilder().setTitle("❌ تم رفض مخالفتك").addFields({ name: "النوع", value: v.violationType }, { name: "السبب", value: reason }).setTimestamp())).catch(() => {});
    return interaction.reply({ content: "✅ تم رفض المخالفة وحفظ السبب.", ephemeral: true });
}

// ══════════════════════════════════════════════════════════════════════════
// 7) أمر /تحكم-قياده — طلب ترقية/تنزيل لعضو (يروح للقيادة العليا بمركز العمليات)
// ══════════════════════════════════════════════════════════════════════════
async function handleCommandCommand(interaction) {
    const settings = await getSettings();
    if (!(await isAnyAdmin(interaction.user.id, settings))) {
        return interaction.reply({ content: "🚫 هذا الأمر مخصص لكبار المسؤولين فقط.", ephemeral: true });
    }
    const embed = brandFooter(new EmbedBuilder()
        .setTitle("🎖️ لوحة تحكم القيادة")
        .setDescription(
            "هذي اللوحة الرسمية لتقديم طلب ترقية أو تنزيل رتبة لأحد الأفراد.\n" +
            "الطلب يروح مباشرة للقيادة العليا بمركز العمليات لاعتماده.\n\n" +
            `**الرتبة المطلوبة لاستخدام الزر:** ${settings.commandPermissions.command} فما فوق`
        ));
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("cmd_start").setLabel("🎖️ تقديم طلب ترقية/تنزيل").setStyle(ButtonStyle.Primary),
    );
    await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleCommandStart(interaction) {
    const settings = await getSettings();
    const p = await getOrCreatePersonnel(interaction.user.id, interaction.member);
    if (!rankAtLeast(p.rank, settings.commandPermissions.command)) {
        return interaction.reply({ content: `🚫 رتبتك الحالية (${p.rank}) أقل من الرتبة المطلوبة (${settings.commandPermissions.command}) لاستخدام هذا الزر.`, ephemeral: true });
    }
    const menu = new UserSelectMenuBuilder().setCustomId("cmd_target_select").setPlaceholder("اختر الفرد المطلوب ترقيته أو تنزيله");
    await interaction.reply({ content: "**الخطوة ١ من ٣ — اختيار الفرد**", components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
}

async function handleCommandTargetSelect(interaction) {
    const targetId = interaction.values[0];
    const target = await getOrCreatePersonnel(targetId, null);
    cmdSessions.set(interaction.user.id, { targetId, targetRank: target.rank });

    const idx = rankIndex(target.rank);
    const canPromote = idx < CONFIG.MILITARY_RANKS.length - 1;
    const canDemote = idx > 0;
    const row = new ActionRowBuilder();
    if (canPromote) row.addComponents(new ButtonBuilder().setCustomId("cmd_dir_up").setLabel(`⬆️ ترقية إلى ${CONFIG.MILITARY_RANKS[idx + 1]}`).setStyle(ButtonStyle.Success));
    if (canDemote) row.addComponents(new ButtonBuilder().setCustomId("cmd_dir_down").setLabel(`⬇️ تنزيل إلى ${CONFIG.MILITARY_RANKS[idx - 1]}`).setStyle(ButtonStyle.Danger));

    await interaction.update({
        content: `**الخطوة ٢ من ٣ — الاتجاه**\nالفرد: <@${targetId}>\nرتبته الحالية: ${target.rank}`,
        components: row.components.length ? [row] : [],
    });
}

async function handleCommandDirectionButton(interaction) {
    const session = cmdSessions.get(interaction.user.id);
    if (!session) return interaction.update({ content: "⏱️ انتهت الجلسة، ابدأ من جديد.", components: [] });
    const direction = interaction.customId === "cmd_dir_up" ? "up" : "down";
    session.direction = direction;

    const modal = new ModalBuilder().setCustomId("cmd_reason_modal").setTitle(direction === "up" ? "سبب الترقية" : "سبب التنزيل");
    const input = new TextInputBuilder().setCustomId("reason").setLabel("اكتب السبب").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(400);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

async function handleCommandReasonModal(interaction) {
    const session = cmdSessions.get(interaction.user.id);
    if (!session) return interaction.reply({ content: "⏱️ انتهت الجلسة، ابدأ من جديد بالأمر.", ephemeral: true });
    const reason = interaction.fields.getTextInputValue("reason");
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    const targetMember = await guild.members.fetch(session.targetId).catch(() => null);
    const target = await getOrCreatePersonnel(session.targetId, targetMember);
    const idx = rankIndex(target.rank);
    const toRank = session.direction === "up" ? CONFIG.MILITARY_RANKS[idx + 1] : CONFIG.MILITARY_RANKS[idx - 1];
    const sectorKey = await getMemberSectorKey(guild, session.targetId);
    const settings = await getSettings();

    const doc = await PromotionRequest.create({
        sector: sectorKey, sectorLabel: sectorKey ? CONFIG.SECTORS[sectorKey] : "غير محدد",
        targetDiscord: session.targetId, targetTag: targetMember?.user?.username || session.targetId,
        targetName: target.registeredName || targetMember?.displayName || session.targetId,
        fromRank: target.rank, toRank, direction: session.direction, reason: reason.trim(),
        requestedBy: interaction.user.id, requestedByTag: interaction.user.username,
    });
    cmdSessions.delete(interaction.user.id);

    await logEvent({
        action: session.direction === "up" ? "طلب ترقية (بوت الأوامر)" : "طلب تنزيل (بوت الأوامر)",
        discordId: session.targetId, discordTag: doc.targetTag,
        actorId: interaction.user.id, actorTag: interaction.user.username,
        details: `${doc.fromRank} ← ${doc.toRank} — السبب: ${reason.trim()}`,
    });

    // إشعار القيادة العليا (نفس فكرة مركز العمليات) — رسالة خاصة فيها زر رابط لمركز العمليات
    const members = settings.highCommand || [];
    const embed = brandFooter(new EmbedBuilder()
        .setTitle("🎖️ يوجد تقرير ترقية عسكرية")
        .addFields(
            { name: "الفرد", value: doc.targetName, inline: true },
            { name: "القطاع", value: doc.sectorLabel, inline: true },
            { name: "الاتجاه", value: doc.direction === "up" ? "⬆️ ترقية" : "⬇️ تنزيل", inline: true },
            { name: "من رتبة", value: doc.fromRank, inline: true },
            { name: "إلى رتبة", value: doc.toRank, inline: true },
            { name: "مقدّم الطلب", value: doc.requestedByTag, inline: false },
            { name: "السبب", value: doc.reason, inline: false },
        ).setTimestamp());
    for (const m of members) dmUser(m.id, embed).catch(() => {});

    await interaction.reply({ content: `✅ تم إرسال طلبك بنجاح لـ${target.registeredName ? target.registeredName : "الفرد"}، بانتظار موافقة القيادة العليا من مركز العمليات.`, ephemeral: true });
}

// ══════════════════════════════════════════════════════════════════════════
// 8) أمر /اصدار-اجازه
// ══════════════════════════════════════════════════════════════════════════
async function handleLeaveCommand(interaction) {
    const settings = await getSettings();
    if (!(await isAnyAdmin(interaction.user.id, settings))) {
        return interaction.reply({ content: "🚫 هذا الأمر مخصص لكبار المسؤولين فقط.", ephemeral: true });
    }
    const embed = brandFooter(new EmbedBuilder()
        .setTitle("🌴 لوحة طلب الإجازة العسكرية")
        .setDescription(
            "لكل عسكري رصيد إجازات ثابت (10 أيام)، ينقص مع كل إجازة تُقبل ولا يتجدد إلا بتعديل الإدارة يدوياً.\n\n" +
            `**الرتبة المطلوبة لاستخدام الزر:** ${settings.commandPermissions.leave} فما فوق`
        ));
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("leave_start").setLabel("🌴 طلب إجازة").setStyle(ButtonStyle.Primary),
    );
    await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleLeaveStart(interaction) {
    const settings = await getSettings();
    const p = await getOrCreatePersonnel(interaction.user.id, interaction.member);
    if (!rankAtLeast(p.rank, settings.commandPermissions.leave)) {
        return interaction.reply({ content: `🚫 رتبتك الحالية (${p.rank}) أقل من الرتبة المطلوبة (${settings.commandPermissions.leave}) لاستخدام هذا الزر.`, ephemeral: true });
    }
    const modal = new ModalBuilder().setCustomId("leave_modal").setTitle("طلب إجازة عسكرية");
    const daysInput = new TextInputBuilder().setCustomId("days").setLabel("مدة الإجازة بالأيام").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3);
    const reasonInput = new TextInputBuilder().setCustomId("reason").setLabel("سبب الإجازة").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(400);
    modal.addComponents(
        new ActionRowBuilder().addComponents(daysInput),
        new ActionRowBuilder().addComponents(reasonInput),
    );
    await interaction.showModal(modal);
}

async function handleLeaveModal(interaction) {
    const days = parseInt(interaction.fields.getTextInputValue("days"), 10);
    const reason = interaction.fields.getTextInputValue("reason").trim();
    if (!days || days < 1) return interaction.reply({ content: "❌ حدد عدد أيام صحيح.", ephemeral: true });

    const p = await getOrCreatePersonnel(interaction.user.id, interaction.member);
    const balance = p.leaveBalance ?? CONFIG.DEFAULT_LEAVE_BALANCE;
    if (days > balance) return interaction.reply({ content: `❌ رصيدك الحالي ${balance} يوم فقط، ما يكفي لهذا الطلب.`, ephemeral: true });

    const pending = await LeaveRequest.countDocuments({ discord: interaction.user.id, status: "pending" });
    if (pending >= 2) return interaction.reply({ content: "❌ عندك طلب إجازة قيد المراجعة بالفعل.", ephemeral: true });

    const active = await LeaveRequest.findOne({ discord: interaction.user.id, status: "approved" });
    if (active) return interaction.reply({ content: "❌ عندك إجازة نشطة حالياً، ما تقدر تطلب إجازة جديدة إلا بعد ما تنتهي.", ephemeral: true });

    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    const sectorKey = await getMemberSectorKey(guild, interaction.user.id);
    const settings = await getSettings();

    const leave = await LeaveRequest.create({
        discord: interaction.user.id, discordTag: interaction.user.username,
        name: p.registeredName || interaction.user.username, unit: p.unit, rank: p.rank,
        sector: sectorKey, sectorLabel: sectorKey ? CONFIG.SECTORS[sectorKey] : null,
        reason, days,
    });
    await logEvent({ action: "طلب إجازة (بوت الأوامر)", discordId: p.discord, discordTag: p.discordTag, actorId: p.discord, actorTag: interaction.user.username, details: `${days} يوم — ${reason}` });

    if (sectorKey) {
        await notifySectorLeadership(settings, sectorKey, brandFooter(new EmbedBuilder()
            .setTitle("🌴 طلب إجازة جديد بقطاعك")
            .addFields({ name: "الفرد", value: leave.name, inline: true }, { name: "المدة", value: `${days} يوم`, inline: true }, { name: "السبب", value: reason })
            .setTimestamp()));
    }
    await interaction.reply({ content: "✅ تم إرسال طلب إجازتك، بانتظار مراجعة الإدارة من مركز العمليات.", ephemeral: true });
}

// ══════════════════════════════════════════════════════════════════════════
// 9) أمر /تحكم-الافراد — بطاقة تعريف + مخالفاتي (بيانات كل شخص عن نفسه)
// ══════════════════════════════════════════════════════════════════════════
async function handlePersonnelCommand(interaction) {
    const settings = await getSettings();
    if (!(await isAnyAdmin(interaction.user.id, settings))) {
        return interaction.reply({ content: "🚫 هذا الأمر مخصص لكبار المسؤولين فقط.", ephemeral: true });
    }
    const embed = brandFooter(new EmbedBuilder()
        .setTitle("🪪 لوحة تحكم الأفراد")
        .setDescription(
            "من هنا يقدر أي عسكري يشوف بطاقته العسكرية أو مخالفاته الخاصة.\n\n" +
            `**الرتبة المطلوبة لاستخدام الأزرار:** ${settings.commandPermissions.personnel} فما فوق`
        ));
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("pers_card").setLabel("🪪 عرض البطاقة").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("pers_violations").setLabel("📋 مخالفاتي").setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({ embeds: [embed], components: [row] });
}

async function handlePersonnelCard(interaction) {
    const settings = await getSettings();
    const p = await getOrCreatePersonnel(interaction.user.id, interaction.member);
    if (!rankAtLeast(p.rank, settings.commandPermissions.personnel)) {
        return interaction.reply({ content: `🚫 رتبتك الحالية (${p.rank}) أقل من الرتبة المطلوبة (${settings.commandPermissions.personnel}).`, ephemeral: true });
    }
    const embed = brandFooter(new EmbedBuilder()
        .setTitle("🪪 بطاقة عسكرية")
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
            { name: "الاسم", value: p.registeredName || interaction.user.username, inline: true },
            { name: "الرتبة", value: p.rank, inline: true },
            { name: "اليونت", value: p.unit || "-", inline: true },
            { name: "النقاط", value: String(p.points), inline: true },
            { name: "عدد الملاحظات", value: String(p.notes.length), inline: true },
            { name: "رصيد الإجازات", value: `${p.leaveBalance ?? CONFIG.DEFAULT_LEAVE_BALANCE} يوم`, inline: true },
        ).setTimestamp());
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handlePersonnelViolations(interaction) {
    const settings = await getSettings();
    const p = await getOrCreatePersonnel(interaction.user.id, interaction.member);
    if (!rankAtLeast(p.rank, settings.commandPermissions.personnel)) {
        return interaction.reply({ content: `🚫 رتبتك الحالية (${p.rank}) أقل من الرتبة المطلوبة (${settings.commandPermissions.personnel}).`, ephemeral: true });
    }
    const list = await Violation.find({ reporterDiscord: interaction.user.id }).sort({ createdAt: -1 }).limit(15);
    if (!list.length) return interaction.reply({ content: "لا توجد لديك أي مخالفات مسجّلة حتى الآن.", ephemeral: true });
    const lines = list.map(v => {
        const s = v.status === "pending" ? "⏳ قيد المراجعة" : v.status === "approved" ? "✅ مقبولة" : "❌ مرفوضة";
        return `**${v.violationType}** — ${v.vehicle} — ${s}`;
    });
    const embed = brandFooter(new EmbedBuilder().setTitle("📋 مخالفاتي").setDescription(lines.join("\n")).setTimestamp());
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ══════════════════════════════════════════════════════════════════════════
// 10) أمر /لوحة-التسجيل — تسجيل حضور/انصراف (متاح للجميع، بدون شرط رتبة)
// ══════════════════════════════════════════════════════════════════════════
async function handleAttendanceCommand(interaction) {
    const settings = await getSettings();
    if (!(await isAnyAdmin(interaction.user.id, settings))) {
        return interaction.reply({ content: "🚫 هذا الأمر مخصص لكبار المسؤولين فقط.", ephemeral: true });
    }
    const embed = brandFooter(new EmbedBuilder()
        .setTitle("🕒 لوحة تسجيل الحضور والانصراف")
        .setDescription("هذي اللوحة الرسمية لتسجيل الدخول والخروج من الخدمة. متاحة لجميع الأفراد بدون استثناء."));
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("att_in").setLabel("🟢 تسجيل دخول").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("att_out").setLabel("🔴 تسجيل خروج").setStyle(ButtonStyle.Danger),
    );
    await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleAttendanceButton(interaction) {
    const wantIn = interaction.customId === "att_in";
    const settings = await getSettings();
    if (settings.lockAttendance && !isSeniorAdmin(interaction.user.id)) {
        return interaction.reply({ content: "🔒 تسجيل الحضور مقفل حالياً من قبل الإدارة العليا.", ephemeral: true });
    }
    const p = await getOrCreatePersonnel(interaction.user.id, interaction.member);
    if (p.isBlocked && !isSeniorAdmin(interaction.user.id)) {
        return interaction.reply({ content: "🚫 حسابك موقوف — راجع الإدارة.", ephemeral: true });
    }

    let st = await AttendanceStatus.findOne({ discord: interaction.user.id });
    if (!st) st = await AttendanceStatus.create({ discord: interaction.user.id, discordTag: interaction.user.username });

    if (wantIn && st.status === "in") return interaction.reply({ content: "أنت مسجّل دخول بالفعل.", ephemeral: true });
    if (!wantIn && st.status === "out") return interaction.reply({ content: "أنت مسجّل خروج بالفعل.", ephemeral: true });

    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    const sectorKey = await getMemberSectorKey(guild, interaction.user.id);
    const sectorLabel = sectorKey ? CONFIG.SECTORS[sectorKey] : null;

    const now = new Date();
    const newType = wantIn ? "in" : "out";
    st.status = newType; st.discordTag = interaction.user.username;
    st.registeredName = p.registeredName; st.unit = p.unit; st.rank = p.rank; st.sectorLabel = sectorLabel || st.sectorLabel;
    if (newType === "in") {
        const isNewDay = !st.lastCheckInAt || st.lastCheckInAt.toDateString() !== now.toDateString();
        st.lastCheckInAt = now; st.todayCount = isNewDay ? 1 : st.todayCount + 1;
    } else {
        st.lastCheckOutAt = now;
    }
    st.updatedAt = now;
    await st.save();
    await AttendanceLog.create({ discord: interaction.user.id, discordTag: interaction.user.username, registeredName: st.registeredName, unit: st.unit, rank: st.rank, type: newType, at: now });

    const { date, time, day } = arabicDateTimeParts(now);
    await interaction.reply({ content: newType === "in" ? `🟢 تم تسجيل دخولك بنجاح — ${time} — ${day} ${date}` : `🔴 تم تسجيل خروجك بنجاح — ${time} — ${day} ${date}`, ephemeral: true });

    if (sectorKey) {
        const embed = brandFooter(new EmbedBuilder()
            .setTitle(newType === "in" ? "🟢 تسجيل دخول" : "🔴 تسجيل خروج")
            .setDescription(`الفرد **${st.registeredName || interaction.user.username}** ${newType === "in" ? "سجّل دخول" : "سجّل خروج"}.`)
            .addFields({ name: "التاريخ", value: date, inline: true }, { name: "الوقت", value: time, inline: true }, { name: "اليوم", value: day, inline: true })
            .setTimestamp());
        await notifySectorLeadership(settings, sectorKey, embed);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// 11) موجّه التفاعلات (Interactions Router)
// ══════════════════════════════════════════════════════════════════════════
client.on("interactionCreate", async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const map = {
                "اصدار-مخالفة": handleViolationCommand,
                "تحكم-قياده": handleCommandCommand,
                "اصدار-اجازه": handleLeaveCommand,
                "تحكم-الافراد": handlePersonnelCommand,
                "لوحة-التسجيل": handleAttendanceCommand,
            };
            const fn = map[interaction.commandName];
            if (fn) await fn(interaction);
            return;
        }

        if (interaction.isButton()) {
            const id = interaction.customId;
            if (id === "viol_start") return handleViolationStart(interaction);
            if (id.startsWith("viol_approve_") || id.startsWith("viol_reject_")) return handleViolationDecisionButton(interaction);
            if (id === "cmd_start") return handleCommandStart(interaction);
            if (id === "cmd_dir_up" || id === "cmd_dir_down") return handleCommandDirectionButton(interaction);
            if (id === "leave_start") return handleLeaveStart(interaction);
            if (id === "pers_card") return handlePersonnelCard(interaction);
            if (id === "pers_violations") return handlePersonnelViolations(interaction);
            if (id === "att_in" || id === "att_out") return handleAttendanceButton(interaction);
            return;
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === "viol_types_select") return handleViolationTypesSelect(interaction);
            if (interaction.customId === "viol_vehicle_select") return handleViolationVehicleSelect(interaction);
            return;
        }

        if (interaction.isUserSelectMenu()) {
            if (interaction.customId === "cmd_target_select") return handleCommandTargetSelect(interaction);
            return;
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith("viol_rejectmodal_")) return handleViolationRejectModal(interaction);
            if (interaction.customId === "cmd_reason_modal") return handleCommandReasonModal(interaction);
            if (interaction.customId === "leave_modal") return handleLeaveModal(interaction);
            return;
        }
    } catch (e) {
        console.error("❌ خطأ بتفاعل بوت الأوامر:", e);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: "⚠️ صار خطأ غير متوقع، حاول مرة ثانية.", ephemeral: true });
            } else {
                await interaction.reply({ content: "⚠️ صار خطأ غير متوقع، حاول مرة ثانية.", ephemeral: true });
            }
        } catch (e2) { /* تجاهل */ }
    }
});

client.login(CONFIG.BOT_TOKEN);
