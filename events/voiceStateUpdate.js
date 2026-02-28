const fs = require("fs");
const path = require("path");

const CONFIG_FILE = path.join(process.cwd(), "data", "voiceSupport.json");

function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch (e) {
    console.error("[VoiceSupport] Fehler beim Laden der Config:", e.message);
    return {};
  }
}

// Speichert aktive Support-Kanaele: channelId -> { userId, guildId }
const activeChannels = new Map();

module.exports = {
  name: "voiceStateUpdate",

  async execute(oldState, newState) {
    try {
      const guild = newState.guild || oldState.guild;
      if (!guild) return;

      const config = loadConfig();
      const guildConfig = config[guild.id];
      if (!guildConfig || !guildConfig.enabled) return;

      const supportChannelId = guildConfig.supportChannelId;
      const notifyChannelId = guildConfig.notifyChannelId;
      const supportRoleId = guildConfig.supportRoleId;
      const categoryId = guildConfig.categoryId || null;

      // --- User joint den Support-Wartekanal ---
      if (newState.channelId === supportChannelId) {
        const member = newState.member;
        if (!member || member.user.bot) return;

        console.log(
          "[VoiceSupport] " +
            member.user.username +
            " hat den Support-Kanal betreten",
        );

        // Privaten Kanal erstellen
        let privateChannel;
        try {
          const channelOptions = {
            name: "support-" + member.user.username,
            type: 2, // GuildVoice
            permissionOverwrites: [
              {
                id: guild.id, // @everyone
                deny: ["Connect", "ViewChannel"],
              },
              {
                id: member.id,
                allow: ["Connect", "ViewChannel", "Speak"],
              },
            ],
          };

          // Support-Rolle Zugriff geben
          if (supportRoleId) {
            channelOptions.permissionOverwrites.push({
              id: supportRoleId,
              allow: ["Connect", "ViewChannel", "Speak", "MoveMembers"],
            });
          }

          // In Kategorie erstellen falls konfiguriert
          if (categoryId) {
            channelOptions.parent = categoryId;
          }

          privateChannel = await guild.channels.create(channelOptions);
          console.log(
            "[VoiceSupport] Privater Kanal erstellt: " + privateChannel.name,
          );
        } catch (err) {
          console.error(
            "[VoiceSupport] Fehler beim Erstellen des privaten Kanals:",
            err.message,
          );
          return;
        }

        // User in privaten Kanal verschieben
        try {
          await member.voice.setChannel(privateChannel);
          console.log(
            "[VoiceSupport] " +
              member.user.username +
              " in privaten Kanal verschoben",
          );
        } catch (err) {
          console.error(
            "[VoiceSupport] Fehler beim Verschieben des Users:",
            err.message,
          );
          await privateChannel.delete().catch(() => {});
          return;
        }

        // Aktiven Kanal speichern
        activeChannels.set(privateChannel.id, {
          userId: member.id,
          guildId: guild.id,
        });

        // Support-Team benachrichtigen
        if (notifyChannelId) {
          try {
            const notifyChannel = guild.channels.cache.get(notifyChannelId);
            if (notifyChannel) {
              const mention = supportRoleId ? "<@&" + supportRoleId + ">" : "";
              await notifyChannel.send({
                content: mention,
                embeds: [
                  {
                    color: 0x5865f2,
                    title: "Neuer Support-Anruf",
                    description:
                      "<@" + member.id + "> wartet auf Unterstuetzung!",
                    fields: [
                      {
                        name: "User",
                        value:
                          "<@" + member.id + "> (" + member.user.username + ")",
                        inline: true,
                      },
                      {
                        name: "Privater Kanal",
                        value: "<#" + privateChannel.id + ">",
                        inline: true,
                      },
                      {
                        name: "Erstellt",
                        value: "<t:" + Math.floor(Date.now() / 1000) + ":R>",
                        inline: true,
                      },
                    ],
                    timestamp: new Date().toISOString(),
                  },
                ],
              });
            }
          } catch (err) {
            console.error(
              "[VoiceSupport] Fehler beim Benachrichtigen:",
              err.message,
            );
          }
        }
      }

      // --- User verlaesst einen aktiven Support-Kanal ---
      if (oldState.channelId && activeChannels.has(oldState.channelId)) {
        const channelData = activeChannels.get(oldState.channelId);

        // Pruefe ob der Kanal jetzt leer ist
        const channel = guild.channels.cache.get(oldState.channelId);
        if (!channel) {
          activeChannels.delete(oldState.channelId);
          return;
        }

        const membersInChannel = channel.members.size;

        if (membersInChannel === 0) {
          console.log(
            "[VoiceSupport] Kanal " +
              channel.name +
              " ist leer, wird geloescht...",
          );
          try {
            await channel.delete(
              "Support beendet - Kanal automatisch geloescht",
            );
            activeChannels.delete(oldState.channelId);
            console.log("[VoiceSupport] Kanal geloescht");
          } catch (err) {
            console.error(
              "[VoiceSupport] Fehler beim Loeschen des Kanals:",
              err.message,
            );
          }
        }
      }
    } catch (err) {
      console.error(
        "[VoiceSupport] Unbehandelter Fehler in voiceStateUpdate:",
        err.message,
      );
    }
  },
};
