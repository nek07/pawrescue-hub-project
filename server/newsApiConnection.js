const api_key = '47bd84681a0a48f580e552a1397e1dfc';
var url = 'https://newsapi.org/v2/everything?' +
          'q=a&' +
          'from=2024-01-29&' +
          'sortBy=popularity&' +
          'apiKey=' + api_key;

let articles = [];

fetch(url)
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    articles = data.articles;
    
  })
  .catch(error => {
    console.error('There was a problem with the fetch operation:', error);
  });
  async function getArrayData() {
    // Simulate some asynchronous operation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const myArray = articles
    return myArray;
  }
  module.exports = getArrayData