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
  if (user.discriminator === "0" || !user.discriminator)
    return user.username || user.id;
  return user.username + "#" + user.discriminator;
}

function getCategoryInfo(category) {
  const categories = {
    support: {
      label: "Support",
      emoji: "SOS",
      color: 0x0099ff,
      description:
        "Du hast ein Problem oder brauchst Hilfe?\nUnser Support-Team ist fuer dich da!",
    },
    bug: {
      label: "Bug Report",
      emoji: "BUG",
      color: 0xff0000,
      description:
        "Danke fuer deinen Bug Report!\nBitte beschreibe das Problem so detailliert wie moeglich.",
    },
    frage: {
      label: "Frage",
      emoji: "FAQ",
      color: 0xffff00,
      description: "Du hast eine Frage?\nWir helfen dir gerne weiter!",
    },
    bewerbung: {
      label: "Bewerbung",
      emoji: "BEW",
      color: 0x00ff00,
      description:
        "Vielen Dank fuer deine Bewerbung!\nBitte beantworte alle Fragen ehrlich und ausfuehrlich.",
    },
    report: {
      label: "Report",
      emoji: "REP",
      color: 0xff6600,
      description:
        "Danke fuer deinen Report!\nBitte beschreibe den Vorfall mit allen relevanten Details.",
    },
    sonstiges: {
      label: "Sonstiges",
      emoji: "SON",
      color: 0x888888,
      description:
        "Du hast ein anderes Anliegen?\nKein Problem, beschreibe uns dein Anliegen!",
    },
  };
  return categories[category] || categories["sonstiges"];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-ticket")
    .setDescription("Ticket-System verwalten")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("panel")
        .setDescription("Erstellt das Ticket-Panel in diesem Channel"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Zeigt alle offenen Tickets an (nur Admins)"),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // --- Subcommand: list ---
    if (sub === "list") {
      const config = loadTicketConfig();
      const guildConfig = config[interaction.guild.id];

      if (!guildConfig || !guildConfig.activeTickets) {
        return interaction.reply({
          content: "Keine offenen Tickets vorhanden.",
          ephemeral: true,
        });
      }

      const activeTickets = Object.values(guildConfig.activeTickets);

      if (activeTickets.length === 0) {
        return interaction.reply({
          content: "Keine offenen Tickets vorhanden.",
          ephemeral: true,
        });
      }

      const ticketList = activeTickets
        .map(
          (t) =>
            "- Ticket #" +
            t.ticketNumber.toString().padStart(4, "0") +
            " | <#" +
            t.channelId +
            ">" +
            " | <@" +
            t.userId +
            ">" +
            " | " +
            t.categoryLabel +
            " | <t:" +
            Math.floor(t.createdAt / 1000) +
            ":R>",
        )
        .join("\n");

      const embed = new EmbedBuilder()
        .setTitle("Offene Tickets (" + activeTickets.length + ")")
        .setDescription(ticketList)
        .setColor(0x0099ff)
        .setTimestamp()
        .setFooter({ text: "Nur fuer Administratoren sichtbar" });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // --- Subcommand: panel ---
    const config = loadTicketConfig();
    const guildConfig = config[interaction.guild.id] || {};

    const titel = guildConfig.panelTitle || "Support Tickets";
    const beschreibung =
      guildConfig.panelDescription ||
      "Benoeligst du Hilfe? Waehle eine Kategorie aus dem Dropdown-Menue unten.\n\n" +
        "**So funktioniert es:**\n" +
        "- Waehle eine passende Kategorie aus\n" +
        "- Ein privater Channel wird fuer dich erstellt\n" +
        "- Beschreibe dein Anliegen\n" +
        "- Unser Team wird dir schnellstmoeglich helfen";

    const embed = new EmbedBuilder()
      .setTitle(titel)
      .setDescription(beschreibung)
      .setColor(0x0099ff)
      .setTimestamp()
      .setFooter({
        text: interaction.guild.name,
        iconURL: interaction.guild.iconURL(),
      });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("ticket_category_select")
      .setPlaceholder("Waehle eine Kategorie aus...")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Support")
          .setDescription("Allgemeine Hilfe und Support-Anfragen")
          .setValue("support"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Bug Report")
          .setDescription("Melde einen Bug oder technisches Problem")
          .setValue("bug"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Frage")
          .setDescription("Stelle eine allgemeine Frage")
          .setValue("frage"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Bewerbung")
          .setDescription("Bewerbung fuer das Team")
          .setValue("bewerbung"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Report")
          .setDescription("Melde einen Regelverstoss oder User")
          .setValue("report"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Sonstiges")
          .setDescription("Alles andere")
          .setValue("sonstiges"),
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({ embeds: [embed], components: [row] });

    const newConfig = loadTicketConfig();
    if (!newConfig[interaction.guild.id]) {
      newConfig[interaction.guild.id] = {
        categoryId: guildConfig.categoryId || null,
        supportRoleId: guildConfig.supportRoleId || null,
        panelTitle: titel,
        panelDescription: beschreibung,
        ticketCounter: 0,
        activeTickets: {},
      };
      saveTicketConfig(newConfig);
    }
  },

  async handleCreateTicket(interaction, category) {
    await interaction.deferReply({ flags: 64 });

    const config = loadTicketConfig();
    const guildConfig = config[interaction.guild.id];

    if (!guildConfig) {
      return interaction.editReply({
        content:
          "Ticket-System ist nicht konfiguriert! Ein Admin muss /setup-ticket ausfuehren.",
      });
    }

    const activeTickets = guildConfig.activeTickets || {};
    const userTicket = Object.values(activeTickets).find(
      (t) => t.userId === interaction.user.id,
    );

    if (userTicket) {
      return interaction.editReply({
        content:
          "Du hast bereits ein offenes Ticket: <#" + userTicket.channelId + ">",
      });
    }

    const categoryInfo = getCategoryInfo(category);

    try {
      guildConfig.ticketCounter = (guildConfig.ticketCounter || 0) + 1;
      const ticketNumber = guildConfig.ticketCounter;

      const channelName =
        "ticket-" + category + "-" + ticketNumber.toString().padStart(4, "0");

      const channelOptions = {
        name: channelName,
        type: ChannelType.GuildText,
        parent: guildConfig.categoryId || null,
        topic:
          categoryInfo.label +
          " Ticket von " +
          getUserDisplay(interaction.user) +
          " | User ID: " +
          interaction.user.id,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
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
        ],
      };

      if (guildConfig.supportRoleId) {
        channelOptions.permissionOverwrites.push({
          id: guildConfig.supportRoleId,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
          ],
        });
      }

      const ticketChannel =
        await interaction.guild.channels.create(channelOptions);

      const ticketEmbed = new EmbedBuilder()
        .setTitle(categoryInfo.label + " Ticket #" + ticketNumber)
        .setDescription(
          "Hallo <@" +
            interaction.user.id +
            ">,\n\n" +
            "Willkommen in deinem **" +
            categoryInfo.label +
            "** Ticket!\n\n" +
            categoryInfo.description +
            "\n\n" +
            "**Bitte beschreibe dein Anliegen so genau wie moeglich:**\n" +
            "- Was ist das Problem/Anliegen?\n" +
            "- Wann trat es auf?\n" +
            "- Screenshots/Beweise (falls vorhanden)\n\n" +
            "Unser Team wird sich schnellstmoeglich um dein Anliegen kuemmern.",
        )
        .setColor(categoryInfo.color)
        .setTimestamp()
        .setFooter({
          text: "Erstellt von " + getUserDisplay(interaction.user),
          iconURL: interaction.user.displayAvatarURL(),
        });

      const controlRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close_" + ticketChannel.id)
          .setLabel("Ticket schliessen")
          .setStyle(ButtonStyle.Danger),
      );

      const mentionContent = guildConfig.supportRoleId
        ? "<@&" + guildConfig.supportRoleId + "> <@" + interaction.user.id + ">"
        : "<@" + interaction.user.id + ">";

      await ticketChannel.send({
        content: mentionContent,
        embeds: [ticketEmbed],
        components: [controlRow],
      });

      activeTickets[ticketChannel.id] = {
        ticketNumber: ticketNumber,
        channelId: ticketChannel.id,
        userId: interaction.user.id,
        category: category,
        categoryLabel: categoryInfo.label,
        createdAt: Date.now(),
      };
      guildConfig.activeTickets = activeTickets;
      config[interaction.guild.id] = guildConfig;
      saveTicketConfig(config);

      await interaction.editReply({
        content:
          categoryInfo.label + " Ticket erstellt! <#" + ticketChannel.id + ">",
      });
    } catch (error) {
      console.error("[Ticket] Fehler beim Erstellen:", error);
      await interaction.editReply({
        content:
          "Fehler beim Erstellen des Tickets! Stelle sicher, dass der Bot die noetigen Berechtigungen hat.",
      });
    }
  },

  async handleCloseTicket(interaction) {
    const channelId = interaction.customId.split("_")[2];

    await interaction.deferReply();

    const config = loadTicketConfig();
    const guildConfig = config[interaction.guild.id];

    if (!guildConfig || !guildConfig.activeTickets[channelId]) {
      return interaction.editReply({
        content: "Dieses Ticket existiert nicht mehr im System.",
      });
    }

    const ticket = guildConfig.activeTickets[channelId];

    try {
      const closeEmbed = new EmbedBuilder()
        .setTitle("Ticket geschlossen")
        .setDescription(
          "Ticket **#" +
            ticket.ticketNumber +
            "** wurde geschlossen.\n\n" +
            "**Geschlossen von:** <@" +
            interaction.user.id +
            "> (" +
            getUserDisplay(interaction.user) +
            ")",
        )
        .setColor(0xff0000)
        .setTimestamp();

      // Transcript versuchen (optional)
      let transcriptEmbed = null;
      try {
        const transcriptCommand = require("./transcript");
        if (transcriptCommand && transcriptCommand.createTranscriptForTicket) {
          transcriptEmbed = await transcriptCommand.createTranscriptForTicket(
            interaction.channel,
            ticket,
          );
        }
      } catch (e) {
        console.log(
          "[Ticket] Kein Transcript-Modul gefunden, wird uebersprungen",
        );
      }

      const embeds = [closeEmbed];
      if (transcriptEmbed) embeds.push(transcriptEmbed);

      await interaction.editReply({
        embeds: embeds,
        content: "Ticket wird in 10 Sekunden geschlossen...",
      });

      delete guildConfig.activeTickets[channelId];
      config[interaction.guild.id] = guildConfig;
      saveTicketConfig(config);

      setTimeout(async () => {
        try {
          await interaction.channel.delete("Ticket geschlossen");
        } catch (err) {
          console.error(
            "[Ticket] Fehler beim Loeschen des Channels:",
            err.message,
          );
        }
      }, 10000);
    } catch (error) {
      console.error("[Ticket] Fehler beim Schliessen:", error);
      await interaction.editReply({
        content: "Fehler beim Schliessen des Tickets!",
      });
    }
  },
};
