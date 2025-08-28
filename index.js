require('dotenv').config();
const fs = require('fs');
const express = require('express');
const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const ms = require('ms');

// --- Express server for Render + UptimeRobot ---
const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// --- Discord client ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// --- Warn system storage ---
const warnsFile = './warns.json';
let warns = {};
if (fs.existsSync(warnsFile)) warns = JSON.parse(fs.readFileSync(warnsFile));

// --- Log channel storage ---
const logFile = './logchannel.json';
let logConfig = {};
if (fs.existsSync(logFile)) logConfig = JSON.parse(fs.readFileSync(logFile));

// --- Helpers ---
function saveWarns() {
    fs.writeFileSync(warnsFile, JSON.stringify(warns, null, 2));
}
function saveLogConfig() {
    fs.writeFileSync(logFile, JSON.stringify(logConfig, null, 2));
}
function sendEmbed(channel, title, description, color = 0x5865F2) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
    return channel.send({ embeds: [embed] });
}
function getLogChannel(guild) {
    const id = logConfig[guild.id];
    if (!id) return null;
    return guild.channels.cache.get(id);
}

// --- Bot ready ---
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: 'you sleep', type: 3 }], // Watching
        status: 'online'
    });
});

// ========== COMMAND HANDLER ==========
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    // --- Kick ---
    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers))
            return sendEmbed(message.channel, 'Error', 'You do not have permission to kick members.', 0xFF0000);

        const member = message.mentions.members.first();
        if (!member) return sendEmbed(message.channel, 'Error', 'Please mention a user to kick.', 0xFF0000);

        try {
            await member.kick();
            return sendEmbed(message.channel, 'Member Kicked', `${member.user.tag} was kicked.`);
        } catch {
            return sendEmbed(message.channel, 'Error', 'I couldn’t kick that user.', 0xFF0000);
        }
    }

    // --- Ban ---
    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
            return sendEmbed(message.channel, 'Error', 'You do not have permission to ban members.', 0xFF0000);

        const member = message.mentions.members.first();
        if (!member) return sendEmbed(message.channel, 'Error', 'Please mention a user to ban.', 0xFF0000);

        try {
            await member.ban();
            return sendEmbed(message.channel, 'Member Banned', `${member.user.tag} was banned.`);
        } catch {
            return sendEmbed(message.channel, 'Error', 'I couldn’t ban that user.', 0xFF0000);
        }
    }

    // --- Hackban ---
    if (command === 'hackban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
            return sendEmbed(message.channel, 'Error', 'You do not have permission to ban users.', 0xFF0000);

        const userId = args[0];
        if (!userId) return sendEmbed(message.channel, 'Error', 'Please provide a user ID to ban.', 0xFF0000);

        try {
            await message.guild.members.ban(userId);
            return sendEmbed(message.channel, 'Hackban Success', `User with ID ${userId} was banned.`);
        } catch {
            return sendEmbed(message.channel, 'Error', 'I couldn’t hackban that user. Check the ID.', 0xFF0000);
        }
    }

    // --- Timeout ---
    if (command === 'timeout') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
            return sendEmbed(message.channel, 'Error', 'You don’t have permission to timeout members.', 0xFF0000);

        const member = message.mentions.members.first();
        const time = args[1];
        if (!member || !time) return sendEmbed(message.channel, 'Usage', '!timeout @user 10m', 0xFF0000);

        const duration = ms(time);
        if (!duration || duration > 28 * 24 * 60 * 60 * 1000)
            return sendEmbed(message.channel, 'Error', 'Invalid timeout duration (max 28 days).', 0xFF0000);

        try {
            await member.timeout(duration, `Timed out by ${message.author.tag}`);
            return sendEmbed(message.channel, 'Member Timed Out', `${member.user.tag} was timed out for ${time}.`);
        } catch {
            return sendEmbed(message.channel, 'Error', 'I couldn’t timeout that user.', 0xFF0000);
        }
    }

    // --- Untimeout ---
    if (command === 'untimeout') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
            return sendEmbed(message.channel, 'Error', 'You don’t have permission to remove timeouts.', 0xFF0000);

        const member = message.mentions.members.first();
        if (!member) return sendEmbed(message.channel, 'Error', 'Please mention a user to remove timeout.', 0xFF0000);

        try {
            await member.timeout(null, `Timeout removed by ${message.author.tag}`);
            return sendEmbed(message.channel, 'Timeout Removed', `${member.user.tag}'s timeout was removed.`);
        } catch {
            return sendEmbed(message.channel, 'Error', 'I couldn’t remove that timeout.', 0xFF0000);
        }
    }

    // --- Say (plain message) ---
    if (command === 'say') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
            return sendEmbed(message.channel, 'Error', 'You do not have permission to use this.', 0xFF0000);

        const text = args.join(' ');
        if (!text) return sendEmbed(message.channel, 'Error', 'Please provide text to say.', 0xFF0000);

        return message.channel.send(text);
    }

    // --- Ping ---
    if (command === 'ping') {
        const botPing = client.ws.ping;
        const msg = await message.channel.send('Pinging...');
        const roundTrip = msg.createdTimestamp - message.createdTimestamp;
        msg.delete();

        return sendEmbed(message.channel, 'Pong!', `Bot latency: **${roundTrip}ms**\nAPI latency: **${botPing}ms**`);
    }

    // --- Warn ---
    if (command === 'warn') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
            return sendEmbed(message.channel, 'Error', 'You do not have permission to warn members.', 0xFF0000);

        const member = message.mentions.members.first();
        if (!member) return sendEmbed(message.channel, 'Error', 'Please mention a user to warn.', 0xFF0000);

        if (!warns[member.id]) warns[member.id] = 0;
        warns[member.id]++;
        saveWarns();

        let msg = `${member.user.tag} has been warned. They now have **${warns[member.id]} warns**.`;

        if (warns[member.id] === 5) {
            await member.timeout(10 * 60 * 1000, '5 warnings reached');
            msg += `\nAutomatic Action: Muted for 10 minutes.`;
        } else if (warns[member.id] === 10) {
            await member.ban({ reason: '10 warnings reached' });
            msg += `\nAutomatic Action: Banned.`;
        }

        return sendEmbed(message.channel, 'User Warned', msg);
    }

    // --- Help ---
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('Bot Commands')
            .setColor(0x5865F2)
            .setDescription([
                '**!kick @user** – Kick a user',
                '**!ban @user** – Ban a user',
                '**!hackban <id>** – Ban a user by ID',
                '**!timeout @user <time>** – Timeout a user',
                '**!untimeout @user** – Remove timeout',
                '**!say <msg>** – Bot says your message (Admins only)',
                '**!ping** – Show bot latency',
                '**!warn @user** – Warn a user (5 = mute, 10 = ban)',
                '**!purge <number>** – Delete recent messages',
                '**!purge after <messageID>** – Delete messages after a specific message',
                '**!setlog <#channel | id>** – Set log channel',
                '**!clearlog** – Stop logging events',
            ].join('\n'))
            .setTimestamp();
        return message.channel.send({ embeds: [helpEmbed] });
    }

    // --- Set log channel ---
    if (command === 'setlog') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
            return sendEmbed(message.channel, 'Error', 'You need Administrator permission to set the log channel.', 0xFF0000);

        const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
        if (!channel) return sendEmbed(message.channel, 'Error', 'Please mention a valid channel or provide a channel ID.', 0xFF0000);

        logConfig[message.guild.id] = channel.id;
        saveLogConfig();

        return sendEmbed(message.channel, 'Log Channel Set', `Logs will now be sent to ${channel}.`);
    }

    // --- Clear log channel ---
    if (command === 'clearlog') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
            return sendEmbed(message.channel, 'Error', 'You need Administrator permission to clear the log channel.', 0xFF0000);

        delete logConfig[message.guild.id];
        saveLogConfig();

        return sendEmbed(message.channel, 'Log Channel Cleared', 'Logging has been disabled for this server.');
    }

    // --- Purge ---
    if (command === 'purge') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
            return sendEmbed(message.channel, 'Error', 'You do not have permission to manage messages.', 0xFF0000);

        if (!args[0]) return sendEmbed(message.channel, 'Error', 'Usage: `!purge <number>` or `!purge after <messageID>`', 0xFF0000);

        if (args[0].toLowerCase() === 'after') {
            const afterID = args[1];
            if (!afterID) return sendEmbed(message.channel, 'Error', 'Please provide a message ID.', 0xFF0000);

            try {
                const messages = await message.channel.messages.fetch({ limit: 100 });
                const msgsToDelete = messages.filter(m => m.id > afterID);
                await message.channel.bulkDelete(msgsToDelete, true);
                return sendEmbed(message.channel, 'Messages Deleted', `Deleted ${msgsToDelete.size} messages after ID ${afterID}.`);
            } catch (err) {
                console.error(err);
                return sendEmbed(message.channel, 'Error', 'Could not delete messages. Make sure they are under 14 days old.', 0xFF0000);
            }
        } else {
            const amount = parseInt(args[0]);
            if (isNaN(amount) || amount < 1 || amount > 100)
                return sendEmbed(message.channel, 'Error', 'Please provide a number between 1 and 100.', 0xFF0000);

            try {
                await message.channel.bulkDelete(amount, true);
                return sendEmbed(message.channel, 'Messages Deleted', `Deleted ${amount} messages.`);
            } catch (err) {
                console.error(err);
                return sendEmbed(message.channel, 'Error', 'Could not delete messages. Make sure they are under 14 days old.', 0xFF0000);
            }
        }
    }
});

// ========== LOGGING ==========
client.on('guildMemberAdd', member => {
    const logChannel = getLogChannel(member.guild);
    if (!logChannel) return;
    const embed = new EmbedBuilder()
        .setTitle('Member Joined')
        .setDescription(`${member.user.tag} joined.\nAccount created <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
        .setColor(0x00FF00)
        .setTimestamp();
    logChannel.send({ embeds: [embed] });
});

client.on('guildMemberRemove', member => {
    const logChannel = getLogChannel(member.guild);
    if (!logChannel) return;
    const roles = member.roles.cache.map(r => r.name).join(', ') || 'None';
    const embed = new EmbedBuilder()
        .setTitle('Member Left')
        .setDescription(`${member.user.tag} left.\nHad roles: ${roles}\nJoined <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`)
        .setColor(0xFF0000)
        .setTimestamp();
    logChannel.send({ embeds: [embed] });
});

client.on('guildMemberUpdate', (oldM, newM) => {
    const logChannel = getLogChannel(newM.guild);
    if (!logChannel) return;

    if (oldM.nickname !== newM.nickname) {
        const embed = new EmbedBuilder()
            .setTitle('Nickname Changed')
            .setDescription(`${newM.user.tag}\nBefore: ${oldM.nickname || 'None'}\nAfter: ${newM.nickname || 'None'}`)
            .setColor(0xFFFF00)
            .setTimestamp();
        logChannel.send({ embeds: [embed] });
    }

    if (oldM.roles.cache.size !== newM.roles.cache.size) {
        const before = oldM.roles.cache.map(r => r.name).join(', ') || 'None';
        const after = newM.roles.cache.map(r => r.name).join(', ') || 'None';
        const embed = new EmbedBuilder()
            .setTitle('Roles Updated')
            .setDescription(`${newM.user.tag}\nBefore: ${before}\nAfter: ${after}`)
            .setColor(0x00FFFF)
            .setTimestamp();
        logChannel.send({ embeds: [embed] });
    }
});

client.on('messageDelete', msg => {
    if (!msg.guild || msg.author?.bot) return;
    const logChannel = getLogChannel(msg.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('Message Deleted')
        .setDescription(`Message deleted in ${msg.channel}\nBy **${msg.author.tag}**\n\n**Content:**\n${msg.content || '[No content]'}`)
        .setColor(0xFF0000)
        .setTimestamp();
    logChannel.send({ embeds: [embed] });
});

client.on('messageUpdate', (oldMsg, newMsg) => {
    if (!newMsg.guild || newMsg.author?.bot) return;
    const logChannel = getLogChannel(newMsg.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('Message Edited')
        .setDescription([
            `Message edited in ${newMsg.channel}`,
            ``,
            `By **${newMsg.author.tag}**`,
            ``,
            `**Before:**\n${oldMsg.content || '[No content]'}`,
            ``,
            `**After:**\n${newMsg.content || '[No content]'}`,
        ].join('\n'))
        .setColor(0xFFFF00)
        .setTimestamp();
    logChannel.send({ embeds: [embed] });
});

// --- Login ---
client.login(process.env.DISCORD_TOKEN);
