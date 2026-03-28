const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  PermissionsBitField,
  ChannelType,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const dataPath = path.join(process.cwd(), "data", "tickets.json");

if (!fs.existsSync(path.dirname(dataPath))) {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
}

function loadTicketConfig() {
  if (!fs.existsSync(dataPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  } catch (e) {
    return {};
  }
}

function saveTicketConfig(config) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error("[Ticket] Fehler beim Speichern:", e.message);
  }
}

function getUserDisplay(user) {
  if (!user) return "Unbekannt";
  if (user.discriminator === "0" || !user.discriminator) return user.username || user.id;
  return user.username + "#" + user.discriminator;
}

function getCategoryInfo(category) {
  const categories = {
    support: { label: "Support", color: 0x0099ff, description: "Du hast ein Problem oder brauchst Hilfe?\nUnser Support-Team ist fuer dich da!" },
    bug:     { label: "Bug Report", color: 0xff0000, description: "Danke fuer deinen Bug Report!\nBitte beschreibe das Problem so detailliert wie moeglich." },
    frage:   { label: "Frage", color: 0xffff00, description: "Du hast eine Frage?\nWir helfen dir gerne weiter!" },
    bewerbung: { label: "Bewerbung", color: 0x00ff00, description: "Vielen Dank fuer deine Bewerbung!\nBitte beantworte alle Fragen ehrlich und ausfuehrlich." },
    report:  { label: "Report", color: 0xff6600, description: "Danke fuer deinen Report!\nBitte beschreibe den Vorfall mit allen relevanten Details." },
    sonstiges: { label: "Sonstiges", color: 0x888888, description: "Du hast ein anderes Anliegen?\nKein Problem, beschreibe uns dein Anliegen!" },
  };
  return categories[category] || categories["sonstiges"];
}

function getRolesForCategory(guildConfig, category) {
  const roles = [];
  if (guildConfig.supportRoleId) roles.push(guildConfig.supportRoleId);
  const categoryRoles = guildConfig.categoryRoles || {};
  if (categoryRoles[category]) {
    for (const roleId of categoryRoles[category]) {
      if (!roles.includes(roleId)) roles.push(roleId);
    }
  }
  return roles;
}

function ensureGuildConfig(config, guildId) {
  if (!config[guildId]) {
    config[guildId] = {
      categoryId: null,
      logChannelId: null,
      supportRoleId: null,
      panelTitle: "Support Tickets",
      panelDescription: null,
      ticketCounter: 0,
      activeTickets: {},
      categoryRoles: {},
    };
  }
  return config[guildId];
}

const CATEGORY_CHOICES = [
  { name: "Support",   value: "support" },
  { name: "Bug Report", value: "bug" },
  { name: "Frage",     value: "frage" },
  { name: "Bewerbung", value: "bewerbung" },
  { name: "Report",    value: "report" },
  { name: "Sonstiges", value: "sonstiges" },
  { name: "Alle Kategorien (globale Support-Rolle)", value: "all" },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-ticket")
    .setDescription("Ticket-System verwalten")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)

    // panel
    .addSubcommand((sub) =>
      sub.setName("panel").setDescription("Erstellt das Ticket-Panel in diesem Channel")
    )

    // list
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Zeigt alle offenen Tickets an")
    )

    // setrole
    .addSubcommand((sub) =>
      sub.setName("setrole")
        .setDescription("Weist einer Ticket-Kategorie eine Rolle zu")
        .addRoleOption((o) => o.setName("rolle").setDescription("Rolle die Zugriff erhalten soll").setRequired(true))
        .addStringOption((o) => o.setName("kategorie").setDescription("Welche Kategorie?").setRequired(true).addChoices(...CATEGORY_CHOICES))
    )

    // removerole
    .addSubcommand((sub) =>
      sub.setName("removerole")
        .setDescription("Entfernt eine Rolle von einer Ticket-Kategorie")
        .addRoleOption((o) => o.setName("rolle").setDescription("Rolle die entfernt werden soll").setRequired(true))
        .addStringOption((o) => o.setName("kategorie").setDescription("Von welcher Kategorie?").setRequired(true).addChoices(...CATEGORY_CHOICES))
    )

    // roles
    .addSubcommand((sub) =>
      sub.setName("roles").setDescription("Zeigt alle konfigurierten Kategorie-Rollen")
    )

    // setlogchannel
    .addSubcommand((sub) =>
      sub.setName("setlogchannel")
        .setDescription("Setzt den Log-Channel fuer Ticket-Ereignisse")
        .addChannelOption((o) =>
          o.setName("channel").setDescription("Der Channel fuer Ticket-Logs").setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )

    // setcategory
    .addSubcommand((sub) =>
      sub.setName("setcategory")
        .setDescription("Setzt die Discord-Kategorie in der Ticket-Channels erstellt werden")
        .addChannelOption((o) =>
          o.setName("kategorie").setDescription("Die Discord-Kategorie").setRequired(true)
            .addChannelTypes(ChannelType.GuildCategory)
        )
    )

    // setpanel
    .addSubcommand((sub) =>
      sub.setName("setpanel")
        .setDescription("Aendert Titel und Beschreibung des Ticket-Panels")
        .addStringOption((o) => o.setName("titel").setDescription("Neuer Panel-Titel").setRequired(true))
        .addStringOption((o) => o.setName("beschreibung").setDescription("Neue Panel-Beschreibung").setRequired(false))
    )

    // settranscriptchannel
    .addSubcommand((sub) =>
      sub.setName("settranscriptchannel")
        .setDescription("Setzt den Channel in dem Ticket-Transcripts gepostet werden")
        .addChannelOption((o) =>
          o.setName("channel").setDescription("Der Channel fuer Transcripts").setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )

    // config
    .addSubcommand((sub) =>
      sub.setName("config").setDescription("Zeigt die aktuelle Ticket-Konfiguration an")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = loadTicketConfig();
    const guildId = interaction.guild.id;

    // ── list ─────────────────────────────────────────────────────────────────
    if (sub === "list") {
      const guildConfig = config[guildId];
      if (!guildConfig?.activeTickets || Object.keys(guildConfig.activeTickets).length === 0) {
        return interaction.reply({ content: "Keine offenen Tickets vorhanden.", ephemeral: true });
      }
      const activeTickets = Object.values(guildConfig.activeTickets);
      const ticketList = activeTickets.map((t) =>
        `- Ticket #${t.ticketNumber.toString().padStart(4, "0")} | <#${t.channelId}> | <@${t.userId}> | ${t.categoryLabel} | <t:${Math.floor(t.createdAt / 1000)}:R>`
      ).join("\n");
      const embed = new EmbedBuilder()
        .setTitle(`Offene Tickets (${activeTickets.length})`)
        .setDescription(ticketList)
        .setColor(0x0099ff).setTimestamp()
        .setFooter({ text: "Nur fuer Administratoren sichtbar" });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── setrole ───────────────────────────────────────────────────────────────
    if (sub === "setrole") {
      const role = interaction.options.getRole("rolle");
      const category = interaction.options.getString("kategorie");
      const guildConfig = ensureGuildConfig(config, guildId);

      if (category === "all") {
        guildConfig.supportRoleId = role.id;
        config[guildId] = guildConfig;
        saveTicketConfig(config);
        return interaction.reply({
          content: `Rolle <@&${role.id}> ist jetzt die **globale Support-Rolle** und sieht alle Ticket-Kategorien.`,
          ephemeral: true,
        });
      }

      if (!guildConfig.categoryRoles) guildConfig.categoryRoles = {};
      if (!guildConfig.categoryRoles[category]) guildConfig.categoryRoles[category] = [];
      if (!guildConfig.categoryRoles[category].includes(role.id)) {
        guildConfig.categoryRoles[category].push(role.id);
      }
      config[guildId] = guildConfig;
      saveTicketConfig(config);
      return interaction.reply({
        content: `Rolle <@&${role.id}> kann jetzt **${getCategoryInfo(category).label}** Tickets sehen.`,
        ephemeral: true,
      });
    }

    // ── removerole ────────────────────────────────────────────────────────────
    if (sub === "removerole") {
      const role = interaction.options.getRole("rolle");
      const category = interaction.options.getString("kategorie");
      const guildConfig = config[guildId];
      if (!guildConfig) return interaction.reply({ content: "Ticket-System nicht konfiguriert.", ephemeral: true });

      if (category === "all") {
        if (guildConfig.supportRoleId === role.id) {
          guildConfig.supportRoleId = null;
          config[guildId] = guildConfig;
          saveTicketConfig(config);
          return interaction.reply({ content: `Rolle <@&${role.id}> wurde als globale Support-Rolle entfernt.`, ephemeral: true });
        }
        return interaction.reply({ content: "Diese Rolle ist nicht als globale Support-Rolle gesetzt.", ephemeral: true });
      }

      const roles = guildConfig.categoryRoles?.[category] || [];
      if (!roles.includes(role.id)) {
        return interaction.reply({ content: `Diese Rolle ist **${getCategoryInfo(category).label}** nicht zugewiesen.`, ephemeral: true });
      }
      guildConfig.categoryRoles[category] = roles.filter((id) => id !== role.id);
      config[guildId] = guildConfig;
      saveTicketConfig(config);
      return interaction.reply({
        content: `Rolle <@&${role.id}> wurde von **${getCategoryInfo(category).label}** Tickets entfernt.`,
        ephemeral: true,
      });
    }

    // ── roles ─────────────────────────────────────────────────────────────────
    if (sub === "roles") {
      const guildConfig = config[guildId];
      if (!guildConfig) return interaction.reply({ content: "Ticket-System nicht konfiguriert.", ephemeral: true });
      const categoryRoles = guildConfig.categoryRoles || {};
      const allCats = ["support", "bug", "frage", "bewerbung", "report", "sonstiges"];
      let desc = guildConfig.supportRoleId
        ? `**Globale Support-Rolle (alle Kategorien):**\n<@&${guildConfig.supportRoleId}>\n\n`
        : "**Globale Support-Rolle:** Nicht gesetzt\n\n";
      desc += "**Kategorie-spezifische Rollen:**\n";
      for (const cat of allCats) {
        const roles = categoryRoles[cat] || [];
        desc += `**${getCategoryInfo(cat).label}:** ${roles.length > 0 ? roles.map((id) => `<@&${id}>`).join(", ") : "_Keine_"}\n`;
      }
      const embed = new EmbedBuilder().setTitle("Ticket Rollen-Konfiguration").setDescription(desc).setColor(0x0099ff).setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── setlogchannel ─────────────────────────────────────────────────────────
    if (sub === "setlogchannel") {
      const channel = interaction.options.getChannel("channel");
      const guildConfig = ensureGuildConfig(config, guildId);
      guildConfig.logChannelId = channel.id;
      config[guildId] = guildConfig;
      saveTicketConfig(config);
      return interaction.reply({ content: `Log-Channel wurde auf ${channel} gesetzt.`, ephemeral: true });
    }

    // ── setcategory ───────────────────────────────────────────────────────────
    if (sub === "setcategory") {
      const category = interaction.options.getChannel("kategorie");
      const guildConfig = ensureGuildConfig(config, guildId);
      guildConfig.categoryId = category.id;
      config[guildId] = guildConfig;
      saveTicketConfig(config);
      return interaction.reply({ content: `Ticket-Channels werden jetzt in **${category.name}** erstellt.`, ephemeral: true });
    }

    // ── setpanel ──────────────────────────────────────────────────────────────
    if (sub === "setpanel") {
      const titel = interaction.options.getString("titel");
      const beschreibung = interaction.options.getString("beschreibung");
      const guildConfig = ensureGuildConfig(config, guildId);
      guildConfig.panelTitle = titel;
      if (beschreibung) guildConfig.panelDescription = beschreibung;
      config[guildId] = guildConfig;
      saveTicketConfig(config);
      return interaction.reply({ content: `Panel-Titel wurde auf **${titel}** gesetzt.`, ephemeral: true });
    }

    // ── settranscriptchannel ──────────────────────────────────────────────────
    if (sub === "settranscriptchannel") {
      const channel = interaction.options.getChannel("channel");
      const guildConfig = ensureGuildConfig(config, guildId);
      guildConfig.transcriptChannelId = channel.id;
      config[guildId] = guildConfig;
      saveTicketConfig(config);
      return interaction.reply({ content: `Transcript-Channel wurde auf ${channel} gesetzt.`, ephemeral: true });
    }

    // ── config ────────────────────────────────────────────────────────────────
    if (sub === "config") {
      const guildConfig = config[guildId];
      if (!guildConfig) return interaction.reply({ content: "Ticket-System nicht konfiguriert.", ephemeral: true });
      const embed = new EmbedBuilder()
        .setTitle("Ticket-System Konfiguration")
        .setColor(0x0099ff)
        .addFields(
          { name: "📁 Ticket-Kategorie", value: guildConfig.categoryId ? `<#${guildConfig.categoryId}>` : "_Nicht gesetzt_", inline: true },
          { name: "📋 Log-Channel", value: guildConfig.logChannelId ? `<#${guildConfig.logChannelId}>` : "_Nicht gesetzt_", inline: true },
          { name: "📜 Transcript-Channel", value: guildConfig.transcriptChannelId ? `<#${guildConfig.transcriptChannelId}>` : "_Nicht gesetzt_", inline: true },
          { name: "👮 Globale Support-Rolle", value: guildConfig.supportRoleId ? `<@&${guildConfig.supportRoleId}>` : "_Nicht gesetzt_", inline: true },
          { name: "🎫 Panel-Titel", value: guildConfig.panelTitle || "_Standard_", inline: true },
          { name: "🔢 Tickets gesamt", value: String(guildConfig.ticketCounter || 0), inline: true },
          { name: "📂 Offene Tickets", value: String(Object.keys(guildConfig.activeTickets || {}).length), inline: true },
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── panel ─────────────────────────────────────────────────────────────────
    const guildConfig = ensureGuildConfig(config, guildId);
    const titel = guildConfig.panelTitle || "Support Tickets";
    const beschreibung = guildConfig.panelDescription ||
      "Benoeligst du Hilfe? Waehle eine Kategorie aus dem Dropdown-Menue unten.\n\n" +
      "**So funktioniert es:**\n" +
      "- Waehle eine passende Kategorie aus\n" +
      "- Ein privater Channel wird fuer dich erstellt\n" +
      "- Beschreibe dein Anliegen\n" +
      "- Unser Team wird dir schnellstmoeglich helfen";

    const embed = new EmbedBuilder()
      .setTitle(titel).setDescription(beschreibung).setColor(0x0099ff).setTimestamp()
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("ticket_category_select")
      .setPlaceholder("Waehle eine Kategorie aus...")
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel("Support").setDescription("Allgemeine Hilfe und Support-Anfragen").setValue("support"),
        new StringSelectMenuOptionBuilder().setLabel("Bug Report").setDescription("Melde einen Bug oder technisches Problem").setValue("bug"),
        new StringSelectMenuOptionBuilder().setLabel("Frage").setDescription("Stelle eine allgemeine Frage").setValue("frage"),
        new StringSelectMenuOptionBuilder().setLabel("Bewerbung").setDescription("Bewerbung fuer das Team").setValue("bewerbung"),
        new StringSelectMenuOptionBuilder().setLabel("Report").setDescription("Melde einen Regelverstoss oder User").setValue("report"),
        new StringSelectMenuOptionBuilder().setLabel("Sonstiges").setDescription("Alles andere").setValue("sonstiges"),
      );

    await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
    config[guildId] = guildConfig;
    saveTicketConfig(config);
  },

  async handleCreateTicket(interaction, category) {
    await interaction.deferReply({ flags: 64 });
    const config = loadTicketConfig();
    const guildConfig = config[interaction.guild.id];

    if (!guildConfig) {
      return interaction.editReply({ content: "Ticket-System ist nicht konfiguriert! Ein Admin muss /setup-ticket panel ausfuehren." });
    }

    const activeTickets = guildConfig.activeTickets || {};
    const userTicket = Object.values(activeTickets).find((t) => t.userId === interaction.user.id);
    if (userTicket) {
      return interaction.editReply({ content: `Du hast bereits ein offenes Ticket: <#${userTicket.channelId}>` });
    }

    const categoryInfo = getCategoryInfo(category);
    const allowedRoles = getRolesForCategory(guildConfig, category);

    try {
      guildConfig.ticketCounter = (guildConfig.ticketCounter || 0) + 1;
      const ticketNumber = guildConfig.ticketCounter;
      const channelName = `ticket-${category}-${ticketNumber.toString().padStart(4, "0")}`;

      const permissionOverwrites = [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.AttachFiles,
            PermissionsBitField.Flags.EmbedLinks,
          ],
        },
        {
          id: interaction.client.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageChannels,
          ],
        },
      ];

      for (const roleId of allowedRoles) {
        permissionOverwrites.push({
          id: roleId,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
          ],
        });
      }

      const ticketChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: guildConfig.categoryId || null,
        topic: `${categoryInfo.label} Ticket von ${getUserDisplay(interaction.user)} | User ID: ${interaction.user.id}`,
        permissionOverwrites,
      });

      const ticketEmbed = new EmbedBuilder()
        .setTitle(`${categoryInfo.label} Ticket #${ticketNumber}`)
        .setDescription(
          `Hallo <@${interaction.user.id}>,\n\nWillkommen in deinem **${categoryInfo.label}** Ticket!\n\n${categoryInfo.description}\n\n` +
          `**Bitte beschreibe dein Anliegen so genau wie moeglich:**\n- Was ist das Problem/Anliegen?\n- Wann trat es auf?\n- Screenshots/Beweise (falls vorhanden)\n\nUnser Team wird sich schnellstmoeglich um dein Anliegen kuemmern.`
        )
        .setColor(categoryInfo.color).setTimestamp()
        .setFooter({ text: `Erstellt von ${getUserDisplay(interaction.user)}`, iconURL: interaction.user.displayAvatarURL() });

      const controlRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_close_${ticketChannel.id}`)
          .setLabel("Ticket schliessen")
          .setStyle(ButtonStyle.Danger)
      );

      let mentionContent = `<@${interaction.user.id}>`;
      for (const roleId of allowedRoles) mentionContent = `<@&${roleId}> ${mentionContent}`;

      await ticketChannel.send({ content: mentionContent, embeds: [ticketEmbed], components: [controlRow] });

      // Log-Channel Benachrichtigung
      if (guildConfig.logChannelId) {
        try {
          const logChannel = await interaction.guild.channels.fetch(guildConfig.logChannelId);
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle("🎫 Neues Ticket erstellt")
              .setColor(categoryInfo.color)
              .addFields(
                { name: "👤 User", value: `<@${interaction.user.id}> (${getUserDisplay(interaction.user)})`, inline: true },
                { name: "📂 Kategorie", value: categoryInfo.label, inline: true },
                { name: "🔢 Ticket #", value: ticketNumber.toString().padStart(4, "0"), inline: true },
                { name: "📍 Channel", value: `<#${ticketChannel.id}>`, inline: true },
              )
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
          }
        } catch (e) {
          console.error("[Ticket] Log-Channel Fehler:", e.message);
        }
      }

      activeTickets[ticketChannel.id] = {
        ticketNumber, channelId: ticketChannel.id,
        userId: interaction.user.id,
        category, categoryLabel: categoryInfo.label,
        createdAt: Date.now(),
      };
      guildConfig.activeTickets = activeTickets;
      config[interaction.guild.id] = guildConfig;
      saveTicketConfig(config);

      await interaction.editReply({ content: `${categoryInfo.label} Ticket erstellt! <#${ticketChannel.id}>` });
    } catch (error) {
      console.error("[Ticket] Fehler beim Erstellen:", error);
      await interaction.editReply({ content: "Fehler beim Erstellen des Tickets! Stelle sicher, dass der Bot die noetigen Berechtigungen hat." });
    }
  },

  async handleCloseTicket(interaction) {
    const channelId = interaction.customId.split("_")[2];
    await interaction.deferReply();
    const config = loadTicketConfig();
    const guildConfig = config[interaction.guild.id];

    if (!guildConfig?.activeTickets[channelId]) {
      return interaction.editReply({ content: "Dieses Ticket existiert nicht mehr im System." });
    }

    const ticket = guildConfig.activeTickets[channelId];

    try {
      // ── Alle Nachrichten sammeln ────────────────────────────────────────
      let messages = [];
      try {
        let lastId = null;
        while (true) {
          const opts = { limit: 100 };
          if (lastId) opts.before = lastId;
          const batch = await interaction.channel.messages.fetch(opts);
          if (batch.size === 0) break;
          messages = messages.concat([...batch.values()]);
          lastId = batch.last().id;
          if (batch.size < 100) break;
        }
        messages.reverse(); // aelteste zuerst
        // Bot-System-Nachrichten rausfiltern (nur reine Embed-Nachrichten ohne Text)
        messages = messages.filter(m => !(m.author.bot && !m.content && m.embeds.length > 0 && m.attachments.size === 0));
      } catch (e) {
        console.error("[Ticket] Fehler beim Laden der Nachrichten:", e.message);
      }

      const categoryColors = {
        support: 0x5865f2, bug: 0xed4245, frage: 0xfaa61a,
        bewerbung: 0x23c45e, report: 0xff6600, sonstiges: 0x888888,
      };
      const accentColor = categoryColors[ticket.category] || 0x5865f2;
      const ticketNum = ticket.ticketNumber.toString().padStart(4, "0");

      // ── Close-Embed im Ticket-Channel ───────────────────────────────────
      const closeEmbed = new EmbedBuilder()
        .setTitle("🔒 Ticket geschlossen")
        .setDescription(
          `Ticket **#${ticketNum}** wurde geschlossen.\n\n` +
          `**Geschlossen von:** <@${interaction.user.id}> (${getUserDisplay(interaction.user)})`
        )
        .setColor(0xff0000)
        .setTimestamp();

      await interaction.editReply({
        content: "Ticket wird in 10 Sekunden geschlossen...",
        embeds: [closeEmbed],
      });

      // ── Log-Channel ─────────────────────────────────────────────────────
      if (guildConfig.logChannelId) {
        try {
          const logChannel = await interaction.guild.channels.fetch(guildConfig.logChannelId);
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle("🔒 Ticket geschlossen")
              .setColor(0xff0000)
              .addFields(
                { name: "🎫 Ticket #", value: ticketNum, inline: true },
                { name: "📂 Kategorie", value: ticket.categoryLabel, inline: true },
                { name: "💬 Nachrichten", value: String(messages.length), inline: true },
                { name: "👤 Erstellt von", value: `<@${ticket.userId}>`, inline: true },
                { name: "👮 Geschlossen von", value: `<@${interaction.user.id}>`, inline: true },
                { name: "⏱️ Erstellt", value: `<t:${Math.floor(ticket.createdAt / 1000)}:R>`, inline: true },
              )
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
          }
        } catch (e) {
          console.error("[Ticket] Log-Channel Fehler:", e.message);
        }
      }

      // ── Transcript-Channel ───────────────────────────────────────────────
      if (guildConfig.transcriptChannelId) {
        try {
          const transcriptChannel = await interaction.guild.channels.fetch(guildConfig.transcriptChannelId);
          if (transcriptChannel) {
            // Header-Embed
            const headerEmbed = new EmbedBuilder()
              .setTitle(`📜 Transcript – Ticket #${ticketNum}`)
              .setColor(accentColor)
              .addFields(
                { name: "📂 Kategorie", value: ticket.categoryLabel, inline: true },
                { name: "👤 Erstellt von", value: `<@${ticket.userId}>`, inline: true },
                { name: "👮 Geschlossen von", value: `<@${interaction.user.id}>`, inline: true },
                { name: "💬 Nachrichten", value: String(messages.length), inline: true },
                { name: "📅 Erstellt", value: `<t:${Math.floor(ticket.createdAt / 1000)}:F>`, inline: true },
                { name: "🔒 Geschlossen", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
              )
              .setTimestamp()
              .setFooter({ text: `Ticket #${ticketNum} · ${ticket.categoryLabel}` });

            await transcriptChannel.send({ embeds: [headerEmbed] });

            // Nachrichten in Chunks aufteilen (max 10 pro Embed wegen Discord-Limit)
            const CHUNK_SIZE = 10;
            const userMessages = messages.slice(0, 100); // max 100 Nachrichten im Transcript

            for (let i = 0; i < userMessages.length; i += CHUNK_SIZE) {
              const chunk = userMessages.slice(i, i + CHUNK_SIZE);

              const msgEmbed = new EmbedBuilder()
                .setColor(accentColor)
                .setDescription(
                  chunk.map(m => {
                    const time = `<t:${Math.floor(m.createdTimestamp / 1000)}:T>`;
                    const author = `**${getUserDisplay(m.author)}**${m.author.bot ? " 🤖" : ""}`;
                    let text = m.content ? m.content.substring(0, 300) : "";
                    if (m.attachments.size > 0) text += `\n📎 ${[...m.attachments.values()].map(a => `[${a.name}](${a.url})`).join(", ")}`;
                    if (m.embeds.length > 0 && !m.content) text = "_[Embed]_";
                    if (!text) text = "_[Leere Nachricht]_";
                    return `${time} ${author}\n${text}`;
                  }).join("\n\n")
                );

              if (i + CHUNK_SIZE >= userMessages.length) {
                msgEmbed.setFooter({ text: `Ende des Transcripts · ${userMessages.length} Nachrichten` });
              }

              await transcriptChannel.send({ embeds: [msgEmbed] });

              // Kurze Pause um Rate Limits zu vermeiden
              if (i + CHUNK_SIZE < userMessages.length) {
                await new Promise(r => setTimeout(r, 500));
              }
            }

            if (messages.length === 0) {
              await transcriptChannel.send({
                embeds: [new EmbedBuilder().setColor(accentColor).setDescription("_Keine Nachrichten im Ticket._")]
              });
            }
          }
        } catch (e) {
          console.error("[Ticket] Transcript-Channel Fehler:", e.message);
        }
      }

      // ── Transcript in Datei speichern ──────────────────────────────────
      try {
        const transcriptPath = path.join(process.cwd(), "data", "transcripts.json");
        const transcripts = fs.existsSync(transcriptPath)
          ? JSON.parse(fs.readFileSync(transcriptPath, "utf-8"))
          : {};

        if (!transcripts[interaction.guild.id]) transcripts[interaction.guild.id] = {};

        transcripts[interaction.guild.id][ticket.ticketNumber] = {
          ticketNumber: ticket.ticketNumber,
          userId:       ticket.userId,
          username:     interaction.guild.members.cache.get(ticket.userId)?.user?.username || ticket.userId,
          category:     ticket.category,
          categoryLabel: ticket.categoryLabel,
          guildId:      interaction.guild.id,
          createdAt:    ticket.createdAt,
          closedAt:     Date.now(),
          closedBy:     getUserDisplay(interaction.user),
          closedById:   interaction.user.id,
          messageCount: messages.length,
          messages:     messages.slice(0, 100).map(m => ({
            id:        m.id,
            userId:    m.author.id,
            username:  getUserDisplay(m.author),
            content:   m.content || "",
            timestamp: m.createdTimestamp,
            attachments: [...m.attachments.values()].map(a => ({ name: a.name, url: a.url })),
          })),
        };

        fs.writeFileSync(transcriptPath, JSON.stringify(transcripts, null, 2));
        console.log("[Ticket] Transcript gespeichert: #" + ticketNum);
      } catch (e) {
        console.error("[Ticket] Transcript-Speichern Fehler:", e.message);
      }

      // ── Config aktualisieren & Channel loeschen ─────────────────────────
      delete guildConfig.activeTickets[channelId];
      config[interaction.guild.id] = guildConfig;
      saveTicketConfig(config);

      setTimeout(async () => {
        try { await interaction.channel.delete("Ticket geschlossen"); }
        catch (err) { console.error("[Ticket] Fehler beim Loeschen:", err.message); }
      }, 10000);

    } catch (error) {
      console.error("[Ticket] Fehler beim Schliessen:", error);
      await interaction.editReply({ content: "Fehler beim Schliessen des Tickets!" });
    }
  },
};