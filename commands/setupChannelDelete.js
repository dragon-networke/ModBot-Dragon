const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(process.cwd(), 'data', 'channelDeleteConfig.json');

function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch (e) {
    return {};
  }
}

function saveConfig(config) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('[ChannelDelete] Fehler beim Speichern:', e.message);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-channeldelete')
    .setDescription('Channel-Delete Benachrichtigungen einrichten')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Log-Channel einrichten')
        .addChannelOption(opt =>
          opt.setName('logchannel')
            .setDescription('Channel in dem Benachrichtigungen gesendet werden')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('rolle')
            .setDescription('Rolle die gepingt wird (optional)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Benachrichtigungen deaktivieren')
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Aktuelle Einstellungen anzeigen')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = loadConfig();

    if (sub === 'setup') {
      const logChannel = interaction.options.getChannel('logchannel');
      const rolle = interaction.options.getRole('rolle');

      config[interaction.guild.id] = {
        enabled: true,
        logChannelId: logChannel.id,
        pingRoleId: rolle ? rolle.id : null,
      };
      saveConfig(config);

      const embed = new EmbedBuilder()
        .setColor(0x51cf66)
        .setTitle('Channel-Delete Setup abgeschlossen!')
        .addFields(
          { name: 'Log-Channel', value: '<#' + logChannel.id + '>', inline: true },
          { name: 'Ping-Rolle', value: rolle ? '<@&' + rolle.id + '>' : 'Keine', inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (sub === 'disable') {
      if (config[interaction.guild.id]) {
        config[interaction.guild.id].enabled = false;
        saveConfig(config);
      }
      await interaction.reply({ content: 'Channel-Delete Benachrichtigungen deaktiviert.', ephemeral: true });

    } else if (sub === 'status') {
      const guildConfig = config[interaction.guild.id];
      if (!guildConfig) {
        return interaction.reply({ content: 'Noch nicht eingerichtet. Nutze /setup-channeldelete setup', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(guildConfig.enabled ? 0x51cf66 : 0xff6b6b)
        .setTitle('Channel-Delete Status')
        .addFields(
          { name: 'Status', value: guildConfig.enabled ? 'Aktiv' : 'Deaktiviert', inline: true },
          { name: 'Log-Channel', value: '<#' + guildConfig.logChannelId + '>', inline: true },
          { name: 'Ping-Rolle', value: guildConfig.pingRoleId ? '<@&' + guildConfig.pingRoleId + '>' : 'Keine', inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
