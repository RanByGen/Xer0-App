require("dotenv").config();
const { 
    Client, 
    GatewayIntentBits, 
    PermissionsBitField, 
    ActivityType, 
    EmbedBuilder 
} = require("discord.js");
const fs = require("fs");
const ms = require("ms");
const express = require("express");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Load config + warns JSON
let config = {};
let warns = {};
if (fs.existsSync("config.json")) config = JSON.parse(fs.readFileSync("config.json"));
if (fs.existsSync("warns.json")) warns = JSON.parse(fs.readFileSync("warns.json"));

// Express server for UptimeRobot
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(3000, () => console.log("Web server running on port 3000"));

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity("you sleep", { type: ActivityType.Watching });
});

client.on("messageCreate", async message => {
    if (message.author.bot || !message.guild) return;

    const prefix = "!";
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    function sendEmbed(channel, description) {
        const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setDescription(description);
        channel.send({ embeds: [embed] });
    }

    // -------------------- MODERATION COMMANDS -------------------- //

    if (command === "kick") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) 
            return sendEmbed(message.channel, "You do not have permission to kick members.");
        const member = message.mentions.members.first();
        if (!member) return sendEmbed(message.channel, "Please mention a user to kick.");
        try {
            await member.kick();
            sendEmbed(message.channel, `Kicked ${member.user.tag}`);
        } catch {
            sendEmbed(message.channel, "I couldn’t kick that user.");
        }
    }

    if (command === "ban") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) 
            return sendEmbed(message.channel, "You do not have permission to ban members.");
        const member = message.mentions.members.first();
        if (!member) return sendEmbed(message.channel, "Please mention a user to ban.");
        try {
            await member.ban();
            sendEmbed(message.channel, `Banned ${member.user.tag}`);
        } catch {
            sendEmbed(message.channel, "I couldn’t ban that user.");
        }
    }

    if (command === "hackban") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) 
            return sendEmbed(message.channel, "You do not have permission to ban members.");
        const userId = args[0];
        if (!userId) return sendEmbed(message.channel, "Please provide a user ID to ban.");
        try {
            await message.guild.members.ban(userId);
            sendEmbed(message.channel, `Banned user with ID ${userId}`);
        } catch {
            sendEmbed(message.channel, "I couldn’t ban that user ID.");
        }
    }

    if (command === "timeout") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) 
            return sendEmbed(message.channel, "You don’t have permission to timeout members.");
        const member = message.mentions.members.first();
        const time = args[1];
        if (!member || !time) return sendEmbed(message.channel, "Usage: !timeout @user 10m");
        const duration = ms(time);
        if (!duration || duration > 28 * 24 * 60 * 60 * 1000) 
            return sendEmbed(message.channel, "Invalid timeout duration (max is 28 days).");
        try {
            await member.timeout(duration, `Timed out by ${message.author.tag}`);
            sendEmbed(message.channel, `Timed out ${member.user.tag} for ${time}`);
        } catch {
            sendEmbed(message.channel, "I couldn’t timeout that user.");
        }
    }

    if (command === "untimeout") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) 
            return sendEmbed(message.channel, "You don’t have permission to remove timeouts.");
        const member = message.mentions.members.first();
        if (!member) return sendEmbed(message.channel, "Please mention a user to remove timeout.");
        try {
            await member.timeout(null, `Timeout removed by ${message.author.tag}`);
            sendEmbed(message.channel, `Removed timeout from ${member.user.tag}`);
        } catch {
            sendEmbed(message.channel, "I couldn’t remove the timeout from that user.");
        }
    }

    if (command === "say") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) 
            return sendEmbed(message.channel, "You do not have permission to use this command.");
        const text = args.join(" ");
        if (!text) return sendEmbed(message.channel, "Please provide a message for me to say.");
        message.delete().catch(() => {});
        message.channel.send(text);
    }

    if (command === "ping") {
        const sent = await message.channel.send({ content: "Pinging..." });
        const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setDescription(`Bot Latency: ${sent.createdTimestamp - message.createdTimestamp}ms | API Latency: ${Math.round(client.ws.ping)}ms`);
        sent.edit({ embeds: [embed] });
    }

    if (command === "warn") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) 
            return sendEmbed(message.channel, "You do not have permission to warn members.");
        const member = message.mentions.members.first();
        if (!member) return sendEmbed(message.channel, "Please mention a user to warn.");

        if (!warns[message.guild.id]) warns[message.guild.id] = {};
        if (!warns[message.guild.id][member.id]) warns[message.guild.id][member.id] = 0;

        warns[message.guild.id][member.id] += 1;
        fs.writeFileSync("warns.json", JSON.stringify(warns, null, 2));

        sendEmbed(message.channel, `${member.user.tag} has been warned. Total warns: ${warns[message.guild.id][member.id]}`);

        if (warns[message.guild.id][member.id] === 5) {
            try {
                await member.timeout(60 * 60 * 1000, "Reached 5 warns");
                sendEmbed(message.channel, `${member.user.tag} has been muted for 1 hour due to 5 warnings.`);
            } catch {}
        } else if (warns[message.guild.id][member.id] === 10) {
            try {
                await member.ban({ reason: "Reached 10 warns" });
                sendEmbed(message.channel, `${member.user.tag} has been banned due to 10 warnings.`);
            } catch {}
        }
    }

    if (command === "help") {
        sendEmbed(message.channel, `Available commands:
kick, ban, hackban, timeout, untimeout, say, ping, warn, setlogchannel, viewlogchannel, enablelogs, disablelogs`);
    }

    // -------------------- LOG CONFIG -------------------- //

    if (command === "setlogchannel") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) 
            return sendEmbed(message.channel, "You do not have permission to set the log channel.");
        const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
        if (!channel) return sendEmbed(message.channel, "Please mention a valid channel or provide its ID.");

        if (!config[message.guild.id]) config[message.guild.id] = {};
        config[message.guild.id].logChannel = channel.id;
        config[message.guild.id].loggingEnabled = true;
        fs.writeFileSync("config.json", JSON.stringify(config, null, 2));

        sendEmbed(message.channel, `Log channel set to ${channel}.`);
    }

    if (command === "viewlogchannel") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) 
            return sendEmbed(message.channel, "You do not have permission to view the log channel.");

        if (!config[message.guild.id] || !config[message.guild.id].logChannel) {
            return sendEmbed(message.channel, "No log channel has been set for this server.");
        }

        const logChannel = message.guild.channels.cache.get(config[message.guild.id].logChannel);
        if (!logChannel) {
            return sendEmbed(message.channel, "The saved log channel no longer exists.");
        }

        sendEmbed(message.channel, `The current log channel is ${logChannel}.`);
    }

    if (command === "enablelogs") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) 
            return sendEmbed(message.channel, "You do not have permission to enable logs.");
        if (!config[message.guild.id]) config[message.guild.id] = {};
        config[message.guild.id].loggingEnabled = true;
        fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
        sendEmbed(message.channel, "Logging has been **enabled** for this server.");
    }

    if (command === "disablelogs") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) 
            return sendEmbed(message.channel, "You do not have permission to disable logs.");
        if (!config[message.guild.id]) config[message.guild.id] = {};
        config[message.guild.id].loggingEnabled = false;
        fs.writeFileSync("config.json", JSON.stringify(config, null, 2));
        sendEmbed(message.channel, "Logging has been **disabled** for this server.");
    }
});

// -------------------- LOGGING EVENTS -------------------- //

function getLogChannel(guild) {
    if (!config[guild.id]?.loggingEnabled) return null;
    if (config[guild.id]?.logChannel) return guild.channels.cache.get(config[guild.id].logChannel);
    return guild.channels.cache.find(ch => ch.name === "logs");
}

function sendLogEmbed(channel, description) {
    if (!channel) return;
    const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setDescription(description);
    channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
}

// Member join/leave/nickname/roles
client.on("guildMemberUpdate", (oldMember, newMember) => {
    const logChannel = getLogChannel(newMember.guild);
    if (!logChannel) return;

    if (oldMember.nickname !== newMember.nickname) {
        sendLogEmbed(logChannel, `Nickname changed: **${oldMember.user.tag}**
Before: ${oldMember.nickname || "None"}
After: ${newMember.nickname || "None"}`);
    }

    if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
        const oldRoles = oldMember.roles.cache.map(r => r.name).join(", ") || "None";
        const newRoles = newMember.roles.cache.map(r => r.name).join(", ") || "None";
        sendLogEmbed(logChannel, `Roles updated for **${oldMember.user.tag}**
Before: ${oldRoles}
After: ${newRoles}`);
    }
});

client.on("guildMemberAdd", member => {
    const logChannel = getLogChannel(member.guild);
    if (!logChannel) return;

    const accountAge = Math.floor((Date.now() - member.user.createdAt) / (1000 * 60 * 60 * 24));
    sendLogEmbed(logChannel, `Member Joined: **${member.user.tag}** (Account age: ${accountAge} days)`);
});

client.on("guildMemberRemove", member => {
    const logChannel = getLogChannel(member.guild);
    if (!logChannel) return;

    const roles = member.roles.cache.map(r => r.name).join(", ") || "None";
    const joinedAgo = Math.floor((Date.now() - member.joinedAt) / (1000 * 60 * 60 * 24));
    sendLogEmbed(logChannel, `Member Left: **${member.user.tag}**
Roles: ${roles}
Time in server: ${joinedAgo} days`);
});

// -------------------- MESSAGE LOGGING -------------------- //
client.on("messageDelete", message => {
    if (!message.guild || message.author.bot) return;
    const logChannel = getLogChannel(message.guild);
    if (!logChannel) return;

    sendLogEmbed(logChannel, `Message deleted in ${message.channel}\n\nBy **${message.author.tag}**\nContent: ${message.content || "No content"}`);
});

client.on("messageUpdate", (oldMessage, newMessage) => {
    if (!oldMessage.guild || oldMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return;
    const logChannel = getLogChannel(oldMessage.guild);
    if (!logChannel) return;

    sendLogEmbed(logChannel, `Message edited in ${oldMessage.channel}\n\nBy **${oldMessage.author.tag}**\n\n**Before**:\n${oldMessage.content}\n\n**After**:\n${newMessage.content}`);
});

client.login(process.env.DISCORD_TOKEN);
