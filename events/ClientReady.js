const { Events, ActivityType } = require("discord.js");
const { startApi } = require("../api");
const logger = require("../logger");

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ Bot ist online! Eingeloggt als ${client.user.tag}`);
    logger.info(`Bot eingeloggt als ${client.user.tag}`);

    // Log-Channel Startnachricht
    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (logChannelId) {
      const channel = await client.channels.fetch(logChannelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        await channel.send(":white_check_mark: Bot wurde erfolgreich gestartet!");
        logger.info("Startnachricht in Log-Channel gesendet.");
      } else {
        logger.warn("Log-Channel nicht gefunden oder kein Textkanal.");
      }
    } else {
      logger.warn("LOG_CHANNEL_ID nicht gesetzt.");
    }

    // Custom Status setzen
    client.user.setPresence({
      activities: [
        {
          name: "Bin in Wartung",
          type: ActivityType.Custom,
        },
      ],
      status: "dnd",
    });

    // API starten
    startApi(client);
    logger.info("API gestartet auf Port " + (process.env.API_PORT || 3001));
  },
};