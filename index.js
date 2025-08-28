require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const ms = require('ms');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Warn system storage
const warnsFile = './warns.json';
let warns = {};
if (fs.existsSync(warnsFile)) {
    warns = JSON.parse(fs.readFileSync(warnsFile));
}

// Log channel storage
const logFile = './logchannel.json';
let logConfig = {};
if (fs.existsSync(logFile)) {
    logConfig = JSON.parse(fs.readFileSync(logFile));
}

// Helper: Save warns
function saveWarns() {
    fs.writeFileSync(warnsFile, JSON.stringify(warns, null, 2));
}
// Helper: Save log config
function saveLogConfig() {
    fs.writeFileSync(logFile, JSON.stringify(logConfig, null, 2));
}

// Start bot
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

    // Helper: Send embed reply
    function sendEmbed(title, description, color = 0x5865F2) {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setTimestamp();
        return message.channel.send({ embeds: [embed] });
    }

    // --- Kick ---
    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers))
            return sendEmbed('Error', 'You do not have permission to kick members.', 0xFF0000);

        const member = message.mentions.members.first();
        if (!member) return sendEmbed('Error', 'Please mention a user to kick.', 0xFF0000);

        try {
            await member.kick();
            return sendEmbed('Member Kicked', `${member.user.tag} was kicked.`);
        } catch {
            return sendEmbed('Error', 'I couldn’t kick that user.', 0xFF0000);
        }
    }

    // --- Ban ---
    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
            return sendEmbed('Error', 'You do not have permission to ban members.', 0xFF0000);

        const member = message.mentions.members.first();
        if (!member) return sendEmbed('Error', 'Please mention a user to ban.', 0xFF0000);

        try {
            await member.ban();
            return sendEmbed('Member Banned', `${member.user.tag} was banned.`);
        } catch {
            return sendEmbed('Error', 'I couldn’t ban that user.', 0xFF0000);
        }
    }

    // --- Hackban ---
    if (command === 'hackban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
            return sendEmbed('Error', 'You do not have permission to ban users.', 0xFF0000);

        const userId = args[0];
        if (!userId) return sendEmbed('Error', 'Please provide a user ID to ban.', 0xFF0000);

        try {
            await message.guild.members.ban(userId);
            return sendEmbed('Hackban Success', `User with ID ${userId} was banned.`);
        } catch {
            return sendEmbed('Error', 'I couldn’t hackban that user. Check the ID.', 0xFF0000);
        }
    }

    // --- Timeout ---
    if (command === 'timeout') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
            return sendEmbed('Error', 'You don’t have permission to timeout members.', 0xFF0000);

        const member = message.mentions.members.first();
        const time = args[1];
        if (!member || !time) return sendEmbed('Usage', '!timeout @user 10m', 0xFF0000);

        const duration = ms(time);
        if (!duration || duration > 28 * 24 * 60 * 60 * 1000)
            return sendEmbed('Error', 'Invalid timeout duration (max 28 days).', 0xFF0000);

        try {
            await member.timeout(duration, `Timed out by ${message.author.tag}`);
            return sendEmbed('Member Timed Out', `${member.user.tag} was timed out for ${time}.`);
        } catch {
            return sendEmbed('Error', 'I couldn’t timeout that user.', 0xFF0000);
        }
    }

    // --- Untimeout ---
    if (command === 'untimeout') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
            return sendEmbed('Error', 'You don’t have permission to remove timeouts.', 0xFF0000);

        const member = message.mentions.members.first();
        if (!member) return sendEmbed('Error', 'Please mention a user to remove timeout.', 0xFF0000);

        try {
            await member.timeout(null, `Timeout removed by ${message.author.tag}`);
            return sendEmbed('Timeout Removed', `${member.user.tag}'s timeout was removed.`);
        } catch {
            return sendEmbed('Error', 'I couldn’t remove that timeout.', 0xFF0000);
        }
    }

    // --- Say (regular message, not embed) ---
    if (command === 'say') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
            return sendEmbed('Error', 'You do not have permission to use this.', 0xFF0000);

        const text = args.join(' ');
        if (!text) return sendEmbed('Error', 'Please provide text to say.', 0xFF0000);

        return message.channel.send(text);
    }

    // --- Ping ---
    if (command === 'ping') {
        const botPing = client.ws.ping;
        const msg = await message.channel.send('Pinging...');
        const roundTrip = msg.createdTimestamp - message.createdTimestamp;
        msg.delete();

        return sendEmbed('Pong!', `Bot latency: **${roundTrip}ms**\nAPI latency: **${botPing}ms**`);
    }

    // --- Warn ---
    if (command === 'warn') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
            return sendEmbed('Error', 'You do not have permission to warn members.', 0xFF0000);

        const member = message.mentions.members.first();
        if (!member) return sendEmbed('Error', 'Please mention a user to warn.', 0xFF0000);

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

        return sendEmbed('User Warned', msg);
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
                '**!setlog <#channel | id>** – Set log channel',
                '**!clearlog** – Stop logging events',
            ].join('\n'))
            .setTimestamp();
        return message.channel.send({ embeds: [helpEmbed] });
    }

    // --- Set Log Channel ---
    if (command === 'setlog') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
            return sendEmbed('Error', 'You need Administrator permission to set the log channel.', 0xFF0000);

        const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
        if (!channel) return sendEmbed('Error', 'Please mention a valid channel or provide a channel ID.', 0xFF0000);

        logConfig[message.guild.id] = channel.id;
        saveLogConfig();

        return sendEmbed('Log Channel Set', `Logs will now be sent to ${channel}.`);
    }

    // --- Clear Log Channel ---
    if (command === 'clearlog') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
            return sendEmbed('Error', 'You need Administrator permission to clear the log channel.', 0xFF0000);

        delete logConfig[message.guild.id];
        saveLogConfig();

        return sendEmbed('Log Channel Cleared', 'Logging has been disabled for this server.');
    }
});

// ========== LOGGING ==========
function getLogChannel(guild) {
    const id = logConfig[guild.id];
    if (!id) return null;
    return guild.channels.cache.get(id);
}

// Member join
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

// Member leave
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

// Nickname/Role updates
client.on('guildMemberUpdate', (oldM, newM) => {
    const logChannel = getLogChannel(newM.guild);
    if (!logChannel) return;

    if (oldM.nickname !== newM.nickname) {
        const embed = new EmbedBuilder()
            .setTitle('Nickname Changed')
            .setDescription(`${newM.user.tag}\nBefore: ${oldM.nickname || 'None'}\nAfter: ${newM.nickname || 'None'}`)
            .setColor(0xFFFF00)
            .setTimestamp();
        return logChannel.send({ embeds: [embed] });
    }

    if (oldM.roles.cache.size !== newM.roles.cache.size) {
        const before = oldM.roles.cache.map(r => r.name).join(', ') || 'None';
        const after = newM.roles.cache.map(r => r.name).join(', ') || 'None';
        const embed = new EmbedBuilder()
            .setTitle('Roles Updated')
            .setDescription(`${newM.user.tag}\nBefore: ${before}\nAfter: ${after}`)
            .setColor(0x00FFFF)
            .setTimestamp();
        return logChannel.send({ embeds: [embed] });
    }
});

// Message delete
client.on('messageDelete', async msg => {
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

// Message edit
client.on('messageUpdate', async (oldMsg, newMsg) => {
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

// Login
client.login(process.env.DISCORD_TOKEN);
