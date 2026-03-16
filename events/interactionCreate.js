const { handleMusicButton } = require('../musicSetup');
const appeal = require('../commands/appeal');

module.exports = {
  name: 'interactionCreate',
  /**
   * @param {import('discord.js').Interaction} interaction
   */
  async execute(interaction) {

    // ── Autocomplete ────────────────────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      const command = interaction.client?.commands?.get(interaction.commandName);
      if (command?.autocomplete) {
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          console.error(`[Autocomplete] Fehler bei /${interaction.commandName}:`, error);
        }
      }
      return;
    }

    // ── Modal Submits ───────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {

      // Appeal Modal
      if (interaction.customId === 'appeal_modal') {
        try {
          return await appeal.handleModal(interaction);
        } catch (error) {
          console.error('[Appeal] Modal-Fehler:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Fehler beim Einreichen des Appeals!', flags: 64 }).catch(() => {});
          }
        }
        return;
      }

      // Appeal Review Modal
      if (interaction.customId.startsWith('appeal_review_')) {
        try {
          return await appeal.handleReviewModal(interaction);
        } catch (error) {
          console.error('[Appeal] Review-Modal-Fehler:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Fehler beim Bearbeiten des Appeals!', flags: 64 }).catch(() => {});
          }
        }
        return;
      }

      return;
    }

    // ── Button Interactions ─────────────────────────────────────────────────
    if (interaction.isButton()) {

      // Musik-Buttons
      if (interaction.customId.startsWith('music_')) {
        try {
          return await handleMusicButton(interaction);
        } catch (error) {
          console.error('[Music] Button-Fehler:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Fehler beim Verarbeiten des Musik-Buttons!', flags: 64 }).catch(() => {});
          }
        }
        return;
      }

      // Appeal-Buttons (Annehmen / Ablehnen / In Bearbeitung)
      if (
        interaction.customId.startsWith('appeal_accept_') ||
        interaction.customId.startsWith('appeal_deny_')   ||
        interaction.customId.startsWith('appeal_pending_')
      ) {
        try {
          return await appeal.handleButton(interaction);
        } catch (error) {
          console.error('[Appeal] Button-Fehler:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Fehler beim Verarbeiten des Appeals!', flags: 64 }).catch(() => {});
          }
        }
        return;
      }

      // Channel-Delete-Button
      if (interaction.customId.startsWith('channel_delete_')) {
        const channelDeleteHandler = require('./channelDelete');
        try {
          return await channelDeleteHandler.handleButton(interaction);
        } catch (error) {
          console.error('Button Error:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Fehler!', flags: 64 }).catch(() => {});
          }
        }
        return;
      }

      // Ban-Request-Buttons
      if (interaction.customId.startsWith('ban_')) {
        const banRequestHandler = require('../commands/interactive_ban_request');
        try {
          return await banRequestHandler.handleButton(interaction);
        } catch (error) {
          console.error('Ban Button Error:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Fehler beim Verarbeiten der Ban-Anfrage!', flags: 64 }).catch(() => {});
          }
        }
        return;
      }

      // Bannlist-Buttons
      if (interaction.customId.startsWith('bannlist_') && !interaction.customId.includes('page_info')) {
        const bannlistHandler = require('../commands/bannlist');
        try {
          return await bannlistHandler.handleButton(interaction);
        } catch (error) {
          console.error('Bannlist Button Error:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Fehler beim Laden der Seite!', flags: 64 }).catch(() => {});
          }
        }
        return;
      }

      // Ticket schließen
      if (interaction.customId.startsWith('ticket_close_')) {
        const ticketPanel = require('../commands/ticketPanel');
        try {
          return await ticketPanel.handleCloseTicket(interaction);
        } catch (error) {
          console.error('Ticket Close Error:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Fehler beim Schließen des Tickets!', flags: 64 }).catch(() => {});
          }
        }
        return;
      }
    }

    // ── Select Menus ────────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {

      // Ticket Kategorie
      if (interaction.customId === 'ticket_category_select') {
        const ticketPanel = require('../commands/ticketPanel');
        const selectedCategory = interaction.values[0];
        try {
          return await ticketPanel.handleCreateTicket(interaction, selectedCategory);
        } catch (error) {
          console.error('Ticket Create Error:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Fehler beim Erstellen des Tickets!', flags: 64 }).catch(() => {});
          }
        }
        return;
      }
    }

    // ── Slash Commands ──────────────────────────────────────────────────────
    const isSlash =
      typeof interaction.isChatInputCommand === 'function'
        ? interaction.isChatInputCommand()
        : (typeof interaction.isCommand === 'function'
            ? interaction.isCommand()
            : interaction.type?.toString?.().includes('ApplicationCommand'));

    if (!isSlash) return;

    const client  = interaction.client;
    const command = client?.commands?.get(interaction.commandName);

    if (!command) {
      try {
        const msg = `⚠️ Befehl \`${interaction.commandName}\` nicht gefunden.`;
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: msg, ephemeral: true });
        } else {
          await interaction.reply({ content: msg, ephemeral: true });
        }
      } catch (_) {}
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`[interactionCreate] Fehler beim Ausführen von /${interaction.commandName}:`, error);
      const msg = '❌ Beim Ausführen des Befehls ist ein Fehler aufgetreten.';
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: msg, ephemeral: true });
        } else {
          await interaction.reply({ content: msg, ephemeral: true });
        }
      } catch (_) {}
    }
  },
};