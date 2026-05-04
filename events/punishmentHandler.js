const { EmbedBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Hilfsfunktionen
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

/**
 * Verarbeitet Strafen-Button-Interaktionen
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handlePunishment(interaction) {
  if (!interaction.customId.startsWith('punish_')) return;

  // Nur Mods/Admins dürfen Strafen verhängen
  if (!interaction.member.permissions.has('ModerateMembers')) {
    return interaction.reply({
      content: '❌ Du hast keine Berechtigung, Strafen zu verhängen!',
      flags: 64
    });
  }

  const [action, targetId] = interaction.customId.split('_').slice(1);
  
  try {
    const target = await interaction.guild.members.fetch(targetId);

    // Strafen-Historie laden/erstellen
    const punishmentsFile = path.join(DATA_DIR, 'punishments.json');
    const punishments = loadJson(punishmentsFile);
    if (!punishments[interaction.guild.id]) punishments[interaction.guild.id] = {};
    if (!punishments[interaction.guild.id][targetId]) punishments[interaction.guild.id][targetId] = [];

    const now = Date.now();
    let successMessage = '';
    const reason = '3 Verwarnungen erhalten';

    // Action ausführen
    if (action === 'mute') {
      // 24 Stunden Mute (Timeout)
      const duration = 24 * 60 * 60 * 1000; // 24h in ms
      await target.timeout(duration, reason);
      successMessage = `🔇 **${target.user.tag}** wurde **24 Stunden gemuted**`;
      
      punishments[interaction.guild.id][targetId].push({
        type: 'mute',
        duration: 24,
        moderator: interaction.user.id,
        timestamp: now,
        reason: reason
      });

    } else if (action === 'kick') {
      await target.kick(reason);
      successMessage = `👢 **${target.user.tag}** wurde **gekickt**`;
      
      punishments[interaction.guild.id][targetId].push({
        type: 'kick',
        moderator: interaction.user.id,
        timestamp: now,
        reason: reason
      });

    } else if (action === 'ban') {
      await interaction.guild.members.ban(targetId, { reason: reason });
      successMessage = `🔨 **${target.user.tag}** wurde **gebannt**`;
      
      punishments[interaction.guild.id][targetId].push({
        type: 'ban',
        moderator: interaction.user.id,
        timestamp: now,
        reason: reason
      });

    } else if (action === 'timeout') {
      // 7 Tage Timeout
      const duration = 7 * 24 * 60 * 60 * 1000; // 7d in ms
      await target.timeout(duration, reason);
      successMessage = `⏱️ **${target.user.tag}** hat einen **7-Tage Timeout**`;
      
      punishments[interaction.guild.id][targetId].push({
        type: 'timeout',
        duration: 7,
        moderator: interaction.user.id,
        timestamp: now,
        reason: reason
      });
    }

    // Strafen speichern
    saveJson(punishmentsFile, punishments);

    // Bestätigungs-Embed
    const confirmEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⚖️ Strafe verhängt')
      .setDescription(successMessage)
      .addFields(
        { name: 'Grund', value: reason },
        { name: 'Moderator', value: interaction.user.tag },
        { name: 'Zeitstempel', value: `<t:${Math.floor(now / 1000)}:F>` }
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [confirmEmbed]
    });

    // Log-Channel Nachricht (falls vorhanden)
    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (logChannelId) {
      const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
      if (logChannel && logChannel.isTextBased()) {
        await logChannel.send({ embeds: [confirmEmbed] });
      }
    }

  } catch (error) {
    console.error('Fehler bei Strafenverhängung:', error);
    await interaction.reply({
      content: `❌ Fehler beim Verhängen der Strafe: ${error.message}`,
      flags: 64
    });
  }
}

module.exports = { handlePunishment };
