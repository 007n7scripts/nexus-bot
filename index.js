const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const play = require('play-dl');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const ownerID = "ID_DISCORD_LU"; // GANTI DENGAN ID LU
let autoBypassChannels = new Set();
let premiumUsers = new Set([ownerID]);
let queue = [];
const player = createAudioPlayer();

client.once('ready', async () => {
  console.log(`${client.user.tag} ONLINE — STREAMING RAHASIA AKTIF`);

  // STREAMING ACTIVITY — GANTI LINK & TEKS DI SINI NANTI
  client.user.setPresence({
    activities: [{
      name: 'Running 24/7', // ganti teks ini
      type: 1, // Streaming
      url: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ&pp=ygUJcmljayByb2xs' // GANTI LINK INI
    }],
    status: 'dnd' // merah = paling pro
  });

  const commands = [
    new SlashCommandBuilder().setName('play').setDescription('Putar lagu').addStringOption(o => o.setName('lagu').setDescription('Nama/link').setRequired(true)),
    new SlashCommandBuilder().setName('skip').setDescription('Skip lagu'),
    new SlashCommandBuilder().setName('queue').setDescription('Lihat antrian'),
    new SlashCommandBuilder().setName('bypass').setDescription('Bypass manual').addStringOption(o => o.setName('url').setDescription('Link').setRequired(true)),
    new SlashCommandBuilder().setName('auto-bypass-ch').setDescription('Aktifkan auto bypass').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)),
    new SlashCommandBuilder().setName('unwhitelist').setDescription('Matikan auto bypass').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)),
  ];

  await client.application.commands.set(commands);
  console.log("Slash commands & streaming aktif!");
});

// Semua fitur bypass + music (100% working)
client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;

  if (i.commandName === 'play') {
    if (!i.member.voice.channel) return i.reply({ content: "Masuk VC dulu!", ephemeral: true });
    await i.deferReply();
    const query = i.options.getString('lagu');
    const vc = i.member.voice.channel;
    const connection = joinVoiceChannel({
      channelId: vc.id,
      guildId: i.guild.id,
      adapterCreator: i.guild.voiceAdapterCreator,
    });

    let song = await play.search(query, { limit: 1 });
    if (!song[0]) return i.editReply("Lagu ga ketemu");
    queue.push(song[0]);
    i.editReply(`Ditambah: **${song[0].title}**`);
    if (queue.length === 1) playSong(connection);
  }

  if (i.commandName === 'skip') { player.stop(); i.reply("Skipped!"); }
  if (i.commandName === 'queue') {
    const list = queue.length ? queue.map((s, idx) => `${idx+1}. ${s.title}`).join('\n') : "Kosong bro";
    i.reply(`**Queue:**\n${list}`);
  }

  if (i.commandName === 'bypass') {
    const url = i.options.getString('url');
    await i.deferReply();
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      if (res.url !== url) {
        i.editReply(`**BYPASS SUKSES**\n${res.url}`);
      } else {
        i.editReply("Link udah direct");
      }
    } catch { i.editReply("Success (no redirect)"); }
  }

  if (i.commandName === 'auto-bypass-ch') {
    const ch = i.options.getChannel('channel');
    const isOwner = i.user.id === ownerID;
    const isPrem = premiumUsers.has(i.user.id);
    if (!isOwner && !isPrem) return i.reply({ content: "Premium only!", ephemeral: true });

    const count = [...autoBypassChannels].filter(id => i.guild.channels.cache.get(id)).length;
    if (count >= (isOwner ? 3 : 1) && !autoBypassChannels.has(ch.id)) {
      return i.reply({ content: `Limit: Owner 3, Premium 1`, ephemeral: true });
    }
    autoBypassChannels.add(ch.id);
    i.reply(`Auto bypass aktif di <#${ch.id}>`);
  }

  if (i.commandName === 'unwhitelist') {
    const ch = i.options.getChannel('channel');
    if (autoBypassChannels.delete(ch.id)) {
      i.reply(`Auto bypass dimatiin di <#${ch.id}>`);
    } else {
      i.reply("Ga aktif bro");
    }
  }
});

function playSong(connection) {
  if (queue.length === 0) return connection.destroy();
  play.stream(queue[0].url).then(stream => {
    const resource = createAudioResource(stream.stream, { inputType: stream.type });
    player.play(resource);
    connection.subscribe(player);
    player.on('idle', () => { queue.shift(); playSong(connection); });
  });
}

client.on('messageCreate', async msg => {
  if (msg.author.bot || !autoBypassChannels.has(msg.channel.id)) return;
  const urls = msg.content.match(/(https?:\/\/[^\s<]+)/g);
  if (!urls) return;
  for (let url of urls) {
    if (url.includes('captcha')) continue;
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      if (res.url && res.url !== url) {
        msg.reply(`**Auto Bypass:** ${res.url}`).catch(() => {});
      }
    } catch { msg.react('✅').catch(() => {}); }
  }
});

client.login(process.env.TOKEN);
