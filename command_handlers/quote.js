const Discord = require("discord.js");
const fetch = require('node-fetch');

exports.quote = () => {
    return fetch('https://animechan.vercel.app/api/random')
        .then(response => response.json())
        .then(quote => new Discord.MessageEmbed()
            .setColor('#f1c40f')
            .setDescription(quote.quote)
            .setFooter(`${quote.character} · ${quote.anime}`))
};