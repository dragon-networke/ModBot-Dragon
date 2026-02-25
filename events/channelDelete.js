const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AuditLogEvent, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const antiNukeHandler = require('./antiNukeHandler');

const pendingDeletions = new Map();
const pendingDeletionsPath = path.join(process.cwd(), 'data/pendingDeletions.json');

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function savePendingDeletions() {
  try {
    fs.writeFileSync(pendingDeletionsPath, JSON.stringify(Array.from(pendingDeletions.entries()), null, 2));
  } catch (e) {
    console.error('Fehler beim Speichern von pendingDeletions:', e);
  }
}

function loadPendingDeletions() {
  if (!fs.existsSync(pendingDeletionsPath)) return;
  try {
    const arr = JSON.parse(fs.readFileSync(pendingDeletionsPath, 'utf-8'));
    for (const [key, value] of arr) {
      pendingDeletions.set(key, value);
    }
    console.log('[DEBUG] pendingDeletions geladen, ' + pendingDeletions.size + ' Eintraege');
  } catch (e) {
    console.error('Fehler beim Laden von pendingDeletions:', e);
  }
}

function getUserDisplay(user) {
  if (!user) return 'Unbekannt';
  if (user.discriminator === '0' || !user.discriminator) {
    return user.username || user.id;
  }
  return user.username + '#' + user.discriminator;
}

loadPendingDeletions();

module.exports = {
  name: 'channelDelete',
  async execute(channel) {
    // Anti-Nuke ZUERST (Ban/Timeout)
    console.log('[DEBUG] antiNukeHandler.handleChannelDelete wird aufgerufen...');
    try {
      await antiNukeHandler.handleChannelDelete(channel);
      console.log('[DEBUG] antiNukeHandler.handleChannelDelete fertig');
    } catch (err) {
      console.error('[ERROR] Fehler in antiNukeHandler:', err);
    }

    // Dann DM senden
    console.log('[DEBUG] channelDeleteHandler.execute wird aufgerufen...');
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('channel_delete_restore_' + channel.id)
          .setLabel('Rueckgaengig machen')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('channel_delete_acknowledge_' + channel.id)
          .setLabel('Zur Kenntnis genommen')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('channel_delete_investigate_' + channel.id)
          .setLabel('Untersuchen')
          .setStyle(ButtonStyle.Primary)
      );

    if (!channel.guild) return;

    try {
      const auditLogs = await channel.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelDelete,
      });

      const deleteLog = auditLogs.entries.first();
      if (!deleteLog) return;

      const executor = deleteLog.executor;
      const target = deleteLog.target;

      if (target.id !== channel.id) return;

      const executorDisplay = getUserDisplay(executor);

      const embed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle('Channel geloescht')
        .setDescription('Channel **' + channel.name + '** wurde geloescht.')
        .addFields(
          { name: 'Von', value: '<@' + executor.id + '> (' + executorDisplay + ')', inline: true },
          { name: 'Zeit', value: '<t:' + Math.floor(Date.now() / 1000) + ':F>', inline: true }
        )
        .setFooter({ text: 'Server: ' + channel.guild.name })
        .setTimestamp();

      const owner = await channel.guild.fetchOwner();

      let notifyUsers = ['1182731753144713338', '1018236519204532345'];
      let notifyRoles = ['1351950370917580885'];
      try {
        const setupLogging = require('../commands/setupLogging');
        const config = setupLogging && setupLogging.loadLoggingConfig ? setupLogging.loadLoggingConfig() : null;
        const guildConfig = config && config[channel.guild.id] ? config[channel.guild.id] : null;
        if (guildConfig && guildConfig.channel) {
          notifyUsers = guildConfig.channel.notifyUsers || notifyUsers;
          notifyRoles = guildConfig.channel.notifyRoles || notifyRoles;
        }
      } catch (e) {
        console.error('Fehler beim Laden der Benachrichtigungsliste:', e);
      }

      try {
        const dmMessage = await owner.send({
          embeds: [embed],
          components: [row]
        });
        pendingDeletions.set(channel.id, {
          messageId: dmMessage.id,
          channelInfo: {
            name: channel.name,
            id: channel.id,
            type: channel.type,
            guildId: channel.guild.id,
            guildName: channel.guild.name,
            position: channel.position,
            topic: channel.topic || null,
            nsfw: channel.nsfw || false,
            rateLimitPerUser: channel.rateLimitPerUser || 0,
            parentId: channel.parentId || null,
            permissionOverwrites: channel.permissionOverwrites?.cache.map(overwrite => ({
              id: overwrite.id,
              type: overwrite.type,
              allow: overwrite.allow.bitfield.toString(),
              deny: overwrite.deny.bitfield.toString(),
            })) || [],
          },
          executor: {
            id: executor.id,
            tag: executorDisplay,
          },
          timestamp: Date.now(),
        });
        savePendingDeletions();
        console.log('[INFO] DM an ' + getUserDisplay(owner.user) + ' gesendet fuer geloeschten Channel: ' + channel.name);
      } catch (error) {
        console.error('[ERROR] Konnte keine DM an ' + getUserDisplay(owner.user) + ' senden:', error.message);
      }

      for (const userId of notifyUsers) {
        if (userId === owner.id) continue;
        try {
          const member = await channel.guild.members.fetch(userId);
          await member.send({ embeds: [embed], components: [row] });
          console.log('[INFO] DM an ' + getUserDisplay(member.user) + ' gesendet fuer geloeschten Channel: ' + channel.name);
        } catch (error) {
          console.error('[ERROR] Konnte keine DM an ' + userId + ' senden:', error.message);
        }
      }

      try {
        const logChannel = channel.guild.channels.cache.find(
          ch => ch.name === 'logs' || ch.name === 'mod-logs' || ch.name === 'admin-logs'
        );
        let mentionString = '';
        if (notifyUsers.length > 0) {
          mentionString += notifyUsers.map(id => '<@' + id + '>').join(' ');
        }
        if (notifyRoles.length > 0) {
          mentionString += ' ' + notifyRoles.map(id => '<@&' + id + '>').join(' ');
        }
        mentionString = mentionString.trim();
        if (logChannel) {
          if (mentionString.length > 0) {
            await logChannel.send({ content: mentionString, embeds: [embed] }).catch(console.error);
          } else {
            await logChannel.send({ embeds: [embed] }).catch(console.error);
          }
        }
      } catch (e) {
        console.error('Fehler beim Benachrichtigen im Log-Channel:', e);
      }

    } catch (error) {
      console.error('Fehler beim Channel-Delete Event:', error);
    }
    console.log('[DEBUG] channelDeleteHandler.execute fertig');
  },

  async handleButton(interaction) {
    if (!interaction.customId.startsWith('channel_delete_')) return;

    const parts = interaction.customId.split('_');
    const action = parts[2];
    const channelId = parts.slice(3).join('_');

    // Immer neu laden aus JSON (wichtig nach Neustart)
    loadPendingDeletions();

    console.log('[DEBUG] handleButton: action=' + action + ' channelId=' + channelId);
    console.log('[DEBUG] Map Groesse: ' + pendingDeletions.size + ' Keys: ' + Array.from(pendingDeletions.keys()).join(', '));

    const deletionData = pendingDeletions.get(channelId);

    if (!deletionData) {
      console.log('[DEBUG] Kein Eintrag fuer channelId=' + channelId + ' - Map leer oder ID falsch');
      return interaction.reply({
        content: 'Diese Benachrichtigung ist abgelaufen oder der Bot wurde neu gestartet.',
        flags: 64,
      });
    }

    if (action === 'restore') {
      const guild = interaction.client.guilds.cache.get(deletionData.channelInfo.guildId);
      if (!guild) {
        return interaction.reply({
          content: 'Server nicht gefunden.',
          ephemeral: true,
        });
      }
      try {
        await interaction.deferReply({ flags: 64 });
      } catch (error) {
        return interaction.reply({ content: 'Diese Aktion ist abgelaufen.', flags: 64 }).catch(() => {});
      }
      try {
        const { channelInfo } = deletionData;
        const channelOptions = {
          name: channelInfo.name,
          type: channelInfo.type,
          position: channelInfo.position,
          reason: 'Wiederhergestellt von ' + interaction.user.username,
        };
        if (channelInfo.topic) channelOptions.topic = channelInfo.topic;
        if (channelInfo.nsfw !== undefined) channelOptions.nsfw = channelInfo.nsfw;
        if (channelInfo.rateLimitPerUser) channelOptions.rateLimitPerUser = channelInfo.rateLimitPerUser;
        if (channelInfo.parentId) channelOptions.parent = channelInfo.parentId;

        const newChannel = await guild.channels.create(channelOptions);

        if (channelInfo.permissionOverwrites && channelInfo.permissionOverwrites.length > 0) {
          for (const overwrite of channelInfo.permissionOverwrites) {
            try {
              await newChannel.permissionOverwrites.create(overwrite.id, {
                allow: BigInt(overwrite.allow),
                deny: BigInt(overwrite.deny),
              });
            } catch (err) {
              console.error('Konnte Permission fuer ' + overwrite.id + ' nicht wiederherstellen:', err.message);
            }
          }
        }

        const successEmbed = new EmbedBuilder()
          .setColor(0x51cf66)
          .setTitle('Channel wiederhergestellt')
          .setDescription('Der Channel wurde erfolgreich wiederhergestellt!')
          .addFields(
            { name: 'Channel-Name', value: newChannel.name, inline: true },
            { name: 'Neue ID', value: newChannel.id, inline: true },
            { name: 'Typ', value: ChannelType[newChannel.type] || 'Unknown', inline: true },
            { name: 'Wiederhergestellt von', value: '<@' + interaction.user.id + '>', inline: false }
          )
          .setTimestamp();

        try {
          const updatedOriginalEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0x51cf66)
            .setFooter({ text: 'Wiederhergestellt von ' + interaction.user.username });
          await interaction.message.edit({
            embeds: [updatedOriginalEmbed],
            components: [],
          });
        } catch (e) {}

        await interaction.editReply({ embeds: [successEmbed] });
        pendingDeletions.delete(channelId);
        savePendingDeletions();

      } catch (error) {
        console.error('Fehler beim Wiederherstellen des Channels:', error);
        await interaction.editReply({
          content: 'Fehler beim Wiederherstellen: ' + error.message,
        });
      }

    } else if (action === 'acknowledge') {
      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0x51cf66)
        .setFooter({ text: 'Bestaetigt von ' + interaction.user.username });

      await interaction.update({
        embeds: [updatedEmbed],
        components: [],
      });

      pendingDeletions.delete(channelId);
      savePendingDeletions();

    } else if (action === 'investigate') {
      const guild = interaction.client.guilds.cache.get(deletionData.channelInfo.guildId);

      if (!guild) {
        return interaction.reply({
          content: 'Server nicht gefunden.',
          ephemeral: true,
        });
      }

      const auditLogs = await guild.fetchAuditLogs({
        limit: 10,
        type: AuditLogEvent.ChannelDelete,
      });

      const recentDeletions = auditLogs.entries
        .filter(entry => Date.now() - entry.createdTimestamp < 3600000)
        .map(entry => '- **' + entry.target.name + '** von ' + getUserDisplay(entry.executor))
        .join('\n') || 'Keine weiteren Loeschungen in letzter Stunde';

      const investigateEmbed = new EmbedBuilder()
        .setColor(0x4c6ef5)
        .setTitle('Untersuchung: Channel-Loeschungen')
        .setDescription('Weitere Loeschungen im Server **' + guild.name + '** in letzter Stunde:')
        .addFields(
          { name: 'Geloeschte Channels', value: recentDeletions, inline: false }
        )
        .setTimestamp();

      await interaction.reply({
        embeds: [investigateEmbed],
        flags: 64,
      });
    }
  },
};
