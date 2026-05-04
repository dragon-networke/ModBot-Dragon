const { Events, ActivityType } = require("discord.js");
const { startApi } = require("../api");
const { setupMusic } = require("../musicSetup");
const logger = require("../logger");

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ Bot ist online! Eingeloggt als ${client.user.tag}`);
    logger.info(`Bot eingeloggt als ${client.user.tag}`);

    // ====================== SLASH COMMANDS DEPLOYEN ======================
    try {
      console.log("🔄 Registriere Slash Commands bei Discord...");

      const commands = [
        require("../commands/warn").data.toJSON(),
        require("../commands/interactive_ban_request").data.toJSON(),
        require("../commands/bannlist").data.toJSON(),
        require("../commands/setupLevels").data.toJSON(),
        require("../commands/appeal").data.toJSON(),
        require("../commands/ticketPanel").data.toJSON(),
        require("../commands/setupVoiceSupport").data.toJSON(),
        require("../commands/antiNuke").data.toJSON(),
        // require("../commands/music").data.toJSON(), // ❌ Deaktiviert wegen YouTube-API Fehler
        require("../commands/setupChannelDelete").data.toJSON(),
        require("../commands/createChannel").data.toJSON(),
        require("../commands/leaderboard").data.toJSON(),
        require("../commands/rank").data.toJSON(),
        require("../commands/transcript").data.toJSON(),
        require("../commands/logtest").data.toJSON(),
        require("../commands/setupAutoMod").data.toJSON(),
        require("../commands/giveaway").data.toJSON(),
      ];

      await client.application.commands.set(commands);

      console.log(`✅ Erfolgreich ${commands.length} Slash Commands deployed!`);
      logger.info(`${commands.length} Slash Commands bei Discord registriert.`);

    } catch (error) {
      console.error("❌ Fehler beim Deployen der Slash Commands:", error.message);
      logger.error("Fehler beim Deployen der Commands: " + error.message);
    }
    // =====================================================================

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

    // Musik-Player initialisieren (deaktiviert wegen YouTube-API Fehler)
    // try {
    //   await setupMusic(client);
    //   logger.info("Musik-Player initialisiert.");
    // } catch (e) {
    //   logger.error("Fehler beim Initialisieren des Musik-Players: " + e.message);
    // }
  },
};