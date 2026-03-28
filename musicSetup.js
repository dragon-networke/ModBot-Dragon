const { Player } = require('discord-player');
const { EmbedBuilder } = require('discord.js');

let playerInstance = null;

async function setupMusic(client) {
  if (playerInstance) return playerInstance;

  const player = new Player(client);
  playerInstance = player;

  // ── Extractors laden ──────────────────────────────────────────────────────

  try {
    const { YoutubeiExtractor } = require('discord-player-youtubei');
    await player.extractors.register(YoutubeiExtractor, {});
    console.log('[Music] YoutubeiExtractor geladen');
  } catch {
    try {
      const { YoutubeiExtractor } = require('@discord-player/extractor');
      await player.extractors.register(YoutubeiExtractor, {});
      console.log('[Music] YoutubeiExtractor (fallback) geladen');
    } catch (e) {
      console.error('[Music] YouTube-Extractor nicht verfügbar:', e.message);
    }
  }

  try {
    const { SoundCloudExtractor } = require('@discord-player/extractor');
    await player.extractors.register(SoundCloudExtractor, {});
    console.log('[Music] SoundCloudExtractor geladen');
  } catch { /* optional */ }

  try {
    const { AttachmentExtractor } = require('@discord-player/extractor');
    await player.extractors.register(AttachmentExtractor, {});
    console.log('[Music] AttachmentExtractor geladen');
  } catch { /* optional */ }

  console.log('[Music] Registrierte Extractors:', player.extractors.size);

  // ── Debug Events ───────────────────────────────────────────────────────────

  player.events.on('audioTrackAdd', (queue, track) => {
    console.log('[Music] Track hinzugefügt:', track.title);
  });

  player.events.on('playerSkip', (queue, track) => {
    console.log('[Music] Track übersprungen:', track?.title);
  });

  player.events.on('playerTriggeredHandledError', (queue, error) => {
    console.error('[Music] Handled Error:', error.message);
  });

  // ── Player Events ──────────────────────────────────────────────────────────

  player.events.on('playerStart', (queue, track) => {
    console.log('[Music] Spielt:', track.title);
    const channel = queue.metadata?.channel;
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('▶️ Spielt jetzt')
      .setDescription(`**[${track.title}](${track.url})**\nvon ${track.author}`)
      .setThumbnail(track.thumbnail?.startsWith('http') ? track.thumbnail : null)
      .setColor(0x3b82f6)
      .addFields(
        { name: '⏱️ Dauer',  value: track.duration,                        inline: true },
        { name: '🔊 Volume', value: `${queue.node.volume}%`,                inline: true },
        { name: '📋 Queue',  value: `${queue.tracks.size} weitere Song(s)`, inline: true },
      )
      .setFooter({ text: `Angefragt von ${track.requestedBy?.username || 'Unbekannt'}` })
      .setTimestamp();

    channel.send({ embeds: [embed] }).catch(() => {});
  });

  player.events.on('emptyQueue', (queue) => {
    console.log('[Music] Queue leer');
    queue.metadata?.channel?.send({
      embeds: [new EmbedBuilder().setColor(0x64748b).setDescription('✅ Queue leer — alle Songs abgespielt.')],
    }).catch(() => {});
  });

  player.events.on('disconnect', (queue) => {
    console.log('[Music] Bot disconnected');
    queue.metadata?.channel?.send({
      embeds: [new EmbedBuilder().setColor(0x64748b).setDescription('👋 Voice-Channel verlassen.')],
    }).catch(() => {});
  });

  player.events.on('error', (queue, error) => {
    console.error('[Music] Queue-Fehler:', error.message);
    queue.metadata?.channel?.send({
      embeds: [new EmbedBuilder().setColor(0xef4444).setDescription(`❌ Fehler: ${error.message}`)],
    }).catch(() => {});
  });

  player.events.on('playerError', (queue, error) => {
    console.error('[Music] Player-Fehler:', error.message);
    queue.metadata?.channel?.send({
      embeds: [new EmbedBuilder().setColor(0xef4444).setDescription(`❌ Player-Fehler: ${error.message}`)],
    }).catch(() => {});
  });

  console.log('[Music] Player initialisiert');
  return player;
}

// ── Button Handler ─────────────────────────────────────────────────────────

async function handleMusicButton(interaction) {
  const { useQueue } = require('discord-player');
  const queue = useQueue(interaction.guild.id);

  if (!queue) {
    return interaction.reply({ content: '❌ Keine aktive Queue!', flags: 64 });
  }

  const id = interaction.customId;

  if (id === 'music_pause_resume') {
    const paused = queue.node.isPaused();
    paused ? queue.node.resume() : queue.node.pause();
    return interaction.reply({ content: paused ? '▶️ Fortgesetzt!' : '⏸️ Pausiert!', flags: 64 });
  }

  if (id === 'music_skip') {
    const current = queue.currentTrack?.title ?? 'Song';
    queue.node.skip();
    return interaction.reply({ content: `⏭️ **${current}** übersprungen.`, flags: 64 });
  }

  if (id === 'music_stop') {
    queue.delete();
    return interaction.reply({ content: '⏹️ Musik gestoppt!', flags: 64 });
  }

  if (id === 'music_loop') {
    const next = (queue.repeatMode + 1) % 3;
    queue.setRepeatMode(next);
    const labels = ['Aus', 'Song', 'Queue'];
    return interaction.reply({ content: `🔁 Loop: **${labels[next]}**`, flags: 64 });
  }

  if (id === 'music_queue') {
    const tracks  = queue.tracks.toArray().slice(0, 10);
    const current = queue.currentTrack;
    const desc    = tracks.length > 0
      ? tracks.map((t, i) => `\`${i + 1}.\` **${t.title}** — ${t.author}`).join('\n')
      : '_Queue ist leer_';

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('📋 Warteschlange')
          .setColor(0x3b82f6)
          .setDescription(current ? `**Jetzt:** ${current.title}\n\n${desc}` : desc),
      ],
      flags: 64,
    });
  }
}

module.exports = { setupMusic, handleMusicButton };