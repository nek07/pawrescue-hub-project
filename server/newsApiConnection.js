// const fs = require('fs').promises; // Import fs.promises for async operations

// const api_key = '47bd84681a0a48f580e552a1397e1dfc';
// const url = 'https://newsapi.org/v2/everything?' +
//     'q=Pets&' +
//     'from=2024-02-10&' +
//     'sortBy=popularity&' +
//     'apiKey=' + api_key;

// let articles = [];
// let fullArticle = []

// fetch(url)
//     .then(response => {
//         if (!response.ok) {
//             throw new Error('Network response was not ok');
//         }
//         return response.json();
//     })
//     .then(async (data) => {
//         articles = data.articles;


//         for (let i = 0; i < articles.length; i++) {
//             const object = articles[i]; // Access each object

//             if (object.urlToImage === null) {
//                 object.urlToImage = 'https://awlights.com/wp-content/uploads/sites/31/2017/05/placeholder-news.jpg';
//             }
//             fullArticle.push(object);
//         }
//         const jsonContent = JSON.stringify(fullArticle, null, 2);

//         try {
//             // Use fs.promises.writeFile to make it async
//             await fs.writeFile('articles1.json', jsonContent);
//             console.log('Data has been written to articles.json');
//         } catch (error) {
//             console.error('Error writing to file:', error);
//         }
//     })
//     .catch(error => {
//         console.error('There was a problem with the fetch operation:', error);
//     });


