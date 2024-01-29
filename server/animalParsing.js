const url = 'https://api.thecatapi.com/v1/images/search?limit=20';
const api_key = 'live_CTtG51AGnthENW1WwznIxe1T1uRmeHwi6Vmk8Wq5GE40hABZO1Bi1nZe6PxlLUSPY';

const fetchData = async () => {
  try {
    const response = await fetch(url, {
      headers: {
        'x-api-key': api_key,
      },
      timeout: 5000, // Set a timeout of 5 seconds (adjust as needed)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error('Error fetching data:', error.message);
  }
};

fetchData();
