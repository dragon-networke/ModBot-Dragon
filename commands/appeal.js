/**
 * commands/appeal.js
 * Appeal-System – User können gegen einen Ban Einspruch einlegen
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const fs   = require('fs');
const path = require('path');

const dataPath = path.join(process.cwd(), 'data', 'appeals.json');

function loadAppeals() {
  if (!fs.existsSync(dataPath)) return {};
  try { return JSON.parse(fs.readFileSync(dataPath, 'utf-8')); }
  catch { return {}; }
}

function saveAppeals(data) {
  if (!fs.existsSync(path.dirname(dataPath))) {
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  }
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function loadConfig() {
  const cfgPath = path.join(process.cwd(), 'data', 'appealConfig.json');
  if (!fs.existsSync(cfgPath)) return {};
  try { return JSON.parse(fs.readFileSync(cfgPath, 'utf-8')); }
  catch { return {}; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('appeal')
    .setDescription('Lege Einspruch gegen eine Servermaßnahme ein'),

  async execute(interaction) {
    const config    = loadConfig();
    const guildConf = config[interaction.guild.id];

    // Prüfen ob Appeal-System konfiguriert ist
    if (!guildConf?.appealChannelId) {
      return interaction.reply({
        content: '❌ Das Appeal-System ist auf diesem Server nicht konfiguriert.',
        ephemeral: true,
      });
    }

    // Prüfen ob User bereits ein offenes Appeal hat
    const appeals    = loadAppeals();
    const guildAppeals = appeals[interaction.guild.id] || {};
    const existing   = Object.values(guildAppeals).find(
      a => a.userId === interaction.user.id && a.status === 'pending'
    );

    if (existing) {
      return interaction.reply({
        content: `❌ Du hast bereits ein offenes Appeal. Warte auf eine Antwort.`,
        ephemeral: true,
      });
    }

    // Modal öffnen
    const modal = new ModalBuilder()
      .setCustomId('appeal_modal')
      .setTitle('Appeal einreichen');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('appeal_reason')
          .setLabel('Warum wurdest du gebannt/bestraft?')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Erkläre was passiert ist...')
          .setRequired(true)
          .setMaxLength(1000)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('appeal_argument')
          .setLabel('Warum sollte die Maßnahme aufgehoben werden?')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Deine Argumente für den Einspruch...')
          .setRequired(true)
          .setMaxLength(1000)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('appeal_promise')
          .setLabel('Was versprichst du für die Zukunft?')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('z.B. Die Regeln einzuhalten...')
          .setRequired(true)
          .setMaxLength(500)
      ),
    );

    await interaction.showModal(modal);
  },

  // ── Modal Submit ──────────────────────────────────────────────────────────

  async handleModal(interaction) {
    if (interaction.customId !== 'appeal_modal') return;

    await interaction.deferReply({ ephemeral: true });

    const config    = loadConfig();
    const guildConf = config[interaction.guild.id];

    if (!guildConf?.appealChannelId) {
      return interaction.editReply({ content: '❌ Appeal-System nicht konfiguriert.' });
    }

    const appealChannel = await interaction.guild.channels.fetch(guildConf.appealChannelId).catch(() => null);
    if (!appealChannel) {
      return interaction.editReply({ content: '❌ Appeal-Channel nicht gefunden.' });
    }

    const reason   = interaction.fields.getTextInputValue('appeal_reason');
    const argument = interaction.fields.getTextInputValue('appeal_argument');
    const promise  = interaction.fields.getTextInputValue('appeal_promise');

    // Appeal speichern
    const appeals = loadAppeals();
    if (!appeals[interaction.guild.id]) appeals[interaction.guild.id] = {};

    const appealId = `appeal_${Date.now()}`;
    appeals[interaction.guild.id][appealId] = {
      id:         appealId,
      userId:     interaction.user.id,
      username:   interaction.user.username,
      guildId:    interaction.guild.id,
      reason,
      argument,
      promise,
      status:     'pending',
      createdAt:  Date.now(),
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
    };
    saveAppeals(appeals);

    // Embed im Appeal-Channel posten
    const embed = new EmbedBuilder()
      .setTitle('📋 Neues Appeal')
      .setColor(0xf59e0b)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 User',          value: `<@${interaction.user.id}> (${interaction.user.username})`, inline: true },
        { name: '🆔 User-ID',       value: interaction.user.id, inline: true },
        { name: '📅 Eingereicht',   value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
        { name: '❓ Was passiert?', value: reason,   inline: false },
        { name: '⚖️ Argumente',    value: argument, inline: false },
        { name: '🤝 Versprechen',   value: promise,  inline: false },
      )
      .setFooter({ text: `Appeal ID: ${appealId}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`appeal_accept_${appealId}`)
        .setLabel('✅ Annehmen')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`appeal_deny_${appealId}`)
        .setLabel('❌ Ablehnen')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`appeal_pending_${appealId}`)
        .setLabel('⏳ In Bearbeitung')
        .setStyle(ButtonStyle.Secondary),
    );

    await appealChannel.send({ embeds: [embed], components: [row] });

    return interaction.editReply({
      content: '✅ Dein Appeal wurde erfolgreich eingereicht! Du wirst benachrichtigt sobald es bearbeitet wurde.',
    });
  },

  // ── Button Handler ────────────────────────────────────────────────────────

  async handleButton(interaction) {
    const [, action, appealId] = interaction.customId.split('_');

    if (!['accept', 'deny', 'pending'].includes(action)) return;

    // Nur Mods/Admins dürfen Appeals bearbeiten
    if (!interaction.member.permissions.has('ModerateMembers') &&
        !interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ Keine Berechtigung!', ephemeral: true });
    }

    // Note-Modal für Ablehnung/Annahme
    const modal = new ModalBuilder()
      .setCustomId(`appeal_review_${action}_${appealId}`)
      .setTitle(action === 'accept' ? 'Appeal annehmen' : action === 'deny' ? 'Appeal ablehnen' : 'Notiz hinzufügen');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('review_note')
          .setLabel('Notiz / Begründung (wird dem User gesendet)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(action !== 'pending')
          .setMaxLength(1000)
          .setPlaceholder(
            action === 'accept' ? 'z.B. Wir haben deinen Fall überprüft und...' :
            action === 'deny'   ? 'z.B. Nach Überprüfung haben wir entschieden...' :
            'Optionale Notiz...'
          )
      )
    );

    await interaction.showModal(modal);
  },

  // ── Review Modal Submit ───────────────────────────────────────────────────

  async handleReviewModal(interaction) {
    if (!interaction.customId.startsWith('appeal_review_')) return;

    const parts    = interaction.customId.split('_');
    const action   = parts[2]; // accept / deny / pending
    const appealId = parts.slice(3).join('_');
    const note     = interaction.fields.getTextInputValue('review_note') || '';

    await interaction.deferReply({ ephemeral: true });

    const appeals    = loadAppeals();
    const guildAppeals = appeals[interaction.guild.id] || {};
    const appeal     = guildAppeals[appealId];

    if (!appeal) {
      return interaction.editReply({ content: '❌ Appeal nicht gefunden.' });
    }

    // Status aktualisieren
    const statusMap = { accept: 'accepted', deny: 'denied', pending: 'pending' };
    appeal.status     = statusMap[action];
    appeal.reviewedBy = interaction.user.id;
    appeal.reviewedAt = Date.now();
    appeal.reviewNote = note;
    saveAppeals(appeals);

    // Original-Embed aktualisieren
    const colors  = { accepted: 0x22c55e, denied: 0xef4444, pending: 0xf59e0b };
    const labels  = { accepted: '✅ Angenommen', denied: '❌ Abgelehnt', pending: '⏳ In Bearbeitung' };

    try {
      const msg = interaction.message;
      if (msg) {
        const updatedEmbed = EmbedBuilder.from(msg.embeds[0])
          .setColor(colors[appeal.status])
          .setTitle(`${labels[appeal.status]} — Appeal`)
          .spliceFields(-1, 0, {
            name:   '📝 Entscheidung',
            value:  `**${labels[appeal.status]}** von <@${interaction.user.id}>\n${note || '_Keine Notiz_'}`,
            inline: false,
          });

        await msg.edit({ embeds: [updatedEmbed], components: [] });
      }
    } catch (e) {
      console.error('[Appeal] Embed-Update Fehler:', e.message);
    }

    // User per DM benachrichtigen
    try {
      const user = await interaction.client.users.fetch(appeal.userId);
      const dmEmbed = new EmbedBuilder()
        .setTitle(`Dein Appeal wurde ${labels[appeal.status].split(' ')[1]}`)
        .setColor(colors[appeal.status])
        .setDescription(
          `**Server:** ${interaction.guild.name}\n\n` +
          (note ? `**Begründung:**\n${note}` : '')
        )
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] }).catch(() => {});
    } catch { /* User hat DMs deaktiviert */ }

    return interaction.editReply({
      content: `✅ Appeal wurde als **${labels[appeal.status]}** markiert.`,
    });
  },
};
