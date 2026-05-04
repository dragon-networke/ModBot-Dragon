const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Hilfsfunktionen für JSON-Verwaltung
function loadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return {};
  }
}

function saveJson(filePath, data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Fehler beim Speichern:', e.message);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warnt einen User')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('Der User, der gewarnt werden soll')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('grund')
        .setDescription('Grund der Warnung')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('grund');
    
    try {
      const member = await interaction.guild.members.fetch(target.id);
    } catch (e) {
      return interaction.reply({ content: '❌ User nicht gefunden!', flags: 64 });
    }

    // Warn in Datenbank speichern (JSON)
    const warnings = loadJson(path.join(DATA_DIR, 'warnings.json'));
    if (!warnings[interaction.guild.id]) warnings[interaction.guild.id] = {};

    if (!warnings[interaction.guild.id][target.id]) {
      warnings[interaction.guild.id][target.id] = [];
    }

    warnings[interaction.guild.id][target.id].push({
      reason: reason,
      moderator: interaction.user.id,
      timestamp: Date.now()
    });

    const warnCount = warnings[interaction.guild.id][target.id].length;
    saveJson(path.join(DATA_DIR, 'warnings.json'), warnings);

    // Embed an User
    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle('⚠️ Du wurdest gewarnt!')
      .setDescription(`**Server:** ${interaction.guild.name}\n**Grund:** ${reason}\n**Verwarnungen:** ${warnCount}/3`)
      .setFooter({ text: `Warnung #${warnCount}` })
      .setTimestamp();

    try {
      await target.send({ embeds: [embed] });
    } catch (e) {
      // User hat DMs deaktiviert
    }

    // Antwort an Moderator
    const replyEmbed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle('⚠️ User verwarnt')
      .setDescription(`**User:** ${target.tag}\n**Grund:** ${reason}\n**Verwarnungen gesamt:** ${warnCount}/3`)
      .setTimestamp();

    // WENN 3. VERWARNUNG: Strafen-Panel zeigen
    if (warnCount === 3) {
      replyEmbed.setColor(0xff0000);
      replyEmbed.addFields({ name: '⚠️ Achtung!', value: '**3 Verwarnungen erreicht!** Wähle eine Strafe aus:' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`punish_mute_${target.id}`)
          .setLabel('🔇 Mute (24h)')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`punish_kick_${target.id}`)
          .setLabel('👢 Kick')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`punish_ban_${target.id}`)
          .setLabel('🔨 Ban')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`punish_timeout_${target.id}`)
          .setLabel('⏱️ Timeout (7d)')
          .setStyle(ButtonStyle.Danger)
      );

      return await interaction.reply({
        embeds: [replyEmbed],
        components: [row]
      });
    }

    await interaction.reply({
      embeds: [replyEmbed],
      flags: 64
    });
  }
};