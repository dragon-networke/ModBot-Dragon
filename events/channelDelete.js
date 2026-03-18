const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
  name: Events.ChannelDelete,

  async execute(channel) {
    if (!channel.guild) return;

    // Ticket-Channel gelöscht? Aus der Config entfernen
    try {
      const fs   = require('fs');
      const path = require('path');
      const dataPath = path.join(process.cwd(), 'data', 'tickets.json');

      if (fs.existsSync(dataPath)) {
        const config = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        const guildConfig = config[channel.guild.id];

        if (guildConfig?.activeTickets?.[channel.id]) {
          delete guildConfig.activeTickets[channel.id];
          config[channel.guild.id] = guildConfig;
          fs.writeFileSync(dataPath, JSON.stringify(config, null, 2));
          console.log(`[ChannelDelete] Ticket-Channel ${channel.id} aus Config entfernt.`);
        }
      }
    } catch (e) {
      console.error('[ChannelDelete] Fehler beim Bereinigen der Ticket-Config:', e.message);
    }
  },

  // Button-Handler für channel_delete_ Buttons
  async handleButton(interaction) {
    const channelId = interaction.customId.replace('channel_delete_', '');

    try {
      const channel = interaction.guild.channels.cache.get(channelId);
      if (!channel) {
        return interaction.reply({ content: '❌ Channel nicht gefunden!', flags: 64 });
      }

      await interaction.reply({ content: '🗑️ Channel wird gelöscht...', flags: 64 });
      await channel.delete('Dashboard Aktion');
    } catch (e) {
      console.error('[ChannelDelete] Button-Fehler:', e.message);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Fehler beim Löschen!', flags: 64 }).catch(() => {});
      }
    }
  },
};