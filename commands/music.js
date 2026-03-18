/**
 * commands/music.js
 * Musik-System mit YouTube + Spotify-Suche
 *
 * Benötigte npm-Pakete:
 *   npm install discord-player @discord-player/extractor youtubei.js
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
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function progressBar(current, total, length = 20) {
  if (!total) return '▬'.repeat(length);
  const filled = Math.round((current / total) * length);
  return '█'.repeat(filled) + '▬'.repeat(length - filled);
}

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
      sub.setName('skip')
        .setDescription('Überspringt den aktuellen Song')
        .addIntegerOption(opt =>
          opt.setName('anzahl').setDescription('Wie viele Songs überspringen?').setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub.setName('stop').setDescription('Stoppt die Musik und verlässt den Channel')
    )
    .addSubcommand(sub =>
      sub.setName('queue')
        .setDescription('Zeigt die Warteschlange')
        .addIntegerOption(opt =>
          opt.setName('seite').setDescription('Seite der Queue').setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub.setName('nowplaying').setDescription('Zeigt den aktuellen Song')
    )
    .addSubcommand(sub =>
      sub.setName('loop')
        .setDescription('Loop-Modus einstellen')
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

  // ── Autocomplete ──────────────────────────────────────────────────────────

  async autocomplete(interaction) {
    const query = interaction.options.getFocused();
    if (!query || query.length < 2) return interaction.respond([]);

    try {
      const player  = useMainPlayer();
      const results = await player.search(query, { requestedBy: interaction.user });
      const choices = results.tracks.slice(0, 10).map(t => ({
        name:  `${t.title} — ${t.author}`.substring(0, 100),
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

    // Voice-Channel Prüfung für alle Befehle die Voice brauchen
    const needsVoice = ['play', 'pause', 'skip', 'stop', 'loop', 'volume', 'shuffle', 'remove'];
    if (needsVoice.includes(sub)) {
      const voiceChannel = interaction.member?.voice?.channel;
      if (!voiceChannel) {
        return interaction.reply({ content: '❌ Du musst in einem Voice-Channel sein!', flags: 64 });
      }
      const perms = voiceChannel.permissionsFor(interaction.client.user);
      if (!perms?.has(PermissionsBitField.Flags.Connect) || !perms?.has(PermissionsBitField.Flags.Speak)) {
        return interaction.reply({ content: '❌ Ich habe keine Berechtigung diesem Voice-Channel beizutreten!', flags: 64 });
      }
    }

    // ── play ─────────────────────────────────────────────────────────────────
    if (sub === 'play') {
      await interaction.deferReply();

      const query  = interaction.options.getString('suche', true);
      const player = useMainPlayer();

      if (player.extractors.size === 0) {
        return interaction.editReply({
          content: '❌ Kein Musik-Extractor geladen! Bitte `npm install @discord-player/extractor youtubei.js` ausführen und Bot neustarten.',
        });
      }

      try {
        const { track, queue } = await player.play(
          interaction.member.voice.channel,
          query,
          {
            nodeOptions: {
              metadata: {
                channel:     interaction.channel,
                client:      interaction.client,
                requestedBy: interaction.user,
              },
              selfDeaf:             true,
              volume:               80,
              leaveOnEmpty:         true,
              leaveOnEmptyCooldown: 30_000,
              leaveOnEnd:           true,
              leaveOnEndCooldown:   30_000,
            },
            requestedBy: interaction.user,
          }
        );

        const queued = queue.tracks.size > 0 && queue.currentTrack?.id !== track.id;

        const embed = new EmbedBuilder()
          .setColor(0x3b82f6)
          .setThumbnail(track.thumbnail)
          .setFooter({ text: `Angefragt von ${interaction.user.username}` })
          .setTimestamp();

        if (queued) {
          embed
            .setTitle('📋 Zur Queue hinzugefügt')
            .setDescription(`**[${track.title}](${track.url})**\nvon ${track.author}`)
            .addFields(
              { name: '⏱️ Dauer',    value: track.duration,          inline: true },
              { name: '📋 Position', value: `#${queue.tracks.size}`, inline: true },
            );
          return interaction.editReply({ embeds: [embed] });
        }

        embed
          .setTitle('▶️ Spielt jetzt')
          .setDescription(`**[${track.title}](${track.url})**\nvon ${track.author}`)
          .addFields({ name: '⏱️ Dauer', value: track.duration, inline: true });

        return interaction.editReply({
          embeds: [embed],
          components: [buildControlsRow(false)],
        });

      } catch (e) {
        console.error('[Music] Play-Fehler:', e.message);
        return interaction.editReply({
          content: `❌ Fehler: ${e.message}\n\nTipp: Versuche einen Song-Namen statt einer URL.`,
        });
      }
    }

    // ── pause ─────────────────────────────────────────────────────────────────
    if (sub === 'pause') {
      const queue = useQueue(interaction.guild.id);
      if (!queue?.isPlaying()) return interaction.reply({ content: '❌ Es spielt gerade nichts!', flags: 64 });
      const paused = queue.node.isPaused();
      paused ? queue.node.resume() : queue.node.pause();
      return interaction.reply({ content: paused ? '▶️ Fortgesetzt!' : '⏸️ Pausiert!', flags: 64 });
    }

    // ── skip ──────────────────────────────────────────────────────────────────
    if (sub === 'skip') {
      const queue = useQueue(interaction.guild.id);
      if (!queue?.isPlaying()) return interaction.reply({ content: '❌ Es spielt gerade nichts!', flags: 64 });

      const anzahl  = interaction.options.getInteger('anzahl') || 1;
      const current = queue.currentTrack?.title ?? 'Song';
      for (let i = 0; i < anzahl; i++) queue.node.skip();

      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x3b82f6).setDescription(`⏭️ **${anzahl > 1 ? `${anzahl} Songs` : current}** übersprungen.`)],
      });
    }

    // ── stop ──────────────────────────────────────────────────────────────────
    if (sub === 'stop') {
      const queue = useQueue(interaction.guild.id);
      if (!queue) return interaction.reply({ content: '❌ Es spielt gerade nichts!', flags: 64 });
      queue.delete();
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('⏹️ Musik gestoppt und Queue geleert.')],
      });
    }

    // ── queue ─────────────────────────────────────────────────────────────────
    if (sub === 'queue') {
      const queue = useQueue(interaction.guild.id);
      if (!queue?.currentTrack) return interaction.reply({ content: '❌ Queue ist leer!', flags: 64 });

      const page    = interaction.options.getInteger('seite') || 1;
      const perPage = 10;
      const tracks  = queue.tracks.toArray();
      const pages   = Math.ceil(tracks.length / perPage) || 1;
      const slice   = tracks.slice((page - 1) * perPage, page * perPage);

      const desc = slice.length > 0
        ? slice.map((t, i) => `\`${(page - 1) * perPage + i + 1}.\` **${t.title}** — ${t.author} \`${t.duration}\``).join('\n')
        : '_Keine weiteren Songs_';

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('📋 Warteschlange')
            .setColor(0x3b82f6)
            .setDescription(`**Spielt gerade:** [${queue.currentTrack.title}](${queue.currentTrack.url})\n\n${desc}`)
            .setFooter({ text: `Seite ${page}/${pages} · ${tracks.length} Songs gesamt` }),
        ],
      });
    }

    // ── nowplaying ────────────────────────────────────────────────────────────
    if (sub === 'nowplaying') {
      const queue = useQueue(interaction.guild.id);
      if (!queue?.currentTrack) return interaction.reply({ content: '❌ Es spielt gerade nichts!', flags: 64 });

      const track = queue.currentTrack;
      const pos   = queue.node.getTimestamp();
      const curr  = pos?.current?.value || 0;
      const tot   = pos?.total?.value   || track.durationMS || 0;

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🎵 Spielt gerade')
            .setDescription(`**[${track.title}](${track.url})**\nvon ${track.author}`)
            .setThumbnail(track.thumbnail)
            .setColor(0x3b82f6)
            .addFields(
              { name: 'Fortschritt', value: `\`${formatDuration(curr)}\` ${progressBar(curr, tot)} \`${formatDuration(tot)}\``, inline: false },
              { name: '🔁 Loop',       value: ['Aus', 'Song', 'Queue'][queue.repeatMode], inline: true },
              { name: '🔊 Lautstärke', value: `${queue.node.volume}%`,                    inline: true },
              { name: '📋 Queue',      value: `${queue.tracks.size} Song(s)`,             inline: true },
            )
            .setFooter({ text: `Angefragt von ${track.requestedBy?.username || 'Unbekannt'}` })
            .setTimestamp(),
        ],
        components: [buildControlsRow(queue.node.isPaused())],
      });
    }

    // ── loop ──────────────────────────────────────────────────────────────────
    if (sub === 'loop') {
      const queue = useQueue(interaction.guild.id);
      if (!queue) return interaction.reply({ content: '❌ Keine aktive Queue!', flags: 64 });
      const modus = parseInt(interaction.options.getString('modus', true));
      queue.setRepeatMode(modus);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x3b82f6).setDescription(`🔁 Loop-Modus: **${['Aus', 'Song', 'Queue'][modus]}**`)],
      });
    }

    // ── volume ────────────────────────────────────────────────────────────────
    if (sub === 'volume') {
      const queue = useQueue(interaction.guild.id);
      if (!queue) return interaction.reply({ content: '❌ Keine aktive Queue!', flags: 64 });
      const vol = interaction.options.getInteger('wert', true);
      queue.node.setVolume(vol);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x3b82f6).setDescription(`🔊 Lautstärke auf **${vol}%** gesetzt.`)],
        flags: 64,
      });
    }

    // ── remove ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const queue = useQueue(interaction.guild.id);
      if (!queue?.tracks.size) return interaction.reply({ content: '❌ Queue ist leer!', flags: 64 });
      const pos   = interaction.options.getInteger('position', true) - 1;
      const track = queue.tracks.at(pos);
      if (!track) return interaction.reply({ content: '❌ Song nicht gefunden!', flags: 64 });
      queue.tracks.remove(pos);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x3b82f6).setDescription(`🗑️ **${track.title}** entfernt.`)],
        flags: 64,
      });
    }

    // ── shuffle ───────────────────────────────────────────────────────────────
    if (sub === 'shuffle') {
      const queue = useQueue(interaction.guild.id);
      if (!queue?.tracks.size) return interaction.reply({ content: '❌ Queue ist leer!', flags: 64 });
      queue.tracks.shuffle();
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x3b82f6).setDescription(`🔀 Queue mit **${queue.tracks.size}** Songs gemischt!`)],
      });
    }
  },
};