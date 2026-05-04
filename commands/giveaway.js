const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const GIVEAWAY_FILE = path.join(DATA_DIR, 'giveaways.json');

// Hilfsfunktionen
function loadGiveaways() {
  try {
    if (!fs.existsSync(GIVEAWAY_FILE)) return {};
    return JSON.parse(fs.readFileSync(GIVEAWAY_FILE, 'utf-8'));
  } catch (e) {
    return {};
  }
}

function saveGiveaways(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(GIVEAWAY_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Fehler beim Speichern von Giveaways:', e.message);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Giveaway-System verwalten')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Startet einen neuen Giveaway')
        .addStringOption(opt =>
          opt.setName('preis')
            .setDescription('Der Preis des Giveaways')
            .setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('anzahl')
            .setDescription('Anzahl der Gewinner')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('dauer')
            .setDescription('Dauer des Giveaways in Minuten')
            .setMinValue(1)
            .setMaxValue(10080) // 7 Tage max
            .setRequired(true))
    )
    
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('Beendet einen aktiven Giveaway')
        .addStringOption(opt =>
          opt.setName('id')
            .setDescription('Die Giveaway-ID')
            .setRequired(true)
            .setAutocomplete(true))
    )
    
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Zeigt alle aktiven Giveaways')
    ),

  async autocomplete(interaction) {
    const giveaways = loadGiveaways();
    const guilds = giveaways[interaction.guild.id] || [];
    
    const choices = guilds
      .filter(g => g.active)
      .map(g => ({
        name: `${g.prize} - ${new Date(g.endTime).toLocaleString('de-DE')}`,
        value: g.id
      }));

    await interaction.respond(choices.slice(0, 25));
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'start') {
      return await startGiveaway(interaction);
    } else if (subcommand === 'end') {
      return await endGiveaway(interaction);
    } else if (subcommand === 'list') {
      return await listGiveaways(interaction);
    }
  }
};

async function startGiveaway(interaction) {
  const prize = interaction.options.getString('preis');
  const winnerCount = interaction.options.getInteger('anzahl');
  const duration = interaction.options.getInteger('dauer');

  const giveawayId = `giveaway_${Date.now()}`;
  const startTime = Date.now();
  const endTime = startTime + duration * 60 * 1000;

  // Embed erstellen
  const giveawayEmbed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🎁 GIVEAWAY 🎁')
    .setDescription(`**${prize}**`)
    .addFields(
      { name: 'Gewinner', value: `${winnerCount}`, inline: true },
      { name: 'Endet', value: `<t:${Math.floor(endTime / 1000)}:F>`, inline: true },
      { name: 'Verbleibend', value: `<t:${Math.floor(endTime / 1000)}:R>`, inline: true }
    )
    .setFooter({ text: `ID: ${giveawayId}` })
    .setTimestamp();

  // Button
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway_join_${giveawayId}`)
      .setLabel('🎁 Teilnehmen')
      .setStyle(ButtonStyle.Success)
  );

  // Nachricht senden
  const message = await interaction.channel.send({
    embeds: [giveawayEmbed],
    components: [row]
  });

  // Giveaway speichern
  const giveaways = loadGiveaways();
  if (!giveaways[interaction.guild.id]) giveaways[interaction.guild.id] = [];

  giveaways[interaction.guild.id].push({
    id: giveawayId,
    messageId: message.id,
    channelId: interaction.channel.id,
    prize: prize,
    winnerCount: winnerCount,
    startTime: startTime,
    endTime: endTime,
    active: true,
    participants: [],
    winner: null,
    guildId: interaction.guild.id
  });

  saveGiveaways(giveaways);

  // Auto-Beendigung nach Ablauf
  const timeoutDuration = endTime - Date.now();
  setTimeout(() => autoEndGiveaway(interaction.guild.id, giveawayId, interaction.guild), timeoutDuration);

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Giveaway gestartet')
        .setDescription(`Giveaway für **${prize}** wurde gestartet!\n\nEndet: <t:${Math.floor(endTime / 1000)}:F>`)
    ],
    flags: 64
  });
}

async function endGiveaway(interaction) {
  const giveawayId = interaction.options.getString('id');
  const giveaways = loadGiveaways();
  const guildGiveaways = giveaways[interaction.guild.id] || [];
  const giveaway = guildGiveaways.find(g => g.id === giveawayId);

  if (!giveaway) {
    return interaction.reply({
      content: '❌ Giveaway nicht gefunden!',
      flags: 64
    });
  }

  if (!giveaway.active) {
    return interaction.reply({
      content: '❌ Dieser Giveaway ist bereits beendet!',
      flags: 64
    });
  }

  try {
    // Kanal und Nachricht abrufen
    const channel = await interaction.guild.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(giveaway.messageId);

    // Gewinner auswählen
    const participants = giveaway.participants;
    if (participants.length === 0) {
      giveaway.active = false;
      saveGiveaways(giveaways);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Keine Teilnehmer')
            .setDescription('Es gab keine Teilnehmer für diesen Giveaway!')
        ],
        flags: 64
      });
    }

    // Zufällige Gewinner auswählen
    const winners = [];
    const winnerCount = Math.min(giveaway.winnerCount, participants.length);

    for (let i = 0; i < winnerCount; i++) {
      const randomIndex = Math.floor(Math.random() * participants.length);
      winners.push(participants[randomIndex]);
      participants.splice(randomIndex, 1);
    }

    // Gewinner-Embed
    const winnerText = winners.map(w => `<@${w}>`).join('\n');
    const winnerEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🎁 GIVEAWAY BEENDET 🎁')
      .setDescription(`**${giveaway.prize}**`)
      .addFields(
        { name: '🏆 Gewinner', value: winnerText || 'Keine' },
        { name: 'Anzahl Teilnehmer', value: `${giveaway.participants.length + winnerCount}` }
      )
      .setTimestamp();

    // Nachricht bearbeiten
    await message.edit({
      embeds: [winnerEmbed],
      components: []
    });

    // Benachrichtigung an Gewinner
    for (const winnerId of winners) {
      try {
        const winner = await interaction.guild.members.fetch(winnerId);
        await winner.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFFD700)
              .setTitle('🎉 Herzlichen Glückwunsch!')
              .setDescription(`Du hast den Giveaway für **${giveaway.prize}** gewonnen!\n\n**Server:** ${interaction.guild.name}`)
          ]
        });
      } catch (e) {
        // User hat DMs deaktiviert
      }
    }

    // Giveaway als beendet markieren
    giveaway.active = false;
    giveaway.winner = winners;
    saveGiveaways(giveaways);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ Giveaway beendet')
          .setDescription(`Gewinner: ${winnerText}`)
      ]
    });

  } catch (error) {
    console.error('Fehler beim Beenden des Giveaways:', error);
    interaction.reply({
      content: `❌ Fehler: ${error.message}`,
      flags: 64
    });
  }
}

async function listGiveaways(interaction) {
  const giveaways = loadGiveaways();
  const guildGiveaways = giveaways[interaction.guild.id] || [];
  const activeGiveaways = guildGiveaways.filter(g => g.active);

  if (activeGiveaways.length === 0) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Keine aktiven Giveaways')
          .setDescription('Es gibt derzeit keine aktiven Giveaways.')
      ],
      flags: 64
    });
  }

  const listEmbed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🎁 Aktive Giveaways')
    .setDescription(
      activeGiveaways
        .map((g, i) => `**${i + 1}.** ${g.prize}\n   Gewinner: ${g.winnerCount} | Endet: <t:${Math.floor(g.endTime / 1000)}:R>`)
        .join('\n')
    );

  await interaction.reply({ embeds: [listEmbed] });
}

async function autoEndGiveaway(guildId, giveawayId, guild) {
  const giveaways = loadGiveaways();
  const guildGiveaways = giveaways[guildId] || [];
  const giveaway = guildGiveaways.find(g => g.id === giveawayId);

  if (!giveaway || !giveaway.active) return;

  try {
    const channel = await guild.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(giveaway.messageId);

    const participants = giveaway.participants;

    if (participants.length === 0) {
      const endEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ GIVEAWAY BEENDET')
        .setDescription(`**${giveaway.prize}**\n\nKeine Teilnehmer!`);

      await message.edit({ embeds: [endEmbed], components: [] });
    } else {
      const winners = [];
      const winnerCount = Math.min(giveaway.winnerCount, participants.length);

      for (let i = 0; i < winnerCount; i++) {
        const randomIndex = Math.floor(Math.random() * participants.length);
        winners.push(participants[randomIndex]);
        participants.splice(randomIndex, 1);
      }

      const winnerText = winners.map(w => `<@${w}>`).join('\n');
      const endEmbed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🎁 GIVEAWAY BEENDET 🎁')
        .setDescription(`**${giveaway.prize}**`)
        .addFields({ name: '🏆 Gewinner', value: winnerText });

      await message.edit({ embeds: [endEmbed], components: [] });
      await channel.send({
        content: `🎉 Glückwunsch an ${winnerText}!\n\nIhr habt den Giveaway für **${giveaway.prize}** gewonnen!`
      });

      giveaway.winner = winners;
    }

    giveaway.active = false;
    saveGiveaways(giveaways);
  } catch (error) {
    console.error('Fehler beim Auto-End Giveaway:', error);
  }
}

// Handler für Giveaway-Buttons (wird in interactionCreate.js aufgerufen)
async function handleGiveawayButton(interaction) {
  if (!interaction.customId.startsWith('giveaway_join_')) return;

  const giveawayId = interaction.customId.replace('giveaway_join_', '');
  const giveaways = loadGiveaways();
  const guildGiveaways = giveaways[interaction.guild.id] || [];
  const giveaway = guildGiveaways.find(g => g.id === giveawayId);

  if (!giveaway) {
    return interaction.reply({
      content: '❌ Dieser Giveaway existiert nicht mehr!',
      flags: 64
    });
  }

  if (!giveaway.active) {
    return interaction.reply({
      content: '❌ Dieser Giveaway ist bereits beendet!',
      flags: 64
    });
  }

  // Überprüfen ob User bereits teilnimmt
  if (giveaway.participants.includes(interaction.user.id)) {
    return interaction.reply({
      content: '❌ Du nimmst bereits an diesem Giveaway teil!',
      flags: 64
    });
  }

  // User hinzufügen
  giveaway.participants.push(interaction.user.id);
  saveGiveaways(giveaways);

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Du nimmst teil!')
        .setDescription(`Du nimmst jetzt am Giveaway für **${giveaway.prize}** teil!\n\nGlücklich: 🍀`)
    ],
    flags: 64
  });
}

module.exports.handleGiveawayButton = handleGiveawayButton;
