const fs = require('fs');
const path = require('path');
const { AuditLogEvent, EmbedBuilder } = require('discord.js');

const DATA_FILE = path.join(process.cwd(), 'data', 'antinuke.json');

function readStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    return {};
  }
}

function getUserDisplay(user) {
  if (!user) return 'Unbekannt';
  if (user.discriminator === '0' || !user.discriminator) {
    return user.username || user.id;
  }
  return user.username + '#' + user.discriminator;
}

// Track actions per user per guild
const actionTracker = new Map();

function trackAction(guildId, userId, actionType) {
  if (!actionTracker.has(guildId)) {
    actionTracker.set(guildId, new Map());
  }
  const guildTracker = actionTracker.get(guildId);

  if (!guildTracker.has(userId)) {
    guildTracker.set(userId, { channels: [], roles: [], bans: [], kicks: [] });
  }

  const userActions = guildTracker.get(userId);
  const now = Date.now();
  userActions[actionType].push(now);

  return userActions;
}

function cleanOldActions(actions, timeWindowMs) {
  const cutoff = Date.now() - timeWindowMs;
  return actions.filter(timestamp => timestamp > cutoff);
}

async function checkAndPunish(guild, userId, actionType, config) {
  try {
    const userActions = trackAction(guild.id, userId, actionType);
    const timeWindowMs = config.timeWindowSec * 1000;

    userActions[actionType] = cleanOldActions(userActions[actionType], timeWindowMs);

    const count = userActions[actionType].length;
    const threshold = config.thresholds[actionType];

    if (count >= threshold) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return;

      if (member.id === guild.ownerId) return;
      if (member.user.bot && member.id === guild.members.me?.id) return;

      // Log to channel
      if (config.logChannelId) {
        try {
          const logChannel = guild.channels.cache.get(config.logChannelId);
          if (logChannel) {
            const alertEmbed = new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle('Anti-Nuke Alert')
              .setDescription(getUserDisplay(member.user) + ' hat ' + count + ' ' + actionType + ' Aktionen in ' + config.timeWindowSec + 's durchgefuehrt!')
              .addFields(
                { name: 'User', value: '<@' + userId + '>', inline: true },
                { name: 'Aktion', value: actionType, inline: true },
                { name: 'Anzahl', value: count + '/' + threshold, inline: true },
              )
              .setTimestamp();
            await logChannel.send({ embeds: [alertEmbed] }).catch(console.error);
          }
        } catch (logError) {
          console.error('[AntiNuke] Fehler beim Senden des Log-Embeds:', logError.message);
        }
      }

      // Rollen entfernen
      try {
        const botMember = guild.members.me;
        const botHighestRole = botMember?.roles.highest;
        const rolesToRemove = member.roles.cache.filter(role => role.id !== guild.id);

        if (rolesToRemove.size > 0) {
          try {
            await member.roles.remove(rolesToRemove, 'Anti-Nuke: ' + count + ' ' + actionType + ' in ' + config.timeWindowSec + 's');
            console.log('[AntiNuke] ' + rolesToRemove.size + ' Rollen von ' + getUserDisplay(member.user) + ' entfernt');
          } catch (roleError) {
            console.warn('[AntiNuke] Konnte nicht alle Rollen entfernen, versuche einzeln...');
            let removedCount = 0;
            for (const role of rolesToRemove.values()) {
              if (botHighestRole && role.position < botHighestRole.position) {
                try {
                  await member.roles.remove(role, 'Anti-Nuke: ' + count + ' ' + actionType + ' in ' + config.timeWindowSec + 's');
                  removedCount++;
                } catch (e) {
                  console.error('[AntiNuke] Konnte Rolle ' + role.name + ' nicht entfernen');
                }
              }
            }
            console.log('[AntiNuke] ' + removedCount + '/' + rolesToRemove.size + ' Rollen entfernt');
          }
        }
      } catch (roleErr) {
        console.error('[AntiNuke] Fehler beim Rollenentfernen:', roleErr.message);
      }

      // Ban/Timeout
      try {
        const botMember = guild.members.me;
        const botHighestRole = botMember?.roles.highest;
        const memberHighestRole = member.roles.highest;

        if (config.punishment === 'ban') {
          await member.ban({ reason: 'Anti-Nuke: ' + count + ' ' + actionType + ' in ' + config.timeWindowSec + 's' });
          console.log('[AntiNuke] ' + getUserDisplay(member.user) + ' gebannt');
        } else if (config.punishment === 'timeout') {
          await member.timeout(10 * 60 * 1000, 'Anti-Nuke: ' + count + ' ' + actionType + ' in ' + config.timeWindowSec + 's');
          console.log('[AntiNuke] ' + getUserDisplay(member.user) + ' getimeouted');
        }
      } catch (punishError) {
        console.error('[AntiNuke] Fehler beim Bestrafen von ' + getUserDisplay(member.user) + ':', punishError.message);
      }

      // Tracking zuruecksetzen
      userActions[actionType] = [];
    }
  } catch (err) {
    console.error('[AntiNuke] Unbehandelter Fehler in checkAndPunish:', err.message);
  }
}

async function getExecutor(guild, auditLogType) {
  try {
    const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: auditLogType });
    const entry = auditLogs.entries.first();
    if (entry && Date.now() - entry.createdTimestamp < 5000) {
      return entry.executor;
    }
  } catch (error) {
    console.error('[AntiNuke] Fehler beim Laden der Audit Logs:', error.message);
  }
  return null;
}

module.exports = {
  name: 'antiNukeHandler',

  async handleChannelDelete(channel) {
    try {
      if (!channel.guild) return;

      const store = readStore();
      const config = store[channel.guild.id];
      if (!config || !config.enabled) return;

      const executor = await getExecutor(channel.guild, AuditLogEvent.ChannelDelete);
      if (executor && !executor.bot) {
        await checkAndPunish(channel.guild, executor.id, 'channels', config);
      }
    } catch (err) {
      console.error('[AntiNuke] Fehler in handleChannelDelete:', err.message);
    }
  },

  async handleRoleDelete(role) {
    try {
      if (!role.guild) return;

      const store = readStore();
      const config = store[role.guild.id];
      if (!config || !config.enabled) return;

      const executor = await getExecutor(role.guild, AuditLogEvent.RoleDelete);
      if (executor && !executor.bot) {
        await checkAndPunish(role.guild, executor.id, 'roles', config);
      }
    } catch (err) {
      console.error('[AntiNuke] Fehler in handleRoleDelete:', err.message);
    }
  },

  async handleBanAdd(ban) {
    try {
      if (!ban.guild) return;

      const store = readStore();
      const config = store[ban.guild.id];
      if (!config || !config.enabled) return;

      const executor = await getExecutor(ban.guild, AuditLogEvent.MemberBanAdd);
      if (executor && !executor.bot) {
        await checkAndPunish(ban.guild, executor.id, 'bans', config);
      }
    } catch (err) {
      console.error('[AntiNuke] Fehler in handleBanAdd:', err.message);
    }
  },

  async handleKick(member) {
    try {
      if (!member.guild) return;

      const store = readStore();
      const config = store[member.guild.id];
      if (!config || !config.enabled) return;

      const executor = await getExecutor(member.guild, AuditLogEvent.MemberKick);
      if (executor && !executor.bot) {
        await checkAndPunish(member.guild, executor.id, 'kicks', config);
      }
    } catch (err) {
      console.error('[AntiNuke] Fehler in handleKick:', err.message);
    }
  },
};
