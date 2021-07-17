const fetch = require('node-fetch');

exports.quote = () => {
    return fetch('https://animechan.vercel.app/api/random')
        .then(response => response.json())
        .then(quote => quote.quote + '\n-' + quote.character + ' (' + quote.anime + ')');
};