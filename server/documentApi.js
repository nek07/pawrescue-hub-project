const api_key = '47bd84681a0a48f580e552a1397e1dfc';

var url = 'https://newsapi.org/v2/everything?' +
          'q=a&' +
          'from=2024-01-29&' +
          'sortBy=popularity&' +
          'apiKey=' + api_key;

var arr = [];

fetch(url)
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
        // Check if data.articles is defined
        if (data.articles) {
            const articles = data.articles;

            articles.forEach(function(article, index) {
                console.log(`Article ${index + 1}:`);
                console.log(`Title: ${article.title}`);
                console.log(`Description: ${article.description}`);
                console.log(`Content: ${article.content}`);
                console.log('---');
            });
        } else {
            console.error('No articles found in the response.');
        }
    })
    .catch(function(error) {
        // Handle errors here
        console.error('Error fetching data:', error);
    });
