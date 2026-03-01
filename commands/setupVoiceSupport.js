const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const CONFIG_FILE = path.join(process.cwd(), "data", "voiceSupport.json");

function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch (e) {
    return {};
  }
}

function saveConfig(config) {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error("[VoiceSupport] Fehler beim Speichern:", e.message);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setupvoicesupport")
    .setDescription("Voice-Support System einrichten")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Voice-Support einrichten")
        .addChannelOption((opt) =>
          opt
            .setName("wartekanal")
            .setDescription(
              "Der Sprachkanal dem User joinen um Support zu erhalten",
            )
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName("benachrichtigungskanal")
            .setDescription(
              "Text-Channel wo das Support-Team benachrichtigt wird",
            )
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addRoleOption((opt) =>
          opt
            .setName("supportrolle")
            .setDescription(
              "Rolle die Zugriff auf private Support-Kanaele bekommt",
            )
            .setRequired(false),
        )
        .addChannelOption((opt) =>
          opt
            .setName("kategorie")
            .setDescription("Kategorie in der private Kanaele erstellt werden")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("disable").setDescription("Voice-Support deaktivieren"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Aktuelle Voice-Support Einstellungen anzeigen"),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = loadConfig();

    if (sub === "setup") {
      const wartekanal = interaction.options.getChannel("wartekanal");
      const benachrichtigungskanal = interaction.options.getChannel(
        "benachrichtigungskanal",
      );
      const supportrolle = interaction.options.getRole("supportrolle");
      const kategorie = interaction.options.getChannel("kategorie");

      config[interaction.guild.id] = {
        enabled: true,
        supportChannelId: wartekanal.id,
        notifyChannelId: benachrichtigungskanal.id,
        supportRoleId: supportrolle ? supportrolle.id : null,
        categoryId: kategorie ? kategorie.id : null,
      };

      saveConfig(config);

      const embed = new EmbedBuilder()
        .setColor(0x51cf66)
        .setTitle("Voice-Support eingerichtet!")
        .addFields(
          {
            name: "Wartekanal",
            value: "<#" + wartekanal.id + ">",
            inline: true,
          },
          {
            name: "Benachrichtigungen",
            value: "<#" + benachrichtigungskanal.id + ">",
            inline: true,
          },
          {
            name: "Support-Rolle",
            value: supportrolle ? "<@&" + supportrolle.id + ">" : "Keine",
            inline: true,
          },
          {
            name: "Kategorie",
            value: kategorie ? "<#" + kategorie.id + ">" : "Keine",
            inline: true,
          },
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === "disable") {
      if (config[interaction.guild.id]) {
        config[interaction.guild.id].enabled = false;
        saveConfig(config);
      }

      const embed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle("Voice-Support deaktiviert")
        .setDescription("Das Voice-Support System wurde deaktiviert.")
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === "status") {
      const guildConfig = config[interaction.guild.id];

      if (!guildConfig) {
        return interaction.reply({
          content:
            "Voice-Support ist noch nicht eingerichtet. Nutze /setupvoicesupport setup",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(guildConfig.enabled ? 0x51cf66 : 0xff6b6b)
        .setTitle("Voice-Support Status")
        .addFields(
          {
            name: "Status",
            value: guildConfig.enabled ? "Aktiv" : "Deaktiviert",
            inline: true,
          },
          {
            name: "Wartekanal",
            value: "<#" + guildConfig.supportChannelId + ">",
            inline: true,
          },
          {
            name: "Benachrichtigungen",
            value: "<#" + guildConfig.notifyChannelId + ">",
            inline: true,
          },
          {
            name: "Support-Rolle",
            value: guildConfig.supportRoleId
              ? "<@&" + guildConfig.supportRoleId + ">"
              : "Keine",
            inline: true,
          },
          {
            name: "Kategorie",
            value: guildConfig.categoryId
              ? "<#" + guildConfig.categoryId + ">"
              : "Keine",
            inline: true,
          },
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
