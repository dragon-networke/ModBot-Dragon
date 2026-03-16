/**
 * musicSetup.js
 * Initialisiert discord-player und registriert Events.
 * In index.js / ClientReady.js einbinden:
 *
 *   const { setupMusic } = require('./musicSetup');
 *   setupMusic(client);
 *
 * Benötigte Pakete:
 *   npm install discord-player @discord-player/extractor youtubei.js
 */

const { Player } = require('discord-player');
const { YoutubeiExtractor } = require('@discord-player/extractor');
const { EmbedBuilder } = require('discord.js');

async function setupMusic(client) {
  const player = new Player(client, {
    ytdlOptions: {
      quality:       'highestaudio',
      highWaterMark: 1 << 25,
    },
  });

  // YouTube Extractor registrieren (youtubei - kein API-Key nötig!)
  await player.extractors.register(YoutubeiExtractor, {});

  // Spotify wird über ytdl als YouTube-Suche umgewandelt
  // (kein direktes Streaming, nur Suche nach Titel)
  try {
    const { SpotifyExtractor } = require('@discord-player/extractor');
    await player.extractors.register(SpotifyExtractor, {
      clientId:     process.env.SPOTIFY_CLIENT_ID     || '',
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    });
    console.log('[Music] Spotify Extractor geladen');
  } catch {
    console.log('[Music] Spotify Extractor nicht verfügbar (optional)');
  }

  // ── Player Events ──────────────────────────────────────────────────────

  // Song startet
  player.events.on('playerStart', (queue, track) => {
    const channel = queue.metadata?.channel;
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('▶️ Spielt jetzt')
      .setDescription(`**[${track.title}](${track.url})**\nvon ${track.author}`)
      .setThumbnail(track.thumbnail)
      .setColor(0x3b82f6)
      .addFields(
        { name: '⏱️ Dauer',    value: track.duration,                              inline: true },
        { name: '🔊 Volume',   value: `${queue.node.volume}%`,                     inline: true },
        { name: '📋 Queue',    value: `${queue.tracks.size} weitere Song(s)`,      inline: true },
      )
      .setFooter({ text: `Angefragt von ${track.requestedBy?.username || 'Unbekannt'}` })
      .setTimestamp();

    channel.send({ embeds: [embed] }).catch(() => {});
  });

  // Queue leer
  player.events.on('emptyQueue', (queue) => {
    const channel = queue.metadata?.channel;
    if (!channel) return;

    channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x64748b)
          .setDescription('✅ Queue ist leer — alle Songs wurden abgespielt.'),
      ],
    }).catch(() => {});
  });

  // Bot verlässt Channel
  player.events.on('disconnect', (queue) => {
    const channel = queue.metadata?.channel;
    if (!channel) return;
    channel.send({ embeds: [new EmbedBuilder().setColor(0x64748b).setDescription('👋 Voice-Channel verlassen.')] }).catch(() => {});
  });

  // Fehler
  player.events.on('error', (queue, error) => {
    console.error('[Music] Queue-Fehler:', error.message);
    const channel = queue.metadata?.channel;
    if (channel) {
      channel.send({ embeds: [new EmbedBuilder().setColor(0xef4444).setDescription(`❌ Fehler: ${error.message}`)] }).catch(() => {});
    }
  });

  player.events.on('playerError', (queue, error) => {
    console.error('[Music] Player-Fehler:', error.message);
  });

  console.log('[Music] Player initialisiert');
  return player;
}

// ── Button Handler (für Pause/Skip/Stop/Loop Controls) ────────────────────

async function handleMusicButton(interaction) {
  const { useQueue } = require('discord-player');
  const queue = useQueue(interaction.guild.id);

  if (!queue) {
    return interaction.reply({ content: '❌ Keine aktive Queue!', ephemeral: true });
  }

  const id = interaction.customId;

  if (id === 'music_pause_resume') {
    const paused = queue.node.isPaused();
    paused ? queue.node.resume() : queue.node.pause();
    return interaction.reply({ content: paused ? '▶️ Fortgesetzt!' : '⏸️ Pausiert!', ephemeral: true });
  }

  if (id === 'music_skip') {
    const current = queue.currentTrack?.title ?? 'Song';
    queue.node.skip();
    return interaction.reply({ content: `⏭️ **${current}** übersprungen.`, ephemeral: true });
  }

  if (id === 'music_stop') {
    queue.delete();
    return interaction.reply({ content: '⏹️ Musik gestoppt!', ephemeral: true });
  }

  if (id === 'music_loop') {
    const next = (queue.repeatMode + 1) % 3;
    queue.setRepeatMode(next);
    const labels = ['Aus', 'Song', 'Queue'];
    return interaction.reply({ content: `🔁 Loop: **${labels[next]}**`, ephemeral: true });
  }

  if (id === 'music_queue') {
    const { buildQueueEmbed } = require('./music');
    return interaction.reply({ embeds: [buildQueueEmbed(queue)], ephemeral: true });
  }
}

module.exports = { setupMusic, handleMusicButton };