require("dotenv").config();
const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, Partials } = require("discord.js");
const fs = require("fs");
const express = require("express");
const ms = require("ms");

const warnsFile = "warns.json";
const logConfigFile = "logs-config.json";

if (!fs.existsSync(warnsFile)) fs.writeFileSync(warnsFile, "{}");
if (!fs.existsSync(logConfigFile)) fs.writeFileSync(logConfigFile, "{}");

let warns = JSON.parse(fs.readFileSync(warnsFile));
let logConfig = JSON.parse(fs.readFileSync(logConfigFile));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// --- Keep-alive Web Server for Render ---
const app = express();
app.get("/", (req, res) => res.send("Xer0 Bot is running!"));
app.listen(3000, () => console.log("Web server running on port 3000"));

// --- Bot Ready Event ---
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "you sleep", type: 3 }], // 3 = WATCHING
    status: "online"
  });
});

// --- Utility: Save Warns ---
function saveWarns() {
  fs.writeFileSync(warnsFile, JSON.stringify(warns, null, 2));
}

// --- Utility: Save Log Config ---
function saveLogConfig() {
  fs.writeFileSync(logConfigFile, JSON.stringify(logConfig, null, 2));
}

// --- Command Handling ---
client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;
  const prefix = "!";
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // --- !say (regular message, no embed) ---
  if (command === "say") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("You don’t have permission.");
    }
    const text = args.join(" ");
    if (!text) return message.reply("Please provide a message.");
    return message.channel.send(text);
  }

  // --- !ping ---
  if (command === "ping") {
    const botPing = client.ws.ping;
    const embed = new EmbedBuilder()
      .setTitle("🏓 Pong!")
      .addFields(
        { name: "Bot Ping", value: `${botPing}ms`, inline: true },
        { name: "Message Ping", value: `${Date.now() - message.createdTimestamp}ms`, inline: true }
      )
      .setColor("Blue");
    return message.reply({ embeds: [embed] });
  }

  // --- !warn ---
  if (command === "warn") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("You don’t have permission.");
    }
    const member = message.mentions.members.first();
    if (!member) return message.reply("Mention a user to warn.");

    if (!warns[member.id]) warns[member.id] = 0;
    warns[member.id]++;
    saveWarns();

    let action = "warned";
    if (warns[member.id] === 5) {
      await member.timeout(10 * 60 * 1000, "5 warns reached");
      action = "muted (5 warns)";
    } else if (warns[member.id] === 10) {
      await member.ban({ reason: "10 warns reached" });
      action = "banned (10 warns)";
    }

    const embed = new EmbedBuilder()
      .setTitle("⚠️ User Warned")
      .setDescription(`${member.user.tag} has been ${action}.`)
      .addFields({ name: "Total Warns", value: `${warns[member.id]}` })
      .setColor("Orange");
    return message.channel.send({ embeds: [embed] });
  }

  // --- !setlogchannel ---
  if (command === "setlogchannel") {
    if (message.author.id !== message.guild.ownerId) {
      return message.reply("Only the server owner can set the log channel.");
    }
    let channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
    if (!channel) return message.reply("Please provide a valid channel mention or ID.");
    logConfig[message.guild.id] = channel.id;
    saveLogConfig();
    return message.channel.send({ embeds: [new EmbedBuilder().setDescription(`Log channel set to ${channel}`).setColor("Green")] });
  }

  // --- !clearlchannel ---
  if (command === "clearlchannel") {
    if (message.author.id !== message.guild.ownerId) {
      return message.reply("Only the server owner can clear the log channel.");
    }
    delete logConfig[message.guild.id];
    saveLogConfig();
    return message.channel.send({ embeds: [new EmbedBuilder().setDescription("Log channel cleared.").setColor("Red")] });
  }
});

// --- Logging Events ---
function sendLog(guild, embed) {
  const channelId = logConfig[guild.id];
  if (!channelId) return;
  const logChannel = guild.channels.cache.get(channelId);
  if (logChannel) logChannel.send({ embeds: [embed] }).catch(() => {});
}

client.on("guildMemberUpdate", (oldMember, newMember) => {
  if (!oldMember || !newMember) return;

  // Nickname change
  if (oldMember.nickname !== newMember.nickname) {
    const embed = new EmbedBuilder()
      .setTitle("Nickname Changed")
      .setDescription(`${newMember.user.tag}`)
      .addFields(
        { name: "Before", value: oldMember.nickname || "None" },
        { name: "After", value: newMember.nickname || "None" }
      )
      .setColor("Yellow");
    sendLog(newMember.guild, embed);
  }

  // Role changes (no @everyone pings)
  const oldRoles = oldMember.roles.cache.map(r => r.name).join(", ") || "None";
  const newRoles = newMember.roles.cache.map(r => r.name).join(", ") || "None";
  if (oldRoles !== newRoles) {
    const embed = new EmbedBuilder()
      .setTitle("Roles Updated")
      .setDescription(`${newMember.user.tag}`)
      .addFields(
        { name: "Before", value: oldRoles },
        { name: "After", value: newRoles }
      )
      .setColor("Blue");
    sendLog(newMember.guild, embed);
  }
});

client.on("guildMemberAdd", member => {
  const accountAge = Math.floor((Date.now() - member.user.createdAt) / (1000 * 60 * 60 * 24));
  const embed = new EmbedBuilder()
    .setTitle("Member Joined")
    .setDescription(`${member.user.tag}`)
    .addFields({ name: "Account Age", value: `${accountAge} days` })
    .setColor("Green");
  sendLog(member.guild, embed);
});

client.on("guildMemberRemove", member => {
  const joinedAgo = Math.floor((Date.now() - member.joinedAt) / (1000 * 60 * 60 * 24));
  const roles = member.roles.cache.map(r => r.name).join(", ") || "None";
  const embed = new EmbedBuilder()
    .setTitle("Member Left")
    .setDescription(`${member.user.tag}`)
    .addFields(
      { name: "Roles", value: roles },
      { name: "Joined", value: `${joinedAgo} days ago` }
    )
    .setColor("Red");
  sendLog(member.guild, embed);
});

client.on("messageDelete", async msg => {
  if (!msg.guild || msg.partial) return;
  const embed = new EmbedBuilder()
    .setTitle("Message Deleted")
    .setDescription(`Message deleted in ${msg.channel}`)
    .addFields(
      { name: "By", value: `**${msg.author.tag}**` },
      { name: "Content", value: msg.content || "None" }
    )
    .setColor("Red");
  sendLog(msg.guild, embed);
});

client.on("messageUpdate", async (oldMsg, newMsg) => {
  if (!newMsg.guild || oldMsg.partial) return;
  if (oldMsg.content === newMsg.content) return;
  const embed = new EmbedBuilder()
    .setTitle(`Message edited in ${newMsg.channel}`)
    .setDescription(`By **${newMsg.author.tag}**`)
    .addFields(
      { name: "Before", value: oldMsg.content || "None" },
      { name: "After", value: newMsg.content || "None" }
    )
    .setColor("Orange");
  sendLog(newMsg.guild, embed);
});

client.login(process.env.DISCORD_TOKEN);
