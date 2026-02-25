const antiNukeHandler = require('./antiNukeHandler');

/**
 * Registriert alle Anti-Nuke Event Handler
 * @param {Client} client - Der Discord Client
 */
function setupAntiNukeEvents(client) {
  // Channel Delete wird jetzt in channelDelete.js Event Handler registriert

  // Role Delete
  client.on('roleDelete', role => {
    antiNukeHandler.handleRoleDelete(role);
  });

  // Ban Add
  client.on('guildBanAdd', ban => {
    antiNukeHandler.handleBanAdd(ban);
  });

  // Member Remove (Kick Detection)
  client.on('guildMemberRemove', async member => {
    const auditLogs = await member.guild.fetchAuditLogs({ 
      limit: 1, 
      type: 20 
    }).catch(() => null);
    
    if (auditLogs) {
      const kickLog = auditLogs.entries.first();
      if (kickLog && 
          kickLog.target.id === member.id && 
          Date.now() - kickLog.createdTimestamp < 5000) {
        antiNukeHandler.handleKick(member);
      }
    }
  });

  console.log('✅ Anti-Nuke Event Handler registriert');
}

module.exports = { setupAntiNukeEvents };
