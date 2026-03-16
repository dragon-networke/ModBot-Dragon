/**
 * commands/music.js
 * Musik-System mit YouTube + Spotify-Suche
 *
 * Benötigte npm-Pakete:
 *   npm install discord-player @discord-player/extractor youtubei.js
 *
 * Optional für Spotify-Suche:
 *   npm install play-dl
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require('discord.js');

const { useMainPlayer, useQueue } = require('discord-player');

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function formatDuration(ms) {
  if (!ms) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function progressBar(current, total, length = 20) {
  if (!total) return '▬'.repeat(length);
  const filled = Math.round((current / total) * length);
  return '█'.repeat(filled) + '▬'.repeat(length - filled);
}

function buildNowPlayingEmbed(track, queue) {
  const pos  = queue.node.getTimestamp();
  const curr = pos?.current?.value  || 0;
  const tot  = pos?.total?.value    || track.durationMS || 0;

  return new EmbedBuilder()
    .setTitle('🎵 Spielt gerade')
    .setDescription(`**[${track.title}](${track.url})**\nvon ${track.author}`)
    .setThumbnail(track.thumbnail)
    .setColor(0x3b82f6)
    .addFields(
      {
        name: 'Fortschritt',
        value: `\`${formatDuration(curr)}\` ${progressBar(curr, tot)} \`${formatDuration(tot)}\``,
        inline: false,
      },
      { name: '🔁 Loop',      value: queue.repeatMode === 0 ? 'Aus' : queue.repeatMode === 1 ? 'Song' : 'Queue', inline: true },
      { name: '🔊 Lautstärke',value: `${queue.node.volume}%`, inline: true },
      { name: '📋 Queue',     value: `${queue.tracks.size} Song(s)`, inline: true },
    )
    .setFooter({ text: `Angefragt von ${track.requestedBy?.username || 'Unbekannt'}` })
    .setTimestamp();
}

function buildQueueEmbed(queue, page = 1) {
  const current  = queue.currentTrack;
  const tracks   = queue.tracks.toArray();
  const perPage  = 10;
  const pages    = Math.ceil(tracks.length / perPage) || 1;
  const start    = (page - 1) * perPage;
  const end      = start + perPage;
  const slice    = tracks.slice(start, end);

  const desc = slice.length > 0
    ? slice.map((t, i) => `\`${start + i + 1}.\` **${t.title}** — ${t.author} \`${formatDuration(t.durationMS)}\``).join('\n')
    : '_Queue ist leer_';

  return new EmbedBuilder()
    .setTitle('📋 Warteschlange')
    .setColor(0x3b82f6)
    .setDescription(
      current
        ? `**Spielt gerade:** [${current.title}](${current.url})\n\n${desc}`
        : desc
    )
    .setFooter({ text: `Seite ${page}/${pages} · ${tracks.length} Songs gesamt` });
}

// ── Controls-Row ───────────────────────────────────────────────────────────

function buildControlsRow(paused = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music_pause_resume')
      .setEmoji(paused ? '▶️' : '⏸️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_skip')
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_stop')
      .setEmoji('⏹️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('music_loop')
      .setEmoji('🔁')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_queue')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Secondary),
  );
}

// ── Command Definition ─────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Musik-Befehle')
    .addSubcommand(sub =>
      sub.setName('play')
        .setDescription('Spielt einen Song oder fügt ihn zur Queue hinzu')
        .addStringOption(opt =>
          opt.setName('suche')
            .setDescription('Song-Name, YouTube-URL oder Spotify-Link')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('pause').setDescription('Pausiert / Setzt fort')
    )
    .addSubcommand(sub =>
      sub.setName('skip').setDescription('Überspringt den aktuellen Song')
        .addIntegerOption(opt =>
          opt.setName('anzahl').setDescription('Wie viele Songs überspringen?').setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub.setName('stop').setDescription('Stoppt die Musik und verlässt den Channel')
    )
    .addSubcommand(sub =>
      sub.setName('queue').setDescription('Zeigt die Warteschlange')
        .addIntegerOption(opt =>
          opt.setName('seite').setDescription('Seite der Queue').setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub.setName('nowplaying').setDescription('Zeigt den aktuellen Song')
    )
    .addSubcommand(sub =>
      sub.setName('loop')
        .setDescription('Stellt den Loop-Modus ein')
        .addStringOption(opt =>
          opt.setName('modus')
            .setDescription('Loop-Modus')
            .setRequired(true)
            .addChoices(
              { name: 'Aus',   value: '0' },
              { name: 'Song',  value: '1' },
              { name: 'Queue', value: '2' },
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('volume')
        .setDescription('Lautstärke einstellen (1-100)')
        .addIntegerOption(opt =>
          opt.setName('wert').setDescription('Lautstärke in %').setRequired(true).setMinValue(1).setMaxValue(100)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Entfernt einen Song aus der Queue')
        .addIntegerOption(opt =>
          opt.setName('position').setDescription('Position in der Queue').setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub.setName('shuffle').setDescription('Mischt die Queue')
    ),

  // ── Autocomplete ─────────────────────────────────────────────────────────

  async autocomplete(interaction) {
    const query = interaction.options.getFocused();
    if (!query || query.length < 2) return interaction.respond([]);

    try {
      const player = useMainPlayer();
      const results = await player.search(query, {
        requestedBy: interaction.user,
        searchEngine: 'auto',
      });

      const choices = results.tracks.slice(0, 10).map(t => ({
        name: `${t.title} — ${t.author}`.substring(0, 100),
        value: t.url || query,
      }));

      await interaction.respond(choices);
    } catch {
      await interaction.respond([]);
    }
  },

  // ── Execute ───────────────────────────────────────────────────────────────

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // Prüfen ob User in einem Voice-Channel ist (außer bei queue/nowplaying)
    const needsVoice = ['play', 'pause', 'skip', 'stop', 'loop', 'volume', 'shuffle', 'remove'];
    if (needsVoice.includes(sub)) {
      const voiceChannel = interaction.member?.voice?.channel;
      if (!voiceChannel) {
        return interaction.reply({
          content: '❌ Du musst in einem Voice-Channel sein!',
          ephemeral: true,
        });
      }

      // Bot-Permissions prüfen
      const perms = voiceChannel.permissionsFor(interaction.client.user);
      if (!perms?.has(PermissionsBitField.Flags.Connect) || !perms?.has(PermissionsBitField.Flags.Speak)) {
        return interaction.reply({
          content: '❌ Ich habe keine Berechtigung diesem Voice-Channel beizutreten!',
          ephemeral: true,
        });
      }
    }

    // ── play ────────────────────────────────────────────────────────────────
    if (sub === 'play') {
      await interaction.deferReply();

      const query = interaction.options.getString('suche', true);
      const player = useMainPlayer();

      try {
        const { track, queue: q } = await player.play(
          interaction.member.voice.channel,
          query,
          {
            nodeOptions: {
              metadata: {
                channel:     interaction.channel,
                client:      interaction.client,
                requestedBy: interaction.user,
              },
              selfDeaf:           true,
              volume:             80,
              leaveOnEmpty:       true,
              leaveOnEmptyCooldown: 30_000,
              leaveOnEnd:         true,
              leaveOnEndCooldown: 30_000,
            },
            requestedBy: interaction.user,
          }
        );

        const wasQueued = q.tracks.size > 0 && q.currentTrack?.id !== track.id;

        const embed = new EmbedBuilder()
          .setColor(0x3b82f6)
          .setThumbnail(track.thumbnail)
          .setTimestamp()
          .setFooter({ text: `Angefragt von ${interaction.user.username}` });

        if (wasQueued) {
          embed
            .setTitle('📋 Zur Queue hinzugefügt')
            .setDescription(`**[${track.title}](${track.url})**\nvon ${track.author}`)
            .addFields(
              { name: '⏱️ Dauer',    value: formatDuration(track.durationMS), inline: true },
              { name: '📋 Position', value: `#${q.tracks.size}`,              inline: true },
            );
          return interaction.editReply({ embeds: [embed] });
        }

        embed
          .setTitle('▶️ Spielt jetzt')
          .setDescription(`**[${track.title}](${track.url})**\nvon ${track.author}`)
          .addFields({ name: '⏱️ Dauer', value: formatDuration(track.durationMS), inline: true });

        return interaction.editReply({
          embeds: [embed],
          components: [buildControlsRow(false)],
        });

      } catch (e) {
        console.error('[Music] Play-Fehler:', e.message);
        return interaction.editReply({
          content: `❌ Fehler: ${e.message}`,
        });
      }
    }

    // ── pause ───────────────────────────────────────────────────────────────
    if (sub === 'pause') {
      const queue = useQueue(interaction.guild.id);
      if (!queue?.isPlaying()) {
        return interaction.reply({ content: '❌ Es spielt gerade nichts!', ephemeral: true });
      }

      const paused = queue.node.isPaused();
      paused ? queue.node.resume() : queue.node.pause();

      return interaction.reply({
        content: paused ? '▶️ Fortgesetzt!' : '⏸️ Pausiert!',
        ephemeral: true,
      });
    }

    // ── skip ────────────────────────────────────────────────────────────────
    if (sub === 'skip') {
      const queue = useQueue(interaction.guild.id);
      if (!queue?.isPlaying()) {
        return interaction.reply({ content: '❌ Es spielt gerade nichts!', ephemeral: true });
      }

      const anzahl = interaction.options.getInteger('anzahl') || 1;
      const current = queue.currentTrack;

      for (let i = 0; i < anzahl; i++) {
        queue.node.skip();
      }

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3b82f6)
            .setDescription(`⏭️ **${anzahl > 1 ? `${anzahl} Songs` : current?.title ?? 'Song'}** übersprungen.`),
        ],
      });
    }

    // ── stop ────────────────────────────────────────────────────────────────
    if (sub === 'stop') {
      const queue = useQueue(interaction.guild.id);
      if (!queue) {
        return interaction.reply({ content: '❌ Es spielt gerade nichts!', ephemeral: true });
      }

      queue.delete();
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription('⏹️ Musik gestoppt und Queue geleert.'),
        ],
      });
    }

    // ── queue ───────────────────────────────────────────────────────────────
    if (sub === 'queue') {
      const queue = useQueue(interaction.guild.id);
      if (!queue?.currentTrack) {
        return interaction.reply({ content: '❌ Queue ist leer!', ephemeral: true });
      }

      const page = interaction.options.getInteger('seite') || 1;
      return interaction.reply({ embeds: [buildQueueEmbed(queue, page)] });
    }

    // ── nowplaying ──────────────────────────────────────────────────────────
    if (sub === 'nowplaying') {
      const queue = useQueue(interaction.guild.id);
      if (!queue?.currentTrack) {
        return interaction.reply({ content: '❌ Es spielt gerade nichts!', ephemeral: true });
      }

      return interaction.reply({
        embeds: [buildNowPlayingEmbed(queue.currentTrack, queue)],
        components: [buildControlsRow(queue.node.isPaused())],
      });
    }

    // ── loop ────────────────────────────────────────────────────────────────
    if (sub === 'loop') {
      const queue = useQueue(interaction.guild.id);
      if (!queue) {
        return interaction.reply({ content: '❌ Keine aktive Queue!', ephemeral: true });
      }

      const modus = parseInt(interaction.options.getString('modus', true));
      queue.setRepeatMode(modus);

      const labels = ['Aus', 'Song', 'Queue'];
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3b82f6)
            .setDescription(`🔁 Loop-Modus: **${labels[modus]}**`),
        ],
      });
    }

    // ── volume ──────────────────────────────────────────────────────────────
    if (sub === 'volume') {
      const queue = useQueue(interaction.guild.id);
      if (!queue) {
        return interaction.reply({ content: '❌ Keine aktive Queue!', ephemeral: true });
      }

      const vol = interaction.options.getInteger('wert', true);
      queue.node.setVolume(vol);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3b82f6)
            .setDescription(`🔊 Lautstärke auf **${vol}%** gesetzt.`),
        ],
        ephemeral: true,
      });
    }

    // ── remove ──────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const queue = useQueue(interaction.guild.id);
      if (!queue?.tracks.size) {
        return interaction.reply({ content: '❌ Queue ist leer!', ephemeral: true });
      }

      const pos   = interaction.options.getInteger('position', true) - 1;
      const track = queue.tracks.at(pos);

      if (!track) {
        return interaction.reply({ content: '❌ Song nicht gefunden!', ephemeral: true });
      }

      queue.tracks.remove(pos);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3b82f6)
            .setDescription(`🗑️ **${track.title}** aus der Queue entfernt.`),
        ],
        ephemeral: true,
      });
    }

    // ── shuffle ─────────────────────────────────────────────────────────────
    if (sub === 'shuffle') {
      const queue = useQueue(interaction.guild.id);
      if (!queue?.tracks.size) {
        return interaction.reply({ content: '❌ Queue ist leer!', ephemeral: true });
      }

      queue.tracks.shuffle();
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3b82f6)
            .setDescription(`🔀 Queue mit **${queue.tracks.size}** Songs gemischt!`),
        ],
      });
    }
  },
};
